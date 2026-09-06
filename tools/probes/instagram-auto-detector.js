// Instagram Zero-Friction Network Auto-Detector (2026 Unified Meta Stack)
//
// 100% KHONG CO UI / KHONG CO HUD / KHONG CHAN CLICK.
// Hoan toan log truc tiep ra DevTools Console.
// Tu dong hook & giai ma sau: Fetch, XHR, WebSocket (LightSpeed/DGW/Realtime/Binary), Beacon, Worker, MessagePort.
//
// Cach dung:
// 1. Neu trang dang bi vuong do script cu truoc do, bam F5 (Refresh) trang instagram.com 1 lan.
// 2. Mo F12 -> Console.
// 3. Copy toan bo file nay va Paste vao Console -> Enter.
// 4. Click xem tin nhan, go chu trong khung chat, xem story.
// 5. Tat ca su kien Read Receipt, Typing, Story Seen, DGW Frame se hien thi ngay lap tuc!
// 6. Muon dung: go __igDetector.stop()

(function installInstagramDetector() {
  'use strict';

  // 1. Don dep triet de moi HUD hoac element ton dong tu script truoc
  try {
    var staleSelectors = [
      '#instagram-auto-detector-hud',
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

  // Doc balanced JSON object tu mot chuoi ky tu bat dau bang { hoac [
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
        continue;
      }
      if (ch === '"') {
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

  function describeDgwTask(task) {
    var innerPayload = task && task.payload;
    if (typeof innerPayload === 'string') {
      try {
        innerPayload = JSON.parse(innerPayload);
      } catch {
        // ignore
      }
    }
    return {
      label: String(task && task.label !== undefined ? task.label : ''),
      labelRaw: task && task.label,
      payload: innerPayload,
      rawTask: task,
    };
  }

  // Trich xuat moi DGW Task tu object JSON (LightSpeed/DGW envelope)
  function extractTasksFromDGW(obj) {
    if (!obj || typeof obj !== 'object') return [];
    var allTasks = [];

    function traverse(target) {
      if (!target) return;
      if (typeof target === 'string') {
        try {
          var p = JSON.parse(target);
          traverse(p);
        } catch {
          // ignore
        }
        return;
      }
      if (Array.isArray(target)) {
        target.forEach(function (item) {
          traverse(item);
        });
        return;
      }
      if (typeof target === 'object') {
        if (Array.isArray(target.tasks)) {
          target.tasks.forEach(function (t) {
            allTasks.push(describeDgwTask(t));
          });
        }
        if (target.label !== undefined) {
          allTasks.push(describeDgwTask(target));
        }
        if (target.payload) traverse(target.payload);
        if (target.request) traverse(target.request);
        if (target.data) traverse(target.data);
      }
    }

    traverse(obj);
    return allTasks;
  }

  // Giai ma binary frame cua WebSocket DGW LightSpeed
  function decodeBinaryDGW(bytes) {
    var text;
    try {
      text = decoder.decode(bytes);
    } catch {
      return { text: '', json: null, tasks: [] };
    }

    var parsedObj = null;
    for (var i = 0; i < bytes.length; i += 1) {
      if (bytes[i] === OPEN_BRACE || bytes[i] === OPEN_BRACKET) {
        var candidate = readBalancedObject(text.slice(i));
        if (candidate && typeof candidate === 'object' && Object.keys(candidate).length > 0) {
          parsedObj = candidate;
          break;
        }
      }
    }
    var tasks = parsedObj ? extractTasksFromDGW(parsedObj) : [];
    return {
      text: text,
      json: parsedObj,
      tasks: tasks,
    };
  }

  function tryParseJson(str) {
    if (!str || (str[0] !== '{' && str[0] !== '[')) return null;
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  }

  // Phan tich body da dang (string, URLSearchParams, FormData, ArrayBuffer, View, Object)
  function parseBody(body) {
    if (!body) return { type: 'empty', text: '', json: null, tasks: [] };
    try {
      if (typeof body === 'string') {
        if (body.indexOf('=') !== -1 && body.indexOf('{') === -1) {
          var params = {};
          body.split('&').forEach(function (part) {
            var pair = part.split('=');
            if (pair.length >= 2) {
              var k = decodeURIComponent(pair[0]);
              var v = decodeURIComponent(pair.slice(1).join('='));
              try {
                params[k] = JSON.parse(v);
              } catch {
                params[k] = v;
              }
            }
          });
          return { type: 'urlencoded', text: body, json: params, tasks: [] };
        }
        var parsedJson = tryParseJson(body);
        var tasks = parsedJson ? extractTasksFromDGW(parsedJson) : [];
        return { type: 'string', text: body, json: parsedJson, tasks: tasks };
      }
      if (body instanceof URLSearchParams) {
        var urlObj = {};
        body.forEach(function (v, k) {
          try {
            urlObj[k] = JSON.parse(v);
          } catch {
            urlObj[k] = v;
          }
        });
        return { type: 'urlencoded', text: body.toString(), json: urlObj, tasks: [] };
      }
      if (body instanceof ArrayBuffer) {
        var dgwAb = decodeBinaryDGW(new Uint8Array(body));
        return { type: 'arraybuffer', text: dgwAb.text, json: dgwAb.json, tasks: dgwAb.tasks };
      }
      if (ArrayBuffer.isView(body)) {
        var bytes = new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
        var dgwView = decodeBinaryDGW(bytes);
        return { type: 'binary', text: dgwView.text, json: dgwView.json, tasks: dgwView.tasks };
      }
      if (typeof FormData !== 'undefined' && body instanceof FormData) {
        var formObj = {};
        var pairs = [];
        body.forEach(function (v, k) {
          pairs.push(k + '=' + (typeof v === 'string' ? v : '<blob>'));
          try {
            formObj[k] = typeof v === 'string' ? JSON.parse(v) : v;
          } catch {
            formObj[k] = v;
          }
        });
        return { type: 'formdata', text: pairs.join('&'), json: formObj, tasks: [] };
      }
      if (typeof body === 'object') {
        var objTasks = extractTasksFromDGW(body);
        return { type: 'object', text: JSON.stringify(body), json: body, tasks: objTasks };
      }
    } catch {
      // ignore
    }
    return { type: typeof body, text: String(body), json: null, tasks: [] };
  }

  function identifyCategory(url, text, json, tasks) {
    var u = (url || '').toLowerCase();
    var t = (text || '').toLowerCase();

    // 1. Kiem tra truc tiep tu cac DGW Tasks da giai ma
    if (tasks && tasks.length > 0) {
      for (var i = 0; i < tasks.length; i += 1) {
        var lbl = String(tasks[i].label);
        if (lbl === '21' || lbl === '72' || lbl === '235' || lbl === '6') {
          return 'READ_RECEIPT';
        }
        if (lbl === '3') {
          return 'TYPING_INDICATOR';
        }
        var pStr = JSON.stringify(tasks[i].payload || '').toLowerCase();
        if (pStr.includes('watermark') || pStr.includes('mark_thread_read') || pStr.includes('seen')) {
          return 'READ_RECEIPT';
        }
        if (pStr.includes('typing') || pStr.includes('activity_status')) {
          return 'TYPING_INDICATOR';
        }
      }
    }

    // 2. Kiem tra GraphQL Operation / Friendly Name
    var friendly = '';
    if (json) {
      if (json.fb_api_req_friendly_name) friendly = String(json.fb_api_req_friendly_name).toLowerCase();
      if (json.operationName) friendly = String(json.operationName).toLowerCase();
    }

    // 3. Story Seen Markers (Kiem tra truoc vi URL chua /seen de khong bi nham voi Read Receipt)
    if (
      u.includes('/stories/reel/seen') ||
      u.includes('/media/seen') ||
      friendly.includes('storiesseen') ||
      friendly.includes('storiesv3seen') ||
      friendly.includes('storiesreelsoseen') ||
      friendly.includes('storiesreelseen') ||
      t.includes('stories/reel/seen') ||
      t.includes('stories_reel_seen')
    ) {
      return 'STORY_SEEN';
    }

    // 4. Typing Indicator Markers & Stop Typing
    if (
      u.includes('/activity_status_indication') ||
      u.includes('/typing') ||
      t.includes('activity_status_indication') ||
      t.includes('indicate_activity') ||
      t.includes('typing_indicator') ||
      t.includes('is_typing') ||
      t.includes('"label":3') ||
      t.includes('"label": 3') ||
      t.includes('"label":"3"') ||
      friendly.includes('activitystatus') ||
      friendly.includes('typing')
    ) {
      if (
        t.includes('"activity_status":0') ||
        t.includes('"activity_status": 0') ||
        t.includes('"is_typing":0') ||
        t.includes('"is_typing": 0')
      ) {
        return 'STOP_TYPING';
      }
      return 'TYPING_INDICATOR';
    }

    // 5. Online Presence Amendment
    if (t.includes('presencereportingamendment')) {
      return 'ONLINE_PRESENCE';
    }

    // 6. Read Receipt Markers
    if (
      u.includes('/seen') ||
      u.includes('direct_v2_seen') ||
      friendly.includes('markthreadasread') ||
      friendly.includes('markthreadread') ||
      friendly.includes('readreceipt') ||
      friendly.includes('seen') ||
      t.includes('useigdmarkthreadasread') ||
      t.includes('last_read_watermark_ts') ||
      t.includes('direct_v2_seen') ||
      t.includes('mark_thread_read') ||
      t.includes('mark_thread_as_read') ||
      t.includes('thread_read_watermark') ||
      t.includes('"action":"seen"') ||
      t.includes('"label":21') ||
      t.includes('"label": 21') ||
      t.includes('"label":"21"') ||
      t.includes('"label":72') ||
      t.includes('"label": 72') ||
      t.includes('"label":"72"') ||
      t.includes('"label":235') ||
      t.includes('"label": 235') ||
      t.includes('"label":"235"') ||
      t.includes('"label":6') ||
      t.includes('"label": 6')
    ) {
      return 'READ_RECEIPT';
    }

    // 6. Link Shim Tracking
    if (u.includes('l.instagram.com') || t.includes('l.instagram.com') || u.includes('/linkshim')) {
      return 'LINK_SHIM';
    }

    // 7. DGW Channels
    if (u.includes('/ws/lightspeed')) {
      return 'DGW_LIGHTSPEED';
    }
    if (u.includes('/ws/realtime')) {
      return 'DGW_REALTIME';
    }
    if (u.includes('/ws/streamcontroller')) {
      return 'DGW_STREAM';
    }
    if (u.includes('/ws/mqttbypass')) {
      return 'DGW_MQTT';
    }

    // 8. GraphQL Direct / Feed
    if (u.includes('/graphql') || u.includes('/api/graphql')) {
      return 'GRAPHQL';
    }

    return 'OTHER';
  }

  function emit(channel, method, url, rawData) {
    var parsed = parseBody(rawData);
    var category = identifyCategory(url, parsed.text, parsed.json, parsed.tasks);

    // Bo qua spam background khong lien quan (Vulture JS, logging beacon)
    if (
      url.includes('bootloader-endpoint') ||
      url.includes('/ajax/bz') ||
      url.includes('logging_client_events')
    ) {
      return;
    }

    var sig = channel + '::' + method + '::' + url.split('?')[0] + '::' + category;
    if (category === 'OTHER' && seenSignatures.has(sig)) {
      return;
    }
    if (category === 'OTHER') {
      seenSignatures.add(sig);
    }

    var item = {
      time: new Date().toLocaleTimeString(),
      category: category,
      channel: channel,
      method: method,
      url: url,
      tasks: parsed.tasks,
      payload: parsed.json || parsed.text,
    };
    captured.push(item);

    // Dinh dang hien thi truc tiep va ro rang trong DevTools Console
    if (category === 'READ_RECEIPT') {
      console.log(
        '%c[Instagram Detector] >>> READ RECEIPT DETECTED <<<',
        'background:#ef4444;color:#fff;font-weight:bold;font-size:13px;padding:4px 8px;border-radius:4px;'
      );
      console.log('Kenh:', channel, '| Method:', method, '| URL:', url);
      if (parsed.tasks.length > 0) {
        console.log('Task Labels:', parsed.tasks.map(function (t) { return t.label; }).join(', '));
        console.log('DGW Tasks chi tiet:', parsed.tasks);
      }
      console.log('Payload:', parsed.json || parsed.text);
    } else if (category === 'TYPING_INDICATOR') {
      console.log(
        '%c[Instagram Detector] >>> TYPING INDICATOR DETECTED <<<',
        'background:#f59e0b;color:#000;font-weight:bold;font-size:13px;padding:4px 8px;border-radius:4px;'
      );
      console.log('Kenh:', channel, '| Method:', method, '| URL:', url);
      if (parsed.tasks.length > 0) {
        console.log('Task Labels:', parsed.tasks.map(function (t) { return t.label; }).join(', '));
        console.log('DGW Tasks chi tiet:', parsed.tasks);
      }
      console.log('Payload:', parsed.json || parsed.text);
    } else if (category === 'STOP_TYPING') {
      console.log(
        '%c[Instagram Detector] >>> STOP TYPING DETECTED <<<',
        'background:#78716c;color:#fff;font-weight:bold;font-size:12px;padding:3px 6px;border-radius:4px;'
      );
      console.log('Kenh:', channel, '| Method:', method, '| URL:', url);
      console.log('Payload:', parsed.json || parsed.text);
    } else if (category === 'ONLINE_PRESENCE') {
      console.log(
        '%c[Instagram Detector] >>> ONLINE PRESENCE AMENDMENT <<<',
        'background:#10b981;color:#fff;font-weight:bold;font-size:12px;padding:3px 6px;border-radius:4px;'
      );
      console.log('Kenh:', channel, '| Method:', method, '| URL:', url);
      console.log('Payload:', parsed.json || parsed.text);
    } else if (category === 'STORY_SEEN') {
      console.log(
        '%c[Instagram Detector] >>> STORY SEEN DETECTED <<<',
        'background:#8b5cf6;color:#fff;font-weight:bold;font-size:13px;padding:4px 8px;border-radius:4px;'
      );
      console.log('Kenh:', channel, '| Method:', method, '| URL:', url);
      console.log('Payload:', parsed.json || parsed.text);
    } else if (category === 'LINK_SHIM') {
      console.log(
        '%c[Instagram Detector] >>> LINK SHIM DETECTED <<<',
        'background:#06b6d4;color:#000;font-weight:bold;font-size:13px;padding:4px 8px;border-radius:4px;'
      );
      console.log('Kenh:', channel, '| URL:', url);
    } else if (category === 'DGW_LIGHTSPEED' || category === 'DGW_REALTIME') {
      var taskDesc = parsed.tasks.length > 0
        ? ' (Tasks: ' + parsed.tasks.map(function (t) { return t.label; }).join(',') + ')'
        : '';
      console.log(
        '%c[Instagram ' + category + ']' + taskDesc,
        'background:#3b82f6;color:#fff;font-weight:bold;padding:2px 6px;border-radius:3px;'
      );
      if (parsed.tasks.length > 0) {
        console.log('Tasks:', parsed.tasks);
      }
      if (parsed.json) {
        console.log('Frame JSON:', parsed.json);
      } else if (parsed.text) {
        console.log('Frame Text (dau):', parsed.text.slice(0, 200));
      }
    } else {
      // Cac goi tin khac (MessagePort, GraphQL, Stream)
      var title = '[' + channel + '] ' + category + ' -> ' + url.slice(0, 70);
      console.groupCollapsed('%c' + title, 'background:#64748b;color:#fff;font-size:11px;padding:2px 5px;');
      console.log('Category:', category);
      console.log('URL:', url);
      console.log('Payload:', parsed.json || parsed.text);
      console.groupEnd();
    }
  }

  // --- 1. Hook Fetch ---
  var origFetch = window.fetch;
  window.fetch = function (input, init) {
    try {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var method = (init && init.method) || (typeof input === 'object' && input && input.method) || 'GET';
      var body = (init && init.body) !== undefined ? init.body : undefined;
      emit('Fetch', String(method).toUpperCase(), String(url), body);
    } catch {
      // ignore
    }
    return origFetch.apply(this, arguments);
  };

  // --- 2. Hook XMLHttpRequest ---
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

  // --- 3. Hook WebSocket.send (Ho tro ca Blob, ArrayBuffer, View va String) ---
  var origWsSend = WebSocket.prototype.send;
  WebSocket.prototype.send = function (data) {
    var wsUrl = this.url || 'WebSocket';
    try {
      if (typeof Blob !== 'undefined' && data instanceof Blob) {
        data.arrayBuffer().then(function (ab) {
          emit('WebSocket', 'SEND', wsUrl, ab);
        }).catch(function () {
          // ignore
        });
      } else {
        emit('WebSocket', 'SEND', wsUrl, data);
      }
    } catch {
      // ignore
    }
    try {
      return origWsSend.apply(this, arguments);
    } catch {
      // ignore
    }
  };

  // --- 4. Hook sendBeacon ---
  if (navigator.sendBeacon) {
    var origBeacon = navigator.sendBeacon;
    navigator.sendBeacon = function (url, data) {
      try {
        emit('Beacon', 'POST', String(url), data);
      } catch {
        // ignore
      }
      return origBeacon.apply(this, arguments);
    };
  }

  // --- 5. Hook Worker.postMessage ---
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

  // --- 6. Hook MessagePort.postMessage ---
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
    if (navigator.sendBeacon && origBeacon) {
      navigator.sendBeacon = origBeacon;
    }
    if (window.Worker && origWorkerPost) {
      Worker.prototype.postMessage = origWorkerPost;
    }
    if (window.MessagePort && origPortPost) {
      MessagePort.prototype.postMessage = origPortPost;
    }
    console.log('[Instagram Detector] Da go bo toan bo hook va khoi phuc nguyen ban.');
  }

  window.__igDetector = {
    getCaptured: function () {
      return captured;
    },
    getSignatures: function () {
      var map = {
        READ_RECEIPT: [],
        TYPING_INDICATOR: [],
        STOP_TYPING: [],
        ONLINE_PRESENCE: [],
        STORY_SEEN: [],
        LINK_SHIM: [],
        DGW_LIGHTSPEED: [],
        DGW_REALTIME: [],
        DGW_MQTT: [],
        DGW_STREAM: [],
        GRAPHQL: [],
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
      console.log('[Instagram Detector] Da xoa lich su bat.');
    },
    stop: stop,
  };

  console.log(
    '%c[Instagram Detector Active] San sang! Khong co UI. Hay click xem tin nhan, go chat hoac xem story.',
    'background:#10b981;color:#fff;font-weight:bold;font-size:13px;padding:6px 10px;border-radius:5px;'
  );
  console.log('Moi goi tin lien quan se tu dong hien thi truc tiep ngay ben duoi trong Console.');
})();
