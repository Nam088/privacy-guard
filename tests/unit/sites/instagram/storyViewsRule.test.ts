import { describe, expect, it } from 'vitest';
import { InstagramStoryViewsRule } from '@/sites/instagram/rules/storyViewsRule';

describe('InstagramStoryViewsRule', () => {
  const rule = new InstagramStoryViewsRule();

  it('has correct rule identification', () => {
    expect(rule.id).toBe('instagram.hideStoryViews');
  });

  it('drops REST story seen beacon to /api/v1/stories/reel/seen/', () => {
    const url = 'https://www.instagram.com/api/v1/stories/reel/seen/';
    const body = 'reel_id=123456';
    const verdict = rule.evaluateHttp(url, body);

    expect(verdict).toEqual({
      action: 'drop',
      ruleId: 'instagram.hideStoryViews',
      reason: 'instagram-rest-story-seen',
      metadata: expect.objectContaining({
        url,
        simulatedResponse: { status: 200, body: JSON.stringify({ status: 'ok' }) },
      }),
    });
  });

  it('drops REST media seen beacon to /api/v1/media/seen/', () => {
    const url = 'https://www.instagram.com/api/v1/media/seen/';
    const verdict = rule.evaluateHttp(url, null);

    expect(verdict?.action).toBe('drop');
    expect(verdict?.reason).toBe('instagram-rest-story-seen');
  });

  it('drops GraphQL mutation PolarisStoriesV3SeenMutation', () => {
    const url = 'https://www.instagram.com/api/graphql';
    const body = JSON.stringify({
      fb_api_req_friendly_name: 'PolarisStoriesV3SeenMutation',
      variables: { reel_id: '999' },
    });
    const verdict = rule.evaluateHttp(url, body);

    expect(verdict?.action).toBe('drop');
    expect(verdict?.reason).toBe('instagram-graphql-story-seen');
  });

  it('drops GraphQL mutation StoriesSeenMutation', () => {
    const url = 'https://www.instagram.com/api/graphql';
    const body = JSON.stringify({
      fb_api_req_friendly_name: 'StoriesSeenMutation',
      variables: { story_id: '888' },
    });
    const verdict = rule.evaluateHttp(url, body);

    expect(verdict?.action).toBe('drop');
  });

  it('passes unrelated GraphQL queries like story tray queries', () => {
    const url = 'https://www.instagram.com/api/graphql';
    const body = JSON.stringify({
      fb_api_req_friendly_name: 'PolarisStoriesTrayQuery',
    });
    const verdict = rule.evaluateHttp(url, body);

    expect(verdict).toBeNull();
  });
});
