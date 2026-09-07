import { describe, expect, it } from 'vitest';
import { isRedundantObservation } from '@/core/observationFilter';
import type { ObservedEvent } from '@/observe/types';

function makeEvent(kind: string, target: string = 'test', value?: ObservedEvent['value']): ObservedEvent {
  return {
    seq: 1,
    at: Date.now(),
    kind: kind as ObservedEvent['kind'],
    target,
    value,
  };
}

describe('isRedundantObservation', () => {
  it('never considers suppressed events redundant', () => {
    expect(isRedundantObservation(makeEvent('websocket.suppressed'))).toBe(false);
    expect(isRedundantObservation(makeEvent('fetch.suppressed'))).toBe(false);
    expect(isRedundantObservation(makeEvent('xhr.suppressed'))).toBe(false);
    expect(isRedundantObservation(makeEvent('port.suppressed'))).toBe(false);
    expect(isRedundantObservation(makeEvent('worker.suppressed'))).toBe(false);
  });

  it('never considers mixed frames redundant', () => {
    expect(isRedundantObservation(makeEvent('websocket.mixed'))).toBe(false);
  });

  it('filters out noisy port.postMessage lacking chat keywords', () => {
    const videoMsg = { type: 'appendBuffer', segment: 'video_001.mp4' };
    expect(isRedundantObservation(makeEvent('port.postMessage'), videoMsg)).toBe(true);
    expect(isRedundantObservation(makeEvent('port.postMessage'), undefined)).toBe(true);
  });

  it('retains port.postMessage containing chat keywords', () => {
    const chatMsg = { action: 'sendChatStateFromComposer', thread_key: '123' };
    expect(isRedundantObservation(makeEvent('port.postMessage'), chatMsg)).toBe(false);

    const typingMsg = 'typing_indicator_active';
    expect(isRedundantObservation(makeEvent('port.postMessage'), typingMsg)).toBe(false);
  });

  it('filters out static assets in xhr.send and fetch.send', () => {
    const bootloader = makeEvent('xhr.send', 'https://web.facebook.com/ajax/bootloader-endpoint/?modules=Foo');
    expect(isRedundantObservation(bootloader)).toBe(true);

    const staticCdn = makeEvent('fetch.send', 'https://static.xx.fbcdn.net/rsrc.php/v3/y_/r/abc.js');
    expect(isRedundantObservation(staticCdn)).toBe(true);

    const cssAsset = makeEvent('fetch.send', 'https://web.facebook.com/styles/main.css');
    expect(isRedundantObservation(cssAsset)).toBe(true);
  });

  it('retains graphql and telemetry requests in xhr.send and fetch.send', () => {
    const graphql = makeEvent('xhr.send', 'https://web.facebook.com/api/graphql/');
    expect(isRedundantObservation(graphql)).toBe(false);

    const dwell = makeEvent('fetch.send', 'https://web.facebook.com/ajax/merlin/dwell/');
    expect(isRedundantObservation(dwell)).toBe(false);
  });

  it('filters out 1-2 byte ping websocket frames', () => {
    const pingBinary = makeEvent('websocket.send', 'wss://gateway.facebook.com/ws/realtime', {
      type: 'binary',
      byteLength: 2,
    });
    expect(isRedundantObservation(pingBinary)).toBe(true);

    const normalFrame = makeEvent('websocket.send', 'wss://gateway.facebook.com/ws/realtime', {
      type: 'binary',
      byteLength: 128,
    });
    expect(isRedundantObservation(normalFrame)).toBe(false);
  });
});
