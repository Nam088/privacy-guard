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

    // /ajax/bnzai with Banzai q field carrying Falco viewable impression trigger
    const banzaiForm = new FormData();
    banzaiForm.append('ts', '1788788351230');
    banzaiForm.append(
      'q',
      JSON.stringify([
        {
          trigger: 'falco:comet_metrics_viewable_impression',
          user: '100094293981804',
        },
      ]),
    );
    expect(isDwellTelemetry('https://web.facebook.com/ajax/bnzai?__a=1', banzaiForm)).toBe(true);

    // /ajax/bnzai with Banzai q field carrying Falco dwell time trigger
    const banzaiDwellForm = new FormData();
    banzaiDwellForm.append(
      'q',
      JSON.stringify([
        {
          trigger: 'falco:comet_feed_dwell_time',
          duration_ms: 4500,
        },
      ]),
    );
    expect(isDwellTelemetry('https://web.facebook.com/ajax/bnzai', banzaiDwellForm)).toBe(true);

    // /ajax/bnzai with unrelated trigger
    const banzaiOtherForm = new FormData();
    banzaiOtherForm.append(
      'q',
      JSON.stringify([
        {
          trigger: 'falco:unrelated_action',
        },
      ]),
    );
    expect(isDwellTelemetry('https://web.facebook.com/ajax/bnzai', banzaiOtherForm)).toBe(false);

    // Instagram /video/unified_cvc/ inline feed video playback
    expect(
      isDwellTelemetry(
        'https://www.instagram.com/video/unified_cvc/',
        JSON.stringify({
          d: {
            so: 'inline::inline',
            ps: { s: 'playing', sa: 0 },
            vi: '3980891522232362564',
          },
        }),
      ),
    ).toBe(true);

    // Instagram /api/v1/logging/client_events/ with instagram_feed_dwell_time
    expect(
      isDwellTelemetry(
        'https://www.instagram.com/api/v1/logging/client_events/',
        JSON.stringify({ event: 'instagram_feed_dwell_time', duration: 3200 }),
      ),
    ).toBe(true);

    // Facebook /ajax/merlin/dwell/ with feed_vpvd
    expect(
      isDwellTelemetry(
        'https://web.facebook.com/ajax/merlin/dwell/',
        JSON.stringify({ feed_vpvd: { duration_ms: 2500 } }),
      ),
    ).toBe(true);

    // Live-detected Falco ODS Web Batch with comet_metrics_viewable_impression
    expect(
      isDwellTelemetry(
        'https://web.facebook.com/ajax/bnzai?__a=1',
        JSON.stringify({
          route: 'falco:ods_web_batch',
          data: {
            actorId: '100094293981804',
            e: JSON.stringify({
              batch: {
                '7173': {
                  'entities.ff_js_web.comet_metrics_viewable_impression': {},
                },
              },
            }),
          },
        }),
      ),
    ).toBe(true);

    // Live-detected mouse and pointer interaction tracing
    expect(
      isDwellTelemetry(
        'https://web.facebook.com/ajax/bz',
        JSON.stringify({
          events: [{ name: 'interaction_tracing', action: 'pointer_interaction' }],
        }),
      ),
    ).toBe(true);
  });
});
