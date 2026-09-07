import { describe, expect, it } from 'vitest';
import { InstagramSearchHistoryRule } from '@/sites/instagram/rules/searchHistoryRule';

describe('InstagramSearchHistoryRule', () => {
  const rule = new InstagramSearchHistoryRule();

  it('targets instagram graphql endpoints', () => {
    expect(rule.targetPaths).toContain('/api/graphql/');
    expect(rule.targetPaths).toContain('/graphql/');
  });

  it('drops usePolarisRegisterInRecentSearchesMutation with synthetic Relay response', () => {
    const body =
      'fb_api_req_friendly_name=usePolarisRegisterInRecentSearchesMutation&variables=%7B%22entity_id%22%3A%22123%22%2C%22entity_name%22%3A%22testuser%22%2C%22entity_type%22%3A%22USER%22%7D';
    const verdict = rule.evaluateHttp('https://www.instagram.com/graphql/query', body);
    expect(verdict).toEqual({
      action: 'drop',
      ruleId: 'instagram.stealthSearch',
      reason: 'instagram-add-recent-search',
      metadata: {
        operations: ['usePolarisRegisterInRecentSearchesMutation'],
        simulatedResponse: {
          status: 200,
          body: JSON.stringify({
            data: {
              xig_register_recent_search: {
                success: true,
              },
            },
            extensions: { is_final: true },
          }),
        },
      },
    });
  });

  it('handles relative endpoint URLs correctly without throwing', () => {
    const body = 'fb_api_req_friendly_name=usePolarisRegisterInRecentSearchesMutation';
    const verdict = rule.evaluateHttp('/graphql/query', body);
    expect(verdict?.action).toBe('drop');
  });

  it('extracts mutation name from URL query parameters', () => {
    const url = '/graphql/query?fb_api_req_friendly_name=usePolarisRegisterInRecentSearchesMutation';
    const verdict = rule.evaluateHttp(url, 'variables=%7B%7D');
    expect(verdict?.action).toBe('drop');
  });

  it('drops recent search mutation in JSON body format', () => {
    const body = JSON.stringify({ fb_api_req_friendly_name: 'usePolarisRegisterInRecentSearchesMutation' });
    const verdict = rule.evaluateHttp('https://www.instagram.com/api/graphql/', body);
    expect(verdict?.action).toBe('drop');
  });

  it('passes search null-state queries and explore feed queries', () => {
    const nullStateBody = 'fb_api_req_friendly_name=PolarisSearchNullStateQuery';
    expect(rule.evaluateHttp('https://www.instagram.com/graphql/query', nullStateBody)).toBeNull();

    const profileBody = 'fb_api_req_friendly_name=PolarisProfilePostsTabQuery';
    expect(rule.evaluateHttp('https://www.instagram.com/graphql/query', profileBody)).toBeNull();
  });

  it('reports a batch that mixes a recent search mutation with a query as mixed', () => {
    const body =
      'fb_api_req_friendly_name=usePolarisRegisterInRecentSearchesMutation&x=1&fb_api_req_friendly_name=PolarisFeedTimeline';
    const verdict = rule.evaluateHttp('https://www.instagram.com/graphql/query', body);
    expect(verdict?.action).toBe('mixed');
    expect(verdict?.reason).toBe('mixed-recent-search');
  });

  it('ignores non-graphql endpoints', () => {
    const body = 'fb_api_req_friendly_name=usePolarisRegisterInRecentSearchesMutation';
    expect(rule.evaluateHttp('https://www.instagram.com/direct/inbox/', body)).toBeNull();
  });
});
