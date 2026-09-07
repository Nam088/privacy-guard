import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect, test, type BrowserContext } from '@playwright/test';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(dirname, '../../.output/chrome-mv3');

let context: BrowserContext;
let extensionId: string;

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  let [worker] = context.serviceWorkers();
  if (!worker) {
    worker = await context.waitForEvent('serviceworker');
  }
  extensionId = new URL(worker.url()).host;
});

test.afterAll(async () => {
  await context.close();
});

async function openPopup() {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  return page;
}

test('shows the global section on an unsupported site', async () => {
  const page = await openPopup();
  await page.getByRole('button', { name: 'Global' }).click();
  await expect(page.locator('#master-switch')).toBeAttached();
  await expect(page.getByRole('switch')).toHaveCount(3);
  await page.close();
});

test('has the master switch plus the two global toggles', async () => {
  const page = await openPopup();
  await page.getByRole('button', { name: 'Global' }).click();
  await expect(page.getByRole('switch')).toHaveCount(3);
  await page.close();
});

test('pausing protection disables every other toggle', async () => {
  const page = await openPopup();

  await page.locator('label[for="master-switch"]').click();

  await expect(page.locator('#master-switch')).not.toBeChecked();
  await expect(page.getByRole('switch').nth(1)).toBeDisabled();

  await page.locator('label[for="master-switch"]').click();
  await page.close();
});

test('a toggle change survives closing and reopening the popup', async () => {
  const first = await openPopup();
  await first.getByRole('switch').nth(1).uncheck({ force: true });
  await expect(first.getByRole('switch').nth(1)).not.toBeChecked();
  await first.close();

  const second = await openPopup();
  await expect(second.getByRole('switch').nth(1)).not.toBeChecked();
  await second.close();
});
