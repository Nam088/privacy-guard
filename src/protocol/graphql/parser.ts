/**
 * GraphQL request parser for Meta / Facebook web requests.
 *
 * Extracts operation names (fb_api_req_friendly_name or operationName) and doc_id
 * from url-encoded bodies, JSON payloads, URLSearchParams, FormData, or ArrayBuffers.
 */

export interface GraphQLOperationInfo {
  readonly friendlyName?: string;
  readonly docId?: string;
}

export function extractGraphQLOperation(body: unknown): GraphQLOperationInfo | null {
  if (!body) {
    return null;
  }

  // 1. URLSearchParams instance
  if (body instanceof URLSearchParams) {
    let friendlyName: string | undefined;
    const fbName = body.get('fb_api_req_friendly_name');
    const opName = body.get('operationName');
    if (fbName) {
      friendlyName = fbName;
    } else if (opName) {
      friendlyName = opName;
    }

    const docIdValue = body.get('doc_id');
    let docId: string | undefined;
    if (docIdValue) {
      docId = docIdValue;
    }

    if (friendlyName || docId) {
      return { friendlyName, docId };
    }
    return null;
  }

  // 2. FormData instance
  if (typeof FormData === 'function' && body instanceof FormData) {
    const fbName = body.get('fb_api_req_friendly_name');
    const opName = body.get('operationName');
    let friendlyName: string | undefined;
    if (typeof fbName === 'string') {
      friendlyName = fbName;
    } else if (typeof opName === 'string') {
      friendlyName = opName;
    }

    const docIdValue = body.get('doc_id');
    let docId: string | undefined;
    if (typeof docIdValue === 'string') {
      docId = docIdValue;
    }

    if (friendlyName || docId) {
      return { friendlyName, docId };
    }
    return null;
  }

  // 3. Binary buffers (ArrayBuffer or TypedArray)
  if (body instanceof ArrayBuffer) {
    return extractGraphQLOperation(new TextDecoder().decode(new Uint8Array(body)));
  }
  if (ArrayBuffer.isView(body)) {
    const uint8 = new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
    return extractGraphQLOperation(new TextDecoder().decode(uint8));
  }

  // 4. String body (URL-encoded or JSON)
  if (typeof body === 'string') {
    const trimmed = body.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const json = JSON.parse(trimmed);
        if (typeof json === 'object' && json !== null) {
          let friendlyName: string | undefined;
          if (typeof json.fb_api_req_friendly_name === 'string') {
            friendlyName = json.fb_api_req_friendly_name;
          } else if (typeof json.operationName === 'string') {
            friendlyName = json.operationName;
          }

          let docId: string | undefined;
          if (json.doc_id !== undefined && json.doc_id !== null) {
            docId = String(json.doc_id);
          }

          if (friendlyName || docId) {
            return { friendlyName, docId };
          }
        }
      } catch {
        // Not valid JSON, fall through to URL-encoded parsing
      }
    }

    try {
      const params = new URLSearchParams(trimmed);
      let friendlyName: string | undefined;
      const fbName = params.get('fb_api_req_friendly_name');
      const opName = params.get('operationName');
      if (fbName) {
        friendlyName = fbName;
      } else if (opName) {
        friendlyName = opName;
      }

      const docIdValue = params.get('doc_id');
      let docId: string | undefined;
      if (docIdValue) {
        docId = docIdValue;
      }

      if (friendlyName || docId) {
        return { friendlyName, docId };
      }
    } catch {
      return null;
    }
  }

  // 5. Plain object body directly passed
  if (typeof body === 'object' && body !== null) {
    const obj = body as Record<string, unknown>;
    let friendlyName: string | undefined;
    if (typeof obj.fb_api_req_friendly_name === 'string') {
      friendlyName = obj.fb_api_req_friendly_name;
    } else if (typeof obj.operationName === 'string') {
      friendlyName = obj.operationName;
    }

    let docId: string | undefined;
    if (obj.doc_id !== undefined && obj.doc_id !== null) {
      docId = String(obj.doc_id);
    }

    if (friendlyName || docId) {
      return { friendlyName, docId };
    }
  }

  return null;
}
