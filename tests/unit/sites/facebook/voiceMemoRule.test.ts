import { describe, expect, it } from 'vitest';
import { FacebookVoiceMemoRule } from '@/sites/facebook/rules/voiceMemoRule';

describe('FacebookVoiceMemoRule', () => {
  const rule = new FacebookVoiceMemoRule();
  const graphqlUrl = 'https://www.facebook.com/api/graphql/';

  it('drops requests carrying AudioClipPlayedMutation', () => {
    const body = new URLSearchParams({
      fb_api_req_friendly_name: 'AudioClipPlayedMutation',
      variables: JSON.stringify({ clip_id: '123' }),
    }).toString();

    const verdict = rule.evaluateHttp(graphqlUrl, body);
    expect(verdict).toEqual({
      action: 'drop',
      ruleId: 'facebook.hideVoicePlayed',
      reason: 'voice-played-mutation',
      metadata: { operations: ['AudioClipPlayedMutation'] },
    });
  });

  it('drops requests matching regex pattern for audio play', () => {
    const body = new URLSearchParams({
      fb_api_req_friendly_name: 'useAudioClipPlayedMutation',
    }).toString();

    const verdict = rule.evaluateHttp(graphqlUrl, body);
    expect(verdict?.action).toBe('drop');
  });

  it('drops requests carrying AudioClipsPlaybackStartFalcoEvent', () => {
    const body = new URLSearchParams({
      fb_api_req_friendly_name: 'AudioClipsPlaybackStartFalcoEvent',
    }).toString();

    const verdict = rule.evaluateHttp(graphqlUrl, body);
    expect(verdict?.action).toBe('drop');
  });

  it('passes unrelated graphql queries', () => {
    const body = new URLSearchParams({
      fb_api_req_friendly_name: 'CometFeedQuery',
    }).toString();

    const verdict = rule.evaluateHttp(graphqlUrl, body);
    expect(verdict).toBeNull();
  });
});
