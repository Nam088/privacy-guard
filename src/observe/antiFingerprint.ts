/**
 * Anti-Fingerprinting Shield Hook.
 *
 * Normalizes hardware telemetry, WebGL vendor/renderer, and adds subtle micro-noise to
 * Canvas to prevent device fingerprinting and cross-account tracking on Facebook & Instagram.
 */

import {
  STANDARD_HARDWARE_CONCURRENCY,
  STANDARD_DEVICE_MEMORY,
  STANDARD_COLOR_DEPTH,
  spoofWebGLParameter,
  applyCanvasNoise,
} from './antiFingerprintUtil';

export function installAntiFingerprintHook(
  win: Window,
  isActive: () => boolean,
): () => void {
  if (!win) {
    return () => {};
  }

  const uninstalls: Array<() => void> = [];

  // 1. Normalize navigator.hardwareConcurrency & navigator.deviceMemory
  const nav = win.navigator;
  if (nav) {
    const navProto = (win as unknown as { Navigator?: { prototype?: unknown } }).Navigator?.prototype || nav;

    // hardwareConcurrency
    try {
      const origHCDesc =
        Object.getOwnPropertyDescriptor(navProto, 'hardwareConcurrency') ||
        Object.getOwnPropertyDescriptor(nav, 'hardwareConcurrency');
      const origHCVal = nav.hardwareConcurrency;

      Object.defineProperty(nav, 'hardwareConcurrency', {
        configurable: true,
        enumerable: true,
        get() {
          if (isActive()) {
            return STANDARD_HARDWARE_CONCURRENCY;
          }
          if (origHCDesc && typeof origHCDesc.get === 'function') {
            return origHCDesc.get.call(this);
          }
          return origHCVal;
        },
      });

      uninstalls.push(() => {
        try {
          if (origHCDesc) {
            Object.defineProperty(nav, 'hardwareConcurrency', origHCDesc);
          } else {
            // @ts-expect-error restore value
            delete nav.hardwareConcurrency;
          }
        } catch {}
      });
    } catch {}

    // deviceMemory
    try {
      const origDMDesc =
        Object.getOwnPropertyDescriptor(navProto, 'deviceMemory') ||
        Object.getOwnPropertyDescriptor(nav, 'deviceMemory');
      // @ts-expect-error deviceMemory property
      const origDMVal = nav.deviceMemory;

      Object.defineProperty(nav, 'deviceMemory', {
        configurable: true,
        enumerable: true,
        get() {
          if (isActive()) {
            return STANDARD_DEVICE_MEMORY;
          }
          if (origDMDesc && typeof origDMDesc.get === 'function') {
            return origDMDesc.get.call(this);
          }
          return origDMVal;
        },
      });

      uninstalls.push(() => {
        try {
          if (origDMDesc) {
            Object.defineProperty(nav, 'deviceMemory', origDMDesc);
          } else {
            // @ts-expect-error restore value
            delete nav.deviceMemory;
          }
        } catch {}
      });
    } catch {}
  }

  // 2. Normalize screen.colorDepth & screen.pixelDepth
  const scr = win.screen;
  if (scr) {
    try {
      const origCDVal = scr.colorDepth;
      Object.defineProperty(scr, 'colorDepth', {
        configurable: true,
        enumerable: true,
        get() {
          return isActive() ? STANDARD_COLOR_DEPTH : origCDVal;
        },
      });
      uninstalls.push(() => {
        try {
          // @ts-expect-error restore
          delete scr.colorDepth;
        } catch {}
      });
    } catch {}
  }

  // 3. WebGL getParameter spoofing
  const winAny = win as unknown as {
    WebGLRenderingContext?: { prototype?: { getParameter: (pname: number) => unknown } };
    WebGL2RenderingContext?: { prototype?: { getParameter: (pname: number) => unknown } };
  };

  if (winAny.WebGLRenderingContext?.prototype?.getParameter) {
    const origGetParam = winAny.WebGLRenderingContext.prototype.getParameter;
    winAny.WebGLRenderingContext.prototype.getParameter = function (pname: number): unknown {
      const originalValue = origGetParam.apply(this, arguments as unknown as [number]);
      if (isActive()) {
        return spoofWebGLParameter(pname, originalValue);
      }
      return originalValue;
    };
    uninstalls.push(() => {
      winAny.WebGLRenderingContext!.prototype.getParameter = origGetParam;
    });
  }

  if (winAny.WebGL2RenderingContext?.prototype?.getParameter) {
    const origGetParam2 = winAny.WebGL2RenderingContext.prototype.getParameter;
    winAny.WebGL2RenderingContext.prototype.getParameter = function (pname: number): unknown {
      const originalValue = origGetParam2.apply(this, arguments as unknown as [number]);
      if (isActive()) {
        return spoofWebGLParameter(pname, originalValue);
      }
      return originalValue;
    };
    uninstalls.push(() => {
      winAny.WebGL2RenderingContext!.prototype.getParameter = origGetParam2;
    });
  }

  // 4. Canvas getImageData micro-noise
  const winCanvas = win as unknown as {
    CanvasRenderingContext2D?: {
      prototype?: {
        getImageData: (sx: number, sy: number, sw: number, sh: number) => ImageData;
      };
    };
  };

  if (winCanvas.CanvasRenderingContext2D?.prototype?.getImageData) {
    const origGetImageData = winCanvas.CanvasRenderingContext2D.prototype.getImageData;
    winCanvas.CanvasRenderingContext2D.prototype.getImageData = function (
      sx: number,
      sy: number,
      sw: number,
      sh: number,
    ): ImageData {
      const imgData = origGetImageData.apply(this, arguments as unknown as [number, number, number, number]);
      if (isActive() && imgData && imgData.data) {
        applyCanvasNoise(imgData.data);
      }
      return imgData;
    };
    uninstalls.push(() => {
      winCanvas.CanvasRenderingContext2D!.prototype.getImageData = origGetImageData;
    });
  }

  return () => {
    for (const undo of uninstalls) {
      undo();
    }
  };
}
