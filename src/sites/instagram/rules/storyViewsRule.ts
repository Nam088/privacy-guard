import type { HttpSuppressionRule, RuleVerdict } from '@/engine';
import { INSTAGRAM_SIGNATURES } from '../signatures';
import {
  GRAPHQL_PATHS,
  collectOperationNames,
  decideByOperationNames,
  parseGraphQLUrl,
} from '../../facebook/rules/graphqlRequest';

const STORY_SEEN_REGEX = /polaris.*seen|stories.*seen|seen.*stories|media.*seen/i;

function isInstagramStorySeenOperation(name: string): boolean {
  if (STORY_SEEN_REGEX.test(name)) {
    return true;
  }
  const lowered = name.toLowerCase();
  return INSTAGRAM_SIGNATURES.storySeenMutations.some((known) => known.toLowerCase() === lowered);
}

/**
 * InstagramStoryViewsRule: Anonymous viewing of Instagram Stories.
 *
 * Drops REST `/api/v1/stories/reel/seen/`, `/api/v1/media/seen/` and GraphQL `PolarisStoriesSeenMutation`
 * requests. Returns a synthetic 200 OK so the story tray and video player continue playback naturally.
 */
export class InstagramStoryViewsRule implements HttpSuppressionRule {
  readonly id = 'instagram.hideStoryViews';
  readonly targetPaths: readonly string[] = [
    ...GRAPHQL_PATHS,
    '/api/v1/stories/',
    '/api/v1/media/seen/',
  ];

  evaluateHttp(url: string, body: unknown): RuleVerdict | null {
    // 1. Check REST endpoints
    for (const pattern of INSTAGRAM_SIGNATURES.storySeenRestPatterns) {
      if (pattern.test(url)) {
        return {
          action: 'drop',
          ruleId: this.id,
          reason: 'instagram-rest-story-seen',
          metadata: {
            url,
            simulatedResponse: { status: 200, body: JSON.stringify({ status: 'ok' }) },
          },
        };
      }
    }

    // 2. Check GraphQL mutations
    const parsedUrl = parseGraphQLUrl(url);
    if (parsedUrl !== null) {
      const names = collectOperationNames(parsedUrl, body);
      const action = decideByOperationNames(names, isInstagramStorySeenOperation);
      if (action !== 'pass') {
        return {
          action,
          ruleId: this.id,
          reason: action === 'drop' ? 'instagram-graphql-story-seen' : 'mixed-story-seen',
          metadata: {
            operations: names,
            simulatedResponse: { status: 200, body: JSON.stringify({ data: { status: 'ok' } }) },
          },
        };
      }
    }

    return null;
  }
}
