import { describe, expect, it } from 'vitest';
import {
  STANDARD_HARDWARE_CONCURRENCY,
  STANDARD_DEVICE_MEMORY,
  STANDARD_COLOR_DEPTH,
  UNMASKED_VENDOR_WEBGL,
  UNMASKED_RENDERER_WEBGL,
  STANDARD_WEBGL_VENDOR,
  STANDARD_WEBGL_RENDERER,
  spoofWebGLParameter,
  applyCanvasNoise,
} from '@/observe/antiFingerprintUtil';

describe('antiFingerprintUtil', () => {
  describe('constants', () => {
    it('has standard expected generic values', () => {
      expect(STANDARD_HARDWARE_CONCURRENCY).toBe(8);
      expect(STANDARD_DEVICE_MEMORY).toBe(8);
      expect(STANDARD_COLOR_DEPTH).toBe(24);
      expect(STANDARD_WEBGL_VENDOR).toContain('Google Inc.');
      expect(STANDARD_WEBGL_RENDERER).toContain('ANGLE');
    });
  });

  describe('spoofWebGLParameter', () => {
    it('spoofs UNMASKED_VENDOR_WEBGL', () => {
      const spoofed = spoofWebGLParameter(UNMASKED_VENDOR_WEBGL, 'Apple Inc.');
      expect(spoofed).toBe(STANDARD_WEBGL_VENDOR);
    });

    it('spoofs UNMASKED_RENDERER_WEBGL', () => {
      const spoofed = spoofWebGLParameter(UNMASKED_RENDERER_WEBGL, 'Apple M1 Max');
      expect(spoofed).toBe(STANDARD_WEBGL_RENDERER);
    });

    it('returns original value for non-fingerprint parameters', () => {
      const original = 3379; // MAX_TEXTURE_SIZE
      expect(spoofWebGLParameter(0x0d33, original)).toBe(original);
    });
  });

  describe('applyCanvasNoise', () => {
    it('handles empty or too short data gracefully', () => {
      const empty = new Uint8ClampedArray(0);
      expect(() => applyCanvasNoise(empty)).not.toThrow();
    });

    it('alters LSB of pixel buffer subtly to modify hash', () => {
      const pixels = new Uint8ClampedArray(1024);
      // Initialize with uniform values
      for (let i = 0; i < pixels.length; i++) {
        pixels[i] = 128;
      }
      const clone = new Uint8ClampedArray(pixels);
      applyCanvasNoise(pixels);

      // Verify that changes were made
      let diffCount = 0;
      for (let i = 0; i < pixels.length; i++) {
        if (pixels[i] !== clone[i]) {
          diffCount++;
          // Difference should only be 1 (LSB flip)
          expect(Math.abs(pixels[i] - clone[i])).toBe(1);
        }
      }
      expect(diffCount).toBeGreaterThan(0);
    });
  });
});
