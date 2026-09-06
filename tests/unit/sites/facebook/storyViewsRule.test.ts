import { describe, expect, it } from 'vitest';
import { FacebookStoryViewsRule } from '@/sites/facebook/rules/storyViewsRule';

describe('FacebookStoryViewsRule', () => {
  const rule = new FacebookStoryViewsRule();

  it('targets facebook graphql endpoints', () => {
    expect(rule.targetPaths).toContain('/api/graphql/');
    expect(rule.targetPaths).toContain('/graphql/');
  });

  it('drops primary storiesUpdateSeenStateMutation requests', () => {
    const body = 'fb_api_req_friendly_name=storiesUpdateSeenStateMutation&variables=%7B%22story_id%22%3A%22123%22%7D';
    const verdict = rule.evaluateHttp('https://www.facebook.com/api/graphql/', body);
    expect(verdict).toEqual({
      action: 'drop',
      ruleId: 'facebook.hideStoryViews',
      reason: 'story-seen-mutation',
      metadata: { operations: ['storiesUpdateSeenStateMutation'] },
    });
  });

  it('handles relative endpoint URLs correctly without throwing', () => {
    const body = 'fb_api_req_friendly_name=storiesUpdateSeenStateMutation';
    const verdict = rule.evaluateHttp('/api/graphql/', body);
    expect(verdict?.action).toBe('drop');
  });

  it('extracts mutation name from URL query parameters', () => {
    const url = '/api/graphql/?fb_api_req_friendly_name=storiesUpdateSeenStateMutation';
    const verdict = rule.evaluateHttp(url, 'variables=%7B%7D');
    expect(verdict?.action).toBe('drop');
  });

  it('drops StoriesSeenMutation requests', () => {
    const body = 'fb_api_req_friendly_name=StoriesSeenMutation&variables=%7B%22story_id%22%3A%22123%22%7D';
    const verdict = rule.evaluateHttp('https://www.facebook.com/api/graphql/', body);
    expect(verdict).toEqual({
      action: 'drop',
      ruleId: 'facebook.hideStoryViews',
      reason: 'story-seen-mutation',
      metadata: { operations: ['StoriesSeenMutation'] },
    });
  });

  it('drops CometStoriesSeenMutation and StoriesUpdateSeenStateMutation', () => {
    const cometVerdict = rule.evaluateHttp(
      'https://www.facebook.com/api/graphql/',
      'fb_api_req_friendly_name=CometStoriesSeenMutation',
    );
    expect(cometVerdict?.action).toBe('drop');

    const updateVerdict = rule.evaluateHttp(
      'https://www.facebook.com/api/graphql/',
      'fb_api_req_friendly_name=StoriesUpdateSeenStateMutation',
    );
    expect(updateVerdict?.action).toBe('drop');
  });

  it('drops StoriesSeenTrayItemMutation requests', () => {
    const body = 'fb_api_req_friendly_name=StoriesSeenTrayItemMutation';
    const verdict = rule.evaluateHttp('https://www.facebook.com/api/graphql/', body);
    expect(verdict?.action).toBe('drop');
  });

  it('drops StoriesReaderSeenMutation requests in JSON format', () => {
    const body = JSON.stringify({ fb_api_req_friendly_name: 'StoriesReaderSeenMutation' });
    const verdict = rule.evaluateHttp('https://www.facebook.com/api/graphql/', body);
    expect(verdict?.action).toBe('drop');
  });

  it('finds every operation in a batched body', () => {
    const body =
      'fb_api_req_friendly_name=StoriesSeenMutation&x=1&fb_api_req_friendly_name=CometStoriesSeenMutation';
    const verdict = rule.evaluateHttp('https://www.facebook.com/api/graphql/', body);
    expect(verdict?.action).toBe('drop');
    expect(verdict?.metadata?.operations).toEqual([
      'StoriesSeenMutation',
      'CometStoriesSeenMutation',
    ]);
  });

  it('reports a batch that mixes a seen marker with an innocent operation, and lets it through', () => {
    // Same law the WebSocket path obeys. Dropping the batch would take the innocent operation
    // with it, and the caller would be answered with a synthetic 200 and never know.
    const body =
      'fb_api_req_friendly_name=StoriesSeenMutation&x=1&fb_api_req_friendly_name=CometNewsFeed_Query';
    const verdict = rule.evaluateHttp('https://www.facebook.com/api/graphql/', body);
    expect(verdict?.action).toBe('mixed');
    expect(verdict?.reason).toBe('mixed-story-seen');
  });

  it('passes normal feed or comment queries', () => {
    const body = 'fb_api_req_friendly_name=CometNewsFeed_Query&doc_id=123';
    expect(rule.evaluateHttp('https://www.facebook.com/api/graphql/', body)).toBeNull();
  });

  it('passes a feed query whose own text happens to read like a signature', () => {
    // The old raw-body scan dropped this: an unanchored pattern across the whole payload cannot
    // tell a story marker from somebody writing about stories.
    const body =
      'fb_api_req_friendly_name=CometFeedQuery&variables=' +
      encodeURIComponent(JSON.stringify({ text: 'markstory: things i have not seen' }));
    expect(rule.evaluateHttp('https://www.facebook.com/api/graphql/', body)).toBeNull();
  });

  it('leaves a request alone when no operation can be identified', () => {
    const body = 'unknown_key=1&custom_blob=an_opaque_thing';
    expect(rule.evaluateHttp('https://www.facebook.com/api/graphql/', body)).toBeNull();
  });

  it('never inspects a graphql path on a host that is not Meta', () => {
    expect(
      rule.evaluateHttp(
        'https://analytics.example.com/graphql/',
        'fb_api_req_friendly_name=StoriesSeenMutation',
      ),
    ).toBeNull();
  });

  it('passes non-graphql or empty requests', () => {
    expect(rule.evaluateHttp('https://www.facebook.com/api/graphql/', null)).toBeNull();
    expect(rule.evaluateHttp('https://www.facebook.com/api/graphql/', '')).toBeNull();
    expect(rule.evaluateHttp('https://www.facebook.com/messages/t/123', 'some_body')).toBeNull();
  });
});
