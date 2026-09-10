/**
 * Generates add on store screenshots that satisfy the Chrome Web Store spec:
 * at most 5 images per locale, exactly 1280x800, PNG 24 bit with no alpha.
 *
 * One full set is produced per locale listed in tools/lib/store-copy.mjs, into
 * assets/store/<locale>/. Both the popup interface and the marketing copy are in
 * that locale, so no image ever mixes two languages.
 *
 * Two stage pipeline, both stages provided by tools/lib/store-render.mjs:
 *   1. The real popup is captured from the loaded extension.
 *   2. Each capture is composed onto a marketing canvas, rendered at 2x, then
 *      averaged down to 1280x800 and re-encoded as 24 bit RGB.
 *
 * Usage:
 *   pnpm build                  # .output/chrome-mv3 must exist
 *   pnpm screenshots:store
 *
 * Output: assets/store/en/*.png, assets/store/vi/*.png
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertLocaleCoverage,
  FOOTNOTE,
  LOCALES,
  resolvePopupState,
  SLIDES,
} from './lib/store-copy.mjs';
import { openStoreRenderer, POPUP_SIZE, verifyArtefacts } from './lib/store-render.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const extensionPath = path.resolve(rootDir, '.output/chrome-mv3');
const outputDir = path.resolve(rootDir, 'assets/store');

/** Chrome Web Store screenshot dimensions. The other accepted size is 640x400. */
const CANVAS = { width: 1280, height: 800 };

/** Rendered width of the popup on the canvas; height keeps its aspect ratio. */
const POPUP_WIDTH = 700;
const POPUP_HEIGHT = Math.round((POPUP_WIDTH / POPUP_SIZE.width) * POPUP_SIZE.height);

/** Composited against the canvas base colour so flattening never lightens edges. */
const CANVAS_BASE_RGB = [8, 11, 18];

/** Marketing canvas, authored at exactly CANVAS size in CSS pixels. */
function canvasHtml({ copy, footnote, popupDataUri, locale }) {
  const bullets = copy.bullets
    .map(
      (text) => `
        <li>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="10" cy="10" r="9" />
            <path d="M5.8 10.4l2.6 2.6 5.6-6" />
          </svg>
          <span>${text}</span>
        </li>`,
    )
    .join('');

  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    width: ${CANVAS.width}px;
    height: ${CANVAS.height}px;
    overflow: hidden;
    position: relative;
    background: #080b12;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    color: #f8fafc;
  }

  /* Brand glow, kept low contrast so the popup stays the focal point. */
  .glow {
    position: absolute;
    border-radius: 50%;
    filter: blur(90px);
  }
  .glow-a { width: 720px; height: 720px; left: -220px; top: -260px; background: rgba(37, 99, 235, 0.30); }
  .glow-b { width: 620px; height: 620px; right: -180px; bottom: -240px; background: rgba(59, 130, 246, 0.18); }

  .grid {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(to right, rgba(148, 163, 184, 0.06) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(148, 163, 184, 0.06) 1px, transparent 1px);
    background-size: 48px 48px;
    mask-image: radial-gradient(ellipse at 30% 40%, #000 25%, transparent 75%);
  }

  .stage {
    position: relative;
    display: flex;
    align-items: center;
    gap: 40px;
    width: 100%;
    height: 100%;
    padding: 0 40px 0 72px;
  }

  .copy { width: 428px; flex: 0 0 428px; }

  .eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px 6px 11px;
    margin-bottom: 22px;
    border: 1px solid rgba(59, 130, 246, 0.35);
    border-radius: 999px;
    background: rgba(59, 130, 246, 0.12);
    font-size: 12.5px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #93c5fd;
  }
  .eyebrow i {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #34d399;
    box-shadow: 0 0 0 3px rgba(52, 211, 153, 0.22);
  }

  h1 {
    font-size: 43px;
    line-height: 1.11;
    font-weight: 800;
    letter-spacing: -0.022em;
    white-space: pre-line;
  }

  .body {
    margin-top: 18px;
    font-size: 16.5px;
    line-height: 1.55;
    color: #a9b6c9;
  }

  ul { list-style: none; margin-top: 26px; display: flex; flex-direction: column; gap: 12px; }
  li { display: flex; align-items: flex-start; gap: 11px; font-size: 14.5px; line-height: 1.4; color: #dbe4ef; }
  li svg { width: 20px; height: 20px; flex: 0 0 20px; margin-top: 1px; }
  li circle { fill: rgba(52, 211, 153, 0.16); stroke: rgba(52, 211, 153, 0.5); stroke-width: 1; }
  li path { fill: none; stroke: #34d399; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }

  .shot {
    flex: 1 1 auto;
    display: flex;
    justify-content: flex-end;
    align-items: center;
  }
  .shot img {
    width: ${POPUP_WIDTH}px;
    height: ${POPUP_HEIGHT}px;
    display: block;
    border-radius: 18px;
    box-shadow:
      0 2px 6px rgba(0, 0, 0, 0.35),
      0 26px 70px rgba(0, 0, 0, 0.55),
      0 0 0 1px rgba(148, 163, 184, 0.14);
  }

  .footnote {
    position: absolute;
    left: 72px;
    bottom: 34px;
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 12.5px;
    font-weight: 600;
    color: rgba(148, 163, 184, 0.8);
  }
  .footnote svg { width: 14px; height: 14px; }
  .footnote path { fill: none; stroke: #34d399; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
</style>
</head>
<body>
  <div class="glow glow-a"></div>
  <div class="glow glow-b"></div>
  <div class="grid"></div>

  <div class="stage">
    <div class="copy">
      <div class="eyebrow"><i></i>${copy.eyebrow}</div>
      <h1>${copy.headline}</h1>
      <p class="body">${copy.body}</p>
      <ul>${bullets}</ul>
    </div>
    <div class="shot"><img src="${popupDataUri}" alt="" /></div>
  </div>

  <div class="footnote">
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3l7 3v6c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6l7-3z" />
      <path d="M9 12.2l2 2 4-4.4" />
    </svg>
    <span>${footnote}</span>
  </div>
</body>
</html>`;
}

async function main() {
  assertLocaleCoverage();

  console.log('Launching Chromium with the extension loaded...');
  const renderer = await openStoreRenderer({ extensionPath });
  console.log(`Extension id: ${renderer.extensionId}`);

  const byLocale = new Map();

  try {
    for (const locale of LOCALES) {
      const localeDir = path.join(outputDir, locale);
      await fs.mkdir(localeDir, { recursive: true });

      const artefacts = [];
      console.log(`\n[${locale}]`);

      for (const slide of SLIDES) {
        console.log(`  Building ${locale}/${slide.file}`);

        const popupDataUri = await renderer.capturePopup(resolvePopupState(slide, locale));

        const buffer = await renderer.renderCanvas({
          html: canvasHtml({
            copy: slide.copy[locale],
            footnote: FOOTNOTE[locale],
            popupDataUri,
            locale,
          }),
          ...CANVAS,
          background: CANVAS_BASE_RGB,
        });

        await fs.writeFile(path.join(localeDir, slide.file), buffer);
        artefacts.push({ file: `${locale}/${slide.file}`, buffer });

        if (locale === 'en') {
          await fs.writeFile(path.join(outputDir, slide.file), buffer);
        }
      }

      byLocale.set(locale, artefacts);
    }
  } finally {
    await renderer.close();
  }

  // Fail loudly rather than shipping an image the store will reject. The five
  // image cap applies per locale, so each set is verified on its own.
  console.log('\nVerifying store requirements');
  let total = 0;
  for (const [locale, artefacts] of byLocale) {
    console.log(`  [${locale}]`);
    verifyArtefacts(artefacts, { ...CANVAS, maxCount: 5 });
    total += artefacts.length;
  }

  console.log(`\n${total} screenshots written to assets/store/ across ${byLocale.size} locales`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
