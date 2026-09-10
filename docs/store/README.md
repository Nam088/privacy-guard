# Store listing copy

Source of truth for the text submitted to add on stores. Everything in this
folder is **paste ready plain text**: copy a file's whole contents into the
matching field, no editing needed.

| File | Where it goes |
| --- | --- |
| `description.en.md` | AMO and Chrome Web Store "Description", English locale |
| `description.vi.md` | AMO "Description", Vietnamese (`vi`) locale |
| `cws-privacy.md` | Chrome Web Store "Privacy Practices" tab form fields |
| `reviewer-notes.md` | AMO "Notes to Reviewer" on the Submit a New Version page |
| `../../assets/store/en/` | English screenshots and promo tiles, generated (see below) |
| `../../assets/store/vi/` | Vietnamese screenshots and promo tiles, generated |

## Official Store Listings

| Store | URL | Identifier |
| --- | --- | --- |
| **Chrome Web Store** | https://chromewebstore.google.com/detail/privacy-guard/beplndkbpjhkdbnagabhdbjjfhjflhgn | Item ID: `beplndkbpjhkdbnagabhdbjjfhjflhgn` |
| **Firefox Add-ons (AMO)** | https://addons.mozilla.org/en-US/firefox/addon/privacy-guard-social/ | Slug: `privacy-guard-social` (`privacy-guard@nam088.dev`) |

Release notes for the version being submitted come from [`CHANGELOG.md`](../../CHANGELOG.md)
at the repository root.

## Rules for editing

1. **Claims must match the code.** Every capability listed in a description has
   to exist in `src/sites/facebook/features.ts`, `src/sites/instagram/features.ts`,
   or `src/trackers/features.ts`. Reviewers compare the description against the
   source, and an unbacked claim is a rejection risk.
2. **Permissions must match the manifest.** The description states that host
   access is limited to the four Meta domains and that `<all_urls>` is optional
   and only requested by the link parameter cleaner. Keep this in sync with
   `wxt.config.ts` whenever permissions change.
3. **Markdown format.** Descriptions use standard Markdown syntax (headings `##`,
   bullet lists `-`, bold text `**`, and inline code spans). Ensure formatting
   renders cleanly and remains consistent across all locales.
4. **Update both locales together.** A feature added to `description.en.md` and
   forgotten in `description.vi.md` leaves Vietnamese users with a stale listing.
5. **Bump the version in `reviewer-notes.md`.** It names the expected build
   artefact path, which changes with every release.


## Images

`assets/store/` holds every image the listing needs. They are generated, not
hand made, so regenerate them rather than editing an image:

```bash
pnpm build            # the tools load .output/chrome-mv3
pnpm assets:store     # screenshots and promo tiles
```

Individually: `pnpm screenshots:store` and `pnpm promos:store`.

One full set is generated per locale into `assets/store/<locale>/`, currently `en` and `vi`. Upload the matching folder against each locale in the store dashboard.

| Asset | Files | Required size | Limit per locale |
| --- | --- | --- | --- |
| Screenshots | `<locale>/0*.png` | 1280x800 (or 640x400) | at most 5, at least 1 |
| Small promo tile | `<locale>/promo-small.png` | 440x280 | 1 |
| Marquee promo tile | `<locale>/promo-marquee.png` | 1400x560 | 1 |

All of them must be JPEG or PNG with 8 bits per channel and **no alpha
channel**. Each tool asserts size, colour type and absence of alpha before it
finishes, and fails the run rather than writing an image the store would reject.

Chromium only ever emits 32 bit RGBA, and no image library is in the dependency
tree, so `tools/lib/png.mjs` is a small PNG codec on `node:zlib` that re-encodes
each canvas as 24 bit RGB. It also averages the 2x render down to the target
size, which keeps text and UI edges supersampled rather than rasterised once at
final resolution.

`tools/lib/store-render.mjs` owns the browser session, the popup capture and the
encoding, so the screenshot and promo tools only describe their own layouts.

All copy, and the popup control labels needed to drive the interface in each
language, live in `tools/lib/store-copy.mjs`. Adding a locale is a matter of
adding one block there; the renderers do not change.

Rules when editing the slide list:

1. **Copy must match the visible toggles.** Each slide declares the `presets` it
   applies so the switches on screen actually back the claims beside them. A
   bullet saying something is hidden, next to a toggle that is off, reads as a
   false claim.
2. **State the tab and presets on every slide.** A slide that inherits the
   previous one's state changes silently when the list is reordered.
3. **Translate every field of a slide.** A locale missing a string throws rather
   than falling back to English, because a half English screenshot is worse than
   a failed build.
4. **Keep `POPUP_LABELS` in step with `src/i18n`.** The tools click the popup by
   its visible labels, so renaming a tab or a preset in the app breaks capture
   until the table is updated. The failure is loud: the click reports the label
   it could not find.
