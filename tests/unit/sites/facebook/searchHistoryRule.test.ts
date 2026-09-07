import { describe, expect, it } from 'vitest';
import { FacebookSearchHistoryRule } from '@/sites/facebook/rules/searchHistoryRule';

describe('FacebookSearchHistoryRule', () => {
  const rule = new FacebookSearchHistoryRule();

  it('targets facebook graphql endpoints', () => {
    expect(rule.targetPaths).toContain('/api/graphql/');
    expect(rule.targetPaths).toContain('/graphql/');
  });

  it('drops CometAddTypeaheadRecentSearchMutation with synthetic Relay response', () => {
    const body = 'fb_api_req_friendly_name=CometAddTypeaheadRecentSearchMutation&variables=%7B%22input%22%3A%7B%22keyword%22%3A%22test%22%7D%7D';
    const verdict = rule.evaluateHttp('https://www.facebook.com/api/graphql/', body);
    expect(verdict).toEqual({
      action: 'drop',
      ruleId: 'facebook.stealthSearch',
      reason: 'facebook-add-recent-search',
      metadata: {
        operations: ['CometAddTypeaheadRecentSearchMutation'],
        simulatedResponse: {
          status: 200,
          body: JSON.stringify({
            data: {
              search_typeahead_add_recent_search: {
                client_mutation_id: '1',
              },
            },
            extensions: { is_final: true },
          }),
        },
      },
    });
  });

  it('drops addTypeaheadRecentSearchMutation', () => {
    const body = 'fb_api_req_friendly_name=addTypeaheadRecentSearchMutation';
    const verdict = rule.evaluateHttp('https://www.facebook.com/api/graphql/', body);
    expect(verdict?.action).toBe('drop');
    expect(verdict?.ruleId).toBe('facebook.stealthSearch');
  });

  it('handles relative endpoint URLs correctly without throwing', () => {
    const body = 'fb_api_req_friendly_name=CometAddTypeaheadRecentSearchMutation';
    const verdict = rule.evaluateHttp('/api/graphql/', body);
    expect(verdict?.action).toBe('drop');
  });

  it('extracts mutation name from URL query parameters', () => {
    const url = '/api/graphql/?fb_api_req_friendly_name=CometAddTypeaheadRecentSearchMutation';
    const verdict = rule.evaluateHttp(url, 'variables=%7B%7D');
    expect(verdict?.action).toBe('drop');
  });

  it('drops recent search mutation in JSON body format', () => {
    const body = JSON.stringify({ fb_api_req_friendly_name: 'CometAddTypeaheadRecentSearchMutation' });
    const verdict = rule.evaluateHttp('https://www.facebook.com/api/graphql/', body);
    expect(verdict?.action).toBe('drop');
  });

  it('passes search suggestions queries and search feed results', () => {
    const suggestionsBody = 'fb_api_req_friendly_name=SearchCometTypeaheadSuggestionsQuery';
    expect(rule.evaluateHttp('https://www.facebook.com/api/graphql/', suggestionsBody)).toBeNull();

    const bootstrapBody = 'fb_api_req_friendly_name=CometSearchTypeaheadBootstrapQuery';
    expect(rule.evaluateHttp('https://www.facebook.com/api/graphql/', bootstrapBody)).toBeNull();

    const resultsBody = 'fb_api_req_friendly_name=SearchCometResultsInitialResultsQuery';
    expect(rule.evaluateHttp('https://www.facebook.com/api/graphql/', resultsBody)).toBeNull();
  });

  it('reports a batch that mixes a recent search mutation with a query as mixed', () => {
    const body =
      'fb_api_req_friendly_name=CometAddTypeaheadRecentSearchMutation&x=1&fb_api_req_friendly_name=CometNewsFeed_Query';
    const verdict = rule.evaluateHttp('https://www.facebook.com/api/graphql/', body);
    expect(verdict?.action).toBe('mixed');
    expect(verdict?.reason).toBe('mixed-recent-search');
  });

  it('ignores non-graphql endpoints', () => {
    const body = 'fb_api_req_friendly_name=CometAddTypeaheadRecentSearchMutation';
    expect(rule.evaluateHttp('https://www.facebook.com/messages/t/123', body)).toBeNull();
  });
});
