// A probe that answers: when the typing indicator reaches the other person, what left the browser?
//
// The lightspeed frame probe saw nothing during a typing session that the recipient definitely
// saw, so typing does not travel as a WebSocket.send on the top frame lightspeed socket. This one
// does not assume where it goes instead. It watches every outbound channel a page has and reports
// what happened between two marks, so the answer comes from a controlled comparison rather than
// from a guess about Meta's architecture.
//
// It observes and never blocks. From bodies it reads only sizes, path names, GraphQL operation
// names and whether a small set of structural words appear. No value, no identifier, no message
// text is recorded.
//
// Paste it, then:
//   __typingProbe.mark('idle')     wait a few seconds, touching nothing
//   __typingProbe.mark('typing')   focus the composer and type, do not send
//   __typingProbe.mark('stopped')  stop typing, wait
//   __typingProbe.report()

(function installTypingTransportProbe() {
  'use strict';

  // Structural words. A body containing one is worth a closer look; a body containing none is
  // almost certainly not the typing signal.
  var MARKERS = ['is_typing', 'typing', '"tasks"', '"label"', 'thread_key'];

  // A GraphQL operation name says what a request is for and carries no personal data, which
  // makes it the single most useful thing to extract if typing turns out to be an http call.
  var NAME_KEYS = ['fb_api_req_friendly_name', 'doc_id'];

  var HEX_PREFIX_BYTES = 12;

  var decoder = new TextDecoder('utf-8');
  var events = [];
  var startedAt = Date.now();

  function pathOf(url) {
    try {
      return new URL(url, globalThis.location ? globalThis.location.href : undefined).pathname;
    } catch {
      return String(url).slice(0, 120);
    }
  }

  function push(kind, detail) {
    detail.kind = kind;
    detail.ms = Date.now() - startedAt;
    events.push(detail);
  }

  function markersIn(text) {
    return MARKERS.filter(function (marker) {
      return text.indexOf(marker) !== -1;
    });
  }

  // Pulls out the operation name and query id only. Both name a request rather than describing a
  // person, and without them an http answer would be a path and a byte count.
  function namesIn(text) {
    var found = {};
    NAME_KEYS.forEach(function (key) {
      var pattern = "(?:^|[?&\"'])" + key + "[\"']?[=:]\\s*\"?([A-Za-z0-9_]{1,80})";
      var match = new RegExp(pattern).exec(text);
      if (match) {
        found[key] = match[1];
      }
    });
    return found;
  }

  function describeBody(body) {
    if (body === null || typeof body === 'undefined') {
      return { bodyType: 'none', bytes: 0, markers: [], names: {} };
    }
    var text = null;
    var type = typeof body;
    if (typeof body === 'string') {
      text = body;
      type = 'string';
    } else if (body instanceof URLSearchParams) {
      text = body.toString();
      type = 'urlencoded';
    } else if (body instanceof ArrayBuffer) {
      text = decoder.decode(new Uint8Array(body));
      type = 'arraybuffer';
    } else if (ArrayBuffer.isView(body)) {
      text = decoder.decode(new Uint8Array(body.buffer, body.byteOffset, body.byteLength));
      type = 'binary';
    } else if (typeof FormData !== 'undefined' && body instanceof FormData) {
      var parts = [];
      body.forEach(function (value, key) {
        parts.push(key + '=' + (typeof value === 'string' ? value : '<file>'));
      });
      text = parts.join('&');
      type = 'formdata';
    } else if (typeof Blob !== 'undefined' && body instanceof Blob) {
      return { bodyType: 'blob', bytes: body.size, markers: [], names: {} };
    }
    if (text === null) {
      return { bodyType: type, bytes: null, markers: [], names: {} };
    }
    return {
      bodyType: type,
      bytes: text.length,
      markers: markersIn(text),
      names: namesIn(text),
    };
  }

  function hexPrefix(bytes) {
    var out = [];
    for (var i = 0; i < Math.min(bytes.length, HEX_PREFIX_BYTES); i += 1) {
      out.push((bytes[i] < 16 ? '0' : '') + bytes[i].toString(16));
    }
    return out.join(' ');
  }

  // Every outbound channel a page has, patched one at a time. A channel that is patched and
  // silent during typing rules itself out, which is worth as much as the one that fires.

  var originalSend = WebSocket.prototype.send;
  WebSocket.prototype.send = function patchedSocketSend(data) {
    try {
      var bytes = null;
      if (data instanceof ArrayBuffer) {
        bytes = new Uint8Array(data);
      } else if (ArrayBuffer.isView(data)) {
        bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      } else if (typeof data === 'string') {
        bytes = new TextEncoder().encode(data);
      }
      push('ws.send', {
        path: pathOf(this.url),
        bytes: bytes ? bytes.length : null,
        headHex: bytes ? hexPrefix(bytes) : null,
        markers: bytes ? markersIn(decoder.decode(bytes)) : [],
      });
    } catch (err) {
      console.warn('[typingProbe] ws observation failed', err);
    }
    return originalSend.apply(this, arguments);
  };

  var OriginalWebSocket = globalThis.WebSocket;
  function PatchedWebSocket(url, protocols) {
    push('ws.open', { path: pathOf(url) });
    return protocols === undefined
      ? new OriginalWebSocket(url)
      : new OriginalWebSocket(url, protocols);
  }
  PatchedWebSocket.prototype = OriginalWebSocket.prototype;
  ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'].forEach(function (key, index) {
    PatchedWebSocket[key] = index;
  });
  globalThis.WebSocket = PatchedWebSocket;

  var originalFetch = globalThis.fetch;
  globalThis.fetch = function patchedFetch(input, init) {
    try {
      var url = typeof input === 'string' ? input : input && input.url;
      var body = init && init.body;
      var described = describeBody(body);
      described.path = pathOf(url);
      described.method = (init && init.method) || (input && input.method) || 'GET';
      push('fetch', described);
    } catch (err) {
      console.warn('[typingProbe] fetch observation failed', err);
    }
    return originalFetch.apply(this, arguments);
  };

  var originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function patchedOpen(method, url) {
    this.__typingProbeMethod = method;
    this.__typingProbeUrl = url;
    return originalOpen.apply(this, arguments);
  };

  var originalXhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function patchedXhrSend(body) {
    try {
      var described = describeBody(body);
      described.path = pathOf(this.__typingProbeUrl);
      described.method = this.__typingProbeMethod || 'GET';
      push('xhr', described);
    } catch (err) {
      console.warn('[typingProbe] xhr observation failed', err);
    }
    return originalXhrSend.apply(this, arguments);
  };

  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    var originalBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function patchedBeacon(url, data) {
      try {
        var described = describeBody(data);
        described.path = pathOf(url);
        push('beacon', described);
      } catch (err) {
        console.warn('[typingProbe] beacon observation failed', err);
      }
      return originalBeacon(url, data);
    };
  }

  // A worker cannot be patched from here, but knowing one was created, and with which script,
  // turns "somewhere else" into a named place to look next.
  ['Worker', 'SharedWorker'].forEach(function (name) {
    var Original = globalThis[name];
    if (!Original) {
      return;
    }
    function Patched(url, options) {
      push(name.toLowerCase() + '.create', { path: pathOf(url) });
      return options === undefined ? new Original(url) : new Original(url, options);
    }
    Patched.prototype = Original.prototype;
    globalThis[name] = Patched;
  });

  function mark(name) {
    push('mark', { name: String(name) });
    console.log('[typingProbe] mark: ' + name);
    return name;
  }

  function tally(values) {
    var counts = {};
    values.forEach(function (value) {
      counts[value] = (counts[value] || 0) + 1;
    });
    return counts;
  }

  // Everything is reported per window between marks, because the question is not what the page
  // sends but what it sends only while typing.
  function windows() {
    var out = [];
    var current = { name: '(before any mark)', events: [] };
    events.forEach(function (event) {
      if (event.kind === 'mark') {
        out.push(current);
        current = { name: event.name, from: event.ms, events: [] };
      } else {
        current.events.push(event);
      }
    });
    out.push(current);
    return out.filter(function (window) {
      return window.events.length > 0 || window.name !== '(before any mark)';
    });
  }

  function summarizeWindow(window) {
    var withMarkers = window.events.filter(function (event) {
      return event.markers && event.markers.length > 0;
    });
    return {
      window: window.name,
      total: window.events.length,
      byKind: tally(window.events.map(function (event) { return event.kind; })),
      byPath: tally(window.events.map(function (event) { return event.kind + ' ' + event.path; })),
      // The short list. Anything here is a candidate for carrying the typing signal.
      carryingMarkers: withMarkers.map(function (event) {
        return {
          kind: event.kind,
          path: event.path,
          method: event.method,
          bytes: event.bytes,
          headHex: event.headHex,
          markers: event.markers,
          names: event.names,
        };
      }),
      graphqlNames: tally(
        window.events
          .filter(function (event) { return event.names && event.names.fb_api_req_friendly_name; })
          .map(function (event) { return event.names.fb_api_req_friendly_name; }),
      ),
    };
  }

  function summarize() {
    var all = windows().map(summarizeWindow);
    var typing = all.filter(function (window) { return /typ/i.test(window.window); });
    var candidates = typing.reduce(function (acc, window) {
      return acc.concat(window.carryingMarkers);
    }, []);
    return {
      startedAt: new Date(startedAt).toISOString(),
      totalEvents: events.length,
      windows: all,
      verdict:
        events.filter(function (e) { return e.kind !== 'mark'; }).length === 0
          ? 'NOTHING OBSERVED AT ALL. The probe is not installed on the right context.'
          : typing.length === 0
            ? 'NO TYPING WINDOW. Call mark("typing") before typing, then report again.'
            : candidates.length === 0
              ? 'NO CANDIDATE. Nothing sent while typing contained a structural marker. Compare byPath across windows by hand: whatever appears only in the typing window is the lead.'
              : 'CANDIDATES FOUND, listed under the typing window as carryingMarkers.',
    };
  }

  function report() {
    var summary = summarize();
    console.log('[typingProbe] ' + summary.verdict);
    console.log(JSON.stringify(summary, null, 2));
    return summary;
  }

  function stop() {
    WebSocket.prototype.send = originalSend;
    globalThis.WebSocket = OriginalWebSocket;
    globalThis.fetch = originalFetch;
    XMLHttpRequest.prototype.open = originalOpen;
    XMLHttpRequest.prototype.send = originalXhrSend;
    console.log('[typingProbe] restored');
  }

  globalThis.__typingProbe = {
    events: events,
    mark: mark,
    describeBody: describeBody,
    windows: windows,
    summarize: summarize,
    report: report,
    stop: stop,
  };

  console.log('[typingProbe] watching every outbound channel. Start with __typingProbe.mark("idle")');
})();
