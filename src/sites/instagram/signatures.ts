/**
 * Instagram-specific URL patterns, DGW task labels, GraphQL operations, and WebSocket signatures.
 * In 2026, Meta unified Instagram Direct with Messenger's modern LightSpeed / DGW / Realtime stack.
 */

export interface InstagramSignatures {
  readonly readReceiptLabels: readonly string[];
  readonly readReceiptPaths: readonly string[];
  readonly typingLabels: readonly string[];
  readonly typingPaths: readonly string[];
  readonly inboxWatermarkLabels: readonly string[];
  readonly inboxWatermarkPaths: readonly string[];
  readonly readReceiptMutations: readonly string[];
  readonly readReceiptWorkerActions: readonly string[];
  readonly typingMutations: readonly string[];
  readonly typingWorkerActions: readonly string[];
  readonly storySeenRestPatterns: readonly RegExp[];
  readonly storySeenMutations: readonly string[];
  readonly readReceiptRestPatterns: readonly RegExp[];
  readonly typingRestPatterns: readonly RegExp[];
  readonly wsHosts: readonly string[];
}

export const INSTAGRAM_SIGNATURES: InstagramSignatures = {
  readReceiptLabels: ['21', '72', '235'] as readonly string[],
  readReceiptPaths: ['/ws/lightspeed', '/ws/realtime', '/chat', '/pubsub'] as readonly string[],
  typingLabels: ['3'] as readonly string[],
  typingPaths: ['/ws/lightspeed', '/ws/realtime', '/chat', '/pubsub'] as readonly string[],
  inboxWatermarkLabels: ['6'] as readonly string[],
  inboxWatermarkPaths: ['/ws/lightspeed', '/ws/realtime'] as readonly string[],
  readReceiptMutations: [
    'useReadReceiptMutation',
    'useMarkThreadReadMutation',
    'MarkThreadReadMutation',
    'MercuryThreadMarkReadMutation',
    'ThreadMarkReadMutation',
    'LSPlatformWatermarkMutation',
    'MessengerThreadMarkReadMutation',
    'PolarisDirectThreadSeenMutation',
    'direct_thread_seen',
    'direct_v2_seen',
    'DirectMutation',
    'mark_read',
  ] as readonly string[],
  readReceiptWorkerActions: [
    'mark_read',
    'markread',
    'send_read_receipt',
    'sendreadreceipt',
    'updatewatermark',
    'setwatermark',
    'last_read_watermark_ts',
    'thread_read_watermark',
  ] as readonly string[],
  typingMutations: [
    'useTypingIndicatorMutation',
    'LSPlatformTypingMutation',
    'TypingMutation',
    'ThreadTypingIndicatorMutation',
    'CometTypingMutation',
    'PolarisDirectActivityStatusMutation',
    'PolarisDirectThreadActivityIndicatorMutation',
    'direct_activity_status_indication',
    'useDirectActivityStatusMutation',
  ] as readonly string[],
  typingWorkerActions: [
    'typing_indicator',
    'user_is_typing',
  ] as readonly string[],
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
  ] as readonly string[],
  readReceiptRestPatterns: [
    /\/api\/v1\/direct_v2\/threads\/[^/]+\/items\/[^/]+\/seen\/?/i,
    /\/api\/v1\/direct_v2\/threads\/[^/]+\/seen\/?/i,
    /\/api\/v1\/direct_v2\/threads\/broadcast\/seen\/?/i,
  ],
  typingRestPatterns: [
    /\/api\/v1\/direct_v2\/threads\/[^/]+\/activity_status_indication\/?/i,
    /\/api\/v1\/direct_v2\/threads\/[^/]+\/typing\/?/i,
  ],
  wsHosts: ['gateway.instagram.com', 'edge-chat.instagram.com'],
};
