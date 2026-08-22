// settings.html 极简交互：一个「配对」按钮 + 连接状态点。
// 通过 /kv 与电子脑(main.js)可靠通信（不依赖 BroadcastChannel）。
//
// 带诊断：把脚本加载/按钮绑定/点击/错误写到 /kv.diag，供工具侧回读定位问题。

(function () {
  const $ = (s) => document.querySelector(s);
  const KV = '/kv';

  // ---- 诊断写入：记录脚本运行情况到 /kv.diag ----
  async function diag(patch) {
    try {
      const cur = await (await fetch(KV)).json().catch(function(){ return {}; });
      const next = Object.assign({}, cur, { diag: Object.assign({}, (cur.diag || {}), patch) });
      await fetch(KV, { method: 'PUT', body: JSON.stringify(next) });
    } catch (e) {}
  }
  diag({ scriptLoaded: Date.now() });

  async function readKV() {
    try { return await (await fetch(KV)).json(); }
    catch (e) { return {}; }
  }
  async function writeKV(patch) {
    try {
      const cur = await readKV();
      const next = Object.assign({}, cur, patch);
      await fetch(KV, { method: 'PUT', body: JSON.stringify(next) });
    } catch (e) {}
  }

  var pendingConnect = false; // 点击「配对/重新连接」后置 true，直到连接结果出来才恢复

  // 统一按钮查找：id 可能被宿主剥离/改写，用 getElementById + 兜底（按内容找第一个 button）。
  function findBtn() {
    let b = null;
    try { b = document.getElementById('pairBtn'); } catch (e) {}
    if (!b) { try { b = document.querySelector('button'); } catch (e) {} } // 配对是第一个按钮
    return b;
  }
  function findUnpairBtn() {
    let b = null;
    try { b = document.getElementById('unpairBtn'); } catch (e) {}
    if (!b) { try { b = document.querySelectorAll('button')[1] || null; } catch (e) {} }
    return b;
  }
  function findStatus() {
    return document.getElementById('status') || document.querySelector('.muted');
  }
  function findDot() {
    return document.getElementById('dot') || document.querySelector('.dot');
  }
  function findBattery() {
    return document.getElementById('battery');
  }
  function render(st) {
    const connected = !!(st && st.status && st.status.connected);
    const dot = findDot();
    const status = findStatus();
    const btn = findBtn();
    const battery = findBattery();
    if (dot) dot.className = 'dot ' + (connected ? 'on' : 'off');
    if (status) status.textContent = connected
      ? '已连接' + (st.status.device_name ? ' · ' + st.status.device_name : '')
      : '未连接';
    // 连接后按钮显示「重新连接」且可点（再次触发连接/刷新链路）；未连接显示「配对」。
    // 点击后 pendingConnect 期间保持「连接中…」直到结果，避免被轮询重置。
    if (btn) {
      if (pendingConnect) {
        btn.textContent = '连接中…';
        btn.disabled = false;
      } else {
        btn.textContent = connected ? '重新连接' : '配对';
        btn.disabled = false;
      }
    }
    // 电量：来自硬件 status 报告（st.hwStatus.bat.pct / bat.mV），未拿到时不显示
    if (battery && st && st.hwStatus && st.hwStatus.bat) {
      const bat = st.hwStatus.bat;
      battery.textContent = '🔋 ' + (bat.pct != null ? bat.pct + '%' : '') + (bat.mV ? ' · ' + bat.mV + 'mV' : '');
    } else if (battery) {
      battery.textContent = '';
    }
  }

  // ---- 等 DOM 就绪后再挂按钮 handler（Cindy settingsHtml 可能分步注入，直接执行时 DOM 未必完整）----
  function bind() {
    const btn = findBtn(); // 用统一的查找函数（getElementById + querySelector 兜底）
    if (btn) {
      diag({ buttonBound: Date.now() });
      btn.addEventListener('click', async function () {
        diag({ click: Date.now() });
        // 配对 与 重新连接 都触发 connect（重连会重新扫描/连接硬件）
        pendingConnect = true;
        const cur = await readKV();
        await writeKV({ cmd: 'connect', seq: Date.now(), status: cur.status || null, heartbeat: cur.heartbeat || null });
        // 15s 兜底恢复（连接扫描约几秒；若正常 render 会在状态变化时更早恢复）
        setTimeout(function () { pendingConnect = false; }, 15000);
      });
    } else {
      diag({ buttonMissing: true, html: (document.body && document.body.innerHTML || '').slice(0, 200) });
    }
    // 解除配对按钮：点后写 /kv cmd:'unpair'，电子脑据此给硬件发 {"cmd":"unpair"}
    const unpairBtn = findUnpairBtn();
    if (unpairBtn) {
      diag({ unpairBound: Date.now() });
      unpairBtn.addEventListener('click', async function () {
        diag({ unpairClick: Date.now() });
        unpairBtn.textContent = '发送中…';
        unpairBtn.disabled = true;
        await writeKV({ cmd: 'unpair', seq: Date.now() });
        setTimeout(function () { unpairBtn.textContent = '解除配对'; unpairBtn.disabled = false; }, 8000);
      });
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }

  // ---- 再启动轮询渲染状态 ----
  let lastConnected = null;
  async function poll() {
    const st = await readKV();
    const connected = !!(st && st.status && st.status.connected);
    if (lastConnected === null) lastConnected = connected;
    // 连接状态发生变化（pending → 结果），清 pendingConnect，让按钮回到「配对/重新连接」
    if (pendingConnect && connected !== lastConnected) {
      pendingConnect = false;
    }
    lastConnected = connected;
    render(st);
  }
  poll(); // 立即刷一次
  setInterval(poll, 1500);

  // 捕获未处理错误写入 diag
  window.addEventListener('error', function (e) {
    diag({ error: String(e.message || e) });
  });
})();
