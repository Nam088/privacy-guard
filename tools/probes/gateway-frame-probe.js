// A temporary probe, pasted into the page console on messenger.com, that decodes every gateway
// socket frame the page sends and reports what arrived in which window between marks.
//
// It began as a lightspeed only probe answering whether one frame carries one task or several,
// which it did: signal tasks arrive in frames of their own. It watches every path now because a
// typing session produced nothing on lightspeed while the recipient plainly saw the indicator,
// so the signal is somewhere else on the gateway and guessing where has already failed twice.
//
// It observes and reports. It never blocks a frame, never alters one, and never reads a value:
// only task labels, field names, byte lengths and counts leave the decoder.
//
// Paste it, then mark what you are about to do so the comparison is built into the run:
//   __gwProbe.mark('idle')      wait, touching nothing
//   __gwProbe.mark('typing')    type into a composer, do not send
//   __gwProbe.mark('stopped')   stop, wait
//   __gwProbe.report()

(function installLightspeedProbe() {
  'use strict';

  var OPEN_BRACE = 0x7b;
  var OPEN_BRACKET = 0x5b;
  var HEX_PREFIX_BYTES = 16;

  // Used as the size floor only when no frame decoded, so there is nothing to calibrate against.
  // A sixteen byte header plus the shortest conceivable task envelope is comfortably above this,
  // so anything smaller is control traffic. Reported as `floorUsed` either way.
  var FALLBACK_TASK_FLOOR_BYTES = 32;

  // Marks a shape taken from the outer object because the frame had no inner payload to take one
  // from, so the two are never read as the same level of the frame.
  var outerPrefix = 'outer: ';

  // Searched for inside frames the decoder could not read. A frame carrying one of these is a
  // task frame that was missed, which invalidates any verdict. A frame carrying neither is
  // probably an ack or a heartbeat and costs the verdict nothing.
  var TASK_MARKERS = ['tasks', 'label'];

  // Labels this build is hunting. 72 and 235 are read receipts, observed on /ws/lightspeed across
  // two sessions. 3 is the typing label from the older transport findings and has never appeared
  // on this account, kept only so a run that does produce it says so loudly.
  var SIGNAL_LABELS = ['3', '72', '235'];

  var decoder = new TextDecoder('utf-8');

  // Reads one balanced JSON object or array starting at index 0, tracking string state so that a
  // brace inside a string value does not end it early. Returns null when text does not start with
  // a complete one.
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

  // The frame is a binary header followed by JSON. The header contains the bytes 7b 7d, an ASCII
  // {}, so a scan that stops at the first brace parses an empty object and calls that success.
  // This keeps scanning until a brace yields an object with at least one key, and reports how
  // many bytes it had to skip so a changed header shows up as a changed number rather than as
  // silence.
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

  // Two envelopes ride this one socket. Read receipts arrive as { epoch_id, tasks, version_id }
  // with tasks an array; typing arrives as { label, payload, version }, one task and no array.
  // Anything matching neither is reported as unknown rather than as an empty task list, because
  // a parser that reports health on a frame it never read is the failure this project keeps
  // designing around.
  function extractTasks(inner) {
    if (!inner || typeof inner !== 'object') {
      return { envelope: 'unknown', tasks: [] };
    }
    if (Array.isArray(inner.tasks)) {
      return { envelope: 'array', tasks: inner.tasks };
    }
    if (typeof inner.label !== 'undefined') {
      return { envelope: 'single', tasks: [inner] };
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
    };
  }

  var state = {
    frames: [],
    undecoded: [],
    sentByPath: {},
    window: '(before any mark)',
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

  // Whether an undecodable frame nonetheless contains the ascii of a task envelope key. This is
  // the difference between a verdict with a hole in it and a verdict that is merely incomplete
  // about acks, so it is worth searching the raw bytes for.
  function markersIn(bytes) {
    var text = decoder.decode(bytes);
    return TASK_MARKERS.filter(function (marker) {
      return text.indexOf('"' + marker + '"') !== -1;
    });
  }

  // Key names, several levels down. The first version only recursed when a value turned out to be
  // json hiding in a string, so a plainly nested object stopped at its own name and the shape of
  // `presenceReportingAmendment` came back as the single word `presenceReportingAmendment`. An
  // object is an object however it got there.
  function shapeOf(value, depth) {
    if (Array.isArray(value)) {
      var first = value.length > 0 ? shapeOf(parseNested(value[0]), depth) : null;
      return '[' + (first === null ? '' : first) + ']';
    }
    if (!value || typeof value !== 'object') {
      return null;
    }
    var keys = Object.keys(value).sort();
    if (depth <= 0) {
      return keys.join(',');
    }
    return keys
      .map(function (key) {
        var inner = shapeOf(parseNested(value[key]), depth - 1);
        return inner === null ? key : key + '{' + inner + '}';
      })
      .join(',');
  }

  function record(url, bytes) {
    var decoded = decodeFrame(bytes);
    if (!decoded) {
      state.undecoded.push({
        n: state.frames.length + state.undecoded.length,
        window: state.window,
        path: pathOf(url),
        bytes: bytes.length,
        headHex: hexPrefix(bytes),
        markers: markersIn(bytes),
      });
      return;
    }
    var inner = parseNested(decoded.outer.payload);
    var extracted = extractTasks(inner);
    var described = extracted.tasks.map(describeTask);
    state.frames.push({
      n: state.frames.length + state.undecoded.length,
      at: new Date().toISOString(),
      window: state.window,
      path: pathOf(url),
      bytes: bytes.length,
      headerBytes: decoded.headerBytes,
      headHex: hexPrefix(bytes),
      outerKeys: Object.keys(decoded.outer),
      innerKeys: inner && typeof inner === 'object' ? Object.keys(inner) : [],
      envelope: extracted.envelope,
      // Only filled in for a shape neither envelope explains, which is where the next answer is.
      // Falling back to the outer matters more than it looks: every /ws/realtime frame decodes and
      // then has no `payload` key, so shaping only the inner made 24 of 35 unknown frames vanish
      // from the report entirely while appearing in the decoded count.
      innerShape:
        extracted.envelope === 'unknown'
          ? shapeOf(inner, 3) || outerPrefix + shapeOf(decoded.outer, 2)
          : null,
      taskCount: described.length,
      labels: described.map(function (task) { return task.label; }),
      tasks: described,
    });
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
      {
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
      console.warn('[gwProbe] observation failed, frame passed through untouched', err);
    }
    return original.apply(this, arguments);
  };

  function windowNames(frames, undecoded) {
    var seen = [];
    frames.concat(undecoded).forEach(function (frame) {
      if (seen.indexOf(frame.window) === -1) {
        seen.push(frame.window);
      }
    });
    return seen;
  }

  function tally(values) {
    var counts = {};
    values.forEach(function (value) {
      counts[value] = (counts[value] || 0) + 1;
    });
    return counts;
  }

  // A verdict is only worth as much as the share of traffic behind it. Anything that makes the
  // sample incomplete downgrades the answer to inconclusive rather than being reported alongside
  // a confident one, because a decoder calling itself healthy on frames it never read is the
  // exact failure this project keeps having to design around.
  function smallestDecoded(frames) {
    return frames.reduce(function (min, frame) {
      return min === null || frame.bytes < min ? frame.bytes : min;
    }, null);
  }

  // An undecodable frame is only a hole in the sample if it could have carried a task. One
  // shorter than the shortest frame that did decode could not have, which is arithmetic rather
  // than optimism, and the threshold is reported so the reasoning stays checkable.
  function classifyUndecoded(frames, undecoded) {
    var calibrated = smallestDecoded(frames);
    var floor = calibrated === null ? FALLBACK_TASK_FLOOR_BYTES : calibrated;
    var explained = [];
    var unexplained = [];
    undecoded.forEach(function (frame) {
      if (frame.markers.length === 0 && frame.bytes < floor) {
        explained.push(frame);
      } else {
        unexplained.push(frame);
      }
    });
    return {
      floor: floor,
      calibrated: calibrated !== null,
      explained: explained,
      unexplained: unexplained,
    };
  }

  function blockersFor(frames, undecoded, envelopes) {
    var blockers = [];
    var split = classifyUndecoded(frames, undecoded);
    var missedTaskFrames = undecoded.filter(function (frame) { return frame.markers.length > 0; });
    if (missedTaskFrames.length > 0) {
      blockers.push(
        missedTaskFrames.length +
          ' undecodable frames contain a task envelope key, so task frames were missed',
      );
    } else if (split.unexplained.length > 0) {
      blockers.push(
        split.unexplained.length +
          ' frames could not be decoded and were large enough to have carried a task',
      );
    }
    if (envelopes.unknown) {
      blockers.push(envelopes.unknown + ' decoded frames used an envelope nobody has accounted for');
    }
    return blockers;
  }

  // True but not disqualifying. These describe the decoder's problem, not the sample's.
  function notesFor(frames) {
    var notes = [];
    var lengths = Object.keys(tally(frames.map(function (frame) { return frame.headerBytes; })));
    if (lengths.length > 1) {
      notes.push(
        'header lengths seen: ' +
          lengths.join(', ') +
          '. Locate the json, never seek to a fixed offset.',
      );
    }
    return notes;
  }

  function summarize() {
    var frames = state.frames;
    var undecoded = state.undecoded;
    var signalFrames = frames.filter(function (frame) {
      return frame.labels.some(function (label) { return SIGNAL_LABELS.indexOf(label) !== -1; });
    });

    // The answer. A signal frame whose only labels are signal labels can be dropped whole. One
    // that also carries something else cannot, and M3b has to rewrite instead.
    var contaminated = signalFrames.filter(function (frame) {
      return frame.labels.some(function (label) { return SIGNAL_LABELS.indexOf(label) === -1; });
    });

    var envelopes = tally(frames.map(function (frame) { return frame.envelope; }));
    var blockers = blockersFor(frames, undecoded, envelopes);

    var verdict;
    if (contaminated.length > 0) {
      verdict =
        'DROPPING THE FRAME IS NOT SAFE. A signal task shared a frame with an unrelated task. ' +
        'This holds regardless of what else the run missed.';
    } else if (signalFrames.length === 0) {
      verdict =
        'NO SIGNAL SEEN. Exercise the action, or the labels are different on this account.';
    } else if (blockers.length > 0) {
      verdict =
        'INCONCLUSIVE, do not build on this. ' +
        signalFrames.length +
        ' signal frames carried only signal tasks, but ' +
        blockers.join(', and ') +
        '.';
    } else {
      verdict =
        'DROPPING THE FRAME IS SAFE, on ' +
        signalFrames.length +
        ' signal frames with the whole socket decoded.';
    }

    return {
      installedAt: state.installedAt,
      sentByPath: state.sentByPath,
      framesDecoded: frames.length,
      framesUndecoded: undecoded.length,
      decodedByPath: tally(frames.map(function (frame) { return frame.path; })),
      undecodedByPath: tally(undecoded.map(function (frame) { return frame.path; })),
      undecoded: {
        tooSmallToCarryATask: classifyUndecoded(frames, undecoded).explained.length,
        largeEnoughToCarryATask: classifyUndecoded(frames, undecoded).unexplained.length,
        smallestDecodedFrameBytes: smallestDecoded(frames),
        floorUsed: classifyUndecoded(frames, undecoded).floor,
        floorWasCalibrated: classifyUndecoded(frames, undecoded).calibrated,
        byteLengths: tally(undecoded.map(function (frame) { return frame.bytes; })),
        headHex: tally(undecoded.map(function (frame) { return frame.headHex; })),
        containingTaskMarkers: undecoded.filter(function (frame) { return frame.markers.length > 0; }).length,
        markersSeen: tally(undecoded.reduce(function (all, frame) { return all.concat(frame.markers); }, [])),
      },
      headerBytesSeen: tally(frames.map(function (frame) { return frame.headerBytes; })),
      // Per path, because a header that looks variable across the socket set is usually four
      // consistent framings rather than one inconsistent one.
      headerBytesByPath: Object.keys(tally(frames.map(function (f) { return f.path; }))).reduce(
        function (out, path) {
          out[path] = tally(
            frames
              .filter(function (frame) { return frame.path === path; })
              .map(function (frame) { return frame.headerBytes; }),
          );
          return out;
        },
        {},
      ),
      headHexSeen: tally(frames.map(function (frame) { return frame.headHex; })),
      envelopes: envelopes,
      taskCountPerFrame: tally(frames.map(function (frame) { return frame.taskCount; })),
      labelFrequency: tally(frames.reduce(function (all, frame) { return all.concat(frame.labels); }, [])),
      // Typing is the feature that uses the single task envelope, so which labels arrive in
      // which envelope is how its label gets identified.
      labelsByPath: Object.keys(tally(frames.map(function (f) { return f.path; }))).reduce(
        function (out, path) {
          out[path] = tally(
            frames
              .filter(function (frame) { return frame.path === path; })
              .reduce(function (all, frame) { return all.concat(frame.labels); }, []),
          );
          return out;
        },
        {},
      ),
      // The shapes no envelope explains, collapsed so a repeated shape reads as one line. The
      // typing signal is most likely hiding in here.
      unknownShapes: tally(
        frames
          .filter(function (frame) { return frame.envelope === 'unknown' && frame.innerShape; })
          .map(function (frame) { return frame.path + ' :: ' + frame.innerShape; }),
      ),
      // Everything that arrived in each window. Whatever appears in one window and no other is
      // the lead, with or without a label attached.
      byWindow: windowNames(frames, undecoded).map(function (name) {
        var inWindow = frames.filter(function (frame) { return frame.window === name; });
        var undecodedIn = undecoded.filter(function (frame) { return frame.window === name; });
        return {
          window: name,
          decoded: inWindow.length,
          undecoded: undecodedIn.length,
          byPath: tally(inWindow.map(function (frame) { return frame.path; })),
          labels: tally(inWindow.reduce(function (all, frame) { return all.concat(frame.labels); }, [])),
          sizes: tally(
            inWindow
              .concat(undecodedIn)
              .map(function (frame) { return frame.path + ' ' + frame.bytes + 'b'; }),
          ),
        };
      }),
      labelsByEnvelope: Object.keys(envelopes).reduce(function (out, envelope) {
        out[envelope] = tally(
          frames
            .filter(function (frame) { return frame.envelope === envelope; })
            .reduce(function (all, frame) { return all.concat(frame.labels); }, []),
        );
        return out;
      }, {}),
      signalFrames: signalFrames.map(function (frame) {
        return {
          n: frame.n,
          envelope: frame.envelope,
          taskCount: frame.taskCount,
          labels: frame.labels,
          // Two tasks sharing a label are only harmless if they are the same kind of task. The
          // field names say whether the duplicate is a repeat or something else wearing the
          // same number.
          taskFields: frame.tasks.map(function (task) { return task.label + ': ' + task.fields.join(','); }),
        };
      }),
      signalFramesSharedWithOtherTasks: contaminated.length,
      blockers: blockers,
      notes: notesFor(frames),
      verdict: verdict,
    };
  }

  function mark(name) {
    state.window = String(name);
    console.log('[gwProbe] mark: ' + name);
    return name;
  }

  function report() {
    var summary = summarize();
    console.log('[gwProbe] ' + summary.verdict);
    console.log(JSON.stringify(summary, null, 2));
    return summary;
  }

  function stop() {
    WebSocket.prototype.send = original;
    console.log('[gwProbe] send restored');
  }

  globalThis.__gwProbe = {
    state: state,
    signalLabels: SIGNAL_LABELS,
    mark: mark,
    decodeFrame: decodeFrame,
    extractTasks: extractTasks,
    readBalancedObject: readBalancedObject,
    summarize: summarize,
    report: report,
    stop: stop,
  };

  console.log('[gwProbe] watching every gateway socket. Start with __gwProbe.mark("idle")');
})();
