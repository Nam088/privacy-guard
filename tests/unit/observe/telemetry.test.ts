import { describe, expect, it, vi } from 'vitest';
import { installTelemetryScrambler } from '@/observe/telemetry';

describe('telemetry dwell time scrambler', () => {
  it('blocks dwell time sendBeacon calls while active', () => {
    const origSendBeacon = vi.fn().mockReturnValue(true);
    const scope = {
      navigator: {
        sendBeacon: origSendBeacon,
      },
    };

    const active = true;
    const undo = installTelemetryScrambler(scope, () => active);

    // Call with dwell_time payload to /ajax/bz
    const blocked = scope.navigator.sendBeacon(
      'https://www.facebook.com/ajax/bz?__a=1',
      JSON.stringify({ dwell_time: 12500, post_id: '123' }),
    );

    expect(blocked).toBe(true);
    expect(origSendBeacon).not.toHaveBeenCalled();

    // Call with normal unrelated payload
    scope.navigator.sendBeacon('https://www.facebook.com/other', 'foo=bar');
    expect(origSendBeacon).toHaveBeenCalledTimes(1);

    undo();
    expect(scope.navigator.sendBeacon).toBe(origSendBeacon);
  });

  it('inspects FormData entries and only blocks if dwell keywords are present', () => {
    const origSendBeacon = vi.fn().mockReturnValue(true);
    const scope = {
      navigator: {
        sendBeacon: origSendBeacon,
      },
    };

    const undo = installTelemetryScrambler(scope, () => true);

    const dwellForm = new FormData();
    dwellForm.append('event_name', 'merlin_unified_protocol_event');
    const blocked = scope.navigator.sendBeacon('https://www.facebook.com/ajax/bz', dwellForm);
    expect(blocked).toBe(true);
    expect(origSendBeacon).not.toHaveBeenCalled();

    const normalForm = new FormData();
    normalForm.append('feedback_text', 'great app');
    const passed = scope.navigator.sendBeacon('https://www.facebook.com/ajax/bz', normalForm);
    expect(passed).toBe(true);
    expect(origSendBeacon).toHaveBeenCalledTimes(1);

    undo();
  });

  it('detects Merlin Unified Protocol and timespent events via isDwellTelemetryData', async () => {
    const { isDwellTelemetryData } = await import('@/observe/telemetry');

    // String payload
    expect(
      isDwellTelemetryData(
        JSON.stringify({
          events: [{ name: 'merlin_unified_protocol_event', extra: { element_visibility_absolute_ts: {} } }],
        }),
      ),
    ).toBe(true);

    // Timespent bit array
    expect(isDwellTelemetryData('{"events":[{"name":"web_time_spent_bit_array"}]}')).toBe(true);

    // Binary ArrayBuffer payload
    const text = '...merlin_unified_protocol_event...';
    const buffer = new TextEncoder().encode(text).buffer;
    expect(isDwellTelemetryData(buffer)).toBe(true);

    // Unrelated payload
    expect(isDwellTelemetryData('{"events":[{"name":"normal_event"}]}')).toBe(false);
    expect(isDwellTelemetryData(null)).toBe(false);
  });

  it('evaluates isDwellTelemetry for URL and body', async () => {
    const { isDwellTelemetry } = await import('@/observe/telemetry');

    // /ajax/bz with dwell payload
    expect(
      isDwellTelemetry('https://www.facebook.com/ajax/bz', JSON.stringify({ dwell_time: 5000 })),
    ).toBe(true);

    // /ajax/browser_metrics with watch_time
    expect(
      isDwellTelemetry('https://www.facebook.com/ajax/browser_metrics', 'watch_time=123'),
    ).toBe(true);

    // Unrelated URL
    expect(
      isDwellTelemetry('https://www.facebook.com/api/graphql/', JSON.stringify({ dwell_time: 5000 })),
    ).toBe(false);

    // /ajax/bz with unrelated payload
    expect(
      isDwellTelemetry('https://www.facebook.com/ajax/bz', JSON.stringify({ query: 'search' })),
    ).toBe(false);
  });
});
