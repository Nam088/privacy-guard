/* eslint-disable */
// Auto Popup Typing Diagnostic Probe (2026 - v2 Deep Inspector)
// Tự động 100% — Hook toàn bộ Worker, SharedWorker, WebSocket, Fetch, XHR và MAW Bridge
//
// Cơ chế:
// 1. Hook cả Worker.prototype.postMessage VÀ MessagePort.prototype.postMessage (bắt lệnh gửi xuống Armadillo Worker).
// 2. Hook trực tiếp MAWBridgeFireAndForget.fireAndForget nếu module đã được nạp.
// 3. Bắt toàn bộ WebSocket.prototype.send trên TẤT CẢ các socket (/ws/realtime, /ws/lightspeed, /ws/streamcontroller).
// 4. In ra NGAY LẬP TỨC mọi thứ phát sinh trong 3 giây kể từ khi bạn bấm phím trong popup chat!

(function installDeepPopupTypingProbe() {
  'use strict';

  var oldHud = document.getElementById('auto-typing-probe-hud');
  if (oldHud) oldHud.remove();

  var lastTypingTs = 0;
  var TYPING_WINDOW_MS = 3000;
  var capturedSignals = [];
  var seenSignatures = new Set();

  var hud = document.createElement('div');
  hud.id = 'auto-typing-probe-hud';
  hud.style.cssText = 'position:fixed;bottom:20px;left:20px;z-index:999999;background:rgba(15,23,42,0.96);color:#fff;padding:12px 18px;border-radius:12px;font-family:sans-serif;font-size:13px;box-shadow:0 10px 40px rgba(0,0,0,0.5);border:1.5px solid #3b82f6;max-width:420px;line-height:1.5;backdrop-filter:blur(10px);';
  hud.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
      <strong style="color:#60a5fa;display:flex;align-items:center;gap:6px;font-size:14px;">
        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#10b981;box-shadow:0 0 10px #10b981;"></span>
        Popup Typing Deep Probe v2
      </strong>
      <span id="hud-status" style="font-size:11px;color:#94a3b8;">Đang chờ gõ popup...</span>
    </div>
    <div id="hud-content" style="color:#cbd5e1;font-size:12px;">Hãy click vào ô soạn thảo chat popup bên trái và gõ vài phím. Probe sẽ bắt chính xác kênh gửi!</div>
  `;
  document.body.appendChild(hud);

  function updateHud(channel, detail) {
    var statusEl = document.getElementById('hud-status');
    var contentEl = document.getElementById('hud-content');
    if (statusEl) statusEl.textContent = '🎯 BẮT ĐƯỢC KÊNH!';
    if (contentEl) {
      contentEl.innerHTML = `
        <div style="color:#34d399;font-weight:bold;margin-bottom:4px;">Kênh: ${channel}</div>
        <div style="background:rgba(239,68,68,0.15);border-left:3px solid #ef4444;padding:6px 10px;border-radius:4px;color:#fef08a;font-size:12px;word-break:break-all;">
          ${detail}
        </div>
      `;
    }
    hud.style.borderColor = '#ef4444';
    hud.style.boxShadow = '0 0 30px rgba(239,68,68,0.7)';
  }

  function isTypingActive() {
    return Date.now() - lastTypingTs < TYPING_WINDOW_MS;
  }

  window.addEventListener('keydown', function(e) {
    var target = e.target;
    if (!target) return;
    var isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable || target.getAttribute('role') === 'textbox';
    if (isInput) {
      lastTypingTs = Date.now();
      var statusEl = document.getElementById('hud-status');
      if (statusEl) statusEl.textContent = '⚡ ĐANG GÕ PHÍM...';
    }
  }, true);

  window.addEventListener('input', function() {
    lastTypingTs = Date.now();
  }, true);

  function record(channel, endpoint, dataStr, raw) {
    if (!isTypingActive()) return;

    var sig = channel + '::' + endpoint + '::' + dataStr.slice(0, 100);
    if (seenSignatures.has(sig)) return;
    seenSignatures.add(sig);

    console.log('%c🔥 [BẮT ĐƯỢC TÍN HIỆU GÕ TRONG POPUP CHAT]', 'background:#ef4444;color:#fff;font-weight:bold;font-size:15px;padding:6px 10px;border-radius:6px;');
    console.log('%c👉 KÊNH (TRANSPORT): ' + channel, 'color:#38bdf8;font-weight:bold;font-size:14px;');
    console.log('Endpoint / Đích:', endpoint);
    console.log('Dữ liệu:', dataStr);
    if (raw) console.log('Raw Payload:', raw);
    console.trace('Stack trace:');

    updateHud(channel, dataStr.slice(0, 180));
    capturedSignals.push({ channel: channel, endpoint: endpoint, data: dataStr, raw: raw });
  }

  var KEYWORDS = ['typing', 'chatstate', 'presence', 'composer', 'send_typing_indicators', 'armadillo', 'maw', 'wa_chat', 'is_typing', '"label":3', '"label":"3"'];
  function matchesKey(str) {
    if (!str || typeof str !== 'string') return false;
    var lower = str.toLowerCase();
    return KEYWORDS.some(function(k) { return lower.indexOf(k) !== -1; });
  }

  // 1. Hook Worker.prototype.postMessage (Giao tiếp với Armadillo Worker)
  if (window.Worker) {
    var origWorkerPost = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function(data) {
      if (isTypingActive()) {
        try {
          var str = '';
          try { str = JSON.stringify(data); } catch(e) { str = String(data); }
          record('Worker.postMessage (Armadillo Worker)', 'worker.postMessage', str, data);
        } catch (e) {}
      }
      return origWorkerPost.apply(this, arguments);
    };
  }

  // 2. Hook MessagePort.prototype.postMessage (SharedWorker / Comlink / MAW)
  if (window.MessagePort) {
    var origPortPost = MessagePort.prototype.postMessage;
    MessagePort.prototype.postMessage = function(data) {
      if (isTypingActive()) {
        try {
          var str = '';
          try { str = JSON.stringify(data); } catch(e) { str = String(data); }
          record('MessagePort.postMessage', 'port.postMessage', str, data);
        } catch (e) {}
      }
      return origPortPost.apply(this, arguments);
    };
  }

  // 3. Hook WebSocket.prototype.send (Mọi socket Meta DGW)
  var origWsSend = WebSocket.prototype.send;
  WebSocket.prototype.send = function(data) {
    if (isTypingActive()) {
      try {
        var text = '';
        if (typeof data === 'string') {
          text = data;
        } else if (data instanceof ArrayBuffer) {
          text = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(data));
        } else if (ArrayBuffer.isView(data)) {
          text = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
        }

        // Bỏ qua heartbeat rỗng
        if (text && text.length > 2) {
          record('WebSocket.send', this.url || 'WebSocket', text.slice(0, 400), text);
        }
      } catch (e) {}
    }
    return origWsSend.apply(this, arguments);
  };

  // 4. Hook Fetch
  var origFetch = window.fetch;
  window.fetch = function(input, init) {
    if (isTypingActive()) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var body = (init && init.body) || '';
      var bodyStr = typeof body === 'string' ? body : '';
      if (matchesKey(url) || matchesKey(bodyStr) || url.includes('/graphql') || url.includes('typ.php')) {
        record('Fetch (HTTP)', url.slice(0, 100), bodyStr.slice(0, 300), bodyStr);
      }
    }
    return origFetch.apply(this, arguments);
  };

  // 5. Hook Module MAWBridgeFireAndForget trực tiếp
  try {
    var rawReq = window.require;
    if (typeof rawReq === 'function') {
      var maw = rawReq('MAWBridgeFireAndForget');
      if (maw && typeof maw.fireAndForget === 'function') {
        var origMawFire = maw.fireAndForget;
        maw.fireAndForget = function() {
          var argsArr = Array.prototype.slice.call(arguments);
          var str = JSON.stringify(argsArr);
          record('MAWBridgeFireAndForget.fireAndForget', argsArr[1] || 'action', str, argsArr);
          return origMawFire.apply(this, arguments);
        };
        console.log('%c[Probe] Đã bọc trực tiếp MAWBridgeFireAndForget thành công!', 'color:#10b981;');
      }
    }
  } catch (e) {}

  console.log('%c[Deep Popup Typing Probe v2] Sẵn sàng!', 'color:#10b981;font-weight:bold;font-size:14px;');
  console.log('👉 Bây giờ bạn click vào khung soạn thảo popup bên trái và gõ vài phím liên tục, kết quả kênh gửi sẽ in thẳng ra Console!');
})();
