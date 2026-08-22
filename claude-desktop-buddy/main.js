/**
 * Claude Desktop Buddy — 插件电子脑（浏览器沙箱）。
 *
 * 职责：
 *  1. subscribe 旁听 Cindy 主会话事件（turn/activity/session），聚合出硬件 heartbeat
 *     需要的 total/running/waiting/tokens/prompt 快照。
 *  2. 通过 node worker（BLE）把 heartbeat 推送给 Claude Desktop Buddy 硬件。
 *  3. 维护本地面板状态（不依赖硬件也可用）。
 *  4. 处理 AI 工具调用（buddy_status / buddy_connect / buddy_disconnect）。
 *
 * 边界：沙箱本身零直连、零文件。所有硬件读写都经 cindy.node.request 转发给 worker。
 */

// 会话聚合状态
const sessions = {};       // sessionId -> { running, waiting: Set<requestId>, thinking, label }
const counters = {
  tokens: 0,
  tokensToday: 0,
  running: 0,
  waiting: 0,
  total: 0,
};
const APPROVAL_STATE = { active: false, requestId: null, tool: null, hint: null };
let pendingHeartbeat = null;   // 最近一次 heartbeat（用于工具查询/面板）
let hwConnected = false;
let hwDeviceName = null;
let hwMac = null;              // 硬件 MAC 地址（可选收紧条件；Windows 上名字读不到时用）
let lastTx = null;             // 最近一次成功推送给硬件的心跳（诊断/展示）
let hwStatus = null;           // 硬件 status 报告（{name,sec,bat,sys,stats}），从硬件回传解析
let lastAck = null;            // 最近一次硬件的命令 ack

// ---- 小工具：安全 JSON、时间 ----
function now() {
  return Date.now();
}
function clampTokenDelta(value, max) {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.min(n, max));
}

// ---- 会话状态机 ----
function ensureSession(sessionId, label) {
  if (!sessions[sessionId]) {
    sessions[sessionId] = {
      running: false,
      waiting: new Set(),
      thinking: false,
      label: label || tail(sessionId),
      lastActivity: now(),
      completedTurns: 0,
    };
  }
  return sessions[sessionId];
}

function tail(str) {
  if (!str) return '';
  const s = String(str);
  const parts = s.split(/[\\/]/);
  return parts[parts.length - 1] || s;
}

function recompute() {
  let total = 0, running = 0, waiting = 0;
  let activeApproval = null;
  for (const id in sessions) {
    const s = sessions[id];
    total += 1;
    if (s.running) running += 1;
    if (s.waiting.size > 0) waiting += 1;
    if (s.waiting.size > 0 && !activeApproval) {
      // 取最早一个等待的审批信息
      const reqId = Array.from(s.waiting)[0];
      activeApproval = { sessionId: id, requestId: reqId, tool: s.tool || null, hint: s.hint || null };
    }
  }
  counters.total = total;
  counters.running = running;
  counters.waiting = waiting;
  APPROVAL_STATE.active = !!activeApproval;
  APPROVAL_STATE.requestId = activeApproval ? activeApproval.requestId : null;
  APPROVAL_STATE.tool = activeApproval ? activeApproval.tool : null;
  APPROVAL_STATE.hint = activeApproval ? activeApproval.hint : null;
  APPROVAL_STATE.sessionId = activeApproval ? activeApproval.sessionId : null;
  return activeApproval;
}

// ---- 生成 heartbeat 快照（发给硬件）----
function buildHeartbeat() {
  const active = recompute();
  const total = counters.total;
  const running = counters.running;
  const waiting = counters.waiting;

  let msg;
  const toolName = (APPROVAL_STATE.tool || '').trim();
  // 硬件是 ASCII 像素屏，不支持中文/UTF-8 多字节——占位一律用英文，否则乱码。
  if (waiting > 0) msg = 'approve: ' + (toolName || 'need approval');
  else if (running > 0) msg = running + ' session' + (running > 1 ? 's' : '') + ' working';
  else if (total > 0) msg = total + ' session' + (total > 1 ? 's' : '') + ' ready';
  else msg = 'no session';

  const hb = {
    total: total,
    running: running,
    waiting: waiting,
    msg: msg,
    entries: recentEntries(4),
    tokens: counters.tokens,
    tokens_today: counters.tokensToday,
  };
  if (active) {
    // 硬件端 buddy_parse_prompt 要求 tool/hint 非空，否则 heartbeat 解析失败/界面空白。
    // 而 Cindy subscribe 的 did-approval-* 不提供工具名/参数，这里拿不到真实值——
    // 用非空占位文案，保证硬件审批界面不空白、且用户知道要去 Cindy 处理。
    const tool = (active.tool || '').trim();
    const hint = (active.hint || '').trim();
    hb.prompt = {
      id: active.requestId || 'pending',
      tool: tool ? tool : 'approval',
      hint: hint ? hint.slice(0, 320) : 'check in Cindy', // 硬件 ASCII 屏，用英文
    };
  }
  pendingHeartbeat = hb;
  return hb;
}

// 最近消息：从会话状态里拿 label + 状态摘要，新->旧，最多 n 条
function recentEntries(n) {
  const list = [];
  for (const id in sessions) {
    const s = sessions[id];
    const tag = s.waiting.size > 0 ? 'waiting' : (s.running ? 'working' : 'idle');
    list.push({ id, at: s.lastActivity, label: s.label, tag });
  }
  list.sort(function (a, b) { return b.at - a.at; });
  return list.slice(0, n).map(function (e) {
    return e.label + ' ' + e.tag;
  });
}

// ---- 推送到硬件（经 node worker）----
async function pushToHardware() {
  const hb = buildHeartbeat();
  // 未连接时也更新面板（面板独立可用）
  notifyPanel({ kind: 'heartbeat', hb });
  // 同步一份到 /kv（供设置页展示）
  writeStatusToKV();
  if (!hwConnected) return;
  try {
    const res = await cindy.node.request({ method: 'buddy.send', params: { json: JSON.stringify(hb) } });
    if (res.ok) {
      lastTx = JSON.stringify(hb);
      writeStatusToKV(); // 回写最近发送内容
    } else {
      notifyPanel({ kind: 'tx_error', message: res.message });
    }
  } catch (e) {
    notifyPanel({ kind: 'tx_error', message: e.message || String(e) });
  }
}

// 解除配对：给硬件发 {"cmd":"unpair"}，硬件弹确认、用户在硬件按键确认后删除绑定断开。
// 供工具(buddy_unpair)与 /kv 命令共用。
async function doUnpair() {
  try {
    const res = await cindy.node.request({ method: 'buddy.send', params: { json: '{"cmd":"unpair"}' } });
    return { ok: !!(res && res.ok), message: (res && res.message) || null };
  } catch (e) {
    return { ok: false, message: e.message || String(e) };
  }
}

// ---- 保活：硬件要求 30s 内存活、每 10s 一条 keepalive ----
let keepaliveTimer = null;
function startKeepalive() {
  if (keepaliveTimer) clearInterval(keepaliveTimer);
  keepaliveTimer = setInterval(function () {
    if (hwConnected) {
      pushToHardware();
    }
  }, 10000);
}

// ---- 归并 subscribe 事件到状态 ----
function onHostEvent(msg) {
  if (msg.type !== 'event') return;
  const name = msg.name;
  const d = msg.data || {};

  // 会话生命周期
  if (name === 'did-session-created') {
    ensureSession(d.sessionId, d.title || d.workdir || tail(d.sessionId));
  } else if (name === 'did-session-archived') {
    delete sessions[d.sessionId];
  } else if (name === 'did-session-switched') {
    // 只是切到台前，不影响计数
    return;
  }

  // 轮次边界
  if (name === 'did-turn-start') {
    const s = ensureSession(d.sessionId);
    s.running = true;
    s.lastActivity = now();
    s.thinking = false;
    if (d.model) s.model = d.model;
  } else if (name === 'did-turn-end') {
    const s = sessions[d.sessionId];
    if (s) {
      s.running = false;
      s.lastActivity = now();
      // 结算 token（usage 字段可选，缺省保守记 0）
      const usage = d.usage;
      if (usage) {
        const add = clampTokenDelta((usage.outputTokens || 0) + (usage.inputTokens || 0) + (usage.cacheReadTokens || 0), 1000000);
        counters.tokens += add;
        counters.tokensToday += add;
      }
      s.completedTurns += 1;
    }
  }

  // 思考边界
  if (name === 'did-thinking-start') {
    const s = ensureSession(d.sessionId);
    s.thinking = true;
  } else if (name === 'did-thinking-end') {
    const s = sessions[d.sessionId];
    if (s) s.thinking = false;
  }

  // 审批边界（等权限）
  if (name === 'did-approval-start') {
    const s = ensureSession(d.sessionId);
    s.waiting.add(d.requestId);
    s.lastActivity = now();
  } else if (name === 'did-approval-end') {
    const s = sessions[d.sessionId];
    if (s) {
      s.waiting.delete(d.requestId);
      s.lastActivity = now();
    }
  }

  // 用户输入边界（ask_user_question 等）
  if (name === 'did-user-input-start') {
    const s = ensureSession(d.sessionId);
    s.waiting.add(d.requestId);
    s.lastActivity = now();
  } else if (name === 'did-user-input-end') {
    const s = sessions[d.sessionId];
    if (s) {
      s.waiting.delete(d.requestId);
      s.lastActivity = now();
    }
  }

  // 事件被丢弃：复位本地派生状态（防止永久卡在 waiting/running）
  if (msg.dropped) {
    for (const id in sessions) {
      const s = sessions[id];
      // 只清等待/运行的"运行中"位，保留会话行
      // （无法确知丢的是哪条，保守做法：不强行清，交给后续事件）
    }
  }

  schedulePush();
}

// ---- 面板通知（BroadcastChannel，与 panel.html 同源通信）----
let panelBroadcast;
function getPanelChannel() {
  if (!panelBroadcast) {
    try { panelBroadcast = new BroadcastChannel('claude-desktop-buddy'); }
    catch (e) { panelBroadcast = null; }
  }
  return panelBroadcast;
}
function notifyPanel(payload) {
  const bc = getPanelChannel();
  if (bc) {
    try { bc.postMessage(payload); } catch (e) {}
  }
  // 面板断连后靠每次心跳从广播恢复；也记录一份供 sync 用
  lastPanelState = payload;
}
let lastPanelState = null;

// ---- 处理设备回传（worker 发来的 node-notification / 结果）----
function onHostNodeEvent(msg) {
  if (msg.type !== 'event') return;
  if (msg.name === 'node-notification') {
    // worker 发的 JSON-RPC notification: { method: '<name>', params: {...} }
    const method = msg.method;
    const params = msg.params || {};
    if (method === 'device_line') {
      // 设备向主机回传：permission / ack / status 等
      handleDeviceLine(params.parsed || params.line);
    } else if (method === 'device_event') {
      if (params.status === 'disconnected') {
        hwConnected = false;
        notifyPanel({ kind: 'hw_status', connected: false });
      }
    } else if (method === 'tx_error') {
      notifyPanel({ kind: 'tx_error', message: params.message });
    }
  }
}

function handleDeviceLine(line) {
  if (!line) return;
  const obj = typeof line === 'object' ? line : (function(){ try { return JSON.parse(line); } catch(e){ return null; } })();
  if (!obj) return;
  let type = 'unknown';
  if (obj.cmd === 'permission') {
    type = 'permission_' + (obj.decision || '');
  } else if (obj.ack) {
    // 命令回执：{"ack":"<cmd>","ok":true/false,"n":0}；status 报告是 {"ack":"status","ok":true,"data":{...}}
    type = 'ack_' + obj.ack;
    lastAck = obj;
    if (obj.ack === 'status' && obj.data) {
      hwStatus = obj.data; // 电量/安全/统计：{name,sec,bat,sys,stats}
      writeStatusToKV(); // 同步到 /kv 供设置页展示
    }
  } else if (obj.status) {
    type = 'status';
  }
  notifyPanel({ kind: 'device_msg', line: obj, type });
}

// 往硬件发一条任意命令（复用 worker 的 buddy.send 通道）
async function sendCommand(obj, callId) {
  const json = typeof obj === 'string' ? obj : JSON.stringify(obj);
  return cindy.node.request({ method: 'buddy.send', params: { json }, callId });
}

// 连接成功后做一次同步：time 校准 + name 设置 + status 请求。
// 这些是 Claude Buddy 协议的命令（主机→硬件），硬件收到后按需回 ack/status。
function sendSyncCommands() {
  // time 校准：{time:[epoch_seconds, timezone_offset_seconds]}
  const epoch = Math.floor(Date.now() / 1000);
  const tzOffset = -new Date().getTimezoneOffset() * 60; // 本地时区偏移（秒）
  sendCommand({ time: [epoch, tzOffset] }).catch(function () {});
  // 设备显示名：用友好名（Claude-<MAC后缀>）
  if (hwDeviceName) sendCommand({ cmd: 'name', name: hwDeviceName }).catch(function () {});
  // 主动请求一次状态报告
  requestStatus();
}

// 请求硬件状态报告（{"cmd":"status"}），硬件回 {"ack":"status","ok":true,"data":{...}}
function requestStatus() {
  if (!hwConnected) return;
  sendCommand({ cmd: 'status' }).catch(function () {});
}

// 周期轮询硬件状态（电量/安全/统计）。30s 一次足够。
let statusPollTimer = null;
function startStatusPoll() {
  if (statusPollTimer) clearInterval(statusPollTimer);
  requestStatus();
  statusPollTimer = setInterval(function () { if (hwConnected) requestStatus(); }, 30000);
}

// ---- 工具处理 ----
async function handleToolCall(msg) {
  const tool = msg.tool;
  const callId = msg.callId;

  if (tool === 'buddy_status') {
    const res = await cindy.node.request({ method: 'status', params: {} });
    const hb = pendingHeartbeat || buildHeartbeat();
    const result = {
      hw_connected: hwConnected,
      device_name: hwDeviceName,
      wb_available: false,
      wb_error: null,
      heartbeat: hb,
      hw_status: hwStatus,   // 硬件 status 报告（电量/安全/统计）
      last_ack: lastAck,      // 最近一次硬件命令 ack
    };
    if (res.ok) {
      result.device_name = res.result.deviceName || hwDeviceName;
      result.hw_connected = hwConnected;
      result.wb_available = !!res.result.wbAvailable;
      result.wb_error = res.result.wbError || null;
      // 最近一次写入硬件的心跳（诊断推送是否成功/内容）
      result.last_tx = res.result.lastTxStatus || null;
      result.last_device_msg = res.result.lastMessage || null;
      result.last_panel_state = lastPanelState; // 最近广播给面板的内容（诊断面板是否收到数据）
      // 读取设置页写入的诊断（定位 settings.js 是否加载/点击/报错）
      try {
        const kv = await (await fetch('/kv')).json();
        result.settings_diag = (kv && kv.diag) || null;
        result.settings_cmd = (kv && kv.cmd) || null;
        result.settings_kv_status = (kv && kv.status) || null; // 设置页看到的连接状态
      } catch (e) { result.settings_diag = { kv_error: String(e.message || e) }; }
    } else {
      result.wb_error = res.message || res.errorCode || null;
    }
    return cindy.send({ type: 'tool-result', callId, ok: true, result });
  }

  if (tool === 'buddy_connect') {
    // name_prefix 可能是纯 MAC 地址（Windows 上名字读不到），自动识别
    const arg = msg.args.name_prefix || msg.args.mac || null;
    const isMac = arg && /^[0-9a-fA-F:]{11,17}$/.test(arg.replace(/[\s-]/g, ':')) && arg.indexOf(':') >= 0;
    return connectHardware(isMac ? { mac: arg } : { prefix: arg || undefined }, callId);
  }

  if (tool === 'buddy_disconnect') {
    const res = await cindy.node.request({ method: 'buddy.disconnect', params: {} });
    hwConnected = false;
    notifyPanel({ kind: 'hw_status', connected: false });
    return cindy.send({ type: 'tool-result', callId, ok: true, result: res.result || { status: 'disconnected' } });
  }

  if (tool === 'buddy_unpair') {
    // 解除配对：发 {"cmd":"unpair"} 给硬件，硬件弹确认、用户在硬件按键确认后删除绑定。
    // 工具链路比设置页按钮更可靠（Cindy 设置页点击事件可能受限）。
    const r = await doUnpair();
    if (r.ok) {
      return cindy.send({ type: 'tool-result', callId, ok: true, result: { sent: true, note: '已发送解除配对请求，请在硬件上按 OK 确认。' } });
    }
    return cindy.send({ type: 'tool-result', callId, ok: false, errorCode: 'UNPAIR_FAILED', message: r.message || '发送解除配对失败' });
  }

  return cindy.send({ type: 'tool-result', callId, ok: false, errorCode: 'UNKNOWN_TOOL', message: '未知工具: ' + tool });
}

// ---- 广播 session 列表给面板 ----
function broadcastSessions() {
  const list = [];
  for (const id in sessions) {
    const s = sessions[id];
    list.push({
      label: s.label,
      tag: s.waiting.size > 0 ? 'waiting' : (s.running ? 'working' : 'idle'),
    });
  }
  list.sort(function (a, b) {
    const rank = function (t) { return t === 'waiting' ? 2 : (t === 'working' ? 1 : 0); };
    return rank(b.tag) - rank(a.tag);
  });
  notifyPanel({ kind: 'sessions', list });
}

// ---- 节流：避免高频事件风暴把 BLE 带宽打满 ----
let hbTimer = null;
function schedulePush() {
  if (hbTimer) return;
  hbTimer = setTimeout(function () {
    hbTimer = null;
    pushToHardware();
    broadcastSessions();
  }, 150); // 150ms 合并窗口
}

// ---- 面板 → 电子脑动作（BroadcastChannel 双端同源）----
function setupPanelChannel() {
  try {
    const bc = getPanelChannel();
    if (!bc) return;
    bc.onmessage = function (e) {
      const msg = e.data;
      if (!msg || typeof msg !== 'object') return;
      // 收到任何面板消息都先回执，证明反向通道通了（面板据此判断电子脑在不在线）
      if (msg.kind === 'panel_action' && (msg.action === 'connect' || msg.action === 'disconnect')) {
        notifyPanel({ kind: 'conn_result', action: msg.action, received: true });
      }
      if (msg.kind === 'panel_action' && msg.action === 'connect') {
        // 面板「连接」：默认按 NUS service 匹配（最可靠）。面板若填了 MAC 则作为收紧条件。
        if (msg.mac) connectHardware({ mac: msg.mac }, null);
        else connectHardware({}, null);
      } else if (msg.kind === 'panel_action' && msg.action === 'disconnect') {
        cindy.node.request({ method: 'buddy.disconnect', params: {} }).then(function () {
          hwConnected = false;
          notifyPanel({ kind: 'hw_status', connected: false });
        }).catch(function () {
          hwConnected = false;
          notifyPanel({ kind: 'hw_status', connected: false });
        });
      } else if (msg.kind === 'panel_sync') {
        broadcastPanelFull();
        // 回执：面板据此确认反向通道通了，停止重发
        if (msg.reqId) notifyPanel({ kind: 'sync_ack', reqId: msg.reqId });
      }
    };
  } catch (e) {}
}

// 友好的设备显示名：优先可读广播名；Windows 常读不到（Unknown），
// 此时若拿到 MAC 则用 Claude-<MAC 后缀>（与硬件广播名格式一致），否则原样回落。
function friendlyDeviceName(name, id) {
  const raw = name || '';
  if (raw && raw.indexOf('Unknown') !== 0) return raw;
  if (id) {
    const mac = String(id).toLowerCase().replace(/[\s:]/g, '');
    if (mac.length >= 6) return 'Claude-' + mac.slice(-6).toUpperCase();
    return id;
  }
  return raw || id || null;
}

// 把 connect 逻辑抽出来供面板 / 工具共用
async function connectHardware(opts, callId) {
  try {
    // opts 统一为 { mac?, prefix? }。主匹配依据 = 广播的 NUS service（worker 用
    // filters 发现，最可靠，不依赖可读的设备名、不写死 MAC）；mac/prefix 为可选收紧。
    const mac = (opts && opts.mac) || null;
    const prefix = (opts && opts.prefix) || null;
    const method = mac ? 'buddy.mac_connect' : 'buddy.connect';
    const params = mac ? { mac } : (prefix ? { name_prefix: prefix } : {});
    const res = await cindy.node.request({ method, params, timeoutMs: 45000 });
    if (res.ok && res.result.status === 'connected') {
      hwConnected = true;
      const id = res.result.id || null;
      hwMac = id || hwMac;
      // 显示名：优先可读广播名；读不到（Windows Unknown）时用 Claude-<MAC后缀> 更友好
      hwDeviceName = friendlyDeviceName(res.result.name, id);
      notifyPanel({ kind: 'hw_status', connected: true, name: hwDeviceName });
      pushToHardware();
      sendSyncCommands();   // 连接后：time 同步 + name + status 请求
      startStatusPoll();    // 轮询请求硬件状态报告
      if (callId) {
        return cindy.send({ type: 'tool-result', callId, ok: true, result: res.result });
      }
      return res.result;
    }
    // res.ok 但不是 connected：可能是扫描中 / 未找到 / BLE 不可用。
    // 暴露真实错误，避免掩盖成"连接中"。
    const failMsg = res.ok
      ? (res.result.reason === 'not_connected' ? '尚未建立蓝牙链路。' : (res.result.message || '连接状态未知'))
      : (res.message || '连接失败');
    const failCode = res.ok ? 'NOT_CONNECTED' : (res.errorCode || 'CONNECT_FAILED');
    notifyPanel({ kind: 'hw_status', connected: false, error: failMsg });
    if (callId) {
      return cindy.send({ type: 'tool-result', callId, ok: false, errorCode: failCode, message: failMsg });
    }
    return { status: 'failed', message: failMsg };
  } catch (e) {
    if (callId) {
      return cindy.send({ type: 'tool-result', callId, ok: false, errorCode: 'CONNECT_FAILED', message: e.message || '连接失败' });
    }
    return null;
  }
}

// ---- 钩子：will-user-message（纯副作用审计，原样放行）----
// 声明了 hooks 就必须在窗口内回 event-verdict；超时主机按 allow 处理。
function onWillUserMessage(msg) {
  // msg.data = { sessionId, text, model? }; msg.hookId 原样带回
  // 本插件只旁听 did- 事件做状态，不改写用户消息，直接 allow。
  cindy.send({ type: 'event-verdict', hookId: msg.hookId, action: 'allow' });
  // 钩子窗口内也可顺手刷新一次面板（放行后继续）
  schedulePush();
}

// ---- 主入口 ----
cindy.onHostMessage(function (msg) {
  if (msg.type === 'tool-call') {
    handleToolCall(msg);
    return;
  }
  if (msg.type === 'event') {
    if (msg.name === 'will-user-message') {
      onWillUserMessage(msg);
      return;
    }
    if (msg.name === 'node-notification' || msg.name === 'node-status') {
      onHostNodeEvent(msg);
      return;
    }
    onHostEvent(msg);
    return;
  }
});

// ---- 启动：建立面板通道 + 周期广播 + 保活定时器 ----
setupPanelChannel();

// 周期任务：无论有无事件、是否连接硬件，都向面板广播全量快照（面板一打开即填充），
// 连接硬件时同时补一条 keepalive 心跳给设备（硬件 30s 无心跳判连接死亡）。
const PANEL_TICK_MS = 2000;
let panelTickTimer = null;
function startPanelTick() {
  if (panelTickTimer) clearInterval(panelTickTimer);
  panelTickTimer = setInterval(function () {
    broadcastPanelFull();
  }, PANEL_TICK_MS);
}

// 全量广播：heartbeat + 会话列表 + 硬件状态
function broadcastPanelFull() {
  const hb = buildHeartbeat();
  notifyPanel({ kind: 'heartbeat', hb });
  broadcastSessions();
  notifyPanel({ kind: 'hw_status', connected: hwConnected, name: hwDeviceName });
}

// 立即广播一次（启动即填充面板），再启动周期
broadcastPanelFull();
startPanelTick();

// ---- /kv 通信：与设置页(settings.html)可靠交互，绕过不可靠的 BroadcastChannel ----
// 设置页写 {cmd:'connect'|'disconnect', mac?, seq}；这里轮询读取并执行，回写状态。
async function kvRead() {
  try { return await (await fetch('/kv')).json(); }
  catch (e) { return {}; }
}
async function kvWrite(patch) {
  try {
    const cur = await kvRead();
    const next = Object.assign({}, cur, patch);
    await fetch('/kv', { method: 'PUT', body: JSON.stringify(next) });
  } catch (e) {}
}
// 把当前状态回写 /kv，供设置页展示
async function writeStatusToKV() {
  const hb = buildHeartbeat();
  // 每次只补状态字段，不动设置页写的 cmd（避免死循环读取）
  const st = {
    connected: hwConnected,
    name: hwDeviceName,
    device_name: hwDeviceName,
    mac: hwMac,
  };
  // hwStatus：硬件 status 报告（电量/安全/统计），供设置页展示电量
  await kvWrite({ status: st, heartbeat: hb, lastTx: lastTx, hwStatus: hwStatus });
}
// 轮询设置页写下的命令
let kvLastCmdSeq = 0;
let kvLoopTimer = null;
let kvConnecting = false; // 防重入：连接进行中不再触发新连接
function startKvLoop() {
  if (kvLoopTimer) clearInterval(kvLoopTimer);
  kvLoopTimer = setInterval(kvTick, 1500);
}
async function kvTick() {
  try {
    const cfg = await kvRead();
    if (cfg && cfg.cmd && cfg.seq && cfg.seq !== kvLastCmdSeq) {
      kvLastCmdSeq = cfg.seq;
      if (cfg.cmd === 'connect') {
        if (kvConnecting) return;
        kvConnecting = true;
        let res;
        try {
          res = await connectHardware(cfg.mac ? { mac: cfg.mac } : {}, null);
        } catch (e) {
          res = { status: 'failed', message: String(e.message || e) };
        } finally {
          kvConnecting = false; // 关键：无论成败都复位，防止永久卡死
        }
        // 按真实结果写回状态
        const cur = await kvRead();
        const connected = !!(res && res.status === 'connected');
        const data = Object.assign({}, cur, {
          cmd: null,
          status: { connected: connected, name: hwDeviceName, device_name: hwDeviceName, mac: hwMac, error: connected ? null : ((res && res.message) || '连接失败') },
        });
        try { await fetch('/kv', { method: 'PUT', body: JSON.stringify(data) }); } catch (e) {}
      } else if (cfg.cmd === 'disconnect') {
        const res = await cindy.node.request({ method: 'buddy.disconnect', params: {} });
        hwConnected = false;
        const cur = await kvRead();
        const data = Object.assign({}, cur, { cmd: null, status: { connected: false } });
        try { await fetch('/kv', { method: 'PUT', body: JSON.stringify(data) }); } catch (e) {}
      } else if (cfg.cmd === 'unpair') {
        await doUnpair();
        const cur = await kvRead();
        const data = Object.assign({}, cur, { cmd: null });
        try { await fetch('/kv', { method: 'PUT', body: JSON.stringify(data) }); } catch (e) {}
      }
    }
  } catch (e) {}
}
startKvLoop();
startKeepalive();
