// Facebook Messenger Zero-Friction Network Auto-Detector (2026 Unified Meta Stack)
//
// 100% KHONG CO UI / KHONG CO HUD / KHONG CHAN CLICK.
// Hoan toan log truc tiep ra DevTools Console.
// Tu dong hook & giai ma sau: WebSocket (/ws/lightspeed, /ws/realtime), Worker, MessagePort, Fetch, XHR.
//
// Cach dung:
// 1. Mo tab Facebook (hoac messenger.com) -> F12 -> Console.
// 2. Copy toan bo file nay va Paste vao Console -> Enter.
// 3. Thuc hien cac thao tac: go tin nhan, xem tin nhan, bam gui tin nhan o popup chat.
// 4. Console se tu dong bat va thong bao ngay:
//    - OUTBOUND_MESSAGE: Tin nhan gui di (kiem tra co bi ket 'Dang gui' hay bi chan khong)
//    - READ_RECEIPT: Yeu cau bao da xem (watermark / label 21, 72, 235)
//    - TYPING_INDICATOR: Tin hieu dang soan tin (label 3 / chatstate / send_typing_indicators)
//    - STOP_TYPING: Tin hieu dung soan tin (idle / paused)
// 5. Muon dung detector: go __fbDetector.stop()

(function installFacebookDetector() {
  'use strict';

  try {
    var staleSelectors = [
      '#facebook-auto-detector-hud',
      '#auto-typing-probe-hud',
      '#live-traffic-hud',
      '#live-interceptor-hud',
      '[id*="probe"]',
      '[id*="detector"]',
      '.probe-overlay'
    ];
    staleSelectors.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        el.remove();
      });
    });
    if (document.body) document.body.style.pointerEvents = 'auto';
    if (document.documentElement) document.documentElement.style.pointerEvents = 'auto';
  } catch {
    // ignore
  }

  var decoder = new TextDecoder('utf-8', { fatal: false });
  var captured = [];
  var seenSignatures = new Set();

  var OPEN_BRACE = 0x7b;
  var OPEN_BRACKET = 0x5b;

  function readBalancedObject(text) {
    if (!text || text.length === 0) return null;
    var first = text.charCodeAt(0);
    if (first !== OPEN_BRACE && first !== OPEN_BRACKET) return null;

    var depth = 0;
    var inString = false;
    var escaped = false;
    for (var i = 0; i < text.length; i += 1) {
      var ch = text[i];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (ch === '\\') {
          escaped = true;
        } else if (ch === '"') {
          inString = false;
        }
      } else if (ch === '"') {
        inString = true;
      } else if (ch === '{' || ch === '[') {
        depth += 1;
      } else if (ch === '}' || ch === ']') {
        depth -= 1;
        if (depth === 0) {
          try {
            return JSON.parse(text.slice(0, i + 1));
          } catch {
            return null;
          }
        }
      }
    }
    return null;
  }

  function parseDgwFrame(bytes) {
    if (!(bytes instanceof Uint8Array) || bytes.byteLength < 8) {
      return { envelope: 'unknown', tasks: [], labels: [] };
    }
    var limit = Math.min(bytes.byteLength, 512);
    var start = -1;
    for (var i = 0; i < limit; i += 1) {
      if (bytes[i] === OPEN_BRACE) {
        start = i;
        break;
      }
    }
    if (start === -1) {
      return { envelope: 'unknown', tasks: [], labels: [] };
    }

    var text = decoder.decode(bytes.subarray(start));
    var outer = readBalancedObject(text);
    if (!outer || typeof outer !== 'object') {
      return { envelope: 'unknown', tasks: [], labels: [] };
    }

    if (typeof outer.label !== 'undefined') {
      var singleLabel = String(outer.label);
      return { envelope: 'single', tasks: [{ label: singleLabel, payload: outer.payload }], labels: [singleLabel], rawPayload: outer };
    }

    var inner = outer.payload;
    if (typeof inner === 'string') {
      inner = readBalancedObject(inner) || inner;
    }

    if (inner && typeof inner === 'object' && Array.isArray(inner.tasks)) {
      var tasks = inner.tasks.map(function (t) {
        return { label: String(t.label || ''), payload: t.payload, rawTask: t };
      });
      return { envelope: 'array', tasks: tasks, labels: tasks.map(function (t) { return t.label; }), rawPayload: outer };
    }

    return { envelope: 'object', tasks: [], labels: [], rawPayload: outer };
  }

  function isOutboundMessage(payload) {
    if (!payload) return false;
    if (typeof payload === 'string') {
      return /["\\](?:body|text|send_message|offline_threading_id|message_id)["\\]/i.test(payload);
    }
    if (Array.isArray(payload)) {
      for (var i = 0; i < payload.length; i += 1) {
        var it = payload[i];
        if (typeof it === 'string') {
          var low = it.toLowerCase();
          if (low === 'sendmessage' || low === 'sendtextmessage' || low.includes('send_message')) return true;
        } else if (it && typeof it === 'object') {
          if (isOutboundMessage(it)) return true;
        }
      }
      return false;
    }
    if (typeof payload === 'object') {
      var r = payload;
      if (
        r.body !== undefined ||
        r.text !== undefined ||
        r.message !== undefined ||
        r.offline_threading_id !== undefined ||
        r.message_id !== undefined
      ) {
        return true;
      }
      var act = String(r.action || r.type || r.command || '').toLowerCase();
      if (act.includes('sendmessage') || act.includes('send_message')) return true;
    }
    return false;
  }

  function classify(channel, method, url, data) {
    var str = '';
    var rawObj = null;
    var dgw = null;

    if (typeof data === 'string') {
      str = data;
      try {
        rawObj = JSON.parse(data);
      } catch {
        // ignore
      }
    } else if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
      var u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
      str = decoder.decode(u8);
      dgw = parseDgwFrame(u8);
    } else if (data && typeof data === 'object') {
      rawObj = data;
      try {
        str = JSON.stringify(data);
      } catch {
        str = String(data);
      }
    }

    var lower = str.toLowerCase();

    // 1. Kiem tra tin nhan gui di (Outbound Message)
    if (isOutboundMessage(rawObj) || isOutboundMessage(str)) {
      return {
        category: 'OUTBOUND_MESSAGE',
        detail: 'Phat hien goi tin GUI TIN NHAN (Message Send)',
        payload: rawObj || str,
        dgw: dgw,
      };
    }

    // 2. Kiem tra WebSocket LightSpeed Tasks
    if (dgw && dgw.labels && dgw.labels.length > 0) {
      if (dgw.labels.includes('21') || dgw.labels.includes('72') || dgw.labels.includes('235')) {
        return {
          category: 'READ_RECEIPT',
          detail: 'DGW LightSpeed Read Receipt Task (Labels: ' + dgw.labels.join(', ') + ')',
          payload: dgw,
          dgw: dgw,
        };
      }
      if (dgw.labels.includes('3')) {
        return {
          category: 'TYPING_INDICATOR',
          detail: 'DGW LightSpeed Typing Indicator Task (Label 3)',
          payload: dgw,
          dgw: dgw,
        };
      }
      if (dgw.labels.includes('6')) {
        return {
          category: 'INBOX_WATERMARK',
          detail: 'DGW LightSpeed Inbox Watermark (Label 6)',
          payload: dgw,
          dgw: dgw,
        };
      }
    }

    // 3. Kiem tra Realtime / Worker Read Receipts
    if (
      lower.includes('last_read_watermark_ts') ||
      lower.includes('mark_thread_read') ||
      lower.includes('thread_read_watermark') ||
      lower.includes('send_read_receipt') ||
      lower.includes('markread') ||
      lower.includes('updatewatermark')
    ) {
      return {
        category: 'READ_RECEIPT',
        detail: 'Realtime / Worker Read Receipt Action',
        payload: rawObj || str,
      };
    }

    // 4. Kiem tra Typing Indicator
    if (
      lower.includes('send_typing_indicators') ||
      lower.includes('sendchatstatefromcomposer') ||
      lower.includes('typingindicator') ||
      lower.includes('chatstate')
    ) {
      if (lower.includes('idle') || lower.includes('stop') || lower.includes('paused')) {
        return {
          category: 'STOP_TYPING',
          detail: 'Dung soan tin (Idle/Stop typing)',
          payload: rawObj || str,
        };
      }
      return {
        category: 'TYPING_INDICATOR',
        detail: 'Dang soan tin (Typing indicator)',
        payload: rawObj || str,
      };
    }

    // 5. GraphQL mutations
    if (url.includes('/api/graphql/') || url.includes('/graphql/')) {
      if (/readreceipt|markthreadread/i.test(str)) {
        return {
          category: 'READ_RECEIPT',
          detail: 'GraphQL Read Receipt Mutation',
          payload: rawObj || str,
        };
      }
      if (/typing.{0,30}mutation|typsubscription/i.test(str)) {
        return {
          category: 'TYPING_INDICATOR',
          detail: 'GraphQL Typing Mutation',
          payload: rawObj || str,
        };
      }
    }

    return null;
  }

  function emit(channel, method, url, rawData) {
    try {
      var match = classify(channel, method, url, rawData);
      if (!match) return;

      var sig = match.category + '|' + channel + '|' + url.split('?')[0] + '|' + match.detail;
      var isDuplicate = seenSignatures.has(sig);
      seenSignatures.add(sig);

      var record = {
        time: new Date().toLocaleTimeString(),
        category: match.category,
        channel: channel,
        method: method,
        url: url,
        detail: match.detail,
        payload: match.payload,
      };
      captured.push(record);

      var color = '#3b82f6';
      if (match.category === 'OUTBOUND_MESSAGE') color = '#10b981'; // Xanh la
      if (match.category === 'READ_RECEIPT') color = '#ef4444'; // Do
      if (match.category === 'TYPING_INDICATOR') color = '#f59e0b'; // Cam
      if (match.category === 'STOP_TYPING') color = '#8b5cf6'; // Tim

      console.groupCollapsed(
        '%c[' + match.category + ']%c ' + match.detail + ' %c(' + channel + ' - ' + record.time + ')',
        'background:' + color + ';color:#fff;font-weight:bold;padding:2px 6px;border-radius:3px;',
        'color:#1f2937;font-weight:bold;',
        'color:#6b7280;font-size:11px;'
      );
      console.log('Channel:', channel, '| Method:', method);
      console.log('URL:', url);
      console.log('Payload:', match.payload);
      if (match.category === 'OUTBOUND_MESSAGE') {
        console.log('%c[STATUS] Tin nhan nguoi dung gui di khong bao gio duoc phep bi drop!', 'color:#10b981;font-weight:bold;');
      }
      console.groupEnd();
    } catch {
      // ignore
    }
  }

  // --- Hook Fetch ---
  var origFetch = window.fetch;
  window.fetch = function (input, init) {
    try {
      var url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
      var method = (init && init.method) || 'GET';
      var body = init && init.body;
      emit('Fetch', method, url, body);
    } catch {
      // ignore
    }
    return origFetch.apply(this, arguments);
  };

  // --- Hook XMLHttpRequest ---
  if (window.XMLHttpRequest) {
    var origXhrOpen = XMLHttpRequest.prototype.open;
    var origXhrSend = XMLHttpRequest.prototype.send;
    var metaMap = new WeakMap();

    XMLHttpRequest.prototype.open = function (method, url) {
      metaMap.set(this, { method: String(method).toUpperCase(), url: String(url) });
      return origXhrOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function (body) {
      try {
        var meta = metaMap.get(this) || { method: 'GET', url: '' };
        emit('XHR', meta.method, meta.url, body);
      } catch {
        // ignore
      }
      return origXhrSend.apply(this, arguments);
    };
  }

  // --- Hook WebSocket.send ---
  var origWsSend = WebSocket.prototype.send;
  WebSocket.prototype.send = function (data) {
    var wsUrl = this.url || 'WebSocket';
    try {
      if (typeof Blob !== 'undefined' && data instanceof Blob) {
        data.arrayBuffer().then(function (ab) {
          emit('WebSocket', 'SEND', wsUrl, ab);
        }).catch(function () {});
      } else {
        emit('WebSocket', 'SEND', wsUrl, data);
      }
    } catch {
      // ignore
    }
    return origWsSend.apply(this, arguments);
  };

  // --- Hook Worker.postMessage ---
  if (window.Worker) {
    var origWorkerPost = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (data) {
      try {
        emit('Worker', 'POSTMESSAGE', '<Worker>', data);
      } catch {
        // ignore
      }
      return origWorkerPost.apply(this, arguments);
    };
  }

  // --- Hook MessagePort.postMessage ---
  if (window.MessagePort) {
    var origPortPost = MessagePort.prototype.postMessage;
    MessagePort.prototype.postMessage = function (data) {
      try {
        emit('MessagePort', 'POSTMESSAGE', '<MessagePort>', data);
      } catch {
        // ignore
      }
      return origPortPost.apply(this, arguments);
    };
  }

  function stop() {
    window.fetch = origFetch;
    if (window.XMLHttpRequest) {
      XMLHttpRequest.prototype.open = origXhrOpen;
      XMLHttpRequest.prototype.send = origXhrSend;
    }
    WebSocket.prototype.send = origWsSend;
    if (window.Worker && origWorkerPost) {
      Worker.prototype.postMessage = origWorkerPost;
    }
    if (window.MessagePort && origPortPost) {
      MessagePort.prototype.postMessage = origPortPost;
    }
    console.log('[Facebook Detector] Da go bo toan bo hook va khoi phuc nguyen ban.');
  }

  window.__fbDetector = {
    getCaptured: function () {
      return captured;
    },
    getSignatures: function () {
      var map = {
        OUTBOUND_MESSAGE: [],
        READ_RECEIPT: [],
        TYPING_INDICATOR: [],
        STOP_TYPING: [],
        INBOX_WATERMARK: [],
      };
      captured.forEach(function (c) {
        if (!map[c.category]) map[c.category] = [];
        map[c.category].push(c);
      });
      return map;
    },
    clear: function () {
      captured = [];
      seenSignatures.clear();
      console.log('[Facebook Detector] Da xoa lich su bat.');
    },
    stop: stop,
  };

  console.log(
    '%c[Facebook Messenger Auto-Detector Active] San sang! Khong co UI. Hay go tin nhan, xem chat hoac bam gui.',
    'background:#1877f2;color:#fff;font-weight:bold;font-size:13px;padding:6px 10px;border-radius:5px;'
  );
  console.log('Moi goi tin lien quan se tu dong hien thi truc tiep ngay ben duoi trong Console.');
})();
