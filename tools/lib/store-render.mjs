/**
 * Shared rendering session for add on store artwork.
 *
 * Store artwork has two awkward constraints that this module centralises:
 *
 *   1. Chromium only ever emits 32 bit RGBA PNG, while the stores require
 *      24 bit PNG with no alpha channel.
 *   2. Rendering at a 1x device scale factor gives visibly soft text at these
 *      sizes, so everything renders at `scale` and is averaged back down. That
 *      keeps text and UI edges supersampled, and the averaging is exact because
 *      the factor is an integer.
 *
 * Callers supply the canvas HTML and the target size; this module owns the
 * browser, the popup capture, and the encoding.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { flattenAndDownscale, inspectPng } from './png.mjs';

/** Popup source dimensions, as authored in Popup.tsx. */
export const POPUP_SIZE = { width: 685, height: 570 };

async function clickByAttribute(page, attribute, value) {
  const selector = `button[${attribute}="${value}"]`;
  const button = page.locator(selector).first();
  if ((await button.count()) === 0) {
    throw new Error(`Popup control not found: ${selector}`);
  }
  await button.click();
  await page.waitForTimeout(250);
}

async function clickByText(page, text) {
  const button = page.locator('button', { hasText: text }).first();
  if ((await button.count()) === 0) {
    throw new Error(`Popup control not found by text: ${text}`);
  }
  await button.click();
  await page.waitForTimeout(300);
}

/**
 * Launches Chromium with the built extension loaded and returns helpers for
 * capturing the popup and rendering canvases.
 *
 * @param {object} options
 * @param {string} options.extensionPath  Path to an unpacked MV3 build
 * @param {number} [options.scale]  Supersampling factor; must divide every canvas size
 */
export async function openStoreRenderer({ extensionPath, scale = 2 }) {
  try {
    await fs.access(extensionPath);
  } catch {
    throw new Error(`Extension build not found at ${extensionPath}. Run "pnpm build" first.`);
  }

  const context = await chromium.launchPersistentContext('', {
    headless: false,
    viewport: { width: 750, height: 650 },
    deviceScaleFactor: scale,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--hide-scrollbars',
    ],
  });

  let worker = context.serviceWorkers()[0];
  if (!worker) {
    worker = await context.waitForEvent('serviceworker');
  }
  const extensionId = worker.url().split('/')[2];

  const popupPage = await context.newPage();
  await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
  await popupPage.waitForSelector('main');
  await popupPage.waitForTimeout(900);

  const canvasPage = await context.newPage();

  return {
    extensionId,

    /**
     * Drives the real popup into the requested state and returns it as a data
     * URI, ready to embed in a canvas.
     *
     * `platform`, `subTab` and `presets` match the popup's own visible labels,
     * which are localised, so they must be written in the requested `locale`.
     *
     * @param {object} state
     * @param {'light'|'dark'} state.theme
     * @param {'en'|'vi'} state.locale
     * @param {string} state.platform  Platform tab accessible label
     * @param {string|null} [state.subTab]  Sub tab label, or null to leave it alone
     * @param {string[]} [state.presets]  Quick preset labels to apply
     */
    async capturePopup({ theme, locale, platform, subTab = null, presets = [] }) {
      await clickByAttribute(popupPage, 'title', theme === 'light' ? 'Light' : 'Dark');
      await clickByAttribute(popupPage, 'title', locale === 'vi' ? 'Tiếng Việt' : 'English');
      await clickByAttribute(popupPage, 'aria-label', platform);

      for (const preset of presets) {
        await clickByText(popupPage, preset);
      }
      if (subTab) {
        await clickByAttribute(popupPage, 'title', subTab);
      }

      await popupPage.waitForTimeout(450);
      const png = await popupPage.locator('main').screenshot({ type: 'png' });
      return `data:image/png;base64,${png.toString('base64')}`;
    },

    /**
     * Renders HTML at `width` x `height` CSS pixels and returns a 24 bit RGB
     * PNG of exactly that size.
     *
     * @param {object} options
     * @param {string} options.html
     * @param {number} options.width
     * @param {number} options.height
     * @param {[number, number, number]} options.background  Composited behind any transparency
     */
    async renderCanvas({ html, width, height, background }) {
      if ((width * scale) % scale !== 0 || (height * scale) % scale !== 0) {
        throw new Error(`Canvas ${width}x${height} is not compatible with scale ${scale}`);
      }

      await canvasPage.setViewportSize({ width, height });
      await canvasPage.setContent(html, { waitUntil: 'load' });
      await canvasPage.waitForTimeout(350);

      const supersampled = await canvasPage.screenshot({
        type: 'png',
        clip: { x: 0, y: 0, width, height },
      });

      return flattenAndDownscale(supersampled, scale, background);
    },

    async close() {
      await context.close();
    },
  };
}

/**
 * Inlines a local image as a data URI, so canvases never depend on file paths
 * resolving inside the browser.
 */
export async function inlineImage(filePath) {
  const data = await fs.readFile(filePath);
  const extension = path.extname(filePath).slice(1).toLowerCase();
  const mime = extension === 'svg' ? 'image/svg+xml' : `image/${extension}`;
  return `data:${mime};base64,${data.toString('base64')}`;
}

/**
 * Asserts every artefact meets the store requirements and prints a report.
 * Throws rather than letting a rejected asset be uploaded.
 *
 * @param {Array<{file: string, buffer: Buffer}>} artefacts
 * @param {object} spec
 * @param {number} spec.width
 * @param {number} spec.height
 * @param {number} [spec.maxCount]
 */
export function verifyArtefacts(artefacts, { width, height, maxCount }) {
  let ok = true;

  for (const { file, buffer } of artefacts) {
    const info = inspectPng(buffer);
    const valid =
      info.width === width &&
      info.height === height &&
      info.bitDepth === 8 &&
      info.colourType === 2 &&
      !info.hasAlpha;
    ok = ok && valid;
    console.log(
      `  ${valid ? 'PASS' : 'FAIL'}  ${file}  ${info.width}x${info.height}  ` +
        `colour type ${info.colourType}  alpha ${info.hasAlpha ? 'yes' : 'no'}  ` +
        `${(info.bytes / 1024).toFixed(0)} KB`,
    );
  }

  if (maxCount !== undefined && artefacts.length > maxCount) {
    ok = false;
    console.log(`  FAIL  ${artefacts.length} images produced, the store accepts at most ${maxCount}`);
  }

  if (!ok) {
    throw new Error('One or more assets do not meet the store requirements');
  }
}
