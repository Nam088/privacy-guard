import { describe, expect, it } from 'vitest';
import { transformStreamControllerPresence } from '@/observe/stealthPresence';

describe('stealth presence transformer', () => {
  const streamUrl = 'wss://gateway.messenger.com/ws/streamcontroller?x-dgw-appid=772021112871879';
  const otherUrl = 'wss://gateway.messenger.com/ws/lightspeed';

  it('ignores frames on non-streamcontroller sockets', () => {
    const raw = JSON.stringify({ hello: 'world' });
    expect(transformStreamControllerPresence(otherUrl, raw)).toBe(raw);
  });

  it('rewrites presenceReportingAmendment in string frames to away/offline', () => {
    const activePayload = {
      payload: {
        presenceReportingAmendment: {
          reportingArguments: {
            availability: 1,
            foregrounded: true,
            mutationId: 'test-uuid',
            capabilities: '10',
          },
        },
      },
    };

    const result = transformStreamControllerPresence(streamUrl, JSON.stringify(activePayload));
    expect(typeof result).toBe('string');
    const parsed = JSON.parse(result as string);
    expect(parsed.payload.presenceReportingAmendment.reportingArguments.availability).toBe(2);
    expect(parsed.payload.presenceReportingAmendment.reportingArguments.foregrounded).toBe(false);
  });

  it('rewrites binary frames with a 14-byte DGW header', () => {
    const activePayload = {
      payload: {
        presenceReportingAmendment: {
          reportingArguments: {
            availability: 1,
            foregrounded: true,
          },
        },
      },
    };

    const header = new Uint8Array([0x0d, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x18, 0xb1]);
    const jsonBytes = new TextEncoder().encode(JSON.stringify(activePayload));
    const binaryFrame = new Uint8Array(header.length + jsonBytes.length);
    binaryFrame.set(header, 0);
    binaryFrame.set(jsonBytes, header.length);

    const result = transformStreamControllerPresence(streamUrl, binaryFrame) as Uint8Array;
    expect(result).toBeInstanceOf(Uint8Array);

    // Verify DGW 16-bit payload length at bytes 2-3 matches (result.length - 4)
    const expectedPayloadLen = result.length - 4;
    const actualPayloadLen = ((result[2] ?? 0) << 8) | (result[3] ?? 0);
    expect(actualPayloadLen).toBe(expectedPayloadLen);

    const decodedJson = JSON.parse(new TextDecoder().decode(result.subarray(14)));
    expect(decodedJson.payload.presenceReportingAmendment.reportingArguments.availability).toBe(2);
    expect(decodedJson.payload.presenceReportingAmendment.reportingArguments.foregrounded).toBe(false);
  });

  it('rewrites binary frames whose DGW header contains embedded 7b 7d trap without truncating', () => {
    const activePayload = {
      payload: {
        presenceReportingAmendment: {
          reportingArguments: {
            availability: 1,
            foregrounded: true,
          },
        },
      },
    };

    // Header has 0x7b, 0x7d at byte 4-5
    const header = new Uint8Array([0x0d, 0x02, 0x00, 0x00, 0x7b, 0x7d, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x18, 0xb1]);
    const jsonBytes = new TextEncoder().encode(JSON.stringify(activePayload));
    const binaryFrame = new Uint8Array(header.length + jsonBytes.length);
    binaryFrame.set(header, 0);
    binaryFrame.set(jsonBytes, header.length);

    const result = transformStreamControllerPresence(streamUrl, binaryFrame) as Uint8Array;
    expect(result).toBeInstanceOf(Uint8Array);

    const expectedPayloadLen = result.length - 4;
    const actualPayloadLen = ((result[2] ?? 0) << 8) | (result[3] ?? 0);
    expect(actualPayloadLen).toBe(expectedPayloadLen);

    const decodedJson = JSON.parse(new TextDecoder().decode(result.subarray(14)));
    expect(decodedJson.payload.presenceReportingAmendment.reportingArguments.availability).toBe(2);
    expect(decodedJson.payload.presenceReportingAmendment.reportingArguments.foregrounded).toBe(false);
  });

  it('neutralizes makeUserAvailableWhenInForeground to false', () => {
    const payload = {
      payload: {
        presenceReportingAmendment: {
          reportingArguments: {
            makeUserAvailableWhenInForeground: true,
            mutationId: 'test-uuid',
          },
        },
      },
    };
    const result = transformStreamControllerPresence(streamUrl, JSON.stringify(payload)) as string;
    const parsed = JSON.parse(result);
    expect(parsed.payload.presenceReportingAmendment.reportingArguments.makeUserAvailableWhenInForeground).toBe(false);
  });

  it('neutralizes initial presenceReportingRequest availability: 1 to 2', () => {
    const initialPayload = {
      appFamily: 2,
      presenceReportingRequest: {
        availability: 1,
        capabilities: '10',
      },
    };
    const result = transformStreamControllerPresence(streamUrl, JSON.stringify(initialPayload)) as string;
    const parsed = JSON.parse(result);
    expect(parsed.presenceReportingRequest.availability).toBe(2);
  });

  it('correctly transforms real-world live Messenger DGW presence frame', () => {
    // Exact hex captured from live Messenger session with availability: 1, foregrounded: true
    const realHex =
      '0d0600ba000002803c160218b0017b227061796c6f6164223a7b2270726573656e63655265706f7274696e67416d656e646d656e74223a7b227265706f7274696e67417267756d656e7473223a7b22617661696c6162696c697479223a312c22666f726567726f756e646564223a747275652c226d75746174696f6e4964223a2239653138303766652d666461652d346266662d393834392d303761396464666539396139222c226361706162696c6974696573223a223130227d7d7d7d';
    const binary = new Uint8Array(Buffer.from(realHex, 'hex'));
    const result = transformStreamControllerPresence(streamUrl, binary) as Uint8Array;

    expect(result).toBeInstanceOf(Uint8Array);
    // Payload length at bytes 2-3 must match result.length - 4
    const payloadLen = ((result[2] ?? 0) << 8) | (result[3] ?? 0);
    expect(payloadLen).toBe(result.length - 4);

    // JSON payload must have availability: 2 and foregrounded: false
    const json = JSON.parse(new TextDecoder().decode(result.subarray(14)));
    expect(json.payload.presenceReportingAmendment.reportingArguments.availability).toBe(2);
    expect(json.payload.presenceReportingAmendment.reportingArguments.foregrounded).toBe(false);
  });

  it('correctly preserves trailing frame bytes (such as 00 00 tail marker)', () => {
    // Frame with trailing 00 00 marker
    const realHexWithTail =
      '0d0300bb000001803c160018b1017b227061796c6f6164223a7b2270726573656e63655265706f7274696e67416d656e646d656e74223a7b227265706f7274696e67417267756d656e7473223a7b22617661696c6162696c697479223a312c22666f726567726f756e646564223a747275652c226d75746174696f6e4964223a2265656337363633622d393366392d346264342d626437312d626135386664323862393164222c226361706162696c6974696573223a223130227d7d7d7d0000';
    const binary = new Uint8Array(Buffer.from(realHexWithTail, 'hex'));
    const result = transformStreamControllerPresence(streamUrl, binary) as Uint8Array;

    expect(result).toBeInstanceOf(Uint8Array);
    // Trailing bytes must still be 0x00, 0x00
    expect(result[result.length - 2]).toBe(0x00);
    expect(result[result.length - 1]).toBe(0x00);

    // Payload length in header (bytes 2-3) must match header + json - 4
    const payloadLen = ((result[2] ?? 0) << 8) | (result[3] ?? 0);
    expect(payloadLen).toBe(result.length - 2 - 4);

    const jsonText = new TextDecoder().decode(result.subarray(14, result.length - 2));
    const json = JSON.parse(jsonText);
    expect(json.payload.presenceReportingAmendment.reportingArguments.availability).toBe(2);
    expect(json.payload.presenceReportingAmendment.reportingArguments.foregrounded).toBe(false);
  });

  it('returns untouched data when JSON parsing fails or payload is unrelated', () => {
    const unrelated = JSON.stringify({ payload: { otherStuff: true } });
    expect(transformStreamControllerPresence(streamUrl, unrelated)).toBe(unrelated);
    expect(transformStreamControllerPresence(streamUrl, 'invalid json {')).toBe('invalid json {');
  });
});
