// Probe v2: Monitors all Meta DGW WebSocket paths (/ws/lightspeed, /ws/streamcontroller,
// /ws/realtime, /ws/rpsignaling).
//
// Answers:
// 1. Does typing (task 3) travel over /ws/lightspeed or via a multiplexed stream (streamcontroller/realtime)?
// 2. Which socket and envelope carries each signal task (3, 72, 235)?
//
// Paste into page console on messenger.com or facebook.com.
// Live console alerts will trigger when signal tasks (typing / read receipt) are observed!
// Run __lsProbeV2.report() for the full breakdown. Run __lsProbeV2.stop() to restore send.

(function installLightspeedProbeV2() {
  'use strict';

  var OPEN_BRACE = 0x7b;
  var OPEN_BRACKET = 0x5b;
  var HEX_PREFIX_BYTES = 24;

  // Monitor all candidate paths on Meta's DGW / realtime sockets
  var MONITORED_PATHS = [
    '/ws/lightspeed',
    '/ws/streamcontroller',
    '/ws/realtime',
    '/ws/rpsignaling',
  ];

  // Markers checked in undecoded frames
  var TASK_MARKERS = ['tasks', 'label', 'thread_key', 'is_typing'];

  // Signal labels we are hunting:
  // 3 = UpdatePresence (is_typing)
  // 72 = Read receipt (thread_key)
  // 235 = Read receipt companion (thread_key)
  var SIGNAL_LABELS = ['3', '72', '235'];

  var decoder = new TextDecoder('utf-8');

  function readBalancedObject(text) {
    var first = text.charCodeAt(0);
    if (first !== OPEN_BRACE && first !== OPEN_BRACKET) {
      return null;
    }
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

  function decodeFrame(bytes) {
    for (var i = 0; i < bytes.length; i += 1) {
      if (bytes[i] !== OPEN_BRACE && bytes[i] !== OPEN_BRACKET) {
        continue;
      }
      var parsed = readBalancedObject(decoder.decode(bytes.subarray(i)));
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
        return { outer: parsed, headerBytes: i };
      }
    }
    return null;
  }

  function parseNested(value) {
    if (typeof value !== 'string') {
      return value;
    }
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  function extractTasks(candidate) {
    if (!candidate || typeof candidate !== 'object') {
      return { envelope: 'unknown', tasks: [] };
    }
    if (Array.isArray(candidate.tasks)) {
      return { envelope: 'array', tasks: candidate.tasks };
    }
    if (typeof candidate.label !== 'undefined') {
      return { envelope: 'single', tasks: [candidate] };
    }
    if (typeof candidate.is_typing !== 'undefined') {
      return { envelope: 'typing_direct', tasks: [{ label: '3', payload: candidate }] };
    }
    return { envelope: 'unknown', tasks: [] };
  }

  function describeTask(task) {
    var fields = [];
    var payload = parseNested(task && task.payload);
    if (payload && typeof payload === 'object') {
      fields = Object.keys(payload);
    }
    return {
      label: String(task && task.label),
      labelType: typeof (task && task.label),
      fields: fields,
      rawPayload: payload,
    };
  }

  var state = {
    frames: [],
    undecoded: [],
    sentByPath: {},
    installedAt: new Date().toISOString(),
  };

  function pathOf(url) {
    try {
      return new URL(url).pathname;
    } catch {
      return String(url);
    }
  }

  function hexPrefix(bytes) {
    var out = [];
    for (var i = 0; i < Math.min(bytes.length, HEX_PREFIX_BYTES); i += 1) {
      out.push((bytes[i] < 16 ? '0' : '') + bytes[i].toString(16));
    }
    return out.join(' ');
  }

  function markersIn(bytes) {
    var text = decoder.decode(bytes);
    return TASK_MARKERS.filter(function (marker) {
      return text.indexOf('"' + marker + '"') !== -1 || text.indexOf(marker) !== -1;
    });
  }

  function record(url, bytes) {
    var path = pathOf(url);
    var decoded = decodeFrame(bytes);

    if (!decoded) {
      var markers = markersIn(bytes);
      var undecodedEntry = {
        n: state.frames.length + state.undecoded.length,
        at: new Date().toISOString(),
        path: path,
        bytes: bytes.length,
        headHex: hexPrefix(bytes),
        markers: markers,
      };
      state.undecoded.push(undecodedEntry);

      if (markers.length > 0) {
        console.warn(
          '%c[lsProbeV2] ⚠️ UNDECODED FRAME HAS TASK MARKERS on ' + path + ' (' + bytes.length + ' bytes):',
          'color: orange; font-weight: bold',
          markers,
        );
      }
      return;
    }

    var candidate = parseNested(decoded.outer.payload) || decoded.outer;
    var extracted = extractTasks(candidate);
    if (extracted.tasks.length === 0 && candidate !== decoded.outer) {
      extracted = extractTasks(decoded.outer);
    }

    var described = extracted.tasks.map(describeTask);
    var labels = described.map(function (t) { return t.label; });

    var frameRecord = {
      n: state.frames.length + state.undecoded.length,
      at: new Date().toISOString(),
      path: path,
      bytes: bytes.length,
      headerBytes: decoded.headerBytes,
      headHex: hexPrefix(bytes),
      outerKeys: Object.keys(decoded.outer),
      envelope: extracted.envelope,
      taskCount: described.length,
      labels: labels,
      tasks: described,
    };
    state.frames.push(frameRecord);

    var hasSignal = labels.some(function (l) { return SIGNAL_LABELS.indexOf(l) !== -1; });
    if (hasSignal) {
      console.log(
        '%c[lsProbeV2] 🎯 SIGNAL CAPTURED on ' + path + '! Labels: ' + labels.join(', '),
        'background: #003300; color: #00ff66; font-size: 13px; font-weight: bold; padding: 2px 6px; border-radius: 4px;',
        described,
      );
    } else {
      console.log('[lsProbeV2] Decoded ' + path + ' (' + bytes.length + 'b): labels=[' + labels.join(',') + ']');
    }
  }

  function toBytes(data) {
    if (data instanceof ArrayBuffer) {
      return new Uint8Array(data);
    }
    if (ArrayBuffer.isView(data)) {
      return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    }
    if (typeof data === 'string') {
      return new TextEncoder().encode(data);
    }
    return null;
  }

  var original = WebSocket.prototype.send;

  WebSocket.prototype.send = function patchedSend(data) {
    try {
      var path = pathOf(this.url);
      state.sentByPath[path] = (state.sentByPath[path] || 0) + 1;

      var isTarget = MONITORED_PATHS.some(function (p) {
        return path.indexOf(p) !== -1;
      });

      if (isTarget) {
        var bytes = toBytes(data);
        if (bytes) {
          record(this.url, bytes);
        } else if (data && typeof data.arrayBuffer === 'function') {
          var url = this.url;
          data.arrayBuffer().then(function (buffer) {
            record(url, new Uint8Array(buffer));
          });
        }
      }
    } catch (err) {
      console.warn('[lsProbeV2] observation failed, frame passed untouched', err);
    }
    return original.apply(this, arguments);
  };

  function tally(values) {
    var counts = {};
    values.forEach(function (v) {
      counts[v] = (counts[v] || 0) + 1;
    });
    return counts;
  }

  function summarize() {
    var frames = state.frames;
    var undecoded = state.undecoded;
    var signalFrames = frames.filter(function (f) {
      return f.labels.some(function (l) { return SIGNAL_LABELS.indexOf(l) !== -1; });
    });

    var contaminated = signalFrames.filter(function (f) {
      return f.labels.some(function (l) { return SIGNAL_LABELS.indexOf(l) === -1; });
    });

    var envelopes = tally(frames.map(function (f) { return f.envelope; }));
    var decodedByPath = tally(frames.map(function (f) { return f.path; }));
    var undecodedByPath = tally(undecoded.map(function (f) { return f.path; }));

    var verdict;
    if (contaminated.length > 0) {
      verdict = 'DROPPING THE FRAME IS NOT SAFE. A signal task shared a frame with unrelated tasks.';
    } else if (signalFrames.length === 0) {
      verdict = 'NO SIGNAL SEEN. Exercise typing or read receipt in a conversation.';
    } else {
      verdict = 'SIGNAL CAPTURED: ' + signalFrames.length + ' signal frame(s) seen. Clean isolation: ' + (contaminated.length === 0);
    }

    return {
      installedAt: state.installedAt,
      sentByPath: state.sentByPath,
      decodedByPath: decodedByPath,
      undecodedByPath: undecodedByPath,
      totalDecoded: frames.length,
      totalUndecoded: undecoded.length,
      signalFramesFound: signalFrames.length,
      signalFrames: signalFrames.map(function (f) {
        return {
          n: f.n,
          path: f.path,
          envelope: f.envelope,
          labels: f.labels,
          taskCount: f.taskCount,
          taskFields: f.tasks.map(function (t) {
            return t.label + ': ' + t.fields.join(',') + (t.rawPayload && t.rawPayload.is_typing !== undefined ? ' (is_typing=' + t.rawPayload.is_typing + ')' : '');
          }),
        };
      }),
      envelopes: envelopes,
      labelFrequency: tally(frames.reduce(function (all, f) { return all.concat(f.labels); }, [])),
      labelsByPath: frames.reduce(function (acc, f) {
        acc[f.path] = acc[f.path] || [];
        acc[f.path] = acc[f.path].concat(f.labels);
        return acc;
      }, {}),
      verdict: verdict,
    };
  }

  function report() {
    var summary = summarize();
    console.log('[lsProbeV2] ' + summary.verdict);
    console.log(JSON.stringify(summary, null, 2));
    return summary;
  }

  function stop() {
    WebSocket.prototype.send = original;
    console.log('[lsProbeV2] send restored to original');
  }

  globalThis.__lsProbeV2 = {
    state: state,
    signalLabels: SIGNAL_LABELS,
    monitoredPaths: MONITORED_PATHS,
    summarize: summarize,
    report: report,
    stop: stop,
  };

  // Backwards compatibility alias
  globalThis.__lsProbe = globalThis.__lsProbeV2;

  console.log(
    '%c[lsProbeV2] Installed! Monitoring paths: ' + MONITORED_PATHS.join(', '),
    'color: #00ffff; font-weight: bold',
  );
  console.log('[lsProbeV2] Real-time alerts will pop up when you type or open a chat. Run __lsProbeV2.report() anytime!');
})();
