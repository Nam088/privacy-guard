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
        } catch {
          // ignore restore errors
        }
      });
    } catch {
      // ignore definition errors
    }

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
        } catch {
          // ignore restore errors
        }
      });
    } catch {
      // ignore definition errors
    }
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
        } catch {
          // ignore restore errors
        }
      });
    } catch {
      // ignore definition errors
    }
  }

  // 3. WebGL getParameter spoofing
  const winAny = win as unknown as {
    WebGLRenderingContext?: { prototype?: { getParameter: (pname: number, ...rest: unknown[]) => unknown } };
    WebGL2RenderingContext?: { prototype?: { getParameter: (pname: number, ...rest: unknown[]) => unknown } };
  };

  const webglCtx = winAny.WebGLRenderingContext;
  if (webglCtx?.prototype?.getParameter) {
    const proto = webglCtx.prototype;
    const origGetParam = proto.getParameter;
    proto.getParameter = function (pname: number, ...rest: unknown[]): unknown {
      const originalValue = origGetParam.call(this, pname, ...rest);
      if (isActive()) {
        return spoofWebGLParameter(pname, originalValue);
      }
      return originalValue;
    };
    uninstalls.push(() => {
      proto.getParameter = origGetParam;
    });
  }

  const webgl2Ctx = winAny.WebGL2RenderingContext;
  if (webgl2Ctx?.prototype?.getParameter) {
    const proto2 = webgl2Ctx.prototype;
    const origGetParam2 = proto2.getParameter;
    proto2.getParameter = function (pname: number, ...rest: unknown[]): unknown {
      const originalValue = origGetParam2.call(this, pname, ...rest);
      if (isActive()) {
        return spoofWebGLParameter(pname, originalValue);
      }
      return originalValue;
    };
    uninstalls.push(() => {
      proto2.getParameter = origGetParam2;
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

  const canvasCtx = winCanvas.CanvasRenderingContext2D;
  if (canvasCtx?.prototype?.getImageData) {
    const canvasProto = canvasCtx.prototype;
    const origGetImageData = canvasProto.getImageData;
    canvasProto.getImageData = function (
      ...args: [number, number, number, number]
    ): ImageData {
      const imgData = origGetImageData.apply(this, args);
      if (isActive() && imgData && imgData.data) {
        applyCanvasNoise(imgData.data);
      }
      return imgData;
    };
    uninstalls.push(() => {
      canvasProto.getImageData = origGetImageData;
    });
  }

  return () => {
    for (const undo of uninstalls) {
      undo();
    }
  };
}
