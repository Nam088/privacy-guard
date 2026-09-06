// Pasted into the page console AFTER the extension is installed, to answer one question with
// evidence instead of inference: what did the extension actually do just now?
//
// It listens to the observation bridge the extension already broadcasts, so most of what it
// reports is the extension's own account of itself rather than this script's guess. Where the
// extension reports nothing, this says so rather than filling the gap with an assumption.
//
// It changes nothing. It never calls `require`, never forces a module to load, and never runs a
// timer. An earlier version of the extension broke Facebook by doing the first two.
//
//   __pgDoctor.mark('idle')      wait, touching nothing
//   __pgDoctor.mark('read')      open a conversation with unread messages
//   __pgDoctor.mark('typing')    type into the composer, do not send
//   __pgDoctor.report()

(function installExtensionDoctor() {
  'use strict';

  var OBSERVER_EVENT = 'privacy-guard:observed';
  var CONFIGURE_EVENT = 'privacy-guard:configure';
  var BRIDGE_MODULE = 'MAWBridgeFireAndForget';

  var state = {
    window: '(before any mark)',
    events: [],
    marks: [],
    config: null,
    mawCalls: [],
    startedAt: new Date().toISOString(),
  };

  // Function names are minified away in the built extension, but string literals survive, and a
  // browser built-in still reports [native code]. So a channel is judged patched by what its
  // source is not, never by what it is called.
  function isPatched(fn) {
    try {
      return typeof fn === 'function' && String(fn).indexOf('[native code]') === -1;
    } catch {
      return false;
    }
  }

  function installed() {
    return {
      'WebSocket.send': isPatched(WebSocket.prototype.send),
      fetch: isPatched(globalThis.fetch),
      'XMLHttpRequest.send': isPatched(XMLHttpRequest.prototype.send),
      'MessagePort.postMessage':
        typeof MessagePort === 'function' ? isPatched(MessagePort.prototype.postMessage) : false,
    };
  }

  function onObserved(event) {
    var detail = event && event.detail;
    if (!detail || !detail.kind) {
      return;
    }
    state.events.push({
      kind: detail.kind,
      target: String(detail.target || ''),
      bytes: detail.value ? detail.value.byteLength : null,
      window: state.window,
      at: detail.at,
    });
  }

  function onConfigure(event) {
    state.config = { at: new Date().toISOString(), detail: (event && event.detail) || null };
  }

  document.addEventListener(OBSERVER_EVENT, onObserved);
  document.addEventListener(CONFIGURE_EVENT, onConfigure);

  // The bridge the extension uses for typing on encrypted threads reports nothing at all, so the
  // only way to see anything here is to count the calls ourselves. This wraps whatever is already
  // in place, which means a call is counted whether or not the extension goes on to cancel it.
  // What it cannot show is the cancelling, and the report says so rather than implying otherwise.
  function watchBridge(moduleObject) {
    if (!moduleObject || typeof moduleObject.fireAndForget !== 'function') {
      return false;
    }
    if (moduleObject.__pgDoctorWatched) {
      return true;
    }
    var inner = moduleObject.fireAndForget;
    moduleObject.fireAndForget = function () {
      try {
        state.mawCalls.push({
          action: String(arguments[1]),
          scope: String(arguments[0]),
          window: state.window,
          at: Date.now(),
        });
      } catch {
        // Counting must never be the reason a message fails to send.
      }
      return inner.apply(this, arguments);
    };
    moduleObject.__pgDoctorWatched = true;
    return true;
  }

  var bridgeStatus = 'not seen yet';

  // Asks only for a module Facebook has already finished loading. This never forces a load, which
  // is the distinction that matters: forcing one before its dependencies are ready is what broke
  // the page before.
  try {
    var req = globalThis.require;
    if (req && typeof req.getModuleIfExported === 'function') {
      var already = req.getModuleIfExported(BRIDGE_MODULE);
      if (already && watchBridge(already.default || already)) {
        bridgeStatus = 'already loaded, now counted';
      }
    }
  } catch {
    bridgeStatus = 'getModuleIfExported refused';
  }

  // Otherwise wait for Messenger itself to ask for it, which it does when you focus the composer.
  var originalRequire = globalThis.require;
  if (bridgeStatus === 'not seen yet' && typeof originalRequire === 'function') {
    var wrapped = function (name) {
      var result = originalRequire.apply(this, arguments);
      try {
        if (name === BRIDGE_MODULE && watchBridge(result && (result.default || result))) {
          bridgeStatus = 'caught when the page asked for it';
        }
      } catch {
        // Never let observation change what require returns.
      }
      return result;
    };
    Object.keys(originalRequire).forEach(function (key) {
      wrapped[key] = originalRequire[key];
    });
    globalThis.require = wrapped;
  }

  function tally(values) {
    var counts = {};
    values.forEach(function (value) {
      counts[value] = (counts[value] || 0) + 1;
    });
    return counts;
  }

  function pathOf(url) {
    try {
      return new URL(url).pathname;
    } catch {
      return String(url).slice(0, 80);
    }
  }

  function mark(name) {
    state.window = String(name);
    state.marks.push({ name: state.window, at: Date.now() });
    console.log('[pgDoctor] mark: ' + name);
    return name;
  }

  function windowNames() {
    var seen = [];
    state.events.concat(state.mawCalls).forEach(function (item) {
      if (seen.indexOf(item.window) === -1) {
        seen.push(item.window);
      }
    });
    return seen;
  }

  function summarize() {
    var events = state.events;
    var suppressed = events.filter(function (e) { return e.kind.indexOf('.suppressed') !== -1; });
    var mixed = events.filter(function (e) { return e.kind === 'websocket.mixed'; });

    return {
      startedAt: state.startedAt,
      installed: installed(),
      // Null means no settings change has been broadcast since this was pasted. Toggle any switch
      // in the popup and report again to see it.
      config: state.config,
      totalEvents: events.length,
      byKind: tally(events.map(function (e) { return e.kind; })),
      suppressedByPath: tally(suppressed.map(function (e) { return e.kind + ' ' + pathOf(e.target); })),
      // Frames carrying something suppressible that were let through because they also carried
      // something else. Every one of these is a leak the extension chose over breaking the app.
      leaksByPath: tally(mixed.map(function (e) { return pathOf(e.target); })),
      byWindow: windowNames().map(function (name) {
        var inWindow = events.filter(function (e) { return e.window === name; });
        return {
          window: name,
          events: inWindow.length,
          byKind: tally(inWindow.map(function (e) { return e.kind; })),
          bridgeCalls: tally(
            state.mawCalls
              .filter(function (c) { return c.window === name; })
              .map(function (c) { return c.action; }),
          ),
        };
      }),
      bridge: {
        status: bridgeStatus,
        callsByAction: tally(state.mawCalls.map(function (c) { return c.action; })),
        // Said plainly because the alternative is a reader assuming a zero means protection.
        note:
          'The extension reports nothing when it cancels a bridge call, so a count here shows only '
          + 'that the composer made the call. To prove it was cancelled, turn Hide typing off in '
          + 'the popup, type again, and have the other account tell you whether the indicator '
          + 'appeared. A difference between the two runs is the proof; this number is not.',
      },
      verdict: verdictOf(events, suppressed, mixed),
    };
  }

  function verdictOf(events, suppressed, mixed) {
    var lines = [];
    var channels = installed();
    var dead = Object.keys(channels).filter(function (key) { return !channels[key]; });

    if (events.length === 0 && dead.length === Object.keys(channels).length) {
      return 'EXTENSION NOT ACTIVE ON THIS PAGE. No channel is patched and no event arrived. '
        + 'Check it is enabled, then reload the tab.';
    }
    if (dead.length > 0) {
      lines.push('unpatched channels: ' + dead.join(', '));
    }
    if (events.length === 0) {
      lines.push('channels are patched but nothing has been observed yet, so exercise the app');
    }
    if (suppressed.length > 0) {
      lines.push(suppressed.length + ' requests were withheld');
    }
    if (mixed.length > 0) {
      lines.push(mixed.length + ' LEAKED: suppressible content shared a frame with something else');
    }
    if (suppressed.length === 0 && events.length > 0) {
      lines.push('nothing has been withheld, so either the action was not exercised or the '
        + 'signature does not match what this account sends');
    }
    return lines.join('. ') + '.';
  }

  function report() {
    var summary = summarize();
    console.log('[pgDoctor] ' + summary.verdict);
    console.log(JSON.stringify(summary, null, 2));
    return summary;
  }

  function stop() {
    document.removeEventListener(OBSERVER_EVENT, onObserved);
    document.removeEventListener(CONFIGURE_EVENT, onConfigure);
    if (originalRequire && globalThis.require !== originalRequire) {
      globalThis.require = originalRequire;
    }
    console.log('[pgDoctor] stopped. The bridge counter stays until you reload.');
  }

  globalThis.__pgDoctor = {
    state: state,
    installed: installed,
    mark: mark,
    summarize: summarize,
    report: report,
    stop: stop,
  };

  console.log(
    '[pgDoctor] listening. Channels patched: '
      + JSON.stringify(installed())
      + '. Bridge: ' + bridgeStatus
      + '. Start with __pgDoctor.mark("idle")',
  );
})();
