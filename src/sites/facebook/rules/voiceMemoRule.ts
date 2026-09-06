import type { HttpSuppressionRule, RuleVerdict } from '@/engine';
import { FACEBOOK_SIGNATURES } from '../signatures';
import {
  GRAPHQL_PATHS,
  collectOperationNames,
  decideByOperationNames,
  parseGraphQLUrl,
} from './graphqlRequest';

export const VOICE_PLAYED_MUTATIONS = FACEBOOK_SIGNATURES.voiceMemoMutations;

export const VOICE_PLAYED_PATTERN =
  /audio.{0,20}play|voice.{0,20}play|audioclipplayed|voiceclipplayed/i;

function isVoicePlayedOperation(name: string): boolean {
  if (VOICE_PLAYED_PATTERN.test(name)) {
    return true;
  }
  const lowered = name.toLowerCase();
  return VOICE_PLAYED_MUTATIONS.some((known) => known.toLowerCase() === lowered);
}

/**
 * FacebookVoiceMemoRule: Strategy for suppressing Voice Note Played receipts.
 *
 * Inspects outbound GraphQL requests for audio playback telemetry.
 * Suppresses requests so the sender is never notified that their voice message was played.
 */
export class FacebookVoiceMemoRule implements HttpSuppressionRule {
  readonly id = 'facebook.hideVoicePlayed';
  readonly targetPaths: readonly string[] = GRAPHQL_PATHS;

  evaluateHttp(url: string, body: unknown): RuleVerdict | null {
    const parsedUrl = parseGraphQLUrl(url);
    if (parsedUrl === null) {
      return null;
    }

    const names = collectOperationNames(parsedUrl, body);
    const action = decideByOperationNames(names, isVoicePlayedOperation);
    if (action === 'pass') {
      return null;
    }

    let reason = 'mixed-voice-played';
    if (action === 'drop') {
      reason = 'voice-played-mutation';
    }

    return {
      action,
      ruleId: this.id,
      reason,
      metadata: { operations: names },
    };
  }
}
