/**
 * Low-level binary frame encoding for Meta's Device Gateway (DGW).
 */

/**
 * Re-encodes a DGW binary frame with a new JSON payload, updating the 16-bit payload length
 * in bytes 2-3 and the varint JSON length preceding the payload to ensure gateway protocol sync.
 */
export function reencodeDgwFrame(
  originalBytes: Uint8Array,
  newJsonBytes: Uint8Array,
  jsonStart: number,
  jsonEnd = originalBytes.length,
): Uint8Array {
  const header = new Uint8Array(originalBytes.subarray(0, jsonStart));
  const tail = originalBytes.subarray(jsonEnd);
  const newJsonLen = newJsonBytes.length;

  // Update varint before jsonStart if present
  const prevByte = jsonStart >= 2 ? header[jsonStart - 2] : undefined;
  if (prevByte !== undefined && (prevByte & 0x80) !== 0) {
    header[jsonStart - 2] = (newJsonLen & 0x7f) | 0x80;
    header[jsonStart - 1] = (newJsonLen >> 7) & 0x7f;
  } else if (jsonStart >= 1 && newJsonLen < 128) {
    header[jsonStart - 1] = newJsonLen & 0x7f;
  }

  if (header.length >= 4) {
    const payloadLen = header.length + newJsonLen - 4;
    header[2] = (payloadLen >> 8) & 0xff;
    header[3] = payloadLen & 0xff;
  }

  const result = new Uint8Array(header.length + newJsonLen + tail.length);
  result.set(header, 0);
  result.set(newJsonBytes, header.length);
  result.set(tail, header.length + newJsonLen);
  return result;
}
