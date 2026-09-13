import { describe, expect, it } from 'vitest';
import { installAntiFingerprintHook } from '@/observe/antiFingerprint';
import {
  STANDARD_HARDWARE_CONCURRENCY,
  STANDARD_DEVICE_MEMORY,
  STANDARD_COLOR_DEPTH,
  UNMASKED_VENDOR_WEBGL,
  STANDARD_WEBGL_VENDOR,
} from '@/observe/antiFingerprintUtil';

describe('installAntiFingerprintHook', () => {
  it('does nothing when win is null', () => {
    // @ts-expect-error test null
    const uninstall = installAntiFingerprintHook(null, () => true);
    expect(() => uninstall()).not.toThrow();
  });

  it('spoofs hardware concurrency and device memory when active', () => {
    let active = true;
    const fakeNav = {
      hardwareConcurrency: 16,
      deviceMemory: 32,
    };
    const fakeWin = {
      navigator: fakeNav,
      screen: { colorDepth: 30 },
    } as unknown as Window;

    const uninstall = installAntiFingerprintHook(fakeWin, () => active);

    expect(fakeNav.hardwareConcurrency).toBe(STANDARD_HARDWARE_CONCURRENCY);
    // @ts-expect-error deviceMemory
    expect(fakeNav.deviceMemory).toBe(STANDARD_DEVICE_MEMORY);
    expect(fakeWin.screen.colorDepth).toBe(STANDARD_COLOR_DEPTH);

    // When deactivated
    active = false;
    expect(fakeNav.hardwareConcurrency).toBe(16);
    // @ts-expect-error deviceMemory
    expect(fakeNav.deviceMemory).toBe(32);
    expect(fakeWin.screen.colorDepth).toBe(30);

    uninstall();
  });

  it('spoofs WebGL getParameter queries', () => {
    let active = true;
    const fakeProto = {
      getParameter: (pname: number) => (pname === UNMASKED_VENDOR_WEBGL ? 'Real Apple GPU' : 4096),
    };
    const fakeWin = {
      WebGLRenderingContext: { prototype: fakeProto },
    } as unknown as Window;

    const uninstall = installAntiFingerprintHook(fakeWin, () => active);

    expect(fakeProto.getParameter(UNMASKED_VENDOR_WEBGL)).toBe(STANDARD_WEBGL_VENDOR);
    expect(fakeProto.getParameter(1234)).toBe(4096);

    active = false;
    expect(fakeProto.getParameter(UNMASKED_VENDOR_WEBGL)).toBe('Real Apple GPU');

    uninstall();
  });

  it('injects subtle noise to Canvas getImageData', () => {
    let active = true;
    const fakeProto = {
      getImageData: () => ({
        data: new Uint8ClampedArray([100, 100, 100, 255]),
      }),
    };
    const fakeWin = {
      CanvasRenderingContext2D: { prototype: fakeProto },
    } as unknown as Window;

    const uninstall = installAntiFingerprintHook(fakeWin, () => active);

    const data = fakeProto.getImageData();
    // 100 ^ 1 = 101
    expect(data.data[0]).toBe(101);

    active = false;
    const data2 = fakeProto.getImageData();
    expect(data2.data[0]).toBe(100);

    uninstall();
  });
});
