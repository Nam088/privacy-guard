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

  // 1. Capture Facebook in Light mode
  const lightBtn = await page.$('button[title="Light"]');
  if (lightBtn) {
    await lightBtn.click();
    await page.waitForTimeout(400);
    const fbLightPath = path.resolve(rootDir, 'assets/preview-facebook-light.png');
    await mainElement.screenshot({ path: fbLightPath });
    console.log(`Saved: ${fbLightPath}`);

    // Capture Feed tab in Light mode
    const feedPill = await page.$('button:has-text("Feed")');
    if (feedPill) {
      await feedPill.click();
      await page.waitForTimeout(400);
      const fbFeedLightPath = path.resolve(rootDir, 'assets/preview-facebook-feed-light.png');
      await mainElement.screenshot({ path: fbFeedLightPath });
      console.log(`Saved: ${fbFeedLightPath}`);

      const allPill = await page.$('button:has-text("All")');
      if (allPill) await allPill.click();
      await page.waitForTimeout(300);
    }
  }

  // 2. Switch to Dark mode and capture Facebook
  const darkBtn = await page.$('button[title="Dark"]');
  if (darkBtn) {
    await darkBtn.click();
    await page.waitForTimeout(400);
  }
  const fbPath = path.resolve(rootDir, 'assets/preview-facebook.png');
  await mainElement.screenshot({ path: fbPath });
  console.log(`Saved: ${fbPath}`);

  // 3. Click Instagram tab
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

  // 4. Switch to Light mode + Vietnamese and capture sidebar-optimized-vi.png
  const viLightBtn = await page.$('button[title="Light"], button[title="Sáng"]');
  if (viLightBtn) {
    await viLightBtn.click();
    await page.waitForTimeout(300);
  }
  const viLangBtn = await page.$('button[title="Tiếng Việt"], button:has-text("VI")');
  if (viLangBtn) {
    await viLangBtn.click();
    await page.waitForTimeout(300);
  }
  // Click back to Facebook
  const allBtns = await page.$$('button');
  for (const btn of allBtns) {
    const text = (await btn.textContent()) || '';
    if (text.includes('Facebook')) {
      await btn.click();
      await page.waitForTimeout(300);
      break;
    }
  }
  const viSidebarPath = path.resolve(rootDir, 'scratch/sidebar-optimized-vi.png');
  await mainElement.screenshot({ path: viSidebarPath });
  console.log(`Saved: ${viSidebarPath}`);

  await context.close();
  console.log('Done capturing screenshots!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
