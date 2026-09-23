/**
 * Deep Message Send & Action Sniffer for Browser DevTools (F12 Console)
 * ---------------------------------------------------------------------
 * Hỗ trợ Facebook, Messenger Web, hoặc bất kỳ web app nào.
 * Tự động bắt:
 *  1. DOM Actions: Gõ phím (Enter, composer), Click nút Gửi / icon, Input change.
 *  2. Network HTTP: fetch(), XMLHttpRequest (URL, body, status, error).
 *  3. Realtime / Worker: WebSocket.send, Worker.postMessage, MessagePort.postMessage.
 *  4. Lỗi runtime: window.onerror, unhandledrejection, console.error.
 * 
 * Cách dùng:
 *  1. Mở F12 -> tab Console.
 *  2. Copy toàn bộ nội dung file này và paste vào Console -> Nhấn Enter.
 *  3. Thử gõ và gửi tin nhắn (bấm Enter hoặc bấm nút Gửi).
 *  4. Quan sát log màu sắc trên Console.
 *  5. Khi cần xuất dữ liệu để phân tích: gõ `__msgDebugger.export()` hoặc `__msgDebugger.summary()`.
 *  6. Để tắt sniffer: gõ `__msgDebugger.stop()`.
 */

(function initMessageSendDebugger() {
  'use strict';

  if (window.__msgDebugger && typeof window.__msgDebugger.stop === 'function') {
    try {
      window.__msgDebugger.stop();
    } catch {
      // ignore
    }
  }

  const logs = [];
  const maxLogs = 500;
  const textDecoder = new TextDecoder('utf-8', { fatal: false });

  function timeStr() {
    const d = new Date();
    return `${d.toLocaleTimeString()}.${String(d.getMilliseconds()).padStart(3, '0')}`;
  }

  function addLog(type, category, summary, data = null, level = 'info') {
    const item = {
      id: logs.length + 1,
      time: timeStr(),
      timestamp: Date.now(),
      type,
      category,
      summary,
      data,
      level
    };
    logs.push(item);
    if (logs.length > maxLogs) logs.shift();

    const badgeColors = {
      ACTION: 'background:#6366f1;color:#fff;',      // Tím indigo
      SEND_ATTEMPT: 'background:#10b981;color:#fff;font-weight:bold;', // Xanh lá
      FETCH: 'background:#0ea5e9;color:#fff;',       // Xanh dương
      XHR: 'background:#0284c7;color:#fff;',         // Xanh biển đậm
      WEBSOCKET: 'background:#f59e0b;color:#000;',   // Vàng cam
      WORKER: 'background:#ec4899;color:#fff;',      // Hồng
      ERROR: 'background:#ef4444;color:#fff;font-weight:bold;' // Đỏ
    };

    const style = badgeColors[type] || 'background:#6b7280;color:#fff;';
    console.groupCollapsed(
      `%c[${type}]%c %c${timeStr()}%c ${summary}`,
      `${style}padding:2px 6px;border-radius:3px;font-size:11px;`,
      '',
      'color:#9ca3af;font-size:11px;',
      'font-weight:bold;color:#111827;'
    );
    if (data !== null) {
      console.log('Chi tiết:', data);
    }
    console.groupEnd();
  }

  // Safe JSON stringify chống circular reference (vòng lặp DOM / React fiber)
  function safeJsonStringify(obj, space = 2) {
    const seen = new WeakSet();
    return JSON.stringify(obj, (key, value) => {
      if (typeof Node !== 'undefined' && value instanceof Node) {
        return `<${value.nodeName.toLowerCase()}${value.id ? ' #' + value.id : ''}${value.className && typeof value.className === 'string' ? ' .' + value.className.trim().split(/\s+/).join('.') : ''}>`;
      }
      if (value instanceof Error) {
        return { name: value.name, message: value.message, stack: value.stack };
      }
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular / Self Reference]';
        }
        seen.add(value);
      }
      return value;
    }, space);
  }

  // Helper giải mã buffer hoặc chuỗi
  function decodeData(data) {
    if (data == null) return null;
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch {
        return data;
      }
    }
    if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
      try {
        const u8 = data instanceof Uint8Array ? data : new Uint8Array(data.buffer || data);
        const str = textDecoder.decode(u8);
        try {
          return JSON.parse(str);
        } catch {
          return str.length > 500 ? str.slice(0, 500) + '... (truncated)' : str;
        }
      } catch (e) {
        return `<Binary ${data.byteLength || data.length} bytes>`;
      }
    }
    if (typeof data === 'object') return data;
    return String(data);
  }

  // Kiểm tra payload có phải gửi tin nhắn hay không
  function isSendMessagePayload(data) {
    const raw = typeof data === 'string' ? data : JSON.stringify(data || '');
    return /send_message|sendmessage|offline_threading_id|"body":|"text":|"message":|message_id|sendtext/i.test(raw);
  }

  function getSelector(el) {
    if (!el || !el.tagName) return '';
    let sel = el.tagName.toLowerCase();
    if (el.id) return `#${el.id}`;
    if (el.className && typeof el.className === 'string') {
      sel += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.');
    }
    const role = el.getAttribute('role');
    if (role) sel += `[role="${role}"]`;
    const label = el.getAttribute('aria-label');
    if (label) sel += `[aria-label="${label}"]`;
    return sel;
  }

  // ================= 1. THEO DÕI DOM ACTIONS =================
  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      const isShift = e.shiftKey;
      const target = e.target;
      const isComposer = target && (
        target.isContentEditable ||
        target.getAttribute('role') === 'textbox' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'INPUT'
      );

      const content = isComposer
        ? (target.innerText || target.value || target.textContent || '').trim()
        : null;

      addLog(
        isShift ? 'ACTION' : 'SEND_ATTEMPT',
        'KEYBOARD',
        `Phím [Enter] ${isShift ? '+ Shift (xuống dòng)' : '(Kích hoạt gửi tin nhắn)'} trên ${target ? target.tagName : 'ELEMENT'}`,
        {
          key: e.key,
          shiftKey: isShift,
          contentPreview: content,
          selector: getSelector(target)
        }
      );
    }
  };

  const onClick = (e) => {
    const target = e.target;
    if (!target) return;
    const btn = target.closest('button, [role="button"], [aria-label], svg');
    const label = btn ? (btn.getAttribute('aria-label') || btn.innerText || btn.title || '') : '';
    const isSendCandidate = /gửi|send|press enter|nhấn enter/i.test(label) || (btn && btn.getAttribute('data-testid')?.includes('send'));

    if (isSendCandidate || (btn && label)) {
      addLog(
        isSendCandidate ? 'SEND_ATTEMPT' : 'ACTION',
        'CLICK',
        `Click: "${label || btn.tagName}" ${isSendCandidate ? '👉 [NÚT GỬI]' : ''}`,
        {
          label,
          buttonTag: btn ? btn.tagName : (target ? target.tagName : ''),
          selector: getSelector(btn || target)
        }
      );
    }
  };

  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('click', onClick, true);

  // ================= 2. THEO DÕI FETCH =================
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const [input, init] = args;
    const url = typeof input === 'string' ? input : (input && input.url ? input.url : String(input));
    const method = (init && init.method) || (input && input.method) || 'GET';
    const bodyDecoded = decodeData(init && init.body);
    const isSend = isSendMessagePayload(bodyDecoded);

    const logType = isSend ? 'SEND_ATTEMPT' : 'FETCH';
    addLog(
      logType,
      'HTTP',
      `Fetch ${method} -> ${cleanUrl(url)} ${isSend ? '🔥 [GÓI TIN GỬI TIN NHẮN]' : ''}`,
      { url, method, body: bodyDecoded }
    );

    try {
      const response = await originalFetch.apply(this, args);
      if (!response.ok) {
        addLog('ERROR', 'HTTP', `Fetch Thất Bại: [Status ${response.status}] ${cleanUrl(url)}`, {
          url,
          status: response.status,
          statusText: response.statusText
        }, 'error');
      }
      return response;
    } catch (err) {
      addLog('ERROR', 'HTTP', `Fetch Bị Chặn/Ngoại Lệ: ${err?.message} -> ${cleanUrl(url)}`, {
        url,
        error: String(err)
      }, 'error');
      throw err;
    }
  };

  // ================= 3. THEO DÕI XHR =================
  const originalXhrOpen = XMLHttpRequest.prototype.open;
  const originalXhrSend = XMLHttpRequest.prototype.send;
  const xhrMeta = new WeakMap();

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    xhrMeta.set(this, { method: String(method).toUpperCase(), url: String(url) });
    return originalXhrOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (body) {
    const meta = xhrMeta.get(this) || { method: 'GET', url: '' };
    const decoded = decodeData(body);
    const isSend = isSendMessagePayload(decoded);

    addLog(
      isSend ? 'SEND_ATTEMPT' : 'XHR',
      'HTTP',
      `XHR ${meta.method} -> ${cleanUrl(meta.url)} ${isSend ? '🔥 [GÓI TIN GỬI TIN NHẮN]' : ''}`,
      { url: meta.url, method: meta.method, body: decoded }
    );

    this.addEventListener('error', () => {
      addLog('ERROR', 'HTTP', `XHR Network Error: ${cleanUrl(meta.url)}`, { meta }, 'error');
    });

    return originalXhrSend.call(this, body);
  };

  // ================= 4. THEO DÕI WEBSOCKET =================
  const originalWsSend = WebSocket.prototype.send;
  WebSocket.prototype.send = function (data) {
    const wsUrl = this.url || 'WebSocket';
    const decoded = decodeData(data);
    const isSend = isSendMessagePayload(decoded);

    addLog(
      isSend ? 'SEND_ATTEMPT' : 'WEBSOCKET',
      'REALTIME',
      `WS Send -> ${cleanUrl(wsUrl)} ${isSend ? '🔥 [GÓI TIN GỬI TIN NHẮN]' : ''}`,
      { wsUrl, payload: decoded }
    );

    try {
      return originalWsSend.call(this, data);
    } catch (err) {
      addLog('ERROR', 'REALTIME', `WS Send Lỗi: ${err?.message}`, { error: String(err) }, 'error');
      throw err;
    }
  };

  // ================= 5. THEO DÕI WORKER & MESSAGEPORT (Messenger MAW worker) =================
  let origWorkerPost = null;
  if (window.Worker) {
    origWorkerPost = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (message, ...rest) {
      const decoded = decodeData(message);
      const isSend = isSendMessagePayload(decoded);

      if (isSend || (decoded && typeof decoded === 'object' && (decoded.type || decoded.action))) {
        addLog(
          isSend ? 'SEND_ATTEMPT' : 'WORKER',
          'WORKER',
          `Worker.postMessage ${isSend ? '🔥 [GÓI TIN GỬI TIN NHẮN]' : ''}`,
          { message: decoded }
        );
      }
      return origWorkerPost.call(this, message, ...rest);
    };
  }

  let origPortPost = null;
  if (window.MessagePort) {
    origPortPost = MessagePort.prototype.postMessage;
    MessagePort.prototype.postMessage = function (message, ...rest) {
      const decoded = decodeData(message);
      const isSend = isSendMessagePayload(decoded);

      if (isSend) {
        addLog(
          'SEND_ATTEMPT',
          'WORKER',
          `MessagePort.postMessage 🔥 [GÓI TIN GỬI TIN NHẮN]`,
          { message: decoded }
        );
      }
      return origPortPost.call(this, message, ...rest);
    };
  }

  // ================= 6. THEO DÕI RUNTIME ERRORS =================
  const onError = (msg, url, line, col, error) => {
    addLog('ERROR', 'RUNTIME', `JS Error: ${msg}`, { msg, url, line, col, error: String(error) }, 'error');
  };
  const onUnhandledRejection = (e) => {
    addLog('ERROR', 'PROMISE', `Unhandled Rejection: ${e.reason?.message || e.reason}`, { reason: String(e.reason) }, 'error');
  };

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onUnhandledRejection);

  function cleanUrl(url) {
    if (!url) return '';
    try {
      const u = new URL(url, location.origin);
      return u.pathname + (u.search ? `?${u.search.slice(0, 60)}...` : '');
    } catch {
      return String(url).slice(0, 80);
    }
  }

  // ================= API ĐIỀU KHIỂN =================
  window.__msgDebugger = {
    logs,
    summary: () => {
      console.table(
        logs.map(l => ({
          time: l.time,
          type: l.type,
          category: l.category,
          summary: l.summary
        }))
      );
    },
    export: () => {
      try {
        const jsonStr = safeJsonStringify(logs, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `debug-message-logs-${Date.now()}.json`;
        a.click();
        console.log('✅ Đã tải file JSON logs thành công!');
      } catch (err) {
        console.error('Không thể export:', err);
      }
    },
    clear: () => {
      logs.length = 0;
      console.clear();
      console.log('🧹 Đã xóa toàn bộ logs.');
    },
    stop: () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('click', onClick, true);
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);

      window.fetch = originalFetch;
      XMLHttpRequest.prototype.open = originalXhrOpen;
      XMLHttpRequest.prototype.send = originalXhrSend;
      WebSocket.prototype.send = originalWsSend;
      if (origWorkerPost) Worker.prototype.postMessage = origWorkerPost;
      if (origPortPost) MessagePort.prototype.postMessage = origPortPost;

      delete window.__msgDebugger;
      console.log('%c[STOPPED] Đã tắt Message Send Debugger & khôi phục các hàm gốc của trình duyệt.', 'color:#ef4444;font-weight:bold;');
    }
  };

  console.log(
    '%c[MESSAGE SEND DEBUGGER SẴN SÀNG]%c\n' +
    '1. Thử gõ tin nhắn và nhấn Enter hoặc bấm nút Gửi.\n' +
    '2. Lệnh hỗ trợ:\n' +
    '   - `__msgDebugger.summary()` : Xem bảng tóm tắt dòng sự kiện\n' +
    '   - `__msgDebugger.export()`  : Tải file log .json\n' +
    '   - `__msgDebugger.stop()`    : Tắt debug và trả về ban đầu',
    'background:#10b981;color:#fff;font-weight:bold;font-size:13px;padding:4px 8px;border-radius:4px;',
    'color:#374151;font-size:12px;margin-top:4px;'
  );
})();
