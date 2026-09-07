import type { ObservedEvent } from '@/observe/types';

/**
 * Common regex matching static assets, bootloaders, code splitting chunks, and webstorage endpoints
 * that have no bearing on user privacy, chat states, or tracking beacons.
 */
const STATIC_ASSET_REGEX =
  /(?:\/ajax\/(?:bootloader-endpoint|bulk-route-definitions|webstorage)|static\.xx\.fbcdn\.net|rsrc\.php|\.(?:js|css|svg|png|jpg|jpeg|webp|woff2|ico)(?:\?|$))/i;

/**
 * Keywords indicating a port message is related to chat, typing indicators, receipts, or presence.
 */
const CHAT_RELEVANT_KEYWORDS =
  /chat|typing|receipt|watermark|state|sendChatState|LS|thread|message|presence|dwell/i;

/**
 * Checks whether an observed network or worker event is redundant noise.
 *
 * Filtering out internal browser noise (such as video player buffer chunking,
 * static asset fetching, and bare websocket pings) drastically reduces IPC overhead
 * and prevents saturating extension storage quotas.
 */
export function isRedundantObservation(event: ObservedEvent, raw?: unknown): boolean {
  const kind = event.kind;

  // 1. Any suppressed action or mixed frame is privacy-critical and must ALWAYS be reported.
  if (kind.endsWith('.suppressed') || kind === 'websocket.mixed') {
    return false;
  }

  // 2. Filter noisy port.postMessage:
  // Facebook dispatches hundreds of internal messages for video players, media wasm,
  // and React scheduler. Only retain messages containing chat/receipt/presence keywords.
  if (kind === 'port.postMessage') {
    if (!raw) {
      return true;
    }
    try {
      const sample = typeof raw === 'string' ? raw : JSON.stringify(raw);
      if (!CHAT_RELEVANT_KEYWORDS.test(sample)) {
        return true;
      }
    } catch {
      return true;
    }
    return false;
  }

  // 3. Filter static asset XHR and Fetch calls:
  if (kind === 'xhr.send' || kind === 'fetch.send') {
    if (typeof event.target === 'string' && STATIC_ASSET_REGEX.test(event.target)) {
      return true;
    }
    return false;
  }

  // 4. Filter empty or bare 1-2 byte ping WebSocket frames:
  if (kind === 'websocket.send') {
    if (event.value) {
      if (event.value.type === 'binary' && typeof event.value.byteLength === 'number' && event.value.byteLength <= 2) {
        return true;
      }
      if (event.value.type === 'string' && typeof event.value.byteLength === 'number' && event.value.byteLength <= 2) {
        return true;
      }
    }
    return false;
  }

  return false;
}
