/**
 * Generates the two Chrome Web Store promotional tiles:
 *
 *   small promo tile    440x280
 *   marquee promo tile  1400x560
 *
 * Both must be JPEG or 24 bit PNG with no alpha channel. Rendering, encoding
 * and verification all live in tools/lib/store-render.mjs, shared with the
 * screenshot generator; the copy lives in tools/lib/store-copy.mjs.
 *
 * One pair is produced per locale, into assets/store/<locale>/, with both the
 * popup interface and the copy in that locale.
 *
 * Usage:
 *   pnpm build            # .output/chrome-mv3 must exist
 *   pnpm promos:store
 *
 * Output: assets/store/<locale>/promo-small.png, promo-marquee.png
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertLocaleCoverage,
  LOCALES,
  MARQUEE_COPY,
  MARQUEE_POPUP,
  resolvePopupState,
  SMALL_PROMO_COPY,
} from './lib/store-copy.mjs';
import {
  inlineImage,
  openStoreRenderer,
  POPUP_SIZE,
  verifyArtefacts,
} from './lib/store-render.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const extensionPath = path.resolve(rootDir, '.output/chrome-mv3');
const outputDir = path.resolve(rootDir, 'assets/store');

const SMALL = { width: 440, height: 280 };
const MARQUEE = { width: 1400, height: 560 };

/** Canvas base colour, also used to composite away any transparency. */
const BASE_RGB = [8, 11, 18];

/**
 * Shared background layers. Kept identical across both tiles and the
 * screenshots so the listing reads as one set.
 */
function backdrop() {
  return `
  body {
    margin: 0;
    position: relative;
    overflow: hidden;
    background: #080b12;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    color: #f8fafc;
  }
  * { box-sizing: border-box; }
  .glow { position: absolute; border-radius: 50%; filter: blur(80px); }
  .grid {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(to right, rgba(148, 163, 184, 0.06) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(148, 163, 184, 0.06) 1px, transparent 1px);
    background-size: 40px 40px;
  }`;
}

/** Shield tick used as the trust mark on both tiles. */
const SHIELD_SVG = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 3l7 3v6c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6l7-3z" />
    <path d="M9 12.2l2 2 4-4.4" />
  </svg>`;

/**
 * Small tile. At 440x280 there is no room for UI detail, so this is the icon,
 * the name and one claim, sized to stay legible when the store scales it down.
 */
function smallTileHtml({ iconDataUri, copy, locale }) {
  return `<!doctype html>
<html lang="${locale}"><head><meta charset="utf-8" /><style>
  ${backdrop()}
  body { width: ${SMALL.width}px; height: ${SMALL.height}px; }
  .glow-a { width: 340px; height: 340px; left: -110px; top: -140px; background: rgba(37, 99, 235, 0.34); }
  .glow-b { width: 260px; height: 260px; right: -90px; bottom: -120px; background: rgba(59, 130, 246, 0.20); }
  .grid { mask-image: radial-gradient(ellipse at 50% 40%, #000 20%, transparent 78%); }

  .inner {
    position: relative;
    height: 100%;
    padding: 26px 28px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
  }

  img.icon {
    width: 62px;
    height: 62px;
    border-radius: 15px;
    box-shadow: 0 8px 22px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(148, 163, 184, 0.16);
  }

  h1 {
    margin: 15px 0 0;
    font-size: 27px;
    font-weight: 800;
    letter-spacing: -0.02em;
  }

  p {
    margin: 9px 0 0;
    font-size: 14px;
    line-height: 1.42;
    color: #aebbcd;
    max-width: 320px;
  }

  .trust {
    margin-top: 17px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px 5px 10px;
    border: 1px solid rgba(52, 211, 153, 0.3);
    border-radius: 999px;
    background: rgba(52, 211, 153, 0.1);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #6ee7b7;
  }
  .trust svg { width: 13px; height: 13px; }
  .trust path { fill: none; stroke: #34d399; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
</style></head>
<body>
  <div class="glow glow-a"></div>
  <div class="glow glow-b"></div>
  <div class="grid"></div>
  <div class="inner">
    <img class="icon" src="${iconDataUri}" alt="" />
    <h1>Privacy Guard</h1>
    <p>${copy.tagline}</p>
    <div class="trust">${SHIELD_SVG}<span>${copy.trust}</span></div>
  </div>
</body></html>`;
}

/**
 * Marquee tile. Wide and short, so the copy sits left and the popup sits right.
 * The popup is sized to fit the canvas height completely: cropping it would
 * slice through toggle rows, which reads as a broken image rather than a bleed.
 */
function marqueeTileHtml({ iconDataUri, popupDataUri, copy, locale }) {
  const popupWidth = 556;
  const popupHeight = Math.round((popupWidth / POPUP_SIZE.width) * POPUP_SIZE.height);

  const marks = copy.marks
    .map((text) => `<span class="mark">${SHIELD_SVG}<span>${text}</span></span>`)
    .join('\n        ');

  return `<!doctype html>
<html lang="${locale}"><head><meta charset="utf-8" /><style>
  ${backdrop()}
  body { width: ${MARQUEE.width}px; height: ${MARQUEE.height}px; }
  .glow-a { width: 760px; height: 760px; left: -240px; top: -280px; background: rgba(37, 99, 235, 0.30); }
  .glow-b { width: 640px; height: 640px; right: 20px; bottom: -330px; background: rgba(59, 130, 246, 0.18); }
  .grid { background-size: 48px 48px; mask-image: radial-gradient(ellipse at 26% 45%, #000 25%, transparent 72%); }

  .inner {
    position: relative;
    height: 100%;
    display: flex;
    align-items: center;
    padding-left: 84px;
  }

  .copy { width: 640px; flex: 0 0 640px; }

  .brand { display: flex; align-items: center; gap: 13px; margin-bottom: 26px; }
  .brand img {
    width: 46px;
    height: 46px;
    border-radius: 12px;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(148, 163, 184, 0.16);
  }
  .brand span { font-size: 21px; font-weight: 800; letter-spacing: -0.015em; }

  h1 {
    margin: 0;
    font-size: 44px;
    line-height: 1.1;
    font-weight: 800;
    letter-spacing: -0.024em;
  }
  h1 em { font-style: normal; color: #60a5fa; }

  p {
    margin: 18px 0 0;
    font-size: 16.5px;
    line-height: 1.5;
    color: #a9b6c9;
    max-width: 545px;
  }

  .marks { margin-top: 28px; display: flex; align-items: center; gap: 22px; }
  .mark { display: inline-flex; align-items: center; gap: 7px; font-size: 13.5px; font-weight: 600; color: #cfdae7; }
  .mark svg { width: 16px; height: 16px; }
  .mark path { fill: none; stroke: #34d399; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

  .shot { position: absolute; right: 68px; top: 50%; transform: translateY(-50%); }
  .shot img {
    width: ${popupWidth}px;
    height: ${popupHeight}px;
    display: block;
    border-radius: 18px;
    box-shadow:
      0 2px 6px rgba(0, 0, 0, 0.35),
      0 28px 74px rgba(0, 0, 0, 0.58),
      0 0 0 1px rgba(148, 163, 184, 0.14);
  }
</style></head>
<body>
  <div class="glow glow-a"></div>
  <div class="glow glow-b"></div>
  <div class="grid"></div>
  <div class="inner">
    <div class="copy">
      <div class="brand">
        <img src="${iconDataUri}" alt="" />
        <span>Privacy Guard</span>
      </div>
      <h1>${copy.headline}<br /><em>${copy.headlineAccent}</em></h1>
      <p>${copy.body}</p>
      <div class="marks">
        ${marks}
      </div>
    </div>
    <div class="shot"><img src="${popupDataUri}" alt="" /></div>
  </div>
</body></html>`;
}

async function main() {
  assertLocaleCoverage();

  const iconDataUri = await inlineImage(path.resolve(rootDir, 'assets/icon/128.png'));

  console.log('Launching Chromium with the extension loaded...');
  const renderer = await openStoreRenderer({ extensionPath });
  console.log(`Extension id: ${renderer.extensionId}`);

  const artefacts = [];

  try {
    for (const locale of LOCALES) {
      const localeDir = path.join(outputDir, locale);
      await fs.mkdir(localeDir, { recursive: true });
      console.log(`\n[${locale}]`);

      console.log(`  Building ${locale}/promo-small.png`);
      const small = await renderer.renderCanvas({
        html: smallTileHtml({ iconDataUri, copy: SMALL_PROMO_COPY[locale], locale }),
        ...SMALL,
        background: BASE_RGB,
      });
      await fs.writeFile(path.join(localeDir, 'promo-small.png'), small);
      artefacts.push({ file: `${locale}/promo-small.png`, buffer: small, spec: SMALL });

      console.log(`  Building ${locale}/promo-marquee.png`);
      const popupDataUri = await renderer.capturePopup(resolvePopupState(MARQUEE_POPUP, locale));
      const marquee = await renderer.renderCanvas({
        html: marqueeTileHtml({
          iconDataUri,
          popupDataUri,
          copy: MARQUEE_COPY[locale],
          locale,
        }),
        ...MARQUEE,
        background: BASE_RGB,
      });
      await fs.writeFile(path.join(localeDir, 'promo-marquee.png'), marquee);
      artefacts.push({ file: `${locale}/promo-marquee.png`, buffer: marquee, spec: MARQUEE });

      if (locale === 'en') {
        await fs.writeFile(path.join(outputDir, 'promo-small.png'), small);
        await fs.writeFile(path.join(outputDir, 'promo-marquee.png'), marquee);
      }
    }
  } finally {
    await renderer.close();
  }

  // Each tile has its own required size, so verify them one at a time.
  console.log('\nVerifying store requirements');
  for (const artefact of artefacts) {
    verifyArtefacts([artefact], artefact.spec);
  }

  console.log(`\n${artefacts.length} promo tiles written to assets/store/ across ${LOCALES.length} locales`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
