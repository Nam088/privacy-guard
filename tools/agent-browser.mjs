import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const extensionPath = path.resolve(rootDir, '.output/chrome-mv3');
const profileDir = path.resolve(rootDir, '.dev-profile');
const logFile = path.resolve(profileDir, 'agent-events.jsonl');

if (!fs.existsSync(profileDir)) {
  fs.mkdirSync(profileDir, { recursive: true });
}

if (!fs.existsSync(extensionPath)) {
  console.log('⚠️ Extension build not found. Please run: pnpm build');
  process.exit(1);
}

// Ensure log file exists and append session start marker
fs.appendFileSync(logFile, `// --- Agent Detection Session Started: ${new Date().toISOString()} ---\n`);

console.log('🚀 Đang khởi động Dedicated Browser Profile cho Agent...');
console.log(`📁 Thư mục Profile lưu phiên: ${profileDir}`);
console.log(`🧩 Đường dẫn Extension:       ${extensionPath}`);
console.log(`📡 Cổng Remote DevTools:      http://localhost:9222\n`);

const context = await chromium.launchPersistentContext(profileDir, {
  headless: false,
  viewport: null, // use native window size
  ignoreDefaultArgs: ['--disable-extensions'],
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
    '--remote-debugging-port=9222',
    '--no-first-run',
    '--no-default-browser-check',
  ],
});

// Locate Extension Background Service Worker
let backgroundWorker = context.serviceWorkers().find((sw) => sw.url().includes('chrome-extension://'));
if (!backgroundWorker) {
  try {
    backgroundWorker = await context.waitForEvent('serviceworker', {
      predicate: (sw) => sw.url().includes('chrome-extension://'),
      timeout: 8000,
    });
  } catch {
    backgroundWorker = context.serviceWorkers().find((sw) => sw.url().includes('chrome-extension://'));
  }
}

let extensionId = '';
const enableProtectionInitially = !process.argv.includes('--off');
let currentProtectionState = enableProtectionInitially;

if (backgroundWorker) {
  extensionId = backgroundWorker.url().split('/')[2];
  console.log(`\x1b[32m[EXTENSION] ✅ Đã nạp thành công Privacy Guard Extension!\x1b[0m`);
  console.log(`[EXTENSION] 🆔 ID: ${extensionId}`);
  console.log(`[EXTENSION] 🔗 Popup URL: chrome-extension://${extensionId}/popup.html\n`);

  // Set Master Switch based on requested mode (ON for testing, OFF if --off specified)
  await backgroundWorker.evaluate(async (initialProtection) => {
    const rawSettings = (await chrome.storage.local.get('local:settings'))['local:settings'] || {};
    await chrome.storage.local.set({
      'local:settings': {
        ...rawSettings,
        masterEnabled: initialProtection,
      },
      'local:captureEnabled': true,
    });
  }, enableProtectionInitially);

  if (currentProtectionState) {
    console.log('\x1b[32m[SHIELD] 🛡️ Trạng thái bảo vệ hiện tại: BẬT (Protection: ON)\x1b[0m');
    console.log('\x1b[32m[SHIELD] 🔒 Đang chặn typing indicator, read receipt, story views, v.v. Bạn có thể kiểm thử ngay!\x1b[0m\n');
  } else {
    console.log('\x1b[33m[SHIELD] 🛡️ Trạng thái bảo vệ hiện tại: TẮT (Protection: OFF)\x1b[0m');
    console.log('\x1b[33m[SHIELD] ⚡ Môi trường hoàn toàn tự nhiên (Unhindered) - Gói tin Facebook/Messenger không bị chặn.\x1b[0m\n');
  }
} else {
  console.warn('\x1b[31m[EXTENSION] ⚠️ Không tìm thấy Service Worker của extension.\x1b[0m');
}

// Function to toggle protection dynamically
async function setProtection(enabled) {
  currentProtectionState = enabled;
  if (!backgroundWorker) {
    backgroundWorker = context.serviceWorkers().find((sw) => sw.url().includes('chrome-extension://'));
  }
  if (backgroundWorker) {
    await backgroundWorker.evaluate(async (en) => {
      const rawSettings = (await chrome.storage.local.get('local:settings'))['local:settings'] || {};
      await chrome.storage.local.set({
        'local:settings': {
          ...rawSettings,
          masterEnabled: en,
        },
      });
    }, enabled);
    const label = enabled ? '\x1b[32mBẬT (ON)\x1b[0m' : '\x1b[33mTẮT (OFF)\x1b[0m';
    console.log(`\n>>> 🛡️ Đã chuyển trạng thái bảo vệ sang: ${label} <<<\n`);
  }
}

// Inject Auto-Action Correlator & Anomaly Detector into all web pages
await context.addInitScript(() => {
  if (window.__agentDetectorInitialized) return;
  window.__agentDetectorInitialized = true;

  const state = {
    currentAction: 'IDLE',
    actionTimer: null,
    events: [],
    anomalies: [],
  };

  function setAction(name, timeoutMs = 1000) {
    state.currentAction = name;
    if (state.actionTimer) clearTimeout(state.actionTimer);
    state.actionTimer = setTimeout(() => {
      if (state.currentAction === name) {
        state.currentAction = 'IDLE';
      }
    }, timeoutMs);
  }

  // 1. Detect User Typing
  window.addEventListener(
    'input',
    (e) => {
      const target = e.target;
      if (target?.closest?.('[role="textbox"], [contenteditable="true"], textarea, input[type="text"]')) {
        setAction('USER_TYPING', 1200);
      }
    },
    true,
  );

  // 2. Detect Stop Typing on blur
  window.addEventListener(
    'blur',
    (e) => {
      const target = e.target;
      if (target?.closest?.('[role="textbox"], [contenteditable="true"], textarea')) {
        setAction('USER_STOP_TYPING', 1500);
      }
    },
    true,
  );

  // 3. Detect User Sending Message (Enter)
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        const target = e.target;
        if (target?.closest?.('[role="textbox"], [contenteditable="true"]')) {
          setAction('USER_SEND_MESSAGE', 1800);
        }
      }
    },
    true,
  );

  // 4. Detect Opening Chat / Story / Reel / Links
  window.addEventListener(
    'click',
    (e) => {
      const target = e.target;
      if (target?.closest?.('[role="row"], a[href*="/t/"], a[href*="/messages/"], [aria-label*="Chats"]')) {
        setAction('USER_OPEN_CHAT', 1500);
      } else if (target?.closest?.('[aria-label*="Story"], [aria-label*="story"], a[href*="/stories/"]')) {
        setAction('USER_VIEW_STORY', 2000);
      } else if (target?.closest?.('a[href*="/reel/"], [data-pagelet*="Reel"]')) {
        setAction('USER_VIEW_REEL', 1500);
      } else if (target?.closest?.('a[href]')) {
        const a = target.closest('a[href]');
        if (a && a.href && !a.href.includes('facebook.com') && !a.href.includes('instagram.com')) {
          setAction('USER_CLICK_EXTERNAL_LINK', 1500);
        }
      }
    },
    true,
  );

  // 5. Listen to Privacy Guard Extension Events
  window.addEventListener('privacy-guard:observed', (e) => {
    const detail = e.detail;
    if (!detail || typeof detail !== 'object') return;

    const record = {
      timestamp: Date.now(),
      action: state.currentAction,
      kind: detail.kind,
      target: detail.target,
      payload: detail.payload,
    };
    state.events.push(record);

    // Automated Anomaly checks
    let anomaly = null;
    if (state.currentAction === 'USER_SEND_MESSAGE' && detail.kind?.includes('suppressed')) {
      anomaly = {
        level: 'CRITICAL',
        title: 'OUTBOUND_MESSAGE_BLOCKED',
        desc: 'Người dùng gửi tin nhắn thật nhưng frame mạng bị chặn nhầm!',
        detail,
      };
    } else if (state.currentAction === 'USER_STOP_TYPING' && detail.kind?.includes('suppressed')) {
      if (typeof detail.payload === 'string' && (detail.payload.includes('idle') || detail.payload.includes('stop'))) {
        anomaly = {
          level: 'HIGH',
          title: 'STOP_TYPING_SUPPRESSED',
          desc: 'Tín hiệu dừng gõ bị chặn nhầm, đối phương sẽ bị kẹt 3 chấm vĩnh viễn!',
          detail,
        };
      }
    } else if (detail.kind === 'websocket.mixed') {
      anomaly = {
        level: 'MEDIUM',
        title: 'MIXED_FRAME_LEAK',
        desc: 'Frame hỗn hợp chứa task cần chặn đi kèm task hợp lệ đã được cho qua (có thể rò rỉ tín hiệu).',
        detail,
      };
    }

    if (anomaly) {
      state.anomalies.push(anomaly);
      console.warn(`[AGENT-ANOMALY] 🚨 ${anomaly.level}: ${anomaly.title} - ${anomaly.desc}`, anomaly);
    } else {
      console.log(`[AGENT-ACTION] 🔍 Hành vi: ${state.currentAction} | Intercepted: ${detail.kind} (${detail.target})`);
    }

    // Forward to Node parent via custom event
    window.dispatchEvent(
      new CustomEvent('__agent_report', {
        detail: { record, anomaly },
      }),
    );
  });

  window.__agentDetector = {
    state,
    summary() {
      return {
        totalEvents: state.events.length,
        anomaliesCount: state.anomalies.length,
        anomalies: state.anomalies,
        recentActions: state.events.slice(-10),
      };
    },
    clear() {
      state.events = [];
      state.anomalies = [];
    },
  };
});

function logEventToFile(data) {
  try {
    fs.appendFileSync(logFile, JSON.stringify(data) + '\n');
  } catch {
    // ignore
  }
}

import readline from 'node:readline';

// Setup Page CDP session & listeners
async function wirePage(page) {
  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('/api/graphql/') || url.includes('/graphql/')) {
      const postData = req.postData();
      if (postData) {
        const match = postData.match(/fb_api_req_friendly_name=([^&]+)/);
        if (match) {
          const name = decodeURIComponent(match[1]);
          console.log(`\x1b[35m[GRAPHQL] 📡 ${name}\x1b[0m`);
          logEventToFile({ type: 'graphql', name, timestamp: Date.now() });
        }
      }
    } else if (url.includes('/ajax/bz')) {
      logEventToFile({ type: 'bz', timestamp: Date.now() });
    }
  });

  page.on('console', (msg) => {
    const text = msg.text();
    if (text.startsWith('[AGENT-ACTION]')) {
      console.log(`\x1b[36m${text}\x1b[0m`);
      logEventToFile({ type: 'action', text, timestamp: Date.now() });
    } else if (text.startsWith('[AGENT-ANOMALY]')) {
      console.log(`\x1b[31m\x1b[1m${text}\x1b[0m`);
      logEventToFile({ type: 'anomaly', text, timestamp: Date.now() });
    }
  });

  try {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.enable');

    cdp.on('Network.webSocketFrameSent', (params) => {
      const payload = params.response?.payloadData;
      if (!payload) return;
      // Only log meaningful application frames, filter pings and heartbeat
      if (payload.length > 32) {
        logEventToFile({
          type: 'cdp_ws_sent',
          timestamp: Date.now(),
          url: page.url(),
          length: payload.length,
        });
      }
    });
  } catch {
    // CDP session attach may fail on internal pages
  }
}

context.on('page', (page) => {
  void wirePage(page);
});

for (const p of context.pages()) {
  void wirePage(p);
}

const targetUrl = process.argv.slice(2).find((arg) => arg.startsWith('http')) || null;

const pages = context.pages();
const mainPage = pages.length > 0 ? pages[0] : await context.newPage();

console.log('🌐 Đang mở Messenger, Facebook và Extension Popup...');
await mainPage.goto('https://www.messenger.com/');

const fbPage = await context.newPage();
await fbPage.goto(targetUrl || 'https://web.facebook.com/');

if (extensionId) {
  const popupPage = await context.newPage();
  await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
}

if (targetUrl) {
  await fbPage.bringToFront();
} else {
  await mainPage.bringToFront();
}

console.log('\n===============================================================');
console.log('🎮 BẢNG ĐIỀU KHIỂN THỬ NGHIỆM DÀNH CHO BẠN:');
console.log(`1. [TRẠNG THÁI]: Bảo vệ Privacy Guard hiện đang: ${currentProtectionState ? '🟢 BẬT (ON)' : '🟡 TẮT (OFF)'}`);
console.log('   👉 Tab 1: Messenger (https://www.messenger.com/)');
console.log('   👉 Tab 2: Facebook (https://web.facebook.com/)');
if (extensionId) {
  console.log(`   👉 Tab 3: Bảng điều khiển Extension Popup (chrome-extension://${extensionId}/popup.html)`);
}
console.log('2. [ĐỔI CHẾ ĐỘ]: Gõ "t" + Enter trong terminal này để BẬT/TẮT bảo vệ.');
console.log('3. [THỐNG KÊ]:   Gõ "s" + Enter để xem thống kê hành vi và anomaly.');
console.log('4. [XOÁ LOG]:    Gõ "c" + Enter để xoá trắng log hiện tại.');
console.log('===============================================================\n');

// Readline for interactive CLI
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.on('line', async (line) => {
  const cmd = line.trim().toLowerCase();
  if (cmd === 't') {
    await setProtection(!currentProtectionState);
  } else if (cmd === 's') {
    for (const p of context.pages()) {
      try {
        const summary = await p.evaluate(() => window.__agentDetector?.summary?.());
        if (summary) {
          console.log(`\n📊 [${p.url()}]: Tổng sự kiện: ${summary.totalEvents} | Anomalies: ${summary.anomaliesCount}`);
          if (summary.anomalies.length > 0) {
            console.log('🚨 Danh sách Anomalies:', JSON.stringify(summary.anomalies, null, 2));
          }
        }
      } catch {
        // ignore
      }
    }
  } else if (cmd === 'c') {
    for (const p of context.pages()) {
      try {
        await p.evaluate(() => window.__agentDetector?.clear?.());
      } catch {
        // ignore
      }
    }
    console.log('🧹 Đã dọn sạch log bộ nhớ.');
  }
});

// Keep the process running
await new Promise(() => {});
