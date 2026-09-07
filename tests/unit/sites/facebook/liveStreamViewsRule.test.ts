import { describe, expect, it } from 'vitest';
import { FacebookLiveStreamViewsRule } from '@/sites/facebook/rules/liveStreamViewsRule';

describe('FacebookLiveStreamViewsRule', () => {
  const rule = new FacebookLiveStreamViewsRule();

  it('targets facebook graphql and unified_cvc endpoints', () => {
    expect(rule.targetPaths).toContain('/api/graphql/');
    expect(rule.targetPaths).toContain('/graphql/');
    expect(rule.targetPaths).toContain('/video/unified_cvc/');
  });

  it('drops /video/unified_cvc/ heartbeat requests', () => {
    const verdict = rule.evaluateHttp('https://web.facebook.com/video/unified_cvc/', 'd=%7B%22s%22%3A%22playing%22%7D');
    expect(verdict).toEqual({
      action: 'drop',
      ruleId: 'facebook.hideLiveStreamViews',
      reason: 'live-cvc-ping',
      metadata: { url: 'https://web.facebook.com/video/unified_cvc/' },
    });
  });

  it('drops relative /video/unified_cvc/ paths', () => {
    const verdict = rule.evaluateHttp('/video/unified_cvc/', 'd=%7B%7D');
    expect(verdict?.action).toBe('drop');
    expect(verdict?.reason).toBe('live-cvc-ping');
  });

  it('drops LiveViewerJoinMutation requests', () => {
    const body = 'fb_api_req_friendly_name=LiveViewerJoinMutation&variables=%7B%22target_id%22%3A%22123%22%7D';
    const verdict = rule.evaluateHttp('https://www.facebook.com/api/graphql/', body);
    expect(verdict).toEqual({
      action: 'drop',
      ruleId: 'facebook.hideLiveStreamViews',
      reason: 'live-stream-seen-mutation',
      metadata: { operations: ['LiveViewerJoinMutation'] },
    });
  });

  it('drops LiveVideoViewerPingMutation and CometLiveVideoViewerPingMutation', () => {
    const pingVerdict = rule.evaluateHttp(
      'https://www.facebook.com/api/graphql/',
      'fb_api_req_friendly_name=LiveVideoViewerPingMutation',
    );
    expect(pingVerdict?.action).toBe('drop');

    const cometVerdict = rule.evaluateHttp(
      'https://www.facebook.com/api/graphql/',
      'fb_api_req_friendly_name=CometLiveVideoViewerPingMutation',
    );
    expect(cometVerdict?.action).toBe('drop');
  });

  it('drops LiveVideoCometNuxForCVCQuery requests', () => {
    const body = 'fb_api_req_friendly_name=LiveVideoCometNuxForCVCQuery';
    const verdict = rule.evaluateHttp('https://www.facebook.com/api/graphql/', body);
    expect(verdict?.action).toBe('drop');
  });

  it('drops LiveVideoLogJoinEventMutation and LiveVideoViewerStateMutation', () => {
    const logVerdict = rule.evaluateHttp(
      'https://www.facebook.com/api/graphql/',
      'fb_api_req_friendly_name=LiveVideoLogJoinEventMutation',
    );
    expect(logVerdict?.action).toBe('drop');

    const stateVerdict = rule.evaluateHttp(
      'https://www.facebook.com/api/graphql/',
      'fb_api_req_friendly_name=LiveVideoViewerStateMutation',
    );
    expect(stateVerdict?.action).toBe('drop');
  });

  it('reports mixed batch when live viewer query is grouped with normal query', () => {
    const body =
      'fb_api_req_friendly_name=LiveViewerJoinMutation&x=1&fb_api_req_friendly_name=CometNewsFeed_Query';
    const verdict = rule.evaluateHttp('https://www.facebook.com/api/graphql/', body);
    expect(verdict?.action).toBe('mixed');
    expect(verdict?.reason).toBe('mixed-live-stream-seen');
  });

  it('passes normal feed or unrelated video queries', () => {
    const body = 'fb_api_req_friendly_name=CometNewsFeed_Query&doc_id=123';
    expect(rule.evaluateHttp('https://www.facebook.com/api/graphql/', body)).toBeNull();

    const normalVideo = 'fb_api_req_friendly_name=CometTahoeSidePaneAttachmentRendererQuery';
    expect(rule.evaluateHttp('https://www.facebook.com/api/graphql/', normalVideo)).toBeNull();
  });
});
