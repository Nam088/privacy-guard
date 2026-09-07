/**
 * Shared Worker RPC & MessagePort Utilities for Meta Armadillo / WebWorker Interception.
 *
 * Used across both Facebook and Instagram suppression rules.
 */

/**
 * Recursively inspects arrays or nested request objects passed to WebWorker/MessagePort
 * and extracts all candidate action/method/event names.
 *
 * Handles Meta Armadillo RPC format:
 * `[{ type: "request", content: { namespace: "backend", name: "sendChatStateFromComposer", arg: { ... } } }]`
 */
export function collectWorkerActions(data: unknown): string[] {
  if (!data || typeof data !== 'object') {
    if (typeof data === 'string') {
      return [data];
    }
    return [];
  }
  const actions: string[] = [];
  if (Array.isArray(data)) {
    for (const item of data) {
      actions.push(...collectWorkerActions(item));
    }
    return actions;
  }
  const rec = data as Record<string, unknown>;
  const directKeys = [
    rec.action,
    rec.type,
    rec.name,
    rec.event,
    rec.event_name,
    rec.command,
    rec.actionType,
    rec.method,
  ];
  for (const k of directKeys) {
    if (typeof k === 'string') {
      actions.push(k);
    }
  }

  // Meta Armadillo RPC: { type: "request", content: { namespace: "backend", name: "sendChatStateFromComposer", arg: ... } }
  if (rec.content && typeof rec.content === 'object') {
    actions.push(...collectWorkerActions(rec.content));
  }
  if (rec.payload && typeof rec.payload === 'object') {
    actions.push(...collectWorkerActions(rec.payload));
  }
  if (rec.data && typeof rec.data === 'object') {
    actions.push(...collectWorkerActions(rec.data));
  }
  return actions;
}

/**
 * Recursively extracts state value from request objects (e.g. state: 1 vs state: 0).
 */
export function extractStateValue(data: unknown): unknown {
  if (!data || typeof data !== 'object') {
    return undefined;
  }
  if (Array.isArray(data)) {
    for (const item of data) {
      const val = extractStateValue(item);
      if (val !== undefined) {
        return val;
      }
    }
    return undefined;
  }
  const obj = data as Record<string, unknown>;
  if (obj.state !== undefined) {
    return obj.state;
  }
  if (obj.chat_state !== undefined) {
    return obj.chat_state;
  }
  if (obj.chatState !== undefined) {
    return obj.chatState;
  }
  if (obj.is_typing !== undefined) {
    return obj.is_typing;
  }
  if (obj.arg !== undefined) {
    const val = extractStateValue(obj.arg);
    if (val !== undefined) return val;
  }
  if (obj.args !== undefined) {
    const val = extractStateValue(obj.args);
    if (val !== undefined) return val;
  }
  if (obj.content !== undefined) {
    const val = extractStateValue(obj.content);
    if (val !== undefined) return val;
  }
  if (obj.payload !== undefined) {
    const val = extractStateValue(obj.payload);
    if (val !== undefined) return val;
  }
  return undefined;
}

/**
 * Checks whether an intercepted worker/network payload carries an outbound user message.
 * Ensures the extension NEVER drops real outbound user messages or texts.
 */
export function isOutboundMessagePayload(data: unknown): boolean {
  if (!data || typeof data !== 'object') {
    return false;
  }
  if (Array.isArray(data)) {
    for (const item of data) {
      if (typeof item === 'string') {
        const lower = item.toLowerCase();
        if (
          lower === 'sendmessage' ||
          lower === 'sendtextmessage' ||
          lower === 'sendmediamessage' ||
          lower.includes('sendmessage') ||
          lower.includes('send_message')
        ) {
          return true;
        }
      } else if (item && typeof item === 'object') {
        if (isOutboundMessagePayload(item)) {
          return true;
        }
      }
    }
    return false;
  }

  const rec = data as Record<string, unknown>;
  if (
    rec.body !== undefined ||
    rec.text !== undefined ||
    rec.message !== undefined ||
    rec.offline_threading_id !== undefined ||
    rec.message_id !== undefined ||
    rec.client_context !== undefined
  ) {
    return true;
  }

  const keys = [
    rec.action,
    rec.type,
    rec.name,
    rec.event,
    rec.event_name,
    rec.command,
    rec.actionType,
    rec.method,
  ];
  for (const k of keys) {
    if (typeof k === 'string') {
      const lower = k.toLowerCase();
      if (
        lower === 'sendmessage' ||
        lower === 'sendtextmessage' ||
        lower === 'sendmediamessage' ||
        lower.includes('sendmessage') ||
        lower.includes('send_message')
      ) {
        return true;
      }
    }
  }

  if (rec.content && typeof rec.content === 'object') {
    if (isOutboundMessagePayload(rec.content)) return true;
  }
  if (rec.arg && typeof rec.arg === 'object') {
    if (isOutboundMessagePayload(rec.arg)) return true;
  }
  if (rec.args && typeof rec.args === 'object') {
    if (isOutboundMessagePayload(rec.args)) return true;
  }

  return false;
}
