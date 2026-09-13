/**
 * Anti-Fingerprinting Utilities.
 *
 * Normalizes hardware telemetry, WebGL vendor/renderer, and adds micro-noise to Canvas
 * to prevent Meta and third-party trackers from generating unique device fingerprints.
 */

export const STANDARD_HARDWARE_CONCURRENCY = 8;
export const STANDARD_DEVICE_MEMORY = 8;
export const STANDARD_COLOR_DEPTH = 24;

export const UNMASKED_VENDOR_WEBGL = 0x9245;
export const UNMASKED_RENDERER_WEBGL = 0x9246;

export const STANDARD_WEBGL_VENDOR = 'Google Inc. (Intel)';
export const STANDARD_WEBGL_RENDERER =
  'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)';

/**
 * Spoofs WebGL parameter queries for hardware fingerprinting.
 */
export function spoofWebGLParameter(pname: number, originalValue: unknown): unknown {
  if (pname === UNMASKED_VENDOR_WEBGL) {
    return STANDARD_WEBGL_VENDOR;
  }
  if (pname === UNMASKED_RENDERER_WEBGL) {
    return STANDARD_WEBGL_RENDERER;
  }
  return originalValue;
}

/**
 * Injects imperceptible micro-noise into ImageData pixel buffer to randomize
 * canvas hash while preserving visual rendering.
 */
export function applyCanvasNoise(data: Uint8ClampedArray): void {
  if (!data || data.length < 4) {
    return;
  }
  // Modify LSB (least significant bit) on a deterministic sample of pixels
  // Every 64th pixel (stride 256 bytes) toggle lowest bit of red channel
  for (let i = 0; i < data.length; i += 256) {
    const val = data[i];
    if (typeof val === 'number') {
      data[i] = val ^ 1;
    }
  }
}
