/**
 * Task labels this module suppresses, and the socket they were seen on.
 *
 * These are observations, not documentation.
 *
 * **21** is the one that matters for read receipts. Its payload carries `last_read_watermark_ts`,
 * a field whose name is not an inference, alongside `thread_id` and `sync_group`. Suppressing
 * 72 and 235 without it would leave the watermark going to Meta on every read.
 *
 * **3** is the typing indicator task on `/ws/lightspeed`. It arrives in the single task envelope
 * `{ label: 3, payload: { thread_key, is_typing: 1, ... } }`.
 *
 * **6** is the inbox watermark, `{ parent_thread_key, last_seen_time_ms }`. Unlike every other
 * label here it does not settle a frame on its own: only `parent_thread_key: 0`, the root folder,
 * is the record of opening Messenger. The same label on a folder inside the inbox is left alone.
 *
 * Instagram must not inherit any of this. Different host, no label ever observed.
 */
export const FACEBOOK_SIGNATURES = {
  readReceiptLabels: ['21', '72', '235'] as readonly string[],
  readReceiptPaths: ['/ws/lightspeed', '/ws/realtime'] as readonly string[],
  typingLabels: ['3'] as readonly string[],
  typingPaths: ['/ws/lightspeed', '/ws/realtime'] as readonly string[],
  /**
   * The pre-GraphQL typing endpoint. It carries nothing but a typing ping, so unlike the GraphQL
   * endpoints the path alone is enough to decide.
   */
  typingLegacyPaths: ['/ajax/messaging/typ.php'] as readonly string[],
  inboxWatermarkLabels: ['6'] as readonly string[],
  inboxWatermarkPaths: ['/ws/lightspeed', '/ws/realtime'] as readonly string[],
  readReceiptMutations: [
    'useReadReceiptMutation',
    'useMarkThreadReadMutation',
    'MarkThreadReadMutation',
    'useMarkThreadAsReadMutation',
    'MarkThreadAsReadMutation',
    'useMarkAsReadMutation',
    'MarkAsReadMutation',
    'MercuryThreadMarkReadMutation',
    'ThreadMarkReadMutation',
    'LSPlatformWatermarkMutation',
    'MessengerThreadMarkReadMutation',
    'mark_read',
  ] as readonly string[],
  readReceiptWorkerActions: [
    'sendReadReceipt',
    'sendreceipt',
    'send_receipt',
    'send_read_receipt',
    'sendreadreceipt',
    'mark_read',
    'markread',
    'mark_as_read',
    'markasread',
    'mark_thread_read',
    'markthreadread',
    'mark_seen',
    'markseen',
    'updatewatermark',
    'setwatermark',
    'send_read_watermark',
    'sendreadwatermark',
    'last_read_watermark_ts',
    'thread_read_watermark',
    'thread_read',
    'threadread',
    'displayedReceipt',
    'displayed_receipt',
  ] as readonly string[],
  typingMutations: [
    'useTypingIndicatorMutation',
    'LSPlatformTypingMutation',
    'TypingMutation',
    'ThreadTypingIndicatorMutation',
    'CometTypingMutation',
  ] as readonly string[],
  voiceMemoMutations: [
    'AudioClipPlayedMutation',
    'useAudioClipPlayedMutation',
    'audio_clip_played',
    'VoiceClipPlayedMutation',
    'MessengerAudioClipPlayed',
    'audio_clips_playback_start',
    'audio_clips_playback_pause',
    'audio_clips_playback_resume',
    'AudioClipsPlaybackStartFalcoEvent',
    'AudioClipsPlaybackPauseFalcoEvent',
    'AudioClipsPlaybackResumeFalcoEvent',
  ] as readonly string[],
  typingWorkerActions: [
    'sendChatStateFromComposer',
    'send_typing_indicators',
    'send_typing_indicators_SECURE_MESSAGE_OVER_WA_ONE_TO_ONE',
    'sendChatState',
    'chatstate',
    'chat_state',
    'setChatState',
    'updateChatState',
    'typing_indicator',
  ] as readonly string[],
  typingStopStates: ['idle', 'paus', 'stop', 'inactive', 'clear', 'gone'] as readonly string[],
  dwellTimePaths: [
    '/ajax/bnzai',
    '/ajax/bz',
    '/ajax/browser_metrics',
    '/ajax/merlin/dwell',
    '/ajax/merlin/dwell/',
  ] as readonly string[],
  dwellTimeKeywords: [
    'dwell_time',
    'video_playback_logging',
    'watch_time',
    'timespent',
    'time_spent',
    'post_dwell',
    'merlin_unified_protocol_event',
    'element_visibility_absolute_ts',
    'web_time_spent_bit_array',
    'viewable_impression',
    'comet_metrics_viewable_impression',
    'feed_vpvd',
    'comet_feed_dwell_time',
    'comet_feed_vpvd',
    'vpv_duration',
    'video_time_spent',
    'viewport_tracking',
    'falco:ods_web_batch',
    'ods_web_batch',
    'interaction_tracing',
    'pointer_interaction',
    'mouse_trajectory',
    'pointer_interaction_event',
    'comet_mouse_interaction',
    'cursor_hover_dwell',
    'hover_dwell',
    'mouse_movement',
    'scroll_velocity',
  ] as readonly string[],
  dwellTimeMutations: [
    'FalcoServer',
    'CometFeedVPVDQuery',
    'FeedVPVDMutation',
    'FalcoUnifiedLoggerMutation',
    'CometFeedVPVDLoggingMutation',
    'CometVideoTimeSpentMutation',
    'CometVideoWatchTimeMutation',
    'InteractionTracingMutation',
    'CometInteractionTracingQuery',
  ] as readonly string[],
  liveStreamPaths: [
    '/video/unified_cvc/',
    '/video/unified_cvc',
  ] as readonly string[],
  liveStreamMutations: [
    'LiveViewerJoinMutation',
    'useLiveViewerJoinMutation',
    'LiveVideoViewerStateMutation',
    'LiveVideoViewerPingMutation',
    'CometLiveVideoViewerPingMutation',
    'LiveVideoLogJoinEventMutation',
    'LiveVideoCometNuxForCVCQuery',
    'CometLiveVideoJoinNotificationMutation',
    'LiveVideoViewerTypedLogger',
  ] as readonly string[],
  searchHistoryMutations: [
    'CometAddTypeaheadRecentSearchMutation',
    'addTypeaheadRecentSearchMutation',
  ] as readonly string[],
} as const;
