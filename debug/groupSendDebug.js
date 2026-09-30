/*
 * Messenger group send debugger. Paste into DevTools Console (read only, no page code is changed).
 *
 * Purpose: find out why a message sent to a group stays in "Sending" forever.
 * It records: fetch/XHR calls, the /ws/lightspeed WebSocket frames (task labels, request ids, replies),
 * worker activity, JS errors, and whether privacy shims changed native browser APIs.
 *
 * Usage:
 *   1. Open the group thread on facebook.com or messenger.com, open DevTools Console, paste this file.
 *   2. Force the socket to reconnect under the hook: DevTools > Network > set "Offline", wait 3s, set "No throttling".
 *   3. Send a message to the group and wait about 15s. A warning appears when the message is stuck.
 *   4. Run __fbDbg.status() then __fbDbg.download() to save a JSON report.
 *
 * Privacy: message text, tokens and cookies are redacted (best effort). Thread ids are kept.
 * Review the JSON before sharing it. Use only on your own account.
 *
 * Helpers: __fbDbg.status() .tamper() .tail(30) .filter('ls') .dump() .download() .copy() .stop()
 * Flags:   __fbDbg.verbose = true (live console output), __fbDbg.logAll = true (log every request)
 */
(() => {
  if (window.__fbDbg && window.__fbDbg.installed) {
    console.warn('[dbg] already installed, call __fbDbg.stop() first');
    return;
  }

  const MAX_LOG = 6000;
  const STUCK_MS = 10000;
  const log = [];
  const originals = {};
  const counters = {};
  const lsReq = new Map();
  const sockets = new Map();
  const listeners = [];
  let seq = 0;
  let lastLsReqAt = 0;
  let lastLsRespAt = 0;

  const safe = (fn) => {
    try {
      return fn();
    } catch (e) {
      return undefined;
    }
  };
  const tryJson = (s) => safe(() => JSON.parse(s));

  const push = (type, data) => {
    safe(() => {
      counters[type] = (counters[type] || 0) + 1;
      log.push({ t: Date.now(), type, data });
      if (log.length > MAX_LOG) log.shift();
      if (api.verbose) console.log('[dbg]', type, data);
    });
  };

  const redact = (s) => {
    if (typeof s !== 'string') return s;
    return s
      .replace(/(\\*"(?:text|body|message_text|snippet)\\*":\\*")(.*?)(\\*"[,}\]])/g, '$1<redacted>$3')
      .replace(/((?:access_token|fb_dt|lsd|jazoest|__dyn|__csr|c_user|xs|datr)(?:=|\\*":\\*"))[^&"\\]+/g, '$1<redacted>');
  };

  const cleanUrl = (u) =>
    safe(() => {
      const x = new URL(String(u), location.href);
      return x.origin + x.pathname + (x.search ? '?' + Array.from(x.searchParams.keys()).join('&') : '');
    }) || String(u).slice(0, 120);

  const NOISE = /\/ajax\/bz|bulkroute|rsrc\.php|\.(js|css|png|jpe?g|webp|gif|woff2?|svg|ico)(\?|$)|\/logging|\/security\/hsts|batch_log/i;
  const INTEREST = /graphql|\/ajax\/|\/api\/|mercury|messag|\/t_|upload|send|\/ls_/i;
  const wanted = (u) => api.logAll || (INTEREST.test(String(u)) && !NOISE.test(String(u)));

  const summarizeTasks = (obj) => {
    const out = [];
    const walk = (o, depth) => {
      if (!o || depth > 4) return;
      if (Array.isArray(o)) {
        o.forEach((x) => walk(x, depth + 1));
        return;
      }
      if (typeof o !== 'object') return;
      if (Array.isArray(o.tasks)) {
        o.tasks.forEach((t) =>
          out.push({
            label: t.label,
            queue: String(safe(() => JSON.stringify(t.queue_name))).slice(0, 80),
            taskId: t.task_id,
            failures: t.failure_count,
          })
        );
      }
      Object.keys(o).forEach((k) => {
        if (o[k] && typeof o[k] === 'object') walk(o[k], depth + 1);
      });
    };
    walk(obj, 0);
    return out;
  };

  const summarizeParams = (p) => {
    const info = { keys: [] };
    p.forEach((v, k) => {
      info.keys.push(k + ':' + String(v).length);
      if (k === 'fb_api_req_friendly_name' || k === 'doc_id' || k === 'fb_api_caller_class') info[k] = v;
      if (k === 'variables' || k === 'payload') {
        const j = tryJson(v);
        if (j && typeof j === 'object') {
          info[k + 'Keys'] = Object.keys(j).slice(0, 15);
          info[k + 'Tasks'] = summarizeTasks(j);
          if (typeof j.payload === 'string') {
            const inner = tryJson(j.payload);
            if (inner) info.innerTasks = summarizeTasks(inner);
          }
        }
      }
    });
    return info;
  };

  const summarizeBody = (b) =>
    safe(() => {
      if (b == null) return null;
      if (typeof b === 'string') {
        return b.indexOf('=') >= 0 ? summarizeParams(new URLSearchParams(b)) : { text: redact(b.slice(0, 200)) };
      }
      if (b instanceof URLSearchParams) return summarizeParams(b);
      if (b instanceof FormData) {
        const p = new URLSearchParams();
        b.forEach((v, k) => {
          if (typeof v === 'string') p.append(k, v);
        });
        return summarizeParams(p);
      }
      return { kind: Object.prototype.toString.call(b) };
    });

  const ERR = /"errors?"\s*:|error_code|errorCode|"error_summary"|"description"\s*:\s*"[^"]*(fail|denied|block|limit|spam)/i;
  const scanResponse = (id, text) => {
    const hit = ERR.exec(text);
    push('http:resBody', {
      id,
      len: text.length,
      errorHit: hit ? redact(text.slice(Math.max(0, hit.index - 40), hit.index + 300)) : null,
      head: redact(text.slice(0, 300)),
    });
  };

  // ---------- environment checks (run before hooking) ----------
  const NATIVE = /\{\s*\[native code\]\s*\}/;
  const getDesc = (proto, prop) => safe(() => Object.getOwnPropertyDescriptor(proto, prop).get);
  const targets = [
    ['fetch', () => window.fetch],
    ['XHR.open', () => XMLHttpRequest.prototype.open],
    ['XHR.send', () => XMLHttpRequest.prototype.send],
    ['WebSocket', () => window.WebSocket],
    ['WebSocket.send', () => WebSocket.prototype.send],
    ['Worker', () => window.Worker],
    ['SharedWorker', () => window.SharedWorker],
    ['BroadcastChannel', () => window.BroadcastChannel],
    ['sendBeacon', () => navigator.sendBeacon],
    ['Date', () => Date],
    ['Date.now', () => Date.now],
    ['performance.now', () => performance.now],
    ['Math.random', () => Math.random],
    ['crypto.getRandomValues', () => crypto.getRandomValues],
    ['crypto.randomUUID', () => crypto.randomUUID],
    ['setTimeout', () => window.setTimeout],
    ['setInterval', () => window.setInterval],
    ['requestAnimationFrame', () => window.requestAnimationFrame],
    ['IDBFactory.open', () => IDBFactory.prototype.open],
    ['Function.toString', () => Function.prototype.toString],
    ['TextEncoder', () => window.TextEncoder],
    ['TextDecoder', () => window.TextDecoder],
    ['postMessage', () => window.postMessage],
    ['Navigator.userAgent', () => getDesc(Navigator.prototype, 'userAgent')],
    ['Navigator.hardwareConcurrency', () => getDesc(Navigator.prototype, 'hardwareConcurrency')],
    ['Navigator.language', () => getDesc(Navigator.prototype, 'language')],
    ['Navigator.platform', () => getDesc(Navigator.prototype, 'platform')],
    ['Navigator.onLine', () => getDesc(Navigator.prototype, 'onLine')],
  ];

  const tamperCheck = () => {
    const frame = document.createElement('iframe');
    frame.style.display = 'none';
    document.documentElement.appendChild(frame);
    const freshToString = safe(() => frame.contentWindow.Function.prototype.toString);
    const rows = targets.map(([name, get]) => {
      const fn = safe(get);
      if (typeof fn !== 'function') return { name, present: false, mainNative: true, freshNative: true };
      return {
        name,
        present: true,
        mainNative: !!safe(() => NATIVE.test(Function.prototype.toString.call(fn))),
        freshNative: freshToString ? !!safe(() => NATIVE.test(freshToString.call(fn))) : null,
      };
    });
    frame.remove();
    return rows;
  };

  const randomCheck = () => {
    const m = new Set();
    for (let i = 0; i < 500; i++) m.add(Math.random());
    const g = new Set();
    for (let i = 0; i < 100; i++) g.add(crypto.getRandomValues(new Uint32Array(1))[0]);
    let monotonic = true;
    let prev = Date.now();
    for (let i = 0; i < 2000; i++) {
      const n = Date.now();
      if (n < prev) monotonic = false;
      prev = n;
    }
    return { mathRandomUnique: m.size + '/500', cryptoUnique: g.size + '/100', dateNowMonotonic: monotonic };
  };

  const clockCheck = () => ({
    dateNow: Date.now(),
    perfBased: Math.round(performance.timeOrigin + performance.now()),
    driftMs: Date.now() - Math.round(performance.timeOrigin + performance.now()),
    timeZone: safe(() => Intl.DateTimeFormat().resolvedOptions().timeZone),
    tzOffsetMin: new Date().getTimezoneOffset(),
  });

  const tamperResult = safe(tamperCheck) || [];
  const randomResult = safe(randomCheck);
  const clockResult = safe(clockCheck);

  const t0d = Date.now();
  const t0p = performance.now();
  setTimeout(
    () => push('env:timer', { expectedMs: 200, dateElapsed: Date.now() - t0d, perfElapsed: Math.round(performance.now() - t0p) }),
    200
  );

  // ---------- fetch ----------
  originals.fetch = window.fetch;
  window.fetch = function (input, init) {
    const url = safe(() => (typeof input === 'string' ? input : input.url));
    const want = wanted(url);
    const id = ++seq;
    const start = Date.now();
    if (want) {
      push('fetch:req', {
        id,
        url: cleanUrl(url),
        method: (init && init.method) || (input && input.method) || 'GET',
        body: summarizeBody(init && init.body),
        online: navigator.onLine,
      });
    }
    const p = originals.fetch.apply(this, arguments);
    if (want) {
      p.then(
        (res) => {
          push('fetch:res', { id, status: res.status, ok: res.ok, ms: Date.now() - start });
          safe(() =>
            res
              .clone()
              .text()
              .then((t) => scanResponse(id, t))
              .catch((e) => push('fetch:bodyErr', { id, msg: String(e) }))
          );
        },
        (err) => push('fetch:err', { id, ms: Date.now() - start, msg: String(err) })
      );
    }
    return p;
  };

  // ---------- XHR ----------
  const xp = XMLHttpRequest.prototype;
  originals.xhrOpen = xp.open;
  originals.xhrSend = xp.send;
  xp.open = function (method, url) {
    this.__dbg = { method, url };
    return originals.xhrOpen.apply(this, arguments);
  };
  xp.send = function (body) {
    const meta = this.__dbg;
    if (meta && wanted(meta.url)) {
      const id = ++seq;
      const start = Date.now();
      push('xhr:req', { id, url: cleanUrl(meta.url), method: meta.method, body: summarizeBody(body), online: navigator.onLine });
      ['load', 'error', 'timeout', 'abort'].forEach((kind) =>
        this.addEventListener(kind, () =>
          push('xhr:' + kind, { id, status: this.status, ms: Date.now() - start, readyState: this.readyState })
        )
      );
      this.addEventListener('load', () =>
        safe(() => {
          if (typeof this.responseText === 'string') scanResponse(id, this.responseText);
        })
      );
    }
    return originals.xhrSend.apply(this, arguments);
  };

  // ---------- WebSocket (Lightspeed frames) ----------
  // Observed format on /ws/lightspeed: a short binary header of variable length that contains a literal {}
  // (a naive scan for the first brace parses an empty object), then JSON:
  //   { app_id, payload (string), request_id, type }
  //   payload -> { epoch_id, tasks[], version_id } or a single task { label, payload, version }
  //   task.payload -> a JSON string with the task fields
  const td = new TextDecoder('utf8');

  const toBytes = (d) => {
    if (typeof d === 'string') return Promise.resolve(d);
    if (d instanceof ArrayBuffer) return Promise.resolve(new Uint8Array(d));
    if (ArrayBuffer.isView(d)) return Promise.resolve(new Uint8Array(d.buffer, d.byteOffset, d.byteLength));
    if (typeof Blob !== 'undefined' && d instanceof Blob) return d.arrayBuffer().then((b) => new Uint8Array(b));
    return Promise.resolve(null);
  };

  const extractJson = (text) => {
    const limit = Math.min(text.length, 200);
    const end = text.lastIndexOf('}');
    for (let i = 0; i < limit; i++) {
      if (text[i] !== '{') continue;
      const j = tryJson(text.slice(i, end + 1));
      if (j && typeof j === 'object' && Object.keys(j).length > 0) return j;
    }
    return null;
  };

  const fieldNames = (s) => {
    const o = typeof s === 'string' ? tryJson(s) : s;
    return o && typeof o === 'object' ? Object.keys(o).slice(0, 20) : null;
  };

  const describeInner = (payload) => {
    const inner = typeof payload === 'string' ? tryJson(payload) : payload;
    if (!inner || typeof inner !== 'object') return null;
    const isList = Array.isArray(inner.tasks);
    const tasks = isList ? inner.tasks : inner.label != null ? [inner] : [];
    return {
      shape: isList ? 'tasks[]' : inner.label != null ? 'single' : 'other',
      innerKeys: Object.keys(inner).slice(0, 10),
      tasks: tasks.map((t) => ({
        label: t.label,
        queue: String(safe(() => JSON.stringify(t.queue_name))).slice(0, 60),
        fields: fieldNames(t.payload),
      })),
    };
  };

  const handleMqtt = (dir, wsId, info) => {
    if (!info) return;
    const ws = sockets.get(wsId);
    const path = (ws && safe(() => new URL(ws.url).pathname)) || '';
    const rec = { ws: wsId, dir, path, bytes: info.bytes };
    if (!/lightspeed/.test(path)) {
      push('ws:frame', rec);
      return;
    }
    const text = typeof info.raw === 'string' ? info.raw : td.decode(info.raw);
    const j = extractJson(text);
    if (j) {
      rec.requestId = j.request_id;
      rec.appId = j.app_id;
      rec.msgType = j.type;
      Object.assign(rec, describeInner(j.payload));
      if (dir === 'in') rec.head = redact(text.slice(0, 300));
    } else {
      rec.unparsed = true;
      rec.head = redact(text.slice(0, 120));
    }
    if (dir === 'out') {
      lastLsReqAt = Date.now();
      if (rec.requestId != null) lsReq.set(String(rec.requestId), { t: lastLsReqAt, tasks: rec.tasks });
    } else {
      lastLsRespAt = Date.now();
      const r = rec.requestId != null && lsReq.get(String(rec.requestId));
      if (r) {
        rec.rttMs = Date.now() - r.t;
        lsReq.delete(String(rec.requestId));
      }
    }
    push('ls', rec);
  };

  const asPacket = (b) => (b == null ? null : { bytes: b.length, raw: b });

  originals.WebSocket = window.WebSocket;
  window.WebSocket = new Proxy(originals.WebSocket, {
    construct(target, args) {
      const ws = new target(...args);
      const id = ++seq;
      sockets.set(id, ws);
      push('ws:new', { id, url: cleanUrl(args[0]) });
      ws.addEventListener('open', () => push('ws:open', { id }));
      ws.addEventListener('error', () => push('ws:error', { id, readyState: ws.readyState }));
      ws.addEventListener('close', (e) => push('ws:close', { id, code: e.code, reason: e.reason, wasClean: e.wasClean }));
      ws.addEventListener('message', (e) =>
        toBytes(e.data)
          .then((b) => handleMqtt('in', id, asPacket(b)))
          .catch(() => {})
      );
      const nativeSend = ws.send;
      ws.send = function (data) {
        safe(() =>
          toBytes(data)
            .then((b) => handleMqtt('out', id, asPacket(b)))
            .catch(() => {})
        );
        if (ws.readyState !== 1) push('ws:sendWhileNotOpen', { id, readyState: ws.readyState });
        return nativeSend.apply(this, arguments);
      };
      return ws;
    },
  });

  // ---------- workers ----------
  ['Worker', 'SharedWorker'].forEach((name) => {
    const Native = window[name];
    if (!Native) return;
    originals[name] = Native;
    window[name] = new Proxy(Native, {
      construct(target, args) {
        const w = new target(...args);
        const id = ++seq;
        push('worker:new', { kind: name, id, url: cleanUrl(args[0]) });
        w.addEventListener('error', (e) => push('worker:error', { kind: name, id, msg: redact(String(e.message)) }));
        w.addEventListener('messageerror', () => push('worker:messageerror', { kind: name, id }));
        return w;
      },
    });
  });

  // ---------- errors, console, connectivity ----------
  const listen = (target, name, handler, opts) => {
    target.addEventListener(name, handler, opts);
    listeners.push([target, name, handler, opts]);
  };
  listen(
    window,
    'error',
    (e) =>
      push('js:error', {
        msg: redact(String(e.message)),
        src: cleanUrl(e.filename || ''),
        line: e.lineno,
        col: e.colno,
        stack: redact(String((e.error && e.error.stack) || '').slice(0, 500)),
      }),
    true
  );
  listen(window, 'unhandledrejection', (e) =>
    push('js:unhandledrejection', { reason: redact(String((e.reason && (e.reason.stack || e.reason)) || '').slice(0, 500)) })
  );
  listen(window, 'online', () => push('net:online', {}));
  listen(window, 'offline', () => push('net:offline', {}));
  listen(document, 'visibilitychange', () => push('page:visibility', { state: document.visibilityState }));

  ['error', 'warn'].forEach((level) => {
    originals['console' + level] = console[level];
    console[level] = function () {
      if (String(arguments[0]).indexOf('[dbg]') !== 0) {
        const text = Array.from(arguments)
          .map((a) => safe(() => (typeof a === 'string' ? a : (a && a.stack) || JSON.stringify(a))))
          .join(' ');
        push('console:' + level, { msg: redact(text.slice(0, 500)) });
      }
      return originals['console' + level].apply(this, arguments);
    };
  });

  // ---------- UI watcher: message stuck in "Sending" ----------
  const PENDING = /^(sending|đang gửi)/i;
  const FAILED = /^(not sent|failed to send|chưa gửi|không gửi được)/i;

  const snapshot = () => ({
    now: Date.now(),
    online: navigator.onLine,
    visibility: document.visibilityState,
    hasFocus: document.hasFocus(),
    sockets: Array.from(sockets, ([id, ws]) => ({ id, readyState: ws.readyState, url: cleanUrl(ws.url) })),
    lsReqWithoutResponseOver5s: Array.from(lsReq, ([rid, v]) => ({ rid, ageMs: Date.now() - v.t, tasks: v.tasks })).filter(
      (x) => x.ageMs > 5000
    ),
    msSinceLastLsReq: lastLsReqAt ? Date.now() - lastLsReqAt : null,
    msSinceLastLsResp: lastLsRespAt ? Date.now() - lastLsRespAt : null,
    serviceWorkerControlled: !!(navigator.serviceWorker && navigator.serviceWorker.controller),
    counters: Object.assign({}, counters),
  });

  let pendingSince = 0;
  let lastPending = 0;
  let lastFailed = 0;
  let stuckReported = false;
  const watcher = setInterval(
    () =>
      safe(() => {
        const nowTs = Date.now();
        lsReq.forEach((v, rid) => {
          if (!v.flagged && nowTs - v.t > 8000) {
            v.flagged = true;
            const labelsSent = (v.tasks || []).map((t) => t.label);
            push('ls:noResponse', { rid, ageMs: nowTs - v.t, labels: labelsSent });
            console.warn('[dbg] lightspeed request ' + rid + ' (labels ' + labelsSent.join(',') + ') has no matching response after 8s. Pairing by request_id is unverified, check __fbDbg.filter("ls")');
          }
        });
        const labels = Array.from(document.querySelectorAll('[aria-label]')).map((el) => el.getAttribute('aria-label') || '');
        const pending = labels.filter((l) => PENDING.test(l)).length;
        const failed = labels.filter((l) => FAILED.test(l)).length;
        if (pending !== lastPending) {
          push('ui:pending', { count: pending });
          lastPending = pending;
        }
        if (failed !== lastFailed) {
          push('ui:failed', { count: failed, snapshot: snapshot() });
          lastFailed = failed;
        }
        if (pending > 0) {
          if (!pendingSince) {
            pendingSince = Date.now();
            stuckReported = false;
          }
          if (!stuckReported && Date.now() - pendingSince > STUCK_MS) {
            stuckReported = true;
            push('ui:stuck', snapshot());
            console.warn('[dbg] message stuck in Sending for over ' + STUCK_MS / 1000 + 's. Run __fbDbg.status()');
          }
        } else {
          pendingSince = 0;
        }
      }),
    1000
  );

  // ---------- public API ----------
  const buildReport = () => ({
    generatedAt: new Date().toISOString(),
    page: location.origin + location.pathname.replace(/\d{6,}/g, '<id>'),
    userAgent: navigator.userAgent,
    tamper: tamperResult,
    randomness: randomResult,
    clock: clockResult,
    snapshot: snapshot(),
    log: log.slice(),
  });

  const api = {
    installed: true,
    verbose: false,
    logAll: false,
    status() {
      const s = snapshot();
      console.table(s.sockets);
      console.log('[dbg] snapshot', s);
      return s;
    },
    tamper() {
      const bad = tamperResult.filter((x) => x.present && (!x.mainNative || x.freshNative === false));
      console.log('[dbg] non native APIs:', bad.length ? bad : 'none', '\nrandomness:', randomResult, '\nclock:', clockResult);
      return { bad, randomness: randomResult, clock: clockResult };
    },
    tail(n) {
      return log.slice(Math.max(0, log.length - (n || 30)));
    },
    filter(re) {
      const rx = new RegExp(re);
      return log.filter((e) => rx.test(e.type));
    },
    dump: buildReport,
    download() {
      const blob = new Blob([JSON.stringify(buildReport(), null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'fbGroupSendDebug_' + Date.now() + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
    },
    copy() {
      return navigator.clipboard.writeText(JSON.stringify(buildReport(), null, 2)).then(() => console.log('[dbg] copied'));
    },
    stop() {
      window.fetch = originals.fetch;
      xp.open = originals.xhrOpen;
      xp.send = originals.xhrSend;
      window.WebSocket = originals.WebSocket;
      if (originals.Worker) window.Worker = originals.Worker;
      if (originals.SharedWorker) window.SharedWorker = originals.SharedWorker;
      console.error = originals.consoleerror;
      console.warn = originals.consolewarn;
      listeners.forEach(([t, n, h, o]) => t.removeEventListener(n, h, o));
      clearInterval(watcher);
      api.installed = false;
      console.log('[dbg] stopped and originals restored');
    },
  };

  window.__fbDbg = api;
  const bad = tamperResult.filter((x) => x.present && (!x.mainNative || x.freshNative === false));
  console.log('[dbg] installed. Non native APIs found:', bad.length ? bad.map((x) => x.name) : 'none');
  console.log('[dbg] next: toggle Network Offline then back, send a group message, then run __fbDbg.status()');
})();
