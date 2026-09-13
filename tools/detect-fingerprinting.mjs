import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const profileDir = path.resolve(rootDir, '.dev-profile');

async function detectFingerprinting() {
  console.log('🔍 [PROBE] Bắt đầu dò quét toàn diện Device Profiling & Fingerprinting trên Facebook...');

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    viewport: { width: 1280, height: 800 },
    args: ['--no-first-run', '--no-default-browser-check'],
  });

  const page = await context.newPage();

  const networkTraces = [];
  page.on('request', (req) => {
    const postData = req.postData();
    if (postData) {
      if (postData.includes('screen_') || postData.includes('device_') || postData.includes('hardware') || postData.includes('cpu') || postData.includes('memory') || postData.includes('gpu') || postData.includes('pr=')) {
        networkTraces.push({
          url: req.url().slice(0, 70),
          snippet: postData.slice(0, 300),
        });
      }
    }
  });

  await page.addInitScript(() => {
    window.__fpDetections = [];

    function recordCall(api, detail = '') {
      const err = new Error();
      const stackLines = (err.stack || '').split('\n').slice(2, 6).join(' -> ');
      window.__fpDetections.push({
        api,
        detail,
        stack: stackLines,
        timestamp: Date.now(),
      });
    }

    // 1. Canvas
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function (...args) {
      recordCall('HTMLCanvasElement.toDataURL', args[0] || 'default');
      return origToDataURL.apply(this, args);
    };

    const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = function (...args) {
      recordCall('CanvasRenderingContext2D.getImageData', `${args[0]},${args[1]},${args[2]},${args[3]}`);
      return origGetImageData.apply(this, args);
    };

    // 2. WebGL
    if (typeof WebGLRenderingContext !== 'undefined') {
      const origGetParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function (pname) {
        const name = pname === 0x9245 ? 'UNMASKED_VENDOR' : pname === 0x9246 ? 'UNMASKED_RENDERER' : String(pname);
        recordCall('WebGL.getParameter', name);
        return origGetParameter.apply(this, arguments);
      };

      const origGetExtension = WebGLRenderingContext.prototype.getExtension;
      WebGLRenderingContext.prototype.getExtension = function (name) {
        recordCall('WebGL.getExtension', name);
        return origGetExtension.apply(this, arguments);
      };
    }

    // 3. Hardware & Memory
    try {
      let origHC = navigator.hardwareConcurrency;
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get() {
          recordCall('navigator.hardwareConcurrency', String(origHC));
          return origHC;
        },
      });
    } catch {}

    try {
      let origDM = navigator.deviceMemory;
      Object.defineProperty(navigator, 'deviceMemory', {
        get() {
          recordCall('navigator.deviceMemory', String(origDM));
          return origDM;
        },
      });
    } catch {}

    // 4. Screen Depth & Dimensions
    try {
      let origCD = screen.colorDepth;
      Object.defineProperty(screen, 'colorDepth', {
        get() {
          recordCall('screen.colorDepth', String(origCD));
          return origCD;
        },
      });
    } catch {}
  });

  console.log('🌐 Đang tải https://web.facebook.com/...');
  try {
    await page.goto('https://web.facebook.com/', {
      waitUntil: 'networkidle',
      timeout: 25000,
    });
  } catch {
    console.log('ℹ️ Facebook network idle timeout, tiếp tục đọc kết quả...');
  }

  await page.waitForTimeout(3000);

  const detections = await page.evaluate(() => window.__fpDetections || []);

  console.log('\n===============================================================');
  console.log(`📊 KẾT QUẢ DÒ QUÉT THỰC TẾ:`);
  console.log(`- Cuộc gọi JS API bị bắt: ${detections.length}`);
  console.log(`- Gói mạng mang thông số phần cứng: ${networkTraces.length}`);
  console.log('===============================================================');

  const counts = {};
  for (const item of detections) {
    counts[item.api] = (counts[item.api] || 0) + 1;
  }
  for (const [api, count] of Object.entries(counts)) {
    console.log(`🎯 [JS PROBE] ${api}: ${count} lần`);
  }

  if (detections.length > 0) {
    console.log('\n🔍 Chi tiết 5 cuộc gọi JS gần nhất:');
    for (const d of detections.slice(0, 5)) {
      console.log(`   👉 ${d.api} (${d.detail})`);
      console.log(`      Callsite: ${d.stack.slice(0, 150)}`);
    }
  }

  if (networkTraces.length > 0) {
    console.log('\n📡 Chi tiết gói tin mạng gửi thông số thiết bị:');
    for (const t of networkTraces.slice(0, 3)) {
      console.log(`   👉 URL: ${t.url}`);
      console.log(`      Snippet: ${t.snippet.slice(0, 180)}...\n`);
    }
  }

  await context.close();
}

detectFingerprinting().catch((err) => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});
