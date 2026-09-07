import type { HttpSuppressionRule, RuleVerdict } from '@/engine';
import { INSTAGRAM_SIGNATURES } from '../signatures';
import {
  GRAPHQL_PATHS,
  collectOperationNames,
  decideByOperationNames,
  parseGraphQLUrl,
} from '../../facebook/rules/graphqlRequest';

const SEARCH_RECENT_REGEX = /register.*recent.*search|add.*recent.*search/i;

function isInstagramSearchRecentOperation(name: string): boolean {
  if (SEARCH_RECENT_REGEX.test(name)) {
    return true;
  }
  const lowered = name.toLowerCase();
  return INSTAGRAM_SIGNATURES.searchHistoryMutations.some(
    (known) => known.toLowerCase() === lowered,
  );
}

/**
 * InstagramSearchHistoryRule: Stealth search mode for Instagram.
 *
 * Drops `usePolarisRegisterInRecentSearchesMutation` so search results clicked
 * are never recorded into Instagram Recent Searches or used for profiling.
 * Synthesizes an empty mutation result matching Relay's GraphQL completed shape.
 */
export class InstagramSearchHistoryRule implements HttpSuppressionRule {
  readonly id = 'instagram.stealthSearch';
  readonly targetPaths: readonly string[] = GRAPHQL_PATHS;

  evaluateHttp(url: string, body: unknown): RuleVerdict | null {
    const parsedUrl = parseGraphQLUrl(url);
    if (parsedUrl === null) {
      return null;
    }

    const names = collectOperationNames(parsedUrl, body);
    const action = decideByOperationNames(names, isInstagramSearchRecentOperation);
    if (action === 'pass') {
      return null;
    }

    return {
      action,
      ruleId: this.id,
      reason: action === 'drop' ? 'instagram-add-recent-search' : 'mixed-recent-search',
      metadata: {
        operations: names,
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
    };
  }
}
