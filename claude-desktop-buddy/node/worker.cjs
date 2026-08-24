'use strict';

/**
 * Claude Desktop Buddy — 硬件连接 worker。
 *
 * 通过 BLE Nordic UART Service 连接 Claude Desktop Buddy / FoloToy AI Passport 硬件，
 * 以换行分隔 JSON 收发。运行在随包 Node 进程中，拥有本机权限，可访问系统蓝牙。
 *
 * BLE 实现：webbluetooth（Web Bluetooth 规范 API，SimpleBLE 后端，自带 prebuilds 预编译
 * 二进制，Windows 走系统蓝牙栈，无需 node-gyp/VS 编译）。加载失败时回退"无硬件测试模式"
 * （协议/状态映射/面板仍可用，只是不连真实 BLE）。
 */

const readline = require('node:readline');

// ---- Nordic UART Service 常量（见 claude-desktop-buddy REFERENCE.md）----
const NUS_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const NUS_RX_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'; // desktop -> device, write
const NUS_TX_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'; // device -> desktop, notify
const SCAN_MS = 10000; // 扫描窗口
const DEFAULT_NAME_PREFIX = 'Claude';

// ---- 运行时状态 ----
const state = {
  wb: null,             // 加载到的 webbluetooth 模块
  wbLoaded: false,      // 是否尝试过加载
  wbError: null,        // 加载失败的原因
  bluetooth: null,      // bluetooth 单例
  connected: false,     // 是否已连到硬件
  deviceName: null,     // 硬件广播名
  deviceId: null,       // 硬件 device id
  gattServer: null,     // gatt server
  device: null,         // 持有所连 device 引用（防 GC 回收断连）
  rxChar: null,         // RX（desktop->device）写特征
  txChar: null,         // TX（device->desktop）通知特征
  txQueue: [],          // 待发送的 JSON 行（串行）
  txInFlight: false,
  parseBuffer: '',      // device->desktop 行封帧缓冲
  lastTxStatus: null,
  lastMessage: null,
  pendingId: null,      // 正在处理的 buddy.connect 请求 id
  pendingPrefix: null,  // 正在匹配的设备名前缀
  pendingMac: null,     // 正在匹配的设备 MAC（Windows 上读不到名字时用）
  scanTimer: null,      // 扫描超时定时器
};

// ---- 结构化回复工具 ----
function reply(id, result, error) {
  const message = { jsonrpc: '2.0', id: id ?? null };
  if (error) message.error = error;
  else message.result = result ?? {};
  process.stdout.write(JSON.stringify(message) + '\n');
}
function ok(id, result) { reply(id, result); }
function fail(id, code, message) { reply(id, null, { code, message: String(message) }); }

// 主动推送事件给 main.js：JSON-RPC notification（无 id，带 method）。
function notifyEvent(method, params) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', method, params: params || {} }) + '\n');
}

// ---- 日志走 stderr（协议只走 stdout）----
function log() {
  process.stderr.write('[buddy-worker] ' + Array.prototype.slice.call(arguments).join(' ') + '\n');
}

// ---- 尝试加载 webbluetooth（vendored，自带 prebuilds；失败回退测试模式）----
const VENDOR_WB = require('node:path').join(__dirname, 'vendor', 'webbluetooth', 'dist', 'index.js');
function loadWb() {
  if (state.wbLoaded) return state.wb && state.bluetooth;
  state.wbLoaded = true;
  try {
    const wb = require(VENDOR_WB);
    state.wb = wb;
    state.bluetooth = wb.bluetooth;
    state.wbError = null;
    // 挂载 deviceFound 回调：无 UI 自动选设备。
    // 匹配依据 = 广播的 NUS service（requestDevice 的 filters 已保证只有广播 NUS 的设备
    // 才会触发本回调）。Windows 蓝牙栈读不到设备广播名（device.name 常是 Unknown），
    // 但 NUS service UUID 在广播里稳定可读——这是最可靠的匹配，不依赖名字、不写死 MAC。
    // 设备名仅作展示；读不到时回落 device.id（MAC）。
    wb.bluetooth.deviceFound = function (device, selectFn) {
      // 二次约束（可选）：mac / 名字前缀。默认不设则只按 NUS service 匹配。
      const devMac = String(device.id || '').toLowerCase().replace(/[\s:]/g, '');
      if (state.pendingMac) {
        const tMac = String(state.pendingMac).toLowerCase().replace(/[\s:]/g, '');
        if (devMac !== tMac) return false; // mac 不匹配则继续等
      }
      if (state.pendingPrefix) {
        const name = device.name || '';
        if (name.indexOf(state.pendingPrefix) !== 0) return false; // 名字前缀不匹配则继续等
      }
      log('deviceFound (NUS):', device.id, device.name);
      beginConnect(device);
      return true; // 选中：requestDevice 会 resolve；连接在 beginConnect 里进行
    };
    function beginConnect(device) {
      if (state.scanTimer) { clearTimeout(state.scanTimer); state.scanTimer = null; }
      state.pendingPrefix = null;
      state.pendingMac = null;
      const id = state.pendingId;
      setTimeout(function () { connectDevice(device, id); }, 0);
    }
    log('loaded webbluetooth:', VENDOR_WB);
    return state.bluetooth;
  } catch (e) {
    state.wbError = e.message || String(e);
    log('webbluetooth unavailable, test mode only:', state.wbError);
    return null;
  }
}

// ---- NUS 服务 UUID 过滤 + 自动选设备（deviceFound 回调，无 UI）----
function ensureBluetooth() {
  const bt = loadWb();
  if (!bt) {
    fail(null, 'BLE_UNAVAILABLE', 'webbluetooth 库不可用（' + (state.wbError || '未加载') + '）。可切换到无硬件测试模式。');
    return null;
  }
  return bt;
}

// ---- BLE 扫描 + 连接（webbluetooth requestDevice + deviceFound 回调）----
// opts: { namePrefix?: string, mac?: string }。主匹配依据 = 广播的 NUS service（最可靠，
// 不依赖名字、不写死 MAC）；namePrefix / mac 作为可选二次约束。
function startScan(bt, opts, id) {
  const namePrefix = (opts && opts.namePrefix) || null;
  const mac = (opts && opts.mac) || null;
  log('scanning for NUS service', mac ? '(mac ' + mac + ')' : (namePrefix ? '(prefix ' + namePrefix + ')' : ''));

  state.pendingId = id;
  state.pendingPrefix = namePrefix;
  state.pendingMac = mac;

  // webbluetooth 的 requestDevice 在"找不到设备"时不会 settle（内部 cancel 也不 reject），
  // 所以由我们自己在 SCAN_MS 后自主超时并回复，不依赖 requestDevice 的 promise。
  if (state.scanTimer) clearTimeout(state.scanTimer);
  state.scanTimer = setTimeout(function () {
    const pid = state.pendingId;
    state.pendingId = null;
    state.pendingPrefix = null;
    state.pendingMac = null;
    try { bt.cancelRequest(); } catch (e) {}
    log('scan timeout, no NUS device');
    if (pid != null) {
      fail(pid, 'NOT_FOUND', '未找到广播 Nordic UART(NUS) 服务的设备。请确认硬件已开机、在蓝牙范围内且蓝牙已开启。');
    }
  }, SCAN_MS);

  bt.scanTime = SCAN_MS;
  // 用 NUS service filter：webbluetooth 只会对广播 NUS service 的设备回调 deviceFound。
  // 这是对 Claude Buddy 硬件最精准的匹配（不会误连其它 BLE 设备）。
  bt.requestDevice({ filters: [{ services: [NUS_SERVICE_UUID] }] })
    .then(function (device) {
      // deviceFound 回调中已选中并连接；这里兜底。
      log('requestDevice resolved:', device.id, device.name);
    })
    .catch(function (err) {
      log('requestDevice err:', err);
    });
}

// ---- 连接已完成（requestDevice resolve 出设备）----
async function connectDevice(device, id) {
  try {
    log('connecting gatt:', device.id, device.name);
    const server = await device.gatt.connect();
    state.gattServer = server;
    state.deviceId = device.id;
    state.device = device; // 持有引用，防止 GC 回收导致断连

    const service = await server.getPrimaryService(NUS_SERVICE_UUID);
    const rx = await service.getCharacteristic(NUS_RX_UUID);
    const tx = await service.getCharacteristic(NUS_TX_UUID);

    state.rxChar = rx;
    state.txChar = tx;
    state.connected = true;
    state.deviceName = device.name || device.id;

    // 订阅 TX 通知（设备 -> 主机）
    tx.oncharacteristicvaluechanged = onDeviceData;
    await tx.startNotifications();

    // 监听 GATT 断开：主动通知 main.js，并复位连接状态。
    // （关键：连接后必须挂此监听，否则断开无感知、状态残留）
    device.ongattserverdisconnected = function (e) {
      log('gatt disconnected:', device.id, e && e.message);
      state.connected = false;
      state.rxChar = null;
      state.txChar = null;
      state.gattServer = null;
      notifyEvent('device_event', { status: 'disconnected', reason: (e && e.message) || 'gatt disconnected' });
    };

    log('connected:', state.deviceName);
    if (state.scanTimer) { clearTimeout(state.scanTimer); state.scanTimer = null; }
    ok(id, { status: 'connected', name: state.deviceName, id: state.deviceId });
    state.pendingId = null;
    // 连接建立后，主机侧自动推送心跳，见 main.js
  } catch (err) {
    log('connect failed:', err.message || err);
    state.connected = false;
    state.rxChar = null;
    state.txChar = null;
    const pid = state.pendingId;
    state.pendingId = null;
    if (pid != null) fail(pid, 'CONNECT_FAILED', '连接失败：' + (err.message || err));
  }
}

// 设备通知数据处理（TX characteristic value changed）
function onDeviceData(ev) {
  const dv = ev.target?.value;
  let chunk = '';
  if (dv) {
    const bytes = new Uint8Array(dv.buffer, dv.byteOffset || 0, dv.byteLength || dv.buffer.byteLength);
    chunk = Buffer.from(bytes).toString('utf8');
  }
  if (!chunk) return;
  state.parseBuffer += chunk;
  let idx;
  while ((idx = state.parseBuffer.indexOf('\n')) >= 0) {
    const line = state.parseBuffer.slice(0, idx);
    state.parseBuffer = state.parseBuffer.slice(idx + 1);
    if (!line.trim()) continue;
    let parsed;
    try { parsed = JSON.parse(line); } catch (e) { parsed = null; }
    state.lastMessage = parsed;
    log('device->host:', line);
    notifyEvent('device_line', { line: line, parsed: parsed });
  }
}

// ---- 发送 JSON 行（串行 + 分片，经 RX writeValueWithResponse）----
// BLE ATT 单次 write 有 MTU 上限：macOS CoreBluetooth（经 SimpleBLE 的
// writeRequest）对超过协商 MTU 的整包写入报 CBATTError Code=13
// "value's length is invalid"（Windows 蓝牙栈自动处理长写入，无此问题）。
// 协议本身是"换行分隔 UTF-8 JSON"，接收端按字节流累积、遇到 \n 才切一条
// 完整 JSON——所以发送端只需把 payload 按 CHUNK_BYTES 切成多段串行写出，
// 段间不插入任何字节，硬件收到的仍是完整字节流，在 \n 处解析，完全透明。
const CHUNK_BYTES = 180; // 分片上限（字节），留足 ATT 头余量，避开 macOS MTU

function enqueueTx(line) {
  state.txQueue.push(line);
  if (!state.txInFlight) flushTx();
}

function writeChunk(buf) {
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  // 关键：用 writeValueWithResponse（带响应写）而非 writeValueWithoutResponse（fire-and-forget）。
  // 实测：writeWithoutResponse 在加密/握手阶段不可靠，硬件可能收不到（停在 WAITING FOR CLAUDE）；
  // writeValueWithResponse 走 ATT write request，硬件真实接收并加密校验通过。
  if (typeof state.rxChar.writeValueWithResponse === 'function') {
    return state.rxChar.writeValueWithResponse(ab);
  }
  return state.rxChar.writeValueWithoutResponse(ab);
}

function flushTx() {
  if (state.txInFlight || !state.txQueue.length) return;
  if (!state.connected || !state.rxChar) {
    state.txQueue = [];
    notifyEvent('tx_error', { message: 'not connected' });
    return;
  }
  state.txInFlight = true;
  const line = state.txQueue.shift();
  const payload = Buffer.from(line + '\n', 'utf8');
  // 把整条 payload 切成 ≤CHUNK_BYTES 的字节段，串行写完整段才推进下一条。
  const chunks = [];
  for (let i = 0; i < payload.length; i += CHUNK_BYTES) {
    chunks.push(payload.subarray(i, Math.min(i + CHUNK_BYTES, payload.length)));
  }
  const writeNext = function (index) {
    if (index >= chunks.length) {
      state.lastTxStatus = line;
      log('host->device:', line.length, 'bytes', 'in', chunks.length, 'chunk(s)');
      state.txInFlight = false;
      flushTx();
      return;
    }
    writeChunk(chunks[index]).then(
      function () { writeNext(index + 1); },
      function (err) {
        state.txInFlight = false;
        log('tx failed:', err.message || err, '(chunk', (index + 1) + '/' + chunks.length + ')');
        notifyEvent('tx_error', { message: err.message || String(err) });
        flushTx();
      },
    );
  };
  writeNext(0);
}

// ---- 模拟设备（用于无硬件测试/回传）----
function simulateDeviceLine(line) {
  let parsed = null;
  try { parsed = JSON.parse(line); } catch (e) {}
  state.lastMessage = state.lastMessage || {};
  state.lastMessage.parsed = parsed;
  log('sim device->host:', line);
  notifyEvent('device_line', { line: line, parsed: parsed, simulated: true });
}

// ---- JSON-RPC 分发 ----
readline.createInterface({ input: process.stdin }).on('line', function (line) {
  let request;
  try { request = JSON.parse(line); } catch {
    reply(null, null, { code: -32700, message: 'Parse error' });
    return;
  }
  const id = request.id ?? null;
  const method = request.method;
  const params = request.params || {};

  try {
    switch (method) {
      case 'devices.list': {
        loadWb();
        const wb = state.wb;
        let adapters = null;
        if (wb && typeof wb.getAdapters === 'function') {
          try { adapters = wb.getAdapters(); } catch (e) {}
        }
        return ok(id, { webbluetoothAvailable: !!wb, wbError: state.wbError, connected: state.connected, adapters });
      }

      case 'buddy.connect': {
        // 通用连接：主匹配 = 广播 NUS service；namePrefix / mac 可选收紧
        const bt = ensureBluetooth();
        if (bt) {
          startScan(bt, { namePrefix: params.name_prefix || null, mac: params.mac || null }, id);
        }
        return;
      }

      case 'buddy.mac_connect': {
        // 按 MAC 连接（可选的收紧方式）；仍以 NUS service 为主匹配，只是额外限 MAC
        const bt = ensureBluetooth();
        if (bt) {
          const mac = params.mac || params.name_prefix || null;
          if (!mac) return fail(id, 'INVALID_PARAMS', 'buddy.mac_connect 需要 mac 参数');
          startScan(bt, { namePrefix: null, mac }, id);
        }
        return;
      }

      case 'buddy.disconnect': {
        if (state.scanTimer) { clearTimeout(state.scanTimer); state.scanTimer = null; }
        if (state.wb?.bluetooth) { try { state.wb.bluetooth.cancelRequest(); } catch (e) {} }
        try {
          if (state.gattServer) state.gattServer.disconnect();
          else if (state.device && state.device.gatt) state.device.gatt.disconnect();
        } catch (e) {}
        state.connected = false;
        state.rxChar = null;
        state.txChar = null;
        state.gattServer = null;
        state.device = null;
        state.txQueue = [];
        state.pendingId = null;
        return ok(id, { status: 'disconnected' });
      }

      case 'buddy.send': {
        let jsonLine;
        if (typeof params.json === 'string') jsonLine = params.json;
        else if (params.payload && typeof params.payload === 'object') jsonLine = JSON.stringify(params.payload);
        else jsonLine = String(params.json || params.payload || '');
        if (!jsonLine) return fail(id, 'INVALID_PARAMS', 'buddy.send 需要 json 或 payload');
        if (!state.connected || !state.rxChar) {
          return ok(id, { queued: false, reason: 'not_connected', bytes: Buffer.byteLength(jsonLine) });
        }
        enqueueTx(jsonLine);
        return ok(id, { queued: true, bytes: Buffer.byteLength(jsonLine) });
      }

      case 'status':
        return ok(id, {
          connected: state.connected,
          deviceName: state.deviceName,
          deviceId: state.deviceId,
          lastTxStatus: state.lastTxStatus,
          lastMessage: state.lastMessage,
          wbAvailable: !!state.bluetooth,
          wbError: state.wbError,
        });

      case 'simulate_device_line':
        return simulateDeviceLine(params.line);

      default:
        return fail(id, -32601, 'Method not found: ' + method);
    }
  } catch (err) {
    log('dispatch error:', err.message);
    return fail(id, -32603, err.message || String(err));
  }
});
