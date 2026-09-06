import type { HttpSuppressionRule, RuleVerdict } from '@/engine';
import {
  GRAPHQL_PATHS,
  collectOperationNames,
  decideByOperationNames,
  parseGraphQLUrl,
} from './graphqlRequest';

/**
 * Known Meta GraphQL mutation friendly names for story viewed events.
 * Verified against live Facebook web (Comet) and open-source research.
 */
export const STORY_SEEN_MUTATIONS = [
  'storiesUpdateSeenStateMutation',
  'useStoriesUpdateSeenStateMutation',
  'StoryUpdateSeenStateMutation',
  'updateStorySeenState',
  'CometStoriesSeenMutation',
  'StoriesSeenMutation',
  'StoriesSeenTrayItemMutation',
  'StoriesReaderSeenMutation',
  'StoriesUpdateSeenStateMutation',
  'useStoriesSeenMutation',
  'PolarisStoriesV3SeenMutation',
] as const;

/**
 * Matches operation names not on the list above, for the ones Meta has not shipped yet.
 *
 * This is only ever tested against an operation name. It used to also be run across whole request
 * bodies, where the unanchored `.*` in the old `markstor.*seen` alternative would span an entire
 * feed payload and drop it.
 */
export const STORY_SEEN_PATTERN =
  /stor(y|ies).{0,20}seen|seen.{0,20}stor(y|ies)|polarisstoriesv3seen/i;

function isStorySeenOperation(name: string): boolean {
  if (STORY_SEEN_PATTERN.test(name)) {
    return true;
  }
  const lowered = name.toLowerCase();
  return STORY_SEEN_MUTATIONS.some((known) => known.toLowerCase() === lowered);
}

/**
 * FacebookStoryViewsRule: Strategy for suppressing Facebook Story Seen markers.
 *
 * Inspects outbound GraphQL HTTP requests targeting `/api/graphql/` or `/graphql/` on a Meta host.
 * Drops requests that report story views so the user's name never appears in the story viewer list.
 *
 * A request carrying a seen marker alongside unrelated operations is reported as mixed and sent
 * anyway. That is the same trade the WebSocket path makes: a leak that can be counted beats a
 * request dropped on a guess, because a dropped request here is answered with a synthetic 200 and
 * nobody ever finds out.
 */
export class FacebookStoryViewsRule implements HttpSuppressionRule {
  readonly id = 'facebook.hideStoryViews';
  readonly targetPaths: readonly string[] = GRAPHQL_PATHS;

  evaluateHttp(url: string, body: unknown): RuleVerdict | null {
    const parsedUrl = parseGraphQLUrl(url);
    if (parsedUrl === null) {
      return null;
    }

    const names = collectOperationNames(parsedUrl, body);
    const action = decideByOperationNames(names, isStorySeenOperation);
    if (action === 'pass') {
      return null;
    }

    let reason = 'mixed-story-seen';
    if (action === 'drop') {
      reason = 'story-seen-mutation';
    }

    return {
      action,
      ruleId: this.id,
      reason,
      metadata: { operations: names },
    };
  }
}
