import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const extensionPath = path.resolve(rootDir, '.output/chrome-mv3');

async function main() {
  console.log('Launching browser with extension...');
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    viewport: { width: 750, height: 650 },
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });

  let [background] = context.serviceWorkers();
  if (!background) {
    background = await context.waitForEvent('serviceworker');
  }
  const extensionId = background.url().split('/')[2];
  console.log(`Extension ID: ${extensionId}`);

  const page = await context.newPage();
  await page.setViewportSize({ width: 750, height: 650 });
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await page.waitForSelector('main');
  await page.waitForTimeout(1000);

  const mainElement = await page.$('main');
  if (!mainElement) {
    throw new Error('main element not found');
  }

  // 1. Capture Facebook tab
  const fbPath = path.resolve(rootDir, 'assets/preview-facebook.png');
  await mainElement.screenshot({ path: fbPath });
  console.log(`Saved: ${fbPath}`);

  // 2. Click Instagram tab
  const tabButtons = await page.$$('button');
  for (const btn of tabButtons) {
    const text = (await btn.textContent()) || '';
    if (text.includes('Instagram')) {
      await btn.click();
      await page.waitForTimeout(500);
      const igPath = path.resolve(rootDir, 'assets/preview-instagram.png');
      await mainElement.screenshot({ path: igPath });
      console.log(`Saved: ${igPath}`);
      break;
    }
  }

  // 3. Click Global tab
  for (const btn of tabButtons) {
    const text = (await btn.textContent()) || '';
    if (text.includes('Global')) {
      await btn.click();
      await page.waitForTimeout(500);
      const globalMapPath = path.resolve(rootDir, 'assets/preview-global.png');
      await mainElement.screenshot({ path: globalMapPath });
      console.log(`Saved: ${globalMapPath}`);
      break;
    }
  }

  await context.close();
  console.log('Done capturing screenshots!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
