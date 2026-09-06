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
    'MercuryThreadMarkReadMutation',
    'ThreadMarkReadMutation',
    'LSPlatformWatermarkMutation',
    'MessengerThreadMarkReadMutation',
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
  ] as readonly string[],
  presenceStreamPaths: ['/ws/streamcontroller'] as readonly string[],
  voiceMemoMutations: [
    'AudioClipPlayedMutation',
    'useAudioClipPlayedMutation',
    'audio_clip_played',
    'VoiceClipPlayedMutation',
    'MessengerAudioClipPlayed',
  ] as readonly string[],
  typingWorkerActions: [
    'sendChatStateFromComposer',
    'send_typing_indicators',
    'chatstate',
  ] as readonly string[],
  typingStopStates: ['idle', 'paus', 'stop', 'inactive', 'clear', 'gone'] as readonly string[],
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
  ] as readonly string[],
} as const;
