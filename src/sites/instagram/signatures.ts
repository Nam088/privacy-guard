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
  readonly liveSeenRestPatterns: readonly RegExp[];
  readonly liveSeenMutations: readonly string[];
  readonly readReceiptRestPatterns: readonly RegExp[];
  readonly typingRestPatterns: readonly RegExp[];
  readonly wsHosts: readonly string[];
  readonly dwellTimePaths: readonly string[];
  readonly dwellTimeKeywords: readonly string[];
  readonly dwellTimeMutations: readonly string[];
  readonly searchHistoryMutations: readonly string[];
}

export const INSTAGRAM_SIGNATURES: InstagramSignatures = {
  readReceiptLabels: ['21', '72', '235'] as readonly string[],
  readReceiptPaths: ['/ws/lightspeed', '/ws/realtime', '/ws/streamcontroller', '/chat'] as readonly string[],
  typingLabels: ['3'] as readonly string[],
  typingPaths: ['/ws/mqttbypass', '/ws/streamcontroller', '/ws/lightspeed', '/ws/realtime', '/chat'] as readonly string[],
  inboxWatermarkLabels: [] as readonly string[],
  inboxWatermarkPaths: [] as readonly string[],
  readReceiptMutations: [
    'useIGDMarkThreadAsReadMutation',
    'useIGDMarkThreadAsReadValidationMutation',
    'IGDMarkThreadAsReadMutation',
    'IGDMarkThreadAsReadValidationMutation',
    'PolarisDirectThreadSeenMutation',
    'direct_thread_seen',
    'direct_v2_seen',
  ] as readonly string[],
  readReceiptWorkerActions: [
    'mark_thread_as_read',
    'mark_thread_read',
    'last_read_watermark_ts',
    'thread_read_watermark',
  ] as readonly string[],
  typingMutations: [
    'PolarisDirectActivityStatusMutation',
    'PolarisDirectThreadActivityIndicatorMutation',
    'direct_activity_status_indication',
    'useDirectActivityStatusMutation',
  ] as readonly string[],
  typingWorkerActions: [
    'indicate_activity',
    'typing_indicator',
    'user_is_typing',
  ] as readonly string[],
  storySeenRestPatterns: [
    /\/api\/v1\/stories\/reel\/seen\/?/i,
    /\/api\/v1\/media\/seen\/?/i,
  ],
  storySeenMutations: [
    'PolarisStoriesV3SeenMutation',
    'PolarisStoriesSeenMutation',
  ] as readonly string[],
  liveSeenRestPatterns: [
    /\/api\/v1\/live\/[^/]+\/heartbeat_and_get_viewer_count\/?/i,
    /\/api\/v1\/live\/[^/]+\/join\/?/i,
  ],
  liveSeenMutations: [
    'PolarisLiveViewerJoinMutation',
    'PolarisLiveHeartbeatMutation',
    'LiveViewerJoinMutation',
  ] as readonly string[],
  readReceiptRestPatterns: [
    /\/api\/v1\/direct_v2\/threads\/[^/]+\/items\/[^/]+\/seen\/?/i,
    /\/api\/v1\/direct_v2\/threads\/[^/]+\/seen\/?/i,
  ],
  typingRestPatterns: [
    /\/api\/v1\/direct_v2\/threads\/[^/]+\/activity_status_indication\/?/i,
  ],
  wsHosts: ['gateway.instagram.com', 'edge-chat.instagram.com'],
  dwellTimePaths: [
    '/video/unified_cvc/',
    '/video/unified_cvc',
    '/api/v1/logging/client_events/',
    '/api/v1/logging/client_events',
    '/ajax/bz',
    '/ajax/bnzai',
    '/ajax/browser_metrics',
  ] as readonly string[],
  dwellTimeKeywords: [
    'instagram_feed_dwell_time',
    'instagram_feed_vpvd',
    'instagram_video_playback_duration',
    'ig_feed_vpv',
    'vpv_duration',
    'dwell_time',
    'timespent',
    'time_spent',
    'video_watch_time',
    'feed_vpvd',
    'inline::inline',
    'falco:ods_web_batch',
    'ods_web_batch',
    'interaction_tracing',
    'pointer_interaction',
    'mouse_trajectory',
    'cursor_hover_dwell',
    'hover_dwell',
    'mouse_movement',
  ] as readonly string[],
  dwellTimeMutations: [
    'PolarisFeedVPVDQuery',
    'PolarisDwellTimeMutation',
    'FalcoServer',
  ] as readonly string[],
  searchHistoryMutations: [
    'usePolarisRegisterInRecentSearchesMutation',
  ] as readonly string[],
};
