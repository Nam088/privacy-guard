/**
 * Instagram-specific URL patterns, REST endpoints, GraphQL operations, and WebSocket signatures.
 * Verified against live Instagram Web (Polaris) architecture.
 */

export interface InstagramSignatures {
  readonly readReceiptRestPatterns: readonly RegExp[];
  readonly readReceiptMutations: readonly string[];
  readonly typingRestPatterns: readonly RegExp[];
  readonly typingMutations: readonly string[];
  readonly storySeenRestPatterns: readonly RegExp[];
  readonly storySeenMutations: readonly string[];
  readonly wsHosts: readonly string[];
}

export const INSTAGRAM_SIGNATURES: InstagramSignatures = {
  readReceiptRestPatterns: [
    /\/api\/v1\/direct_v2\/threads\/[^/]+\/items\/[^/]+\/seen\/?/i,
    /\/api\/v1\/direct_v2\/threads\/[^/]+\/seen\/?/i,
    /\/api\/v1\/direct_v2\/threads\/broadcast\/seen\/?/i,
  ],
  readReceiptMutations: [
    'direct_thread_seen',
    'useDirectMutation',
    'PolarisDirectThreadSeenMutation',
    'direct_v2_seen',
    'DirectMutation',
  ],
  typingRestPatterns: [
    /\/api\/v1\/direct_v2\/threads\/[^/]+\/activity_status_indication\/?/i,
    /\/api\/v1\/direct_v2\/threads\/[^/]+\/typing\/?/i,
  ],
  typingMutations: [
    'PolarisDirectActivityStatusMutation',
    'direct_activity_status_indication',
    'useDirectActivityStatusMutation',
  ],
  storySeenRestPatterns: [
    /\/api\/v1\/stories\/reel\/seen\/?/i,
    /\/api\/v1\/media\/seen\/?/i,
    /\/api\/v1\/stories\/seen\/?/i,
  ],
  storySeenMutations: [
    'PolarisStoriesV3SeenMutation',
    'PolarisStoriesSeenMutation',
    'StoriesSeenMutation',
    'useStoriesSeenMutation',
    'storiesUpdateSeenStateMutation',
  ],
  wsHosts: ['gateway.instagram.com', 'edge-chat.instagram.com'],
};
