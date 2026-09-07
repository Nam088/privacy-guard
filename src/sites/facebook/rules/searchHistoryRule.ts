import type { HttpSuppressionRule, RuleVerdict } from '@/engine';
import { FACEBOOK_SIGNATURES } from '../signatures';
import {
  GRAPHQL_PATHS,
  collectOperationNames,
  decideByOperationNames,
  parseGraphQLUrl,
} from './graphqlRequest';

const SEARCH_RECENT_REGEX = /typeahead.*recent.*search|add.*recent.*search/i;

function isFacebookSearchRecentOperation(name: string): boolean {
  if (SEARCH_RECENT_REGEX.test(name)) {
    return true;
  }
  const lowered = name.toLowerCase();
  return FACEBOOK_SIGNATURES.searchHistoryMutations.some(
    (known) => known.toLowerCase() === lowered,
  );
}

/**
 * FacebookSearchHistoryRule: Stealth search mode for Facebook.
 *
 * Drops `CometAddTypeaheadRecentSearchMutation` so visited searches are never
 * recorded in the user's Recent Searches history or used to skew algorithmic recommendations.
 * Synthesizes an empty mutation result matching Relay's GraphQL completed shape.
 */
export class FacebookSearchHistoryRule implements HttpSuppressionRule {
  readonly id = 'facebook.stealthSearch';
  readonly targetPaths: readonly string[] = GRAPHQL_PATHS;

  evaluateHttp(url: string, body: unknown): RuleVerdict | null {
    const parsedUrl = parseGraphQLUrl(url);
    if (parsedUrl === null) {
      return null;
    }

    const names = collectOperationNames(parsedUrl, body);
    const action = decideByOperationNames(names, isFacebookSearchRecentOperation);
    if (action === 'pass') {
      return null;
    }

    return {
      action,
      ruleId: this.id,
      reason: action === 'drop' ? 'facebook-add-recent-search' : 'mixed-recent-search',
      metadata: {
        operations: names,
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
    };
  }
}
