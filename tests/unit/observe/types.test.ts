import { describe, expect, it } from 'vitest';
import { describeValue, newEvent } from '@/observe/types';

describe('newEvent', () => {
  it('stamps a monotonic sequence so ordering survives transport', () => {
    const first = newEvent('websocket.send', 'wss://example.test/');
    const second = newEvent('websocket.send', 'wss://example.test/');
    expect(second.seq).toBeGreaterThan(first.seq);
  });

  it('records the kind and the target', () => {
    const event = newEvent('worker.create', 'https://example.test/w.js');
    expect(event.kind).toBe('worker.create');
    expect(event.target).toBe('https://example.test/w.js');
  });

  it('carries no payload unless one is attached', () => {
    expect(newEvent('websocket.send', 'wss://example.test/').payload).toBeUndefined();
  });

  it('records the frame it came from', () => {
    expect(newEvent('websocket.send', 'wss://example.test/', 'https://a.test/x').frameUrl).toBe(
      'https://a.test/x',
    );
  });
});

describe('describeValue', () => {
  it('reports a string by length, never by content', () => {
    const described = describeValue('a very secret message');
    expect(described.type).toBe('string');
    expect(described.byteLength).toBe(21);
    expect(JSON.stringify(described)).not.toContain('secret');
  });

  it('reports an ArrayBuffer by length', () => {
    const described = describeValue(new ArrayBuffer(64));
    expect(described.type).toBe('ArrayBuffer');
    expect(described.byteLength).toBe(64);
  });

  it('reports a typed array by byte length, not element count', () => {
    const described = describeValue(new Uint16Array(8));
    expect(described.type).toBe('Uint16Array');
    expect(described.byteLength).toBe(16);
  });

  it('reports a Blob by size', () => {
    const described = describeValue(new Blob(['abcd']));
    expect(described.type).toBe('Blob');
    expect(described.byteLength).toBe(4);
  });

  it('survives a value it does not recognise', () => {
    const described = describeValue({ weird: true } as unknown as string);
    expect(described.type).toBe('unknown');
    expect(described.byteLength).toBe(0);
  });

  it('survives null and undefined without throwing', () => {
    expect(describeValue(null as unknown as string).type).toBe('unknown');
    expect(describeValue(undefined as unknown as string).type).toBe('unknown');
  });
});
