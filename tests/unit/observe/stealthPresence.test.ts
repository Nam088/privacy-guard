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
    expect(result.subarray(0, 14)).toEqual(header);

    const decodedJson = JSON.parse(new TextDecoder().decode(result.subarray(14)));
    expect(decodedJson.payload.presenceReportingAmendment.reportingArguments.availability).toBe(2);
    expect(decodedJson.payload.presenceReportingAmendment.reportingArguments.foregrounded).toBe(false);
  });

  it('returns untouched data when JSON parsing fails or payload is unrelated', () => {
    const unrelated = JSON.stringify({ payload: { otherStuff: true } });
    expect(transformStreamControllerPresence(streamUrl, unrelated)).toBe(unrelated);
    expect(transformStreamControllerPresence(streamUrl, 'invalid json {')).toBe('invalid json {');
  });
});
