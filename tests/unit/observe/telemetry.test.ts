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
});
