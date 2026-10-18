import { describe, expect, it } from 'vitest';
import {
  neutralizeTypingDgw,
  neutralizeReadReceiptDgw,
  neutralizeInboxWatermarkDgw,
  neutralizeRealtimeTelemetry,
} from '@/protocol/dgw/dgwNeutralizer';

describe('dgwNeutralizer', () => {
  describe('neutralizeTypingDgw', () => {
    it('neutralizes string JSON with is_typing: 1 to is_typing: 0', () => {
      const input = '{"label":"3","payload":"{\\"is_typing\\":1,\\"thread_key\\":123}"}';
      const output = neutralizeTypingDgw(input) as string;
      expect(output).not.toBeNull();
      expect(output).toMatch(/is_typing\\*":0/);
      expect(output.length).toBe(input.length);
    });

    it('returns null if is_typing is already 0', () => {
      const input = '{"label":"3","payload":"{\\"is_typing\\":0,\\"thread_key\\":123}"}';
      const output = neutralizeTypingDgw(input);
      expect(output).toBeNull();
    });

    it('neutralizes Uint8Array binary DGW frame with is_typing: 1', () => {
      const text = '\x0F\x0B\x00\x02\x00\x00{}\r\x0B\x00{"label":"3","payload":"{\\"is_typing\\":1}"}';
      const bytes = new TextEncoder().encode(text);
      const res = neutralizeTypingDgw(bytes) as Uint8Array;
      expect(res).not.toBeNull();
      expect(res.length).toBe(bytes.length);
      const decoded = new TextDecoder().decode(res);
      expect(decoded).toMatch(/is_typing\\*":0/);
    });

    it('neutralizes ArrayBuffer input and returns ArrayBuffer of same byteLength', () => {
      const text = '{"label":"3","payload":"{\\"is_typing\\":1}"}';
      const buf = new TextEncoder().encode(text).buffer;
      const res = neutralizeTypingDgw(buf) as ArrayBuffer;
      expect(res).not.toBeNull();
      expect(res.byteLength).toBe(buf.byteLength);
      const decoded = new TextDecoder().decode(new Uint8Array(res));
      expect(decoded).toMatch(/is_typing\\*":0/);
    });

    it('never mutates outbound messages (task label 46)', () => {
      const msg = '{"tasks":[{"label":"46","payload":"{\\"text\\":\\"what is is_typing:1?\\"}"}]}';
      const res = neutralizeTypingDgw(msg);
      expect(res).toBeNull();
    });
  });

  describe('neutralizeReadReceiptDgw', () => {
    it('neutralizes last_read_watermark_ts in string JSON to 0 padded with spaces', () => {
      const input = '{"label":"21","payload":"{\\"last_read_watermark_ts\\":1790175610156,\\"sync_group\\":1}"}';
      const output = neutralizeReadReceiptDgw(input) as string;
      expect(output).not.toBeNull();
      expect(output.length).toBe(input.length);
      expect(output).toMatch(/last_read_watermark_ts\\*":0\s{12}/);
      const parsed = JSON.parse(output);
      const inner = JSON.parse(parsed.payload);
      expect(inner.last_read_watermark_ts).toBe(0);
      expect(inner.sync_group).toBe(1);
    });

    it('neutralizes last_read_watermark_ts in binary buffer', () => {
      const input = '{"label":"21","payload":"{\\"last_read_watermark_ts\\":1790175610156,\\"sync_group\\":1}"}';
      const bytes = new TextEncoder().encode(input);
      const res = neutralizeReadReceiptDgw(bytes) as Uint8Array;
      expect(res).not.toBeNull();
      expect(res.length).toBe(bytes.length);
      const decoded = new TextDecoder().decode(res);
      expect(decoded).toMatch(/last_read_watermark_ts\\*":0\s{12}/);
    });

    it('returns null if no last_read_watermark_ts exists', () => {
      const input = '{"label":"46","payload":"{\\"text\\":\\"hello\\"}"}';
      expect(neutralizeReadReceiptDgw(input)).toBeNull();
    });
  });

  describe('neutralizeInboxWatermarkDgw', () => {
    it('neutralizes last_seen_time_ms to 0 padded with spaces', () => {
      const input = '{"label":"6","payload":"{\\"parent_thread_key\\":0,\\"last_seen_time_ms\\":1790175610156}"}';
      const output = neutralizeInboxWatermarkDgw(input) as string;
      expect(output).not.toBeNull();
      expect(output.length).toBe(input.length);
      expect(output).toMatch(/last_seen_time_ms\\*":0\s{12}/);
      const parsed = JSON.parse(output);
      const inner = JSON.parse(parsed.payload);
      expect(inner.last_seen_time_ms).toBe(0);
    });
  });

  describe('neutralizeRealtimeTelemetry', () => {
    it('neutralizes send_typing_indicators to noop_typing_indicators in string', () => {
      const input = '{"events":[{"name":"messenger_web_ux_event","extra":"{\\"event_name\\":\\"send_typing_indicators\\"}"}]}';
      const output = neutralizeRealtimeTelemetry(input) as string;
      expect(output).not.toBeNull();
      expect(output.length).toBe(input.length);
      expect(output).toContain('noop_typing_indicators');
    });

    it('neutralizes send_typing_indicators in binary buffer', () => {
      const input = 'prefix...send_typing_indicators...suffix';
      const bytes = new TextEncoder().encode(input);
      const res = neutralizeRealtimeTelemetry(bytes) as Uint8Array;
      expect(res).not.toBeNull();
      expect(res.length).toBe(bytes.length);
      const decoded = new TextDecoder().decode(res);
      expect(decoded).toContain('noop_typing_indicators');
    });
  });
});
