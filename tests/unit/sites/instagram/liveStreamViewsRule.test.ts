import { describe, expect, it } from 'vitest';
import { InstagramLiveStreamViewsRule } from '@/sites/instagram/rules/liveStreamViewsRule';

describe('InstagramLiveStreamViewsRule', () => {
  const rule = new InstagramLiveStreamViewsRule();

  it('has correct rule identification', () => {
    expect(rule.id).toBe('instagram.hideLiveStreamViews');
  });

  it('drops REST heartbeat to /api/v1/live/{broadcast_id}/heartbeat_and_get_viewer_count/', () => {
    const url = 'https://www.instagram.com/api/v1/live/17988347123456/heartbeat_and_get_viewer_count/';
    const body = 'live_with_eligible=0';
    const verdict = rule.evaluateHttp(url, body);

    expect(verdict).toEqual({
      action: 'drop',
      ruleId: 'instagram.hideLiveStreamViews',
      reason: 'instagram-rest-live-seen',
      metadata: expect.objectContaining({
        url,
        simulatedResponse: { status: 200, body: JSON.stringify({ status: 'ok' }) },
      }),
    });
  });

  it('drops REST join beacon to /api/v1/live/{broadcast_id}/join/', () => {
    const url = 'https://www.instagram.com/api/v1/live/17988347123456/join/';
    const verdict = rule.evaluateHttp(url, null);

    expect(verdict?.action).toBe('drop');
    expect(verdict?.reason).toBe('instagram-rest-live-seen');
  });

  it('drops GraphQL mutation PolarisLiveViewerJoinMutation', () => {
    const url = 'https://www.instagram.com/api/graphql';
    const body = JSON.stringify({
      fb_api_req_friendly_name: 'PolarisLiveViewerJoinMutation',
      variables: { broadcast_id: '999' },
    });
    const verdict = rule.evaluateHttp(url, body);

    expect(verdict?.action).toBe('drop');
    expect(verdict?.reason).toBe('instagram-graphql-live-seen');
  });

  it('drops GraphQL mutation PolarisLiveHeartbeatMutation', () => {
    const url = 'https://www.instagram.com/api/graphql';
    const body = JSON.stringify({
      fb_api_req_friendly_name: 'PolarisLiveHeartbeatMutation',
      variables: { broadcast_id: '888' },
    });
    const verdict = rule.evaluateHttp(url, body);

    expect(verdict?.action).toBe('drop');
    expect(verdict?.reason).toBe('instagram-graphql-live-seen');
  });

  it('passes unrelated GraphQL queries', () => {
    const url = 'https://www.instagram.com/api/graphql';
    const body = JSON.stringify({
      fb_api_req_friendly_name: 'PolarisLiveViewerCommentsQuery',
    });
    const verdict = rule.evaluateHttp(url, body);

    expect(verdict).toBeNull();
  });
});
