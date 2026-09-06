# Privacy Guard M1 and M2: Foundation and Tracker Blocking

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Manifest V3 extension that installs on Chrome, Edge and Firefox, presents a working settings UI driven by a site module registry holding Facebook and Instagram, and actually blocks Meta tracking pixels and the `fbclid` parameter.

**Architecture:** WXT builds one TypeScript source tree into a per browser manifest. Features split in two: site features belong to a module under `src/sites`, global features belong to `src/trackers`. A registry resolves the active tab's URL to at most one site module. Settings are a flat record keyed by `scope.featureId`, validated by zod, persisted through a versioned `storage.defineItem`, and exposed to every screen through a single Preact signal. The background script watches settings and toggles `declarativeNetRequest` rulesets. All pure logic lives outside `src/entrypoints` so it unit tests in plain Node.

**Tech Stack:** TypeScript 5.9 strict, WXT 0.21, Preact 10 with @preact/signals 2, Tailwind CSS v4, zod 4, vitest 4 with WxtVitest and fakeBrowser, @testing-library/preact 3, ESLint 10 with typescript-eslint 8, Playwright 1.63, pnpm.

**Scope:** Milestones M1 and M2 of `docs/superpowers/specs/2026-09-05-privacy-guard-design.md`. M3 through M5 get their own plans.

---

## Already complete

Tasks 1 and 2 landed before the redesign and are still valid, though Task 3 renames and translates them.

- **Task 1**, commit `6600d53`: WXT plus Preact plus TypeScript strict scaffold. `package.json`, `wxt.config.ts`, `tsconfig.json`, background and popup entrypoints, placeholder PNG icons. `pnpm compile` and `pnpm build` both pass.
- **Task 2**, commits `dd38715` and `903f7fe`: vitest with `WxtVitest` and `fakeBrowser`, a smoke test, and `eslint.config.js` carrying the two import boundary rules from spec section 4.3. Both boundaries were proven to fire with deliberate violations before the probe files were deleted.

Two facts established by those tasks that every later task depends on:

1. `import { X } from '#imports';` is the working import style in this project.
2. `pnpm lint`, `pnpm compile` and `pnpm test` all pass and must keep passing.

---

## One honesty rule that shapes the data model

Spec section 7 states that lying to someone about whether they are protected is the most serious failure this class of extension can commit. M1 and M2 do not implement any interception, so every Facebook and Instagram feature is inert until M3 and M4.

Showing a working looking toggle for an inert feature would be exactly that lie. So every feature carries a `status` of `active` or `planned`. Planned features render disabled with a visible note, and `isFeatureOn` returns false for them regardless of the stored value. Flipping a feature to `active` in a later milestone is a one word change in one data file.

---

## File structure after this plan

```
privacy-guard/
  package.json
  wxt.config.ts
  tsconfig.json
  vitest.config.ts
  eslint.config.js
  playwright.config.ts
  public/
    rules/meta-pixel.json             static ruleset blocking Meta pixels
    rules/fbclid.json                 static ruleset stripping the tracking parameter
    icon/                             16, 32, 48, 128 png
  src/
    sites/
      types.ts                        Feature, SiteModule, key helpers
      registry.ts                     modules list, URL to module resolution
      facebook/features.ts            Facebook feature declarations
      facebook/index.ts               Facebook module
      instagram/features.ts           Instagram feature declarations
      instagram/index.ts              Instagram module
    trackers/
      features.ts                     global feature declarations
    core/
      settings/
        schema.ts                     zod schema, defaults built from the registry
        storage.ts                    versioned storage item, safe read and write
        store.ts                      signals store, two way sync with storage
      activeSite.ts                   resolve the active tab to a site module
      badge.ts                        resolve and apply the toolbar badge
      rulesets.ts                     map settings to enabled rulesets
      permissions.ts                  optional host permission handling
    ui/
      components/Toggle.tsx
      components/Section.tsx
      styles/tokens.css
    entrypoints/
      background.ts
      popup/index.html
      popup/main.tsx
      popup/Popup.tsx
  tests/
    unit/sites/types.test.ts
    unit/sites/registry.test.ts
    unit/sites/features.test.ts
    unit/settings/schema.test.ts
    unit/settings/storage.test.ts
    unit/settings/store.test.ts
    unit/activeSite.test.ts
    unit/badge.test.ts
    unit/rulesets.test.ts
    unit/permissions.test.ts
    unit/ui/Toggle.test.tsx
    e2e/popup.spec.ts
```

Enforced by `eslint.config.js` from Task 2: nothing under `src/core` may import from `src/entrypoints`, and nothing under `src/interceptors` or `src/protocol` may import an extension API.

---

## Task 3: Rebrand to Privacy Guard and switch to English

The product is no longer Facebook specific. This task renames it and translates every string that Tasks 1 and 2 left in Vietnamese. Nothing else changes.

The working directory keeps its current name. Renaming the checkout is a single `mv` the owner can do whenever they like, and doing it mid session would break every open tool path for no benefit.

**Files:**
- Modify: `package.json`
- Modify: `wxt.config.ts`
- Modify: `src/entrypoints/background.ts`
- Modify: `src/entrypoints/popup/index.html`
- Modify: `src/entrypoints/popup/Popup.tsx`
- Modify: `eslint.config.js`
- Modify: `tests/unit/smoke.test.ts`

- [ ] **Step 1: Rename the package**

In `package.json`, change the `name` field:

```json
  "name": "privacy-guard",
```

- [ ] **Step 2: Rebrand the manifest and widen the host permissions**

Replace the `manifest` function in `wxt.config.ts` with:

```typescript
  manifest: ({ browser }) => ({
    name: 'Privacy Guard',
    description:
      'Control the signals your social accounts send on your behalf, and block social tracking across the web.',
    permissions: ['storage'],
    host_permissions: [
      '*://*.facebook.com/*',
      '*://*.messenger.com/*',
      '*://*.instagram.com/*',
    ],
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              id: 'privacy-guard@nam088.dev',
              strict_min_version: '128.0',
            },
          },
        }
      : {}),
  }),
```

Two changes beyond the rename. Instagram is now a supported host, per spec section 6. And the
`default_locale: undefined` line is gone, since setting a key to `undefined` was a no op that
serialised away to nothing.

- [ ] **Step 3: Translate the background log line**

`src/entrypoints/background.ts`:

```typescript
import { defineBackground } from '#imports';

export default defineBackground(() => {
  console.log('[privacy-guard] background ready');
});
```

- [ ] **Step 4: Rename the popup document title**

WXT derives the manifest's `action.default_title` from the popup document title, and that string
is what someone sees when they hover the toolbar icon. It is plain ASCII, so the non ASCII sweep
in Step 7 will never catch it.

`src/entrypoints/popup/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Privacy Guard</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

The `lang` attribute moves from `vi` to `en` at the same time, since the document is now English.

- [ ] **Step 5: Translate the placeholder popup**

`src/entrypoints/popup/Popup.tsx`:

```tsx
export function Popup() {
  return <main style={{ width: 360, padding: 16 }}>Privacy Guard</main>;
}
```

- [ ] **Step 6: Translate the ESLint boundary messages**

In `eslint.config.js`, replace the two message strings:

```javascript
const ENTRYPOINT_IMPORTS = {
  group: ['**/entrypoints/**', '@/entrypoints/*', '~/entrypoints/*'],
  message:
    'Dependency direction is one way: entrypoints use core, never the reverse.',
};

const EXTENSION_API_IMPORTS = [
  {
    name: '#imports',
    message:
      'Code running in the MAIN world has no extension APIs. Receive configuration as function arguments instead.',
  },
  {
    name: 'wxt/browser',
    message:
      'Code running in the MAIN world has no extension APIs. Receive configuration as function arguments instead.',
  },
];
```

- [ ] **Step 7: Translate the smoke test**

`tests/unit/smoke.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';

describe('test environment', () => {
  it('provides fakeBrowser with in memory storage', async () => {
    await fakeBrowser.storage.local.set({ ping: 'pong' });
    const result = await fakeBrowser.storage.local.get('ping');
    expect(result).toEqual({ ping: 'pong' });
  });
});
```

- [ ] **Step 8: Verify no Vietnamese remains in source**

Run:
Vietnamese text is the only non ASCII content this project ever had, so finding any byte
outside printable ASCII finds it. Forcing the C locale makes each byte of a multibyte character
count as non printable, which is what makes this work on the BSD grep that ships with macOS.

```bash
LC_ALL=C grep -rn '[^[:print:][:space:]]' \
  src tests package.json wxt.config.ts eslint.config.js vitest.config.ts \
  && echo "FOUND non ASCII text, translate the lines listed above" \
  || echo "clean"
```
Expected: `clean`.

Documentation under `docs/` is out of scope for this check.

- [ ] **Step 9: Verify everything still passes**

Run: `pnpm lint && pnpm compile && pnpm test && pnpm build`
Expected: all four succeed.

Run:
```bash
python3 -c "
import json
m = json.load(open('.output/chrome-mv3/manifest.json'))
print('name', m['name'])
print('title', m['action']['default_title'])
print('hosts', m['host_permissions'])
assert 'FB Security' not in json.dumps(m), 'the old name still appears somewhere in the manifest'
print('OK')
"
```
Expected: name and title both `Privacy Guard`, three host patterns including
`*://*.instagram.com/*`, and `OK`. The assertion is the important part: it catches the old name
wherever it hides, including keys this check does not print by name.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "refactor: rebrand to Privacy Guard and switch source to English"
```

---

## Task 4: Site module types

This file defines the shape the whole registry depends on. It is pure types plus one small
helper, and it imports nothing.

The `status` field is the honesty mechanism described above.

**Files:**
- Create: `src/sites/types.ts`
- Test: `tests/unit/sites/types.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/sites/types.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { GLOBAL_SCOPE, featureKey } from '@/sites/types';

describe('featureKey', () => {
  it('joins a scope and a feature id with a dot', () => {
    expect(featureKey('facebook', 'hideReadReceipts')).toBe(
      'facebook.hideReadReceipts',
    );
  });

  it('uses the global scope for tracker features', () => {
    expect(featureKey(GLOBAL_SCOPE, 'blockMetaPixel')).toBe(
      'global.blockMetaPixel',
    );
  });

  it('produces a distinct key for the same feature id on different sites', () => {
    expect(featureKey('facebook', 'hideReadReceipts')).not.toBe(
      featureKey('instagram', 'hideReadReceipts'),
    );
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `pnpm test tests/unit/sites/types.test.ts`
Expected: FAIL, cannot resolve `@/sites/types`.

- [ ] **Step 3: Write the minimal implementation**

`src/sites/types.ts`:

```typescript
export const GLOBAL_SCOPE = 'global';

export type FeatureStatus = 'active' | 'planned';

export interface Feature {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly defaultEnabled: boolean;
  readonly status: FeatureStatus;
}

export interface SiteModule {
  readonly id: string;
  readonly displayName: string;
  readonly matches: readonly string[];
  readonly hosts: readonly string[];
  readonly features: readonly Feature[];
}

export function featureKey(scope: string, id: string): string {
  return `${scope}.${id}`;
}
```

There is deliberately no inverse of `featureKey` here. Nothing in M1 or M2 needs to turn a key
back into its parts, and an exported helper nobody calls is dead weight that still has to be
maintained. Add it when a caller exists.

The `hosts` field holds bare hostnames such as `facebook.com`, used by the registry to match a
tab URL. The `matches` field holds manifest style patterns. They serve different consumers, so
they stay separate fields rather than one being derived from the other.

- [ ] **Step 4: Run the test to see it pass**

Run: `pnpm test tests/unit/sites/types.test.ts`
Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sites/types.ts tests/unit/sites/types.test.ts
git commit -m "feat: site module types and feature key helpers"
```

---

## Task 5: Facebook and Instagram feature declarations

Pure data. Every feature here is `planned` because M1 and M2 implement no interception. M3 and
M4 flip them one by one.

**Files:**
- Create: `src/sites/facebook/features.ts`
- Create: `src/sites/facebook/index.ts`
- Create: `src/sites/instagram/features.ts`
- Create: `src/sites/instagram/index.ts`
- Test: `tests/unit/sites/features.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/sites/features.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { facebook } from '@/sites/facebook';
import { instagram } from '@/sites/instagram';
import type { SiteModule } from '@/sites/types';

const MODULES: SiteModule[] = [facebook, instagram];

describe.each(MODULES)('site module $id', (site) => {
  it('has a non empty id and display name', () => {
    expect(site.id.length).toBeGreaterThan(0);
    expect(site.displayName.length).toBeGreaterThan(0);
  });

  it('declares at least one host and one match pattern', () => {
    expect(site.hosts.length).toBeGreaterThan(0);
    expect(site.matches.length).toBeGreaterThan(0);
  });

  it('declares only bare hostnames in hosts, no scheme and no wildcard', () => {
    for (const host of site.hosts) {
      expect(host).not.toContain('*');
      expect(host).not.toContain('/');
      expect(host).not.toContain(':');
    }
  });

  it('declares at least one feature', () => {
    expect(site.features.length).toBeGreaterThan(0);
  });

  it('has no duplicate feature ids', () => {
    const ids = site.features.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every feature a non empty label and description', () => {
    for (const feature of site.features) {
      expect(feature.label.length).toBeGreaterThan(0);
      expect(feature.description.length).toBeGreaterThan(0);
    }
  });

  it('marks every feature planned, because no interception ships in M1 or M2', () => {
    for (const feature of site.features) {
      expect(feature.status).toBe('planned');
    }
  });
});

describe('the two modules together', () => {
  it('have different ids', () => {
    expect(facebook.id).not.toBe(instagram.id);
  });

  it('do not claim the same host', () => {
    const all = [...facebook.hosts, ...instagram.hosts];
    expect(new Set(all).size).toBe(all.length);
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `pnpm test tests/unit/sites/features.test.ts`
Expected: FAIL, cannot resolve `@/sites/facebook`.

- [ ] **Step 3: Write the Facebook module**

`src/sites/facebook/features.ts`:

```typescript
import type { Feature } from '../types';

export const FACEBOOK_FEATURES: readonly Feature[] = [
  {
    id: 'hideReadReceipts',
    label: 'Hide read receipts',
    description: 'Read messages without telling the sender you read them',
    defaultEnabled: true,
    status: 'planned',
  },
  {
    id: 'hideTyping',
    label: 'Hide typing indicator',
    description: 'Stop the three dots appearing while you type',
    defaultEnabled: true,
    status: 'planned',
  },
  {
    id: 'hideStoryViews',
    label: 'Hide story views',
    description: 'Watch stories without appearing in the viewer list',
    defaultEnabled: true,
    status: 'planned',
  },
  {
    id: 'blockFeedAutoRefresh',
    label: 'Stop the feed reloading',
    description: 'Keep your place when you switch back to the tab',
    defaultEnabled: true,
    status: 'planned',
  },
  {
    id: 'hideSuggestedPosts',
    label: 'Hide suggested posts',
    description: 'Show only posts from friends and pages you follow',
    defaultEnabled: true,
    status: 'planned',
  },
];
```

`src/sites/facebook/index.ts`:

```typescript
import type { SiteModule } from '../types';
import { FACEBOOK_FEATURES } from './features';

export const facebook: SiteModule = {
  id: 'facebook',
  displayName: 'Facebook',
  hosts: ['facebook.com', 'messenger.com'],
  matches: ['*://*.facebook.com/*', '*://*.messenger.com/*'],
  features: FACEBOOK_FEATURES,
};
```

- [ ] **Step 4: Write the Instagram module**

`src/sites/instagram/features.ts`:

```typescript
import type { Feature } from '../types';

export const INSTAGRAM_FEATURES: readonly Feature[] = [
  {
    id: 'hideReadReceipts',
    label: 'Hide read receipts',
    description: 'Read direct messages without sending a seen marker',
    defaultEnabled: true,
    status: 'planned',
  },
  {
    id: 'hideTyping',
    label: 'Hide typing indicator',
    description: 'Stop the typing bubble appearing in direct messages',
    defaultEnabled: true,
    status: 'planned',
  },
  {
    id: 'hideStoryViews',
    label: 'Hide story views',
    description: 'Watch stories without appearing in the viewer list',
    defaultEnabled: true,
    status: 'planned',
  },
];
```

`src/sites/instagram/index.ts`:

```typescript
import type { SiteModule } from '../types';
import { INSTAGRAM_FEATURES } from './features';

export const instagram: SiteModule = {
  id: 'instagram',
  displayName: 'Instagram',
  hosts: ['instagram.com'],
  matches: ['*://*.instagram.com/*'],
  features: INSTAGRAM_FEATURES,
};
```

- [ ] **Step 5: Run the test to see it pass**

Run: `pnpm test tests/unit/sites/features.test.ts`
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/sites tests/unit/sites/features.test.ts
git commit -m "feat: Facebook and Instagram site modules"
```

---

## Task 6: Global tracker features

These are the only features that actually work in M1 and M2, so they are the only ones marked
`active`.

**Files:**
- Create: `src/trackers/features.ts`
- Test: extends `tests/unit/sites/features.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/sites/features.test.ts`, and add the import at the top of the file:

```typescript
import { GLOBAL_FEATURES } from '@/trackers/features';
```

```typescript
describe('global tracker features', () => {
  it('declares at least one feature', () => {
    expect(GLOBAL_FEATURES.length).toBeGreaterThan(0);
  });

  it('has no duplicate feature ids', () => {
    const ids = GLOBAL_FEATURES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every feature a non empty label and description', () => {
    for (const feature of GLOBAL_FEATURES) {
      expect(feature.label.length).toBeGreaterThan(0);
      expect(feature.description.length).toBeGreaterThan(0);
    }
  });

  it('marks every feature active, because tracker blocking ships in M2', () => {
    for (const feature of GLOBAL_FEATURES) {
      expect(feature.status).toBe('active');
    }
  });

  it('includes the two features M2 implements', () => {
    const ids = GLOBAL_FEATURES.map((f) => f.id);
    expect(ids).toContain('blockMetaPixel');
    expect(ids).toContain('stripFbclid');
  });

  it('leaves fbclid stripping off by default, because it needs an extra permission', () => {
    const strip = GLOBAL_FEATURES.find((f) => f.id === 'stripFbclid');
    expect(strip?.defaultEnabled).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `pnpm test tests/unit/sites/features.test.ts`
Expected: FAIL, cannot resolve `@/trackers/features`.

- [ ] **Step 3: Write the minimal implementation**

`src/trackers/features.ts`:

```typescript
import type { Feature } from '../sites/types';

export const GLOBAL_FEATURES: readonly Feature[] = [
  {
    id: 'blockMetaPixel',
    label: 'Block Meta tracking pixels',
    description: 'Stop Facebook tracking code loading on other websites',
    defaultEnabled: true,
    status: 'active',
  },
  {
    id: 'stripFbclid',
    label: 'Strip fbclid from links',
    description:
      'Remove the tracking parameter when you follow a link off Facebook. Asks for permission to read all sites',
    defaultEnabled: false,
    status: 'active',
  },
];
```

`stripFbclid` defaults to off deliberately. Turning it on triggers an `<all_urls>` permission
prompt, and an extension that fires a frightening permission dialog the first time someone
opens the popup will lose that person. Spec section 6 carries the full reasoning.

- [ ] **Step 4: Run the test to see it pass**

Run: `pnpm test tests/unit/sites/features.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/trackers/features.ts tests/unit/sites/features.test.ts
git commit -m "feat: global tracker feature declarations"
```

---

## Task 7: The site registry

The registry is the piece that makes a third platform cheap. It holds every module and answers
one question: given a URL, which module applies?

Host matching must accept subdomains, because Facebook serves from `www.facebook.com` and
`m.facebook.com`. It must not accept a host that merely ends with the string, because
`notfacebook.com` is a different site and matching it would be a security bug.

**Files:**
- Create: `src/sites/registry.ts`
- Test: `tests/unit/sites/registry.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/sites/registry.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { SITE_MODULES, findSiteForUrl } from '@/sites/registry';

describe('SITE_MODULES', () => {
  it('holds both modules shipping in v1', () => {
    expect(SITE_MODULES.map((m) => m.id).sort()).toEqual([
      'facebook',
      'instagram',
    ]);
  });
});

describe('findSiteForUrl', () => {
  it('matches the bare host', () => {
    expect(findSiteForUrl('https://facebook.com/')?.id).toBe('facebook');
  });

  it('matches a subdomain', () => {
    expect(findSiteForUrl('https://www.facebook.com/feed')?.id).toBe('facebook');
    expect(findSiteForUrl('https://m.facebook.com/')?.id).toBe('facebook');
  });

  it('matches the second host of a module', () => {
    expect(findSiteForUrl('https://www.messenger.com/t/1')?.id).toBe('facebook');
  });

  it('matches the other module', () => {
    expect(findSiteForUrl('https://www.instagram.com/direct/')?.id).toBe(
      'instagram',
    );
  });

  it('does not match a host that merely ends with a supported host', () => {
    expect(findSiteForUrl('https://notfacebook.com/')).toBeNull();
    expect(findSiteForUrl('https://evilfacebook.com/')).toBeNull();
  });

  it('does not match a supported host appearing in the path', () => {
    expect(findSiteForUrl('https://evil.example/facebook.com/login')).toBeNull();
  });

  it('returns null for an unsupported site', () => {
    expect(findSiteForUrl('https://example.com/')).toBeNull();
  });

  it('returns null for a url that is undefined or empty', () => {
    expect(findSiteForUrl(undefined)).toBeNull();
    expect(findSiteForUrl('')).toBeNull();
  });

  it('returns null for a malformed url instead of throwing', () => {
    expect(findSiteForUrl('not a url')).toBeNull();
  });

  it('returns null for a non http scheme', () => {
    expect(findSiteForUrl('chrome-extension://abc/popup.html')).toBeNull();
    expect(findSiteForUrl('file:///Users/someone/facebook.com')).toBeNull();
  });

  it('is case insensitive about the host', () => {
    expect(findSiteForUrl('https://WWW.Facebook.COM/')?.id).toBe('facebook');
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `pnpm test tests/unit/sites/registry.test.ts`
Expected: FAIL, cannot resolve `@/sites/registry`.

- [ ] **Step 3: Write the minimal implementation**

`src/sites/registry.ts`:

```typescript
import { facebook } from './facebook';
import { instagram } from './instagram';
import type { SiteModule } from './types';

export const SITE_MODULES: readonly SiteModule[] = [facebook, instagram];

const HTTP_SCHEMES = new Set(['http:', 'https:']);

function hostMatches(hostname: string, host: string): boolean {
  return hostname === host || hostname.endsWith(`.${host}`);
}

export function findSiteForUrl(url: string | undefined): SiteModule | null {
  if (!url) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (!HTTP_SCHEMES.has(parsed.protocol)) {
    return null;
  }

  const hostname = parsed.hostname.toLowerCase();
  return (
    SITE_MODULES.find((module) =>
      module.hosts.some((host) => hostMatches(hostname, host)),
    ) ?? null
  );
}
```

The `.${host}` prefix inside `hostMatches` is what rejects `notfacebook.com`. A plain
`endsWith` would accept it, which is the subtle bug this function exists to avoid.

- [ ] **Step 4: Run the test to see it pass**

Run: `pnpm test tests/unit/sites/registry.test.ts`
Expected: 12 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sites/registry.ts tests/unit/sites/registry.test.ts
git commit -m "feat: site registry with safe host matching"
```

---

## Task 8: Settings schema

Settings are global switches plus one flat record of feature keys. Flat means updating one
feature is a one line spread, migrations stay readable, and the UI maps straight onto it.

Defaults are derived from the registry rather than written by hand, so adding a feature to a
module cannot leave a hole in the defaults.

**Files:**
- Create: `src/core/settings/schema.ts`
- Test: `tests/unit/settings/schema.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/settings/schema.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import {
  ALL_FEATURES,
  DEFAULT_SETTINGS,
  buildDefaultFeatures,
  findFeature,
  isFeatureOn,
  settingsSchema,
  type Settings,
} from '@/core/settings/schema';
import { SITE_MODULES } from '@/sites/registry';
import { GLOBAL_FEATURES } from '@/trackers/features';

describe('ALL_FEATURES', () => {
  it('covers every site feature and every global feature exactly once', () => {
    const expected =
      SITE_MODULES.reduce((total, m) => total + m.features.length, 0) +
      GLOBAL_FEATURES.length;
    expect(ALL_FEATURES.length).toBe(expected);
    const keys = ALL_FEATURES.map((entry) => entry.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('namespaces site features by module id', () => {
    const keys = ALL_FEATURES.map((entry) => entry.key);
    expect(keys).toContain('facebook.hideReadReceipts');
    expect(keys).toContain('instagram.hideReadReceipts');
  });

  it('namespaces global features under global', () => {
    const keys = ALL_FEATURES.map((entry) => entry.key);
    expect(keys).toContain('global.blockMetaPixel');
  });
});

describe('DEFAULT_SETTINGS', () => {
  it('validates against the schema', () => {
    expect(() => settingsSchema.parse(DEFAULT_SETTINGS)).not.toThrow();
  });

  it('enables the master switch and leaves strict mode off', () => {
    expect(DEFAULT_SETTINGS.masterEnabled).toBe(true);
    expect(DEFAULT_SETTINGS.strictMode).toBe(false);
  });

  it('has one entry per known feature', () => {
    expect(Object.keys(DEFAULT_SETTINGS.features).sort()).toEqual(
      ALL_FEATURES.map((entry) => entry.key).sort(),
    );
  });

  it('takes each default from the feature declaration', () => {
    for (const entry of ALL_FEATURES) {
      expect(DEFAULT_SETTINGS.features[entry.key]).toBe(
        entry.feature.defaultEnabled,
      );
    }
  });
});

describe('buildDefaultFeatures', () => {
  it('returns a fresh object each call, so callers cannot share state', () => {
    const first = buildDefaultFeatures();
    first['facebook.hideTyping'] = false;
    expect(buildDefaultFeatures()['facebook.hideTyping']).toBe(true);
  });
});

describe('settingsSchema', () => {
  it('rejects a wrong type on a global switch', () => {
    const bad = { ...DEFAULT_SETTINGS, masterEnabled: 'yes' };
    expect(settingsSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a missing field', () => {
    const incomplete: Record<string, unknown> = { ...DEFAULT_SETTINGS };
    delete incomplete.theme;
    expect(settingsSchema.safeParse(incomplete).success).toBe(false);
  });

  it('rejects a non boolean feature value', () => {
    const bad = {
      ...DEFAULT_SETTINGS,
      features: { ...DEFAULT_SETTINGS.features, 'global.blockMetaPixel': 1 },
    };
    expect(settingsSchema.safeParse(bad).success).toBe(false);
  });

  it('accepts an unknown feature key, so an older build reading newer settings survives', () => {
    const forward = {
      ...DEFAULT_SETTINGS,
      features: { ...DEFAULT_SETTINGS.features, 'tiktok.hideSeen': true },
    };
    expect(settingsSchema.safeParse(forward).success).toBe(true);
  });
});

describe('findFeature', () => {
  it('finds a site feature by key', () => {
    expect(findFeature('facebook.hideTyping')?.feature.id).toBe('hideTyping');
  });

  it('finds a global feature by key', () => {
    expect(findFeature('global.blockMetaPixel')?.feature.id).toBe(
      'blockMetaPixel',
    );
  });

  it('returns null for an unknown key', () => {
    expect(findFeature('tiktok.hideSeen')).toBeNull();
  });
});

describe('isFeatureOn', () => {
  it('returns false for everything when the master switch is off', () => {
    const off: Settings = { ...DEFAULT_SETTINGS, masterEnabled: false };
    for (const entry of ALL_FEATURES) {
      expect(isFeatureOn(off, entry.key)).toBe(false);
    }
  });

  it('returns true for an active feature that is enabled', () => {
    expect(isFeatureOn(DEFAULT_SETTINGS, 'global.blockMetaPixel')).toBe(true);
  });

  it('returns false for an active feature that is disabled', () => {
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      features: {
        ...DEFAULT_SETTINGS.features,
        'global.blockMetaPixel': false,
      },
    };
    expect(isFeatureOn(settings, 'global.blockMetaPixel')).toBe(false);
  });

  it('returns false for a planned feature even when it is stored as enabled', () => {
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      features: {
        ...DEFAULT_SETTINGS.features,
        'facebook.hideReadReceipts': true,
      },
    };
    expect(isFeatureOn(settings, 'facebook.hideReadReceipts')).toBe(false);
  });

  it('returns false for an unknown key rather than throwing', () => {
    expect(isFeatureOn(DEFAULT_SETTINGS, 'tiktok.hideSeen')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `pnpm test tests/unit/settings/schema.test.ts`
Expected: FAIL, cannot resolve `@/core/settings/schema`.

- [ ] **Step 3: Write the minimal implementation**

`src/core/settings/schema.ts`:

```typescript
import { z } from 'zod';
import { SITE_MODULES } from '@/sites/registry';
import { GLOBAL_SCOPE, featureKey, type Feature } from '@/sites/types';
import { GLOBAL_FEATURES } from '@/trackers/features';

export interface FeatureEntry {
  readonly key: string;
  readonly scope: string;
  readonly feature: Feature;
}

export const ALL_FEATURES: readonly FeatureEntry[] = [
  ...SITE_MODULES.flatMap((module) =>
    module.features.map((feature) => ({
      key: featureKey(module.id, feature.id),
      scope: module.id,
      feature,
    })),
  ),
  ...GLOBAL_FEATURES.map((feature) => ({
    key: featureKey(GLOBAL_SCOPE, feature.id),
    scope: GLOBAL_SCOPE,
    feature,
  })),
];

const FEATURES_BY_KEY = new Map(ALL_FEATURES.map((entry) => [entry.key, entry]));

export function findFeature(key: string): FeatureEntry | null {
  return FEATURES_BY_KEY.get(key) ?? null;
}

export function buildDefaultFeatures(): Record<string, boolean> {
  const defaults: Record<string, boolean> = {};
  for (const entry of ALL_FEATURES) {
    defaults[entry.key] = entry.feature.defaultEnabled;
  }
  return defaults;
}

export const settingsSchema = z.object({
  masterEnabled: z.boolean(),
  strictMode: z.boolean(),
  showBadge: z.boolean(),
  theme: z.enum(['system', 'light', 'dark']),
  features: z.record(z.string(), z.boolean()),
});

export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  masterEnabled: true,
  strictMode: false,
  showBadge: true,
  theme: 'system',
  features: buildDefaultFeatures(),
};

export function isFeatureOn(settings: Settings, key: string): boolean {
  if (!settings.masterEnabled) {
    return false;
  }
  const entry = findFeature(key);
  if (entry === null || entry.feature.status !== 'active') {
    return false;
  }
  return settings.features[key] ?? entry.feature.defaultEnabled;
}
```

Two deliberate choices. The schema accepts unknown feature keys, so settings written by a newer
build do not make an older build discard everything. And `isFeatureOn` gates on `status`, which
is the mechanism that stops the extension claiming protection it has not implemented yet.

- [ ] **Step 4: Run the test to see it pass**

Run: `pnpm test tests/unit/settings/schema.test.ts`
Expected: 20 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/settings/schema.ts tests/unit/settings/schema.test.ts
git commit -m "feat: settings schema derived from the site registry"
```

---

## Task 9: Versioned settings storage

**Files:**
- Create: `src/core/settings/storage.ts`
- Test: `tests/unit/settings/storage.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/settings/storage.test.ts`:

```typescript
import { beforeEach, describe, expect, it } from 'vitest';
import { storage } from '#imports';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { DEFAULT_SETTINGS, type Settings } from '@/core/settings/schema';
import { readSettings, writeSettings } from '@/core/settings/storage';

describe('readSettings and writeSettings', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('returns defaults when storage is empty', async () => {
    await expect(readSettings()).resolves.toEqual(DEFAULT_SETTINGS);
  });

  it('reads back exactly what was written', async () => {
    const next: Settings = {
      ...DEFAULT_SETTINGS,
      features: {
        ...DEFAULT_SETTINGS.features,
        'global.blockMetaPixel': false,
      },
    };
    await writeSettings(next);
    const result = await readSettings();
    expect(result.features['global.blockMetaPixel']).toBe(false);
  });

  it('leaves other features untouched when one changes', async () => {
    await writeSettings({
      ...DEFAULT_SETTINGS,
      features: {
        ...DEFAULT_SETTINGS.features,
        'global.blockMetaPixel': false,
      },
    });
    const result = await readSettings();
    expect(result.features['facebook.hideTyping']).toBe(true);
  });

  it('falls back to defaults when the stored value is corrupt', async () => {
    await storage.setItem('local:settings', { masterEnabled: 'yes' });
    await expect(readSettings()).resolves.toEqual(DEFAULT_SETTINGS);
  });

  it('overwrites corrupt data instead of rereading it forever', async () => {
    await storage.setItem('local:settings', { garbage: true });
    await readSettings();
    const raw = await storage.getItem<Settings>('local:settings');
    expect(raw).toEqual(DEFAULT_SETTINGS);
  });

  it('backfills a feature key missing from stored settings', async () => {
    const partial = {
      ...DEFAULT_SETTINGS,
      features: { 'global.blockMetaPixel': false },
    };
    await storage.setItem('local:settings', partial);
    const result = await readSettings();
    expect(result.features['global.blockMetaPixel']).toBe(false);
    expect(result.features['facebook.hideTyping']).toBe(true);
  });

  it('refuses to write invalid settings', async () => {
    const bad = { ...DEFAULT_SETTINGS, theme: 'neon' } as unknown as Settings;
    await expect(writeSettings(bad)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `pnpm test tests/unit/settings/storage.test.ts`
Expected: FAIL, cannot resolve `@/core/settings/storage`.

- [ ] **Step 3: Write the minimal implementation**

`src/core/settings/storage.ts`:

```typescript
import { storage } from '#imports';
import {
  DEFAULT_SETTINGS,
  buildDefaultFeatures,
  settingsSchema,
  type Settings,
} from './schema';

export const SETTINGS_VERSION = 1;

export const settingsItem = storage.defineItem<Settings>('local:settings', {
  fallback: DEFAULT_SETTINGS,
  version: SETTINGS_VERSION,
});

function withMissingFeatures(settings: Settings): Settings {
  return {
    ...settings,
    features: { ...buildDefaultFeatures(), ...settings.features },
  };
}

export async function readSettings(): Promise<Settings> {
  const raw = await settingsItem.getValue();
  const parsed = settingsSchema.safeParse(raw);
  if (parsed.success) {
    return withMissingFeatures(parsed.data);
  }
  await settingsItem.setValue(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}

export async function writeSettings(next: Settings): Promise<void> {
  await settingsItem.setValue(settingsSchema.parse(next));
}
```

`withMissingFeatures` is what makes adding a feature in a later release safe. Someone upgrading
has stored settings that predate the new key, and without the backfill every new feature would
read as undefined.

- [ ] **Step 4: Run the test to see it pass**

Run: `pnpm test tests/unit/settings/storage.test.ts`
Expected: 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/settings/storage.ts tests/unit/settings/storage.test.ts
git commit -m "feat: versioned settings storage that backfills new feature keys"
```

---

## Task 10: Settings signals store

Every screen reads this store and nothing else. It updates the signal first and persists
afterwards, so the interface responds instantly rather than waiting for a storage round trip.

**Files:**
- Create: `src/core/settings/store.ts`
- Test: `tests/unit/settings/store.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/settings/store.test.ts`:

```typescript
import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { DEFAULT_SETTINGS } from '@/core/settings/schema';
import { readSettings, writeSettings } from '@/core/settings/storage';
import {
  initSettingsStore,
  isReady,
  setFeature,
  setMasterEnabled,
  settings,
  stopSettingsStore,
} from '@/core/settings/store';

describe('settings store', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    stopSettingsStore();
    settings.value = DEFAULT_SETTINGS;
  });

  it('starts out not ready', () => {
    expect(isReady.value).toBe(false);
  });

  it('loads stored settings on init', async () => {
    await writeSettings({
      ...DEFAULT_SETTINGS,
      features: {
        ...DEFAULT_SETTINGS.features,
        'global.blockMetaPixel': false,
      },
    });
    await initSettingsStore();
    expect(isReady.value).toBe(true);
    expect(settings.value.features['global.blockMetaPixel']).toBe(false);
  });

  it('updates the signal before the write resolves', async () => {
    await initSettingsStore();
    const pending = setFeature('global.blockMetaPixel', false);
    expect(settings.value.features['global.blockMetaPixel']).toBe(false);
    await pending;
  });

  it('persists a feature change', async () => {
    await initSettingsStore();
    await setFeature('global.blockMetaPixel', false);
    const persisted = await readSettings();
    expect(persisted.features['global.blockMetaPixel']).toBe(false);
  });

  it('does not disturb other features', async () => {
    await initSettingsStore();
    await setFeature('global.blockMetaPixel', false);
    expect(settings.value.features['global.stripFbclid']).toBe(false);
    expect(settings.value.features['facebook.hideTyping']).toBe(true);
  });

  it('persists the master switch', async () => {
    await initSettingsStore();
    await setMasterEnabled(false);
    const persisted = await readSettings();
    expect(persisted.masterEnabled).toBe(false);
  });

  it('goes back to not ready when stopped', async () => {
    await initSettingsStore();
    stopSettingsStore();
    expect(isReady.value).toBe(false);
  });

  it('survives being initialised twice without leaking a watcher', async () => {
    await initSettingsStore();
    await initSettingsStore();
    await setMasterEnabled(false);
    expect(settings.value.masterEnabled).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `pnpm test tests/unit/settings/store.test.ts`
Expected: FAIL, cannot resolve `@/core/settings/store`.

- [ ] **Step 3: Write the minimal implementation**

`src/core/settings/store.ts`:

```typescript
import { signal } from '@preact/signals';
import { DEFAULT_SETTINGS, type Settings } from './schema';
import { readSettings, settingsItem, writeSettings } from './storage';

export const settings = signal<Settings>(DEFAULT_SETTINGS);
export const isReady = signal(false);

let unwatch: (() => void) | undefined;

export async function initSettingsStore(): Promise<void> {
  settings.value = await readSettings();
  unwatch?.();
  unwatch = settingsItem.watch((next) => {
    if (next) {
      settings.value = next;
    }
  });
  isReady.value = true;
}

export function stopSettingsStore(): void {
  unwatch?.();
  unwatch = undefined;
  isReady.value = false;
}

async function commit(next: Settings): Promise<void> {
  settings.value = next;
  await writeSettings(next);
}

export async function setFeature(key: string, value: boolean): Promise<void> {
  await commit({
    ...settings.value,
    features: { ...settings.value.features, [key]: value },
  });
}

export async function setMasterEnabled(value: boolean): Promise<void> {
  await commit({ ...settings.value, masterEnabled: value });
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `pnpm test tests/unit/settings/store.test.ts`
Expected: 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/settings/store.ts tests/unit/settings/store.test.ts
git commit -m "feat: settings signals store with two way storage sync"
```

---

## Task 10b: Harden the settings store

A follow up to Task 10, raised by its review. Lettered rather than numbered so the tasks after
it keep their numbers.

Two changes, one of which matters more than its low probability suggests.

**The signal must never outlive a failed write.** `commit` sets the signal and then awaits the
write. If the write rejects, the signal keeps a value that was never persisted, and nothing
corrects it for the life of that document. The interface would then show a feature as on while
it is not stored, which is the same dishonesty about protection state that spec section 7 calls
the most serious failure this class of extension can commit. A storage write of a small boolean
map is very unlikely to fail, but the fix costs four lines and the principle is not negotiable.

Note what is deliberately kept: the signal still updates before the write, because that is what
makes the interface respond instantly. Only the failure path changes.

**The single owner rule must be written down.** `settings`, `isReady` and the watcher handle are
module level singletons with no reference counting. That is correct for one root component
calling `initSettingsStore` on mount, which is exactly how the popup uses it. It breaks silently
if two components each initialise and stop it on their own lifecycle, because the second one to
unmount kills the first one's live subscription and flips `isReady` to false underneath it.
Nothing in the code says so. The Options screen in M5 has five sections, each of which could be
tempted to initialise the store for itself, so this needs to be stated before that work starts.

A doc comment is the proportionate fix here rather than reference counting. There is exactly one
consumer today, and building a counting mechanism for a second consumer that does not exist is
the speculative complexity this plan avoids elsewhere. If M5 genuinely needs multiple owners,
add it then, with a test that proves it.

**Deliberately not fixed:** the review also noted that stale feature keys are never pruned from
stored settings. That is intentional. The schema accepts unknown keys so a newer build's
settings do not destroy an older build's, and the only writer is the extension itself, so growth
is bounded by the number of features this product has ever shipped. Revisit it in M5 alongside
the settings export and import work, where a prune step has an obvious home.

**Files:**
- Modify: `src/core/settings/store.ts`
- Modify: `tests/unit/settings/store.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/settings/store.test.ts`, inside the existing `describe('settings store')`
block, and add `vi` to the vitest import at the top of the file:

```typescript
  it('rolls the signal back when the write fails, so the interface never shows an unsaved state', async () => {
    await initSettingsStore();
    const before = settings.value.features['global.blockMetaPixel'];

    const storageModule = await import('@/core/settings/storage');
    const spy = vi
      .spyOn(storageModule, 'writeSettings')
      .mockRejectedValue(new Error('quota exceeded'));

    await expect(setFeature('global.blockMetaPixel', !before)).rejects.toThrow(
      'quota exceeded',
    );
    expect(settings.value.features['global.blockMetaPixel']).toBe(before);

    spy.mockRestore();
  });

  it('still rejects so the caller learns the write failed', async () => {
    await initSettingsStore();

    const storageModule = await import('@/core/settings/storage');
    const spy = vi
      .spyOn(storageModule, 'writeSettings')
      .mockRejectedValue(new Error('quota exceeded'));

    await expect(setMasterEnabled(false)).rejects.toThrow('quota exceeded');
    expect(settings.value.masterEnabled).toBe(true);

    spy.mockRestore();
  });
```

- [ ] **Step 2: Run the test to see it fail**

Run: `pnpm test tests/unit/settings/store.test.ts`
Expected: FAIL on both new tests. The signal keeps the new value after the rejected write, so
the assertion that it went back to `before` fails.

If instead the spy does not intercept the call at all, `store.ts` is holding a direct binding to
the imported function in a way `vi.spyOn` cannot replace. In that case change the test to mock
the module with `vi.mock('@/core/settings/storage', ...)` rather than changing `store.ts` to
suit the test.

- [ ] **Step 3: Write the minimal implementation**

Replace `commit` in `src/core/settings/store.ts` with:

```typescript
async function commit(next: Settings): Promise<void> {
  const previous = settings.value;
  settings.value = next;
  try {
    await writeSettings(next);
  } catch (error) {
    settings.value = previous;
    throw error;
  }
}
```

The rethrow is deliberate. Swallowing the error would leave the caller believing the change
took, which trades one silent lie for another.

- [ ] **Step 4: Add the single owner doc comment**

Above `initSettingsStore` in `src/core/settings/store.ts`:

```typescript
/**
 * Loads settings and starts watching storage for changes.
 *
 * Call this exactly once per document, from the root component. The signals and the watcher
 * handle are module level singletons with no reference counting, so if two components each
 * init and stop the store on their own lifecycle, the second one to unmount silently kills
 * the first one's subscription and flips `isReady` back to false underneath it.
 *
 * Everything else should read the `settings` signal directly rather than calling this.
 */
```

- [ ] **Step 5: Run the test to see it pass**

Run: `pnpm test tests/unit/settings/store.test.ts`
Expected: 10 tests PASS, the original 8 plus the 2 new ones.

- [ ] **Step 6: Verify nothing else broke**

Run: `pnpm lint && pnpm compile && pnpm test && pnpm build`
Expected: all four succeed, with 75 tests in total.

- [ ] **Step 7: Commit**

```bash
git add src/core/settings/store.ts tests/unit/settings/store.test.ts
git commit -m "fix: roll the settings signal back when a write fails"
```

---

## Task 11: Tailwind v4 and design tokens

Tokens are defined twice, once for light at `:root` and once for dark. `@theme inline` maps
them onto Tailwind utility classes, so switching theme means changing CSS variable values and
never touching a class name in JSX.

**Files:**
- Create: `src/ui/styles/tokens.css`
- Modify: `src/entrypoints/popup/main.tsx`

- [ ] **Step 1: Create the token file**

`src/ui/styles/tokens.css`:

```css
@import "tailwindcss";

@theme inline {
  --color-surface: var(--pg-surface);
  --color-surface-muted: var(--pg-surface-muted);
  --color-border: var(--pg-border);
  --color-text: var(--pg-text);
  --color-text-muted: var(--pg-text-muted);
  --color-accent: var(--pg-accent);
  --color-danger: var(--pg-danger);
}

:root {
  --pg-surface: #ffffff;
  --pg-surface-muted: #f4f5f7;
  --pg-border: #e3e5e8;
  --pg-text: #1c1e21;
  --pg-text-muted: #65676b;
  --pg-accent: #1877f2;
  --pg-danger: #e41e3f;
  color-scheme: light dark;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --pg-surface: #18191a;
    --pg-surface-muted: #242526;
    --pg-border: #3a3b3c;
    --pg-text: #e4e6eb;
    --pg-text-muted: #b0b3b8;
    --pg-accent: #2d88ff;
    --pg-danger: #ff5a76;
  }
}

:root[data-theme="dark"] {
  --pg-surface: #18191a;
  --pg-surface-muted: #242526;
  --pg-border: #3a3b3c;
  --pg-text: #e4e6eb;
  --pg-text-muted: #b0b3b8;
  --pg-accent: #2d88ff;
  --pg-danger: #ff5a76;
}

body {
  margin: 0;
  background: var(--pg-surface);
  color: var(--pg-text);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
```

- [ ] **Step 2: Load the CSS from the popup**

`src/entrypoints/popup/main.tsx`:

```tsx
import { render } from 'preact';
import '@/ui/styles/tokens.css';
import { Popup } from './Popup';

const root = document.getElementById('app');
if (root) {
  render(<Popup />, root);
}
```

- [ ] **Step 3: Verify Tailwind emitted the tokens**

Run:
```bash
pnpm build && grep -rl -- "--pg-surface" .output/chrome-mv3 && echo "tokens emitted"
```
Expected: at least one built file contains `--pg-surface`.

If nothing matches, the `tailwindcss()` plugin is missing from `wxt.config.ts`. Fix that rather
than working around it.

- [ ] **Step 4: Commit**

```bash
git add src/ui/styles/tokens.css src/entrypoints/popup/main.tsx
git commit -m "feat: Tailwind v4 design tokens with dark mode support"
```

---

## Task 12: Toggle and Section components

The `badge` prop exists so a planned feature can be labelled visibly in the interface rather
than being silently disabled. A disabled control with no explanation reads as a bug.

**Files:**
- Create: `src/ui/components/Toggle.tsx`
- Create: `src/ui/components/Section.tsx`
- Test: `tests/unit/ui/Toggle.test.tsx`

- [ ] **Step 1: Write the failing test**

`tests/unit/ui/Toggle.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { Toggle } from '@/ui/components/Toggle';

function switchEl(): HTMLInputElement {
  return screen.getByRole('switch') as HTMLInputElement;
}

describe('Toggle', () => {
  it('shows the label', () => {
    render(<Toggle label="Hide read receipts" checked onChange={() => {}} />);
    expect(screen.getByText('Hide read receipts')).toBeTruthy();
  });

  it('shows the description when given one', () => {
    render(
      <Toggle
        label="Hide read receipts"
        description="Read messages quietly"
        checked
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('Read messages quietly')).toBeTruthy();
  });

  it('shows the badge when given one', () => {
    render(
      <Toggle label="Hide typing" badge="Soon" checked onChange={() => {}} />,
    );
    expect(screen.getByText('Soon')).toBeTruthy();
  });

  it('renders no badge element when none is given', () => {
    render(<Toggle label="Hide typing" checked onChange={() => {}} />);
    expect(screen.queryByText('Soon')).toBeNull();
  });

  it('reflects the on state', () => {
    render(<Toggle label="Hide typing" checked onChange={() => {}} />);
    expect(switchEl().checked).toBe(true);
  });

  it('reflects the off state', () => {
    render(<Toggle label="Hide typing" checked={false} onChange={() => {}} />);
    expect(switchEl().checked).toBe(false);
  });

  it('calls onChange with true when switched on', () => {
    const onChange = vi.fn();
    render(<Toggle label="Hide typing" checked={false} onChange={onChange} />);
    fireEvent.click(switchEl());
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('calls onChange with false when switched off', () => {
    const onChange = vi.fn();
    render(<Toggle label="Hide typing" checked onChange={onChange} />);
    fireEvent.click(switchEl());
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('does not call onChange when disabled', () => {
    const onChange = vi.fn();
    render(
      <Toggle label="Hide typing" checked={false} disabled onChange={onChange} />,
    );
    fireEvent.click(switchEl());
    expect(onChange).not.toHaveBeenCalled();
  });

  it('marks the control disabled so assistive technology knows', () => {
    render(
      <Toggle label="Hide typing" checked={false} disabled onChange={() => {}} />,
    );
    expect(switchEl().disabled).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `pnpm test tests/unit/ui/Toggle.test.tsx`
Expected: FAIL, cannot resolve `@/ui/components/Toggle`.

- [ ] **Step 3: Write the minimal implementation**

`src/ui/components/Toggle.tsx`:

```tsx
export interface ToggleProps {
  label: string;
  description?: string;
  badge?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}

export function Toggle({
  label,
  description,
  badge,
  checked,
  disabled = false,
  onChange,
}: ToggleProps) {
  return (
    <label
      class={`flex items-center justify-between gap-3 px-3 py-2.5 ${
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
      }`}
    >
      <span class="min-w-0">
        <span class="flex items-center gap-1.5">
          <span class="text-[13px] font-medium text-text">{label}</span>
          {badge ? (
            <span class="rounded-full border border-border px-1.5 py-px text-[9px] font-semibold tracking-wide text-text-muted uppercase">
              {badge}
            </span>
          ) : null}
        </span>
        {description ? (
          <span class="mt-0.5 block text-[11px] leading-tight text-text-muted">
            {description}
          </span>
        ) : null}
      </span>
      <input
        type="checkbox"
        role="switch"
        class="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(event) => {
          if (disabled) {
            return;
          }
          onChange(event.currentTarget.checked);
        }}
      />
      <span class="relative h-5 w-9 shrink-0 rounded-full bg-border transition-colors peer-checked:bg-accent after:absolute after:top-0.5 after:left-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform after:content-[''] peer-checked:after:translate-x-4" />
    </label>
  );
}
```

The `disabled` guard inside the handler looks redundant, because a real browser never fires a
change event on a disabled input. Keep it anyway, for a reason that has nothing to do with
browsers: `disabled` is how a `planned` feature is rendered, and a planned feature firing
`onChange` would write a stored value for something the extension has not implemented. The guard
makes that impossible at the component level rather than relying on every caller. It also
happens to make the component behave correctly under jsdom, which does still run checkbox
activation on a disabled input.

- [ ] **Step 4: Run the test to see it pass**

Run: `pnpm test tests/unit/ui/Toggle.test.tsx`
Expected: 10 tests PASS.

- [ ] **Step 5: Create the Section component**

`src/ui/components/Section.tsx`:

```tsx
import type { ComponentChildren } from 'preact';

export interface SectionProps {
  title: string;
  children: ComponentChildren;
}

export function Section({ title, children }: SectionProps) {
  return (
    <section class="border-b border-border last:border-b-0">
      <h2 class="px-3 pt-3 pb-1 text-[10px] font-semibold tracking-wider text-text-muted uppercase">
        {title}
      </h2>
      <div>{children}</div>
    </section>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/ui/components tests/unit/ui/Toggle.test.tsx
git commit -m "feat: Toggle and Section components"
```

---

## Task 13: Resolve the active site

The popup needs to know which platform the person is looking at. Reading the active tab's URL
needs no `tabs` permission, because host permissions for the supported sites already make
`tabs.query` return the URL for those tabs and omit it for every other tab. That omission is
exactly the desired behaviour: an unsupported site resolves to null.

As with the badge and the ruleset mapping, the decision lives in a pure function that tests
directly, and the thin wrapper that calls the browser API carries no logic.

**Files:**
- Create: `src/core/activeSite.ts`
- Test: `tests/unit/activeSite.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/activeSite.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { resolveActiveSite } from '@/core/activeSite';

describe('resolveActiveSite', () => {
  it('resolves a supported site from the first tab', () => {
    expect(resolveActiveSite([{ url: 'https://www.facebook.com/' }])?.id).toBe(
      'facebook',
    );
  });

  it('resolves the other supported site', () => {
    expect(resolveActiveSite([{ url: 'https://www.instagram.com/' }])?.id).toBe(
      'instagram',
    );
  });

  it('returns null for an unsupported site', () => {
    expect(resolveActiveSite([{ url: 'https://example.com/' }])).toBeNull();
  });

  it('returns null when the tab has no url, which is what happens without host permission', () => {
    expect(resolveActiveSite([{}])).toBeNull();
  });

  it('returns null when there are no tabs at all', () => {
    expect(resolveActiveSite([])).toBeNull();
  });

  it('ignores tabs after the first', () => {
    expect(
      resolveActiveSite([
        { url: 'https://example.com/' },
        { url: 'https://www.facebook.com/' },
      ]),
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `pnpm test tests/unit/activeSite.test.ts`
Expected: FAIL, cannot resolve `@/core/activeSite`.

- [ ] **Step 3: Write the minimal implementation**

`src/core/activeSite.ts`:

```typescript
import { browser } from '#imports';
import { findSiteForUrl } from '@/sites/registry';
import type { SiteModule } from '@/sites/types';

export interface TabLike {
  url?: string | undefined;
}

export function resolveActiveSite(
  tabs: readonly TabLike[],
): SiteModule | null {
  return findSiteForUrl(tabs[0]?.url);
}

export async function getActiveSite(): Promise<SiteModule | null> {
  try {
    const tabs = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    return resolveActiveSite(tabs);
  } catch {
    return null;
  }
}
```

The try and catch is not defensive noise. In a popup opened from a keyboard shortcut with no
window focused, `tabs.query` can reject, and a rejected promise there would leave the popup
blank.

- [ ] **Step 4: Run the test to see it pass**

Run: `pnpm test tests/unit/activeSite.test.ts`
Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/activeSite.ts tests/unit/activeSite.test.ts
git commit -m "feat: resolve the active tab to a site module"
```

---

## Task 13b: Centralise test cleanup

A follow up to Task 12, raised while implementing it. Lettered so the tasks after it keep their
numbers.

`@testing-library/preact` registers its own cleanup between tests only when it finds a global
`afterEach`. This project imports vitest's test APIs explicitly instead of using injected
globals, so that registration never happens and rendered components pile up across tests in the
same file. Task 12 worked around it with an `afterEach(cleanup)` written directly in
`Toggle.test.tsx`.

That workaround is correct but it does not scale. Every future component test file has to
remember the same incantation, and a file that forgets it does not fail loudly, it just starts
seeing elements left over from a previous test. Milestones M3 through M5 add the in page panel,
the options screen and the dashboard, so there will be many more such files.

Moving the cleanup into a setup file makes it automatic and removes the trap.

**Files:**
- Create: `tests/setup.ts`
- Modify: `vitest.config.ts`
- Modify: `tests/unit/ui/Toggle.test.tsx`

- [ ] **Step 1: Create the setup file**

`tests/setup.ts`:

```typescript
import { cleanup } from '@testing-library/preact';
import { afterEach } from 'vitest';

// @testing-library/preact only auto registers its own cleanup when a global `afterEach`
// exists. This project imports vitest's APIs explicitly rather than enabling globals, so
// the cleanup is registered here once for every test file instead.
afterEach(() => {
  cleanup();
});
```

- [ ] **Step 2: Wire it into the vitest config**

`vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
    restoreMocks: true,
  },
});
```

- [ ] **Step 3: Remove the per file workaround**

In `tests/unit/ui/Toggle.test.tsx`, delete the local `afterEach` block and its explanatory
comment, and drop `cleanup` and `afterEach` from the imports. The first two lines should end up
as:

```tsx
import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
```

- [ ] **Step 4: Prove the setup file is actually doing the work**

Removing the local cleanup and still passing is only weak evidence, since a single passing run
could mean the setup file works or that the tests happen not to collide. Prove it directly.

Temporarily comment out the `setupFiles` line in `vitest.config.ts` and run:

```bash
pnpm test tests/unit/ui/Toggle.test.tsx
```
Expected: FAIL. Without cleanup, `screen.getByRole('switch')` finds several switches left over
from earlier tests and throws a "found multiple elements" error.

Then restore the `setupFiles` line and run it again.
Expected: 10 tests PASS.

Quote both outputs in your report. If commenting out `setupFiles` does not break the tests, the
cleanup is not what is making them pass and something else is going on; stop and report that
rather than continuing.

- [ ] **Step 5: Verify the whole suite**

Run: `pnpm lint && pnpm compile && pnpm test && pnpm build`
Expected: all four succeed, with 91 tests still passing.

- [ ] **Step 6: Commit**

```bash
git add tests/setup.ts vitest.config.ts tests/unit/ui/Toggle.test.tsx
git commit -m "test: register testing library cleanup once instead of per file"
```

---

## Task 14: Assemble the popup

Three things worth noting before writing this.

The signal starts at `DEFAULT_SETTINGS`, so the popup paints immediately with no loading state.
Step 5 measures whether that actually meets the 50 millisecond target from spec section 1.4,
and only a failed measurement justifies adding a `storage.session` cache.

The master switch carries a real label, `Protection`, rather than an empty string, so screen
readers and the end to end tests can both name it.

The `theme` setting is applied to `data-theme` on the root element, matching the CSS variables
from Task 11. Without this the setting would be dead data.

**Files:**
- Modify: `src/core/activeSite.ts`
- Modify: `src/entrypoints/popup/Popup.tsx`

- [ ] **Step 1: Make the swallowed error visible**

Raised by the Task 13 review. `getActiveSite` catches every failure and returns null, which is
the right user facing behaviour, but with no logging a genuine bug is indistinguishable from an
unsupported site. A missing host permission during development would look exactly like visiting
example.com. One line fixes that without changing what the function returns.

In `src/core/activeSite.ts`, replace the catch block:

```typescript
export async function getActiveSite(): Promise<SiteModule | null> {
  try {
    const tabs = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    return resolveActiveSite(tabs);
  } catch (error) {
    console.warn('[privacy-guard] could not read the active tab', error);
    return null;
  }
}
```

Returning null rather than rethrowing stays deliberate: a popup that renders nothing because of
an unhandled rejection is a worse failure than one that shows the unsupported site message.

- [ ] **Step 2: Write the popup**

`src/entrypoints/popup/Popup.tsx`:

```tsx
import { useEffect, useState } from 'preact/hooks';
import { getActiveSite } from '@/core/activeSite';
import {
  initSettingsStore,
  setFeature,
  setMasterEnabled,
  settings,
  stopSettingsStore,
} from '@/core/settings/store';
import { featureKey, type Feature, type SiteModule } from '@/sites/types';
import { GLOBAL_FEATURES } from '@/trackers/features';
import { Section } from '@/ui/components/Section';
import { Toggle } from '@/ui/components/Toggle';

export function Popup() {
  const [site, setSite] = useState<SiteModule | null>(null);
  const [siteResolved, setSiteResolved] = useState(false);

  useEffect(() => {
    void initSettingsStore();
    return () => stopSettingsStore();
  }, []);

  useEffect(() => {
    void getActiveSite().then((resolved) => {
      setSite(resolved);
      setSiteResolved(true);
    });
  }, []);

  const current = settings.value;
  const master = current.masterEnabled;

  useEffect(() => {
    const root = document.documentElement;
    if (current.theme === 'system') {
      delete root.dataset.theme;
    } else {
      root.dataset.theme = current.theme;
    }
  }, [current.theme]);

  function renderFeature(scope: string, feature: Feature) {
    const key = featureKey(scope, feature.id);
    const planned = feature.status === 'planned';
    return (
      <Toggle
        key={key}
        label={feature.label}
        description={feature.description}
        badge={planned ? 'Soon' : undefined}
        checked={current.features[key] ?? feature.defaultEnabled}
        disabled={!master || planned}
        onChange={(next) => void setFeature(key, next)}
      />
    );
  }

  return (
    <main class="w-[360px] bg-surface text-text">
      <header class="flex items-center justify-between border-b border-border px-3 py-3">
        <div>
          <h1 class="text-sm font-semibold">Privacy Guard</h1>
          <p class="text-[11px] text-text-muted">
            {master ? 'Protection on' : 'Protection paused'}
          </p>
        </div>
        <Toggle
          label="Protection"
          checked={master}
          onChange={(next) => void setMasterEnabled(next)}
        />
      </header>

      {site ? (
        <Section title={site.displayName}>
          {site.features.map((feature) =>
            renderFeature(site.id, feature),
          )}
        </Section>
      ) : siteResolved ? (
        <p class="border-b border-border px-3 py-3 text-[11px] leading-snug text-text-muted">
          Open Facebook, Messenger or Instagram to see the controls for that
          site. The settings below apply everywhere.
        </p>
      ) : null}

      <Section title="All websites">
        {GLOBAL_FEATURES.map((feature) =>
          renderFeature('global', feature),
        )}
      </Section>

      <footer class="border-t border-border bg-surface-muted px-3 py-2 text-[11px] leading-snug text-text-muted">
        Works only on your own session. Privacy Guard sends no data anywhere.
      </footer>
    </main>
  );
}
```

- [ ] **Step 3: Check it compiles**

Run: `pnpm compile && pnpm lint`
Expected: both succeed.

- [ ] **Step 4: Run every test**

Run: `pnpm test`
Expected: all tests PASS.

- [ ] **Step 5: Check it by hand on Chrome**

Run: `pnpm dev`
Open a new tab on `https://example.com`, then open the extension popup.
Expected: the header, the explanatory line about opening a supported site, the All websites
section with two toggles, and the footer. `Block Meta tracking pixels` is on, `Strip fbclid` is
off.

Now open `https://www.facebook.com` and open the popup again.
Expected: a `Facebook` section appears above the global one, listing five toggles, every one of
them disabled and badged `Soon`.

Now open `https://www.instagram.com` and open the popup.
Expected: an `Instagram` section with three toggles, all badged `Soon`.

Turn the master switch off.
Expected: the status line reads `Protection paused` and every toggle below becomes disabled.

- [ ] **Step 6: Measure how long the popup takes to open**

Open the popup, right click inside it, choose Inspect. In the popup's console run:

```js
performance.getEntriesByType('navigation')[0].duration
```

Expected: under 50, which is the criterion in spec section 1.4.

If it exceeds 50, the cause is almost certainly waiting on `storage.local`. Only then add the
`storage.session` cache described in spec section 5.1, and record the before and after numbers
in the commit message.

- [ ] **Step 7: Check dark mode**

In the popup's DevTools, open Rendering and set `prefers-color-scheme` to `dark`.
Expected: the surface goes dark, the text goes light, and the section borders stay visible.

- [ ] **Step 8: Commit**

```bash
git add src/entrypoints/popup/Popup.tsx
git commit -m "feat: popup driven by the site registry with honest planned badges"
```

---

## Task 14b: Test the popup's honesty, and restore type checking

Two follow ups raised while running Task 20 out of order. Two separate commits.

### Part one: nothing tests the honesty mechanism at the rendered level

Every Facebook and Instagram feature is `status: 'planned'`, and the popup is supposed to render
those as disabled toggles carrying a `Soon` badge. That is the mechanism keeping the extension
from advertising protection it has not built, which the design spec calls the most serious
failure available to this kind of extension.

Right now `isFeatureOn` is tested, and `Toggle` is tested, but nothing checks that the popup
wires them together correctly. A single wrong ternary in `renderFeature` would ship a row of
live looking switches for features that do nothing, and every existing test would still pass.

The Task 20 report concluded this needs a human at a real Facebook tab. It does not. The popup
learns which site is active through `getActiveSite`, so mocking that one function is enough to
render the Facebook branch with no browser and no account.

### Part two: the end to end suite is no longer type checked

Task 20 hit `TS2307: Cannot find module 'node:path'` because this project has no `@types/node`,
and resolved it by excluding `tests/e2e` from `tsconfig.json`. That was a reasonable call under a
no new dependencies instruction, but it means Playwright's own runner, which strips types without
checking them, is now the only thing that ever looks at that file. A type error there will
surface as a runtime failure instead of a compile error.

`@types/node` is a normal development dependency for any project with a Playwright config. Adding
it and dropping the exclusion restores checking across the whole repository.

**Files:**
- Create: `tests/unit/ui/Popup.test.tsx`
- Modify: `package.json`
- Modify: `tsconfig.json`

- [ ] **Step 1: Write the failing test**

`tests/unit/ui/Popup.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/preact';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { facebook } from '@/sites/facebook';
import { Popup } from '@/entrypoints/popup/Popup';

vi.mock('@/core/activeSite', () => ({
  getActiveSite: vi.fn(),
}));

const { getActiveSite } = await import('@/core/activeSite');
const mockedGetActiveSite = vi.mocked(getActiveSite);

describe('Popup', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    mockedGetActiveSite.mockReset();
  });

  it('shows the global section on an unsupported site', async () => {
    mockedGetActiveSite.mockResolvedValue(null);
    render(<Popup />);

    await waitFor(() => {
      expect(screen.getByText(/Open Facebook, Messenger or Instagram/)).toBeTruthy();
    });
    expect(screen.getByText('All websites')).toBeTruthy();
    expect(screen.queryByText('Facebook')).toBeNull();
  });

  it('shows the site section when a supported site is active', async () => {
    mockedGetActiveSite.mockResolvedValue(facebook);
    render(<Popup />);

    await waitFor(() => {
      expect(screen.getByText('Facebook')).toBeTruthy();
    });
    expect(screen.queryByText(/Open Facebook, Messenger or Instagram/)).toBeNull();
  });

  it('renders every planned feature disabled, so the popup never claims protection it lacks', async () => {
    mockedGetActiveSite.mockResolvedValue(facebook);
    render(<Popup />);

    await waitFor(() => {
      expect(screen.getByText('Facebook')).toBeTruthy();
    });

    for (const feature of facebook.features) {
      const row = screen.getByText(feature.label).closest('label');
      expect(row).not.toBeNull();
      const input = row?.querySelector('input[role="switch"]');
      expect((input as HTMLInputElement).disabled).toBe(true);
    }
  });

  it('badges every planned feature as Soon, so a disabled row does not read as broken', async () => {
    mockedGetActiveSite.mockResolvedValue(facebook);
    render(<Popup />);

    await waitFor(() => {
      expect(screen.getByText('Facebook')).toBeTruthy();
    });

    expect(screen.getAllByText('Soon')).toHaveLength(facebook.features.length);
  });

  it('leaves the active global features usable', async () => {
    mockedGetActiveSite.mockResolvedValue(null);
    render(<Popup />);

    await waitFor(() => {
      expect(screen.getByText('All websites')).toBeTruthy();
    });

    const row = screen.getByText('Block Meta tracking pixels').closest('label');
    const input = row?.querySelector('input[role="switch"]');
    expect((input as HTMLInputElement).disabled).toBe(false);
  });

  it('disables every toggle when protection is paused', async () => {
    mockedGetActiveSite.mockResolvedValue(null);
    render(<Popup />);

    await waitFor(() => {
      expect(screen.getByText('Protection on')).toBeTruthy();
    });

    const master = screen.getAllByRole('switch')[0] as HTMLInputElement;
    master.click();

    await waitFor(() => {
      expect(screen.getByText('Protection paused')).toBeTruthy();
    });

    for (const input of screen.getAllByRole('switch').slice(1)) {
      expect((input as HTMLInputElement).disabled).toBe(true);
    }
  });
});
```

The third and fourth tests are the point of this file. If `renderFeature` ever stops deriving
`disabled` and `badge` from `feature.status`, they fail immediately.

- [ ] **Step 2: Run the test to see it fail**

Run: `pnpm test tests/unit/ui/Popup.test.tsx`
Expected: FAIL. The exact failure depends on how the mock resolves; a missing module or an
unmocked `getActiveSite` reaching `browser.tabs` are both plausible first errors.

If the tests pass on the very first run, treat that as suspicious rather than lucky. Confirm the
mock is really in effect by temporarily making `getActiveSite` resolve to `instagram` and
checking that the Facebook assertions then fail. A test that passes no matter what the mock
returns is testing nothing.

- [ ] **Step 3: Make it pass**

No production change should be needed. The popup already derives `disabled` and `badge` from
`feature.status`. If a test fails for a real reason, fix the popup, not the test.

The likely adjustments are to the test itself: `vi.mock` hoisting with a top level await import
can be fiddly, and if the pattern above does not intercept, switch to importing the module
normally and using `vi.spyOn` on it. Either is fine. What is not fine is changing `Popup.tsx` to
be more mockable.

- [ ] **Step 4: Confirm it passes and prove the mock matters**

Run: `pnpm test tests/unit/ui/Popup.test.tsx`
Expected: 6 tests PASS.

Then temporarily change the mock in the third test to resolve `instagram` instead of `facebook`
and run again.
Expected: FAIL, because Instagram declares three features and Facebook declares five, so the
loop no longer finds the Facebook labels. Restore it afterwards and quote both outputs.

- [ ] **Step 5: Commit part one**

```bash
git add tests/unit/ui/Popup.test.tsx
git commit -m "test: cover the popup's planned feature rendering"
```

- [ ] **Step 6: Restore type checking for the end to end suite**

Run:
```bash
pnpm add -D @types/node
```

Then remove `tests/e2e` from the `exclude` array in `tsconfig.json`, leaving:

```json
  "exclude": ["node_modules", ".output"]
```

- [ ] **Step 7: Prove the e2e suite is now type checked**

Run: `pnpm compile`
Expected: passes.

Then introduce a deliberate type error in `tests/e2e/popup.spec.ts`, for example assigning a
number to `extensionId`, and run `pnpm compile` again.
Expected: FAIL, naming that file. Remove the error and confirm it passes again. Quote both
outputs.

Without this check you cannot tell a type checked file from an ignored one, since both report
success.

- [ ] **Step 8: Verify everything**

Run: `pnpm lint && pnpm compile && pnpm test && pnpm test:e2e`
Expected: all four succeed. Unit tests rise from 91 to 97, and the four end to end tests still
pass.

- [ ] **Step 9: Commit part two**

```bash
git add package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json
git commit -m "chore: type check the end to end suite"
```

---

## Task 14c: Guard the initial settings read

Found by the popup test added in Task 14b, which failed for a real reason rather than a flaw in
the test.

`initSettingsStore` currently does this:

```typescript
settings.value = await readSettings();
unwatch = settingsItem.watch(...);
```

Two ordering problems hide in those two lines.

**A stale read overwrites a newer change.** The assignment runs after the await. If someone flips
a toggle while the read is still in flight, `commit` sets the signal optimistically, then the
read resolves with the value from before the change and puts it straight back. The toggle visibly
flips itself off again.

**The watcher is deaf for the length of the read.** It only registers afterwards, so a storage
write completing inside that window fires no event that anyone is listening for. The signal then
stays stale until something else happens to change it.

The window is a few milliseconds in production, so this needs a click landing inside it. Unlikely,
not impossible, and the consequence is the interface showing a protection state that does not
match what is stored. That is the failure mode spec section 7 exists to prevent, so it is worth
four lines to close rather than leaving as a known race.

The fix is to register the watcher first, so nothing is missed, and to tag every commit with a
revision so the initial read can tell whether it is still the freshest thing to arrive.

**Files:**
- Modify: `src/core/settings/store.ts`
- Modify: `tests/unit/settings/store.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/settings/store.test.ts`, inside the existing `describe('settings store')`
block:

```typescript
  it('does not let a slow initial read clobber a change made while it was in flight', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const storageModule = await import('@/core/settings/storage');
    const readSpy = vi
      .spyOn(storageModule, 'readSettings')
      .mockImplementation(async () => {
        await gate;
        return DEFAULT_SETTINGS;
      });

    const init = initSettingsStore();
    await setMasterEnabled(false);
    expect(settings.value.masterEnabled).toBe(false);

    release();
    await init;

    expect(settings.value.masterEnabled).toBe(false);
    readSpy.mockRestore();
  });

  it('starts watching before the initial read resolves, so a write in that window is not missed', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const storageModule = await import('@/core/settings/storage');
    const readSpy = vi
      .spyOn(storageModule, 'readSettings')
      .mockImplementation(async () => {
        await gate;
        return DEFAULT_SETTINGS;
      });
    const watchSpy = vi.spyOn(storageModule.settingsItem, 'watch');

    const init = initSettingsStore();
    expect(watchSpy).toHaveBeenCalled();

    release();
    await init;
    readSpy.mockRestore();
    watchSpy.mockRestore();
  });
```

Both tests use a gate promise rather than a timer. A timer would make the test a race of its own,
and the thing being tested here is precisely a race.

- [ ] **Step 2: Run the tests to see them fail**

Run: `pnpm test tests/unit/settings/store.test.ts`
Expected: both new tests FAIL. The first because the stale read puts `masterEnabled` back to
true, the second because `watch` has not been called by the time the assertion runs.

- [ ] **Step 3: Write the fix**

Replace the module level state and `initSettingsStore` in `src/core/settings/store.ts`:

```typescript
let unwatch: (() => void) | undefined;
let revision = 0;

/**
 * Loads settings and starts watching storage for changes.
 *
 * Call this exactly once per document, from the root component. The signals and the watcher
 * handle are module level singletons with no reference counting, so if two components each
 * init and stop the store on their own lifecycle, the second one to unmount silently kills
 * the first one's subscription and flips `isReady` back to false underneath it.
 *
 * The watcher is registered before the read, so a write landing while the read is in flight
 * still reaches the signal. The revision check then stops that same read from overwriting a
 * change someone made while it was pending.
 *
 * Everything else should read the `settings` signal directly rather than calling this.
 */
export async function initSettingsStore(): Promise<void> {
  const startedAt = revision;

  unwatch?.();
  unwatch = settingsItem.watch((next) => {
    if (next) {
      settings.value = next;
    }
  });

  const loaded = await readSettings();
  if (revision === startedAt) {
    settings.value = loaded;
  }

  isReady.value = true;
}
```

And bump the revision in `commit`:

```typescript
async function commit(next: Settings): Promise<void> {
  const previous = settings.value;
  revision += 1;
  settings.value = next;
  try {
    await writeSettings(next);
  } catch (error) {
    settings.value = previous;
    throw error;
  }
}
```

The revision is not decremented on rollback. After a rollback the signal holds the value storage
already had, which is what the discarded read would have produced anyway, so skipping the
assignment loses nothing.

- [ ] **Step 4: Run the tests to see them pass**

Run: `pnpm test tests/unit/settings/store.test.ts`
Expected: 12 tests PASS, the previous 10 plus these 2.

- [ ] **Step 5: Prove the guard is what fixes it**

Temporarily change `if (revision === startedAt)` to `if (true)` and run the file again.
Expected: the first new test FAILS again.

Restore it and confirm the file passes. Quote both outputs. Without this, a passing run cannot
tell the guard apart from a test that would pass either way.

- [ ] **Step 6: Verify everything**

Run: `pnpm lint && pnpm compile && pnpm test && pnpm test:e2e`
Expected: all four succeed, with 99 unit tests and 4 end to end tests.

- [ ] **Step 7: Commit**

```bash
git add src/core/settings/store.ts tests/unit/settings/store.test.ts
git commit -m "fix: stop a slow initial read overwriting a newer settings change"
```

---

## Task 15: Background bootstrap and badge

The badge shows `OFF` in red only while the master switch is off. This is deliberate: a
security extension must not be silent about the fact that it is not protecting anything.

The decision lives in a pure `resolveBadge`, and `applyBadge` is the thin wrapper that talks to
the browser. Testing the pure function keeps the test independent of whether `fakeBrowser`
implements `browser.action`.

**Files:**
- Create: `src/core/badge.ts`
- Modify: `src/entrypoints/background.ts`
- Test: `tests/unit/badge.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/badge.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { resolveBadge } from '@/core/badge';
import { DEFAULT_SETTINGS, type Settings } from '@/core/settings/schema';

function withSettings(patch: Partial<Settings>): Settings {
  return { ...DEFAULT_SETTINGS, ...patch };
}

describe('resolveBadge', () => {
  it('shows nothing while protection is on', () => {
    expect(resolveBadge(DEFAULT_SETTINGS).text).toBe('');
  });

  it('shows OFF when the master switch is off', () => {
    expect(resolveBadge(withSettings({ masterEnabled: false })).text).toBe(
      'OFF',
    );
  });

  it('uses the warning colour for the OFF badge', () => {
    expect(resolveBadge(withSettings({ masterEnabled: false })).color).toBe(
      '#e41e3f',
    );
  });

  it('stays silent when the person turned the badge off, even while paused', () => {
    expect(
      resolveBadge(
        withSettings({ masterEnabled: false, showBadge: false }),
      ).text,
    ).toBe('');
  });

  it('stays silent while protection is on even with the badge enabled', () => {
    expect(resolveBadge(withSettings({ showBadge: true })).text).toBe('');
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `pnpm test tests/unit/badge.test.ts`
Expected: FAIL, cannot resolve `@/core/badge`.

- [ ] **Step 3: Write the minimal implementation**

`src/core/badge.ts`:

```typescript
import { browser } from '#imports';
import type { Settings } from './settings/schema';

const WARNING_COLOR = '#e41e3f';

export interface BadgeState {
  text: string;
  color: string;
}

export function resolveBadge(settings: Settings): BadgeState {
  const warn = settings.showBadge && !settings.masterEnabled;
  return {
    text: warn ? 'OFF' : '',
    color: WARNING_COLOR,
  };
}

export async function applyBadge(settings: Settings): Promise<void> {
  const { text, color } = resolveBadge(settings);
  await browser.action.setBadgeBackgroundColor({ color });
  await browser.action.setBadgeText({ text });
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `pnpm test tests/unit/badge.test.ts`
Expected: 5 tests PASS.

- [ ] **Step 5: Wire it into the background**

`src/entrypoints/background.ts`:

```typescript
import { defineBackground } from '#imports';
import { applyBadge } from '@/core/badge';
import { readSettings, settingsItem } from '@/core/settings/storage';

export default defineBackground(() => {
  void applyCurrentSettings();

  settingsItem.watch((next) => {
    if (next) {
      void applyBadge(next);
    }
  });
});

async function applyCurrentSettings(): Promise<void> {
  await applyBadge(await readSettings());
}
```

- [ ] **Step 6: Check it by hand**

Run: `pnpm dev`
Turn the master switch off in the popup, then close the popup.
Expected: the toolbar icon shows a red `OFF` badge. Turn it back on and the badge disappears.

- [ ] **Step 7: Commit**

```bash
git add src/core/badge.ts src/entrypoints/background.ts tests/unit/badge.test.ts
git commit -m "feat: badge warns when protection is paused"
```

---

## Task 16: Verify the build on all three browsers

This closes M1. No new code, only proof that one source tree produces three correct manifests.

**Files:** none created.

- [ ] **Step 1: Build all three**

Run: `pnpm build:all`
Expected: `.output/chrome-mv3`, `.output/edge-mv3` and `.output/firefox-mv3` all exist.

- [ ] **Step 2: Check the Chrome manifest uses a service worker**

Run:
```bash
python3 -c "
import json
m = json.load(open('.output/chrome-mv3/manifest.json'))
print('mv', m['manifest_version'])
print('bg', m['background'])
print('name', m['name'])
print('hosts', m['host_permissions'])
"
```
Expected: `mv 3`, a `background` object with a `service_worker` key, name `Privacy Guard`, and
three host patterns including Instagram.

- [ ] **Step 3: Check the Firefox manifest uses an event page and carries the gecko id**

Run:
```bash
python3 -c "
import json
m = json.load(open('.output/firefox-mv3/manifest.json'))
print('mv', m['manifest_version'])
print('bg', m['background'])
print('gecko', m.get('browser_specific_settings'))
"
```
Expected: `mv 3`, a `background` object with a `scripts` key, and
`browser_specific_settings.gecko.id` equal to `privacy-guard@nam088.dev` with
`strict_min_version` `128.0`.

- [ ] **Step 4: Check the Chrome manifest carries no Firefox only keys**

Run:
```bash
python3 -c "
import json
m = json.load(open('.output/chrome-mv3/manifest.json'))
assert 'browser_specific_settings' not in m, 'Chrome must not carry browser_specific_settings'
print('OK')
"
```
Expected: `OK`.

- [ ] **Step 5: Load it into Firefox by hand**

Open `about:debugging#/runtime/this-firefox`, choose Load Temporary Add-on, and select
`.output/firefox-mv3/manifest.json`.
Expected: it loads without error, the icon appears, the popup opens, and toggles work. Visit
`instagram.com` and confirm the Instagram section appears.

- [ ] **Step 6: Load it into Edge by hand**

Open `edge://extensions`, enable Developer mode, choose Load unpacked, and select
`.output/edge-mv3`.
Expected: it loads without error and the popup works.

- [ ] **Step 7: Mark the milestone**

```bash
git commit --allow-empty -m "chore: M1 complete, extension runs on Chrome Edge and Firefox"
```

---

## Task 17: Static ruleset blocking Meta pixels

The ruleset ships enabled in the manifest, matching the default value of `blockMetaPixel`. That
is both the sensible default and the workaround for Firefox bug 1921353, where static rulesets
fail to reload after a browser restart if none was enabled at install time.

Every rule excludes requests initiated by Meta's own sites. Without that exclusion the
extension would block the very requests the Facebook and Instagram interfaces need.

**Files:**
- Create: `public/rules/meta-pixel.json`
- Modify: `wxt.config.ts`

- [ ] **Step 1: Create the ruleset**

`public/rules/meta-pixel.json`:

```json
[
  {
    "id": 1,
    "priority": 1,
    "action": { "type": "block" },
    "condition": {
      "urlFilter": "||connect.facebook.net/",
      "resourceTypes": ["script"],
      "excludedInitiatorDomains": ["facebook.com", "messenger.com", "instagram.com"]
    }
  },
  {
    "id": 2,
    "priority": 1,
    "action": { "type": "block" },
    "condition": {
      "urlFilter": "||facebook.com/tr",
      "resourceTypes": ["image", "xmlhttprequest", "ping", "script", "sub_frame"],
      "excludedInitiatorDomains": ["facebook.com", "messenger.com", "instagram.com"]
    }
  },
  {
    "id": 3,
    "priority": 1,
    "action": { "type": "block" },
    "condition": {
      "urlFilter": "||facebook.net/signals/",
      "resourceTypes": ["script", "xmlhttprequest", "image"],
      "excludedInitiatorDomains": ["facebook.com", "messenger.com", "instagram.com"]
    }
  }
]
```

- [ ] **Step 2: Declare it in the manifest**

In `wxt.config.ts`, extend the permissions and add the ruleset declaration:

```typescript
    permissions: ['storage', 'declarativeNetRequest'],
    host_permissions: [
      '*://*.facebook.com/*',
      '*://*.messenger.com/*',
      '*://*.instagram.com/*',
    ],
    declarative_net_request: {
      rule_resources: [
        { id: 'meta-pixel', enabled: true, path: 'rules/meta-pixel.json' },
      ],
    },
```

- [ ] **Step 3: Verify the ruleset ships in the build**

Run:
```bash
pnpm build && python3 -c "
import json
m = json.load(open('.output/chrome-mv3/manifest.json'))
print(m['permissions'])
print(m['declarative_net_request'])
rules = json.load(open('.output/chrome-mv3/rules/meta-pixel.json'))
print('rule count', len(rules))
"
```
Expected: permissions include `declarativeNetRequest`, the rule resource is declared with
`enabled` true, and the rule count is 3.

- [ ] **Step 4: Confirm by hand that pixels are blocked**

Run: `pnpm dev`
Open any news site that uses the Meta pixel, open DevTools, go to Network and filter on
`facebook`.
Expected: requests to `connect.facebook.net` and `facebook.com/tr` show as blocked.

- [ ] **Step 5: Confirm by hand that Facebook and Instagram still work**

Open `facebook.com`, scroll the feed, open a conversation and send a test message. Then open
`instagram.com`, scroll, and open direct messages.
Expected: both work normally, and the Network panel shows none of their own requests blocked.

This step is the one that catches a missing `excludedInitiatorDomains`. Do not skip it.

- [ ] **Step 6: Commit**

```bash
git add public/rules/meta-pixel.json wxt.config.ts
git commit -m "feat: static ruleset blocking Meta pixels on third party sites"
```

---

## Task 18: Map settings onto enabled rulesets

**Files:**
- Create: `src/core/rulesets.ts`
- Modify: `src/entrypoints/background.ts`
- Test: `tests/unit/rulesets.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/rulesets.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { RULESET_IDS, resolveRulesets } from '@/core/rulesets';
import { DEFAULT_SETTINGS, type Settings } from '@/core/settings/schema';

function withFeature(key: string, value: boolean): Settings {
  return {
    ...DEFAULT_SETTINGS,
    features: { ...DEFAULT_SETTINGS.features, [key]: value },
  };
}

describe('resolveRulesets', () => {
  it('enables the pixel ruleset by default', () => {
    const plan = resolveRulesets(DEFAULT_SETTINGS);
    expect(plan.enable).toContain(RULESET_IDS.metaPixel);
    expect(plan.disable).not.toContain(RULESET_IDS.metaPixel);
  });

  it('leaves the fbclid ruleset disabled by default', () => {
    const plan = resolveRulesets(DEFAULT_SETTINGS);
    expect(plan.disable).toContain(RULESET_IDS.fbclid);
  });

  it('disables the pixel ruleset when the feature is turned off', () => {
    const plan = resolveRulesets(withFeature('global.blockMetaPixel', false));
    expect(plan.disable).toContain(RULESET_IDS.metaPixel);
    expect(plan.enable).not.toContain(RULESET_IDS.metaPixel);
  });

  it('enables the fbclid ruleset when the feature is turned on', () => {
    const plan = resolveRulesets(withFeature('global.stripFbclid', true));
    expect(plan.enable).toContain(RULESET_IDS.fbclid);
  });

  it('disables everything when the master switch is off', () => {
    const plan = resolveRulesets({
      ...DEFAULT_SETTINGS,
      masterEnabled: false,
    });
    expect(plan.enable).toEqual([]);
    expect(plan.disable).toContain(RULESET_IDS.metaPixel);
    expect(plan.disable).toContain(RULESET_IDS.fbclid);
  });

  it('never puts the same ruleset in both lists', () => {
    const cases: Settings[] = [
      DEFAULT_SETTINGS,
      { ...DEFAULT_SETTINGS, masterEnabled: false },
      withFeature('global.blockMetaPixel', false),
      withFeature('global.stripFbclid', true),
    ];
    for (const settings of cases) {
      const { enable, disable } = resolveRulesets(settings);
      expect(enable.filter((id) => disable.includes(id))).toEqual([]);
    }
  });

  it('accounts for every known ruleset in every case', () => {
    const all = Object.values(RULESET_IDS);
    const cases: Settings[] = [
      DEFAULT_SETTINGS,
      { ...DEFAULT_SETTINGS, masterEnabled: false },
    ];
    for (const settings of cases) {
      const { enable, disable } = resolveRulesets(settings);
      expect([...enable, ...disable].sort()).toEqual([...all].sort());
    }
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `pnpm test tests/unit/rulesets.test.ts`
Expected: FAIL, cannot resolve `@/core/rulesets`.

- [ ] **Step 3: Write the minimal implementation**

`src/core/rulesets.ts`:

```typescript
import { browser } from '#imports';
import { isFeatureOn, type Settings } from './settings/schema';

export const RULESET_IDS = {
  metaPixel: 'meta-pixel',
  fbclid: 'fbclid',
} as const;

export type RulesetId = (typeof RULESET_IDS)[keyof typeof RULESET_IDS];

const RULESET_FEATURE: Record<RulesetId, string> = {
  [RULESET_IDS.metaPixel]: 'global.blockMetaPixel',
  [RULESET_IDS.fbclid]: 'global.stripFbclid',
};

export interface RulesetPlan {
  enable: RulesetId[];
  disable: RulesetId[];
}

export function resolveRulesets(settings: Settings): RulesetPlan {
  const enable: RulesetId[] = [];
  const disable: RulesetId[] = [];

  for (const id of Object.values(RULESET_IDS)) {
    if (isFeatureOn(settings, RULESET_FEATURE[id])) {
      enable.push(id);
    } else {
      disable.push(id);
    }
  }

  return { enable, disable };
}

export async function applyRulesets(settings: Settings): Promise<void> {
  const { enable, disable } = resolveRulesets(settings);
  await browser.declarativeNetRequest.updateEnabledRulesets({
    enableRulesetIds: enable,
    disableRulesetIds: disable,
  });
}
```

Note that `resolveRulesets` already returns `fbclid`, but that ruleset is only declared in the
manifest in Task 19. Until then `applyRulesets` will reject because the id does not exist, so
Step 4 wraps the call in a try and catch. That wrapper stays afterwards, since a rejected
ruleset update must never take the background script down.

- [ ] **Step 4: Wire it into the background**

`src/entrypoints/background.ts`:

```typescript
import { defineBackground } from '#imports';
import { applyBadge } from '@/core/badge';
import { applyRulesets } from '@/core/rulesets';
import type { Settings } from '@/core/settings/schema';
import { readSettings, settingsItem } from '@/core/settings/storage';

export default defineBackground(() => {
  void bootstrap();

  settingsItem.watch((next) => {
    if (next) {
      void apply(next);
    }
  });
});

async function bootstrap(): Promise<void> {
  await apply(await readSettings());
}

async function apply(settings: Settings): Promise<void> {
  await applyBadge(settings);
  try {
    await applyRulesets(settings);
  } catch (error) {
    console.warn('[privacy-guard] could not apply rulesets', error);
  }
}
```

- [ ] **Step 5: Run the test to see it pass**

Run: `pnpm test tests/unit/rulesets.test.ts && pnpm compile && pnpm lint`
Expected: 7 tests PASS, and both checks succeed.

- [ ] **Step 6: Check it by hand**

Run: `pnpm dev`
With DevTools Network open on a site that uses the Meta pixel, turn `Block Meta tracking
pixels` off in the popup and reload the page.
Expected: the requests now go through. Turn it back on, reload, and they are blocked again.

Turn the master switch off and reload.
Expected: the requests go through, because the master switch disables every ruleset.

- [ ] **Step 7: Commit**

```bash
git add src/core/rulesets.ts src/entrypoints/background.ts tests/unit/rulesets.test.ts
git commit -m "feat: enable and disable rulesets from settings"
```

---

## Task 19: Strip fbclid behind an optional permission

A `declarativeNetRequest` redirect rule needs host permission for the URL being rewritten.
Requesting `<all_urls>` at install time would make the install prompt frightening and work
against spec section 6. Instead the permission is requested in the same click that turns the
feature on.

If the person declines, the setting must stay off. An interface that shows a feature as enabled
while it is not running is the exact dishonesty spec section 7 forbids.

**Files:**
- Create: `public/rules/fbclid.json`
- Create: `src/core/permissions.ts`
- Modify: `wxt.config.ts`
- Modify: `src/entrypoints/popup/Popup.tsx`
- Test: `tests/unit/permissions.test.ts`

- [ ] **Step 1: Create the ruleset**

`public/rules/fbclid.json`:

```json
[
  {
    "id": 1,
    "priority": 1,
    "action": {
      "type": "redirect",
      "redirect": {
        "transform": {
          "queryTransform": {
            "removeParams": ["fbclid"]
          }
        }
      }
    },
    "condition": {
      "urlFilter": "fbclid=",
      "resourceTypes": ["main_frame", "sub_frame"],
      "excludedInitiatorDomains": ["facebook.com", "messenger.com", "instagram.com"]
    }
  }
]
```

- [ ] **Step 2: Declare it in the manifest**

In `wxt.config.ts`, add the optional permission and the second ruleset. It ships disabled,
because at install time the permission it needs has not been granted:

```typescript
    permissions: ['storage', 'declarativeNetRequest'],
    host_permissions: [
      '*://*.facebook.com/*',
      '*://*.messenger.com/*',
      '*://*.instagram.com/*',
    ],
    optional_host_permissions: ['<all_urls>'],
    declarative_net_request: {
      rule_resources: [
        { id: 'meta-pixel', enabled: true, path: 'rules/meta-pixel.json' },
        { id: 'fbclid', enabled: false, path: 'rules/fbclid.json' },
      ],
    },
```

- [ ] **Step 3: Write the failing test**

`tests/unit/permissions.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from '#imports';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  ALL_URLS,
  ensureAllUrlsPermission,
  hasAllUrlsPermission,
} from '@/core/permissions';

describe('optional permission for all websites', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('reports false when the permission is not granted', async () => {
    vi.spyOn(browser.permissions, 'contains').mockResolvedValue(false);
    await expect(hasAllUrlsPermission()).resolves.toBe(false);
  });

  it('reports true when the permission is granted', async () => {
    vi.spyOn(browser.permissions, 'contains').mockResolvedValue(true);
    await expect(hasAllUrlsPermission()).resolves.toBe(true);
  });

  it('does not ask again when the permission is already granted', async () => {
    vi.spyOn(browser.permissions, 'contains').mockResolvedValue(true);
    const request = vi
      .spyOn(browser.permissions, 'request')
      .mockResolvedValue(true);
    await expect(ensureAllUrlsPermission()).resolves.toBe(true);
    expect(request).not.toHaveBeenCalled();
  });

  it('asks for the permission when it is missing', async () => {
    vi.spyOn(browser.permissions, 'contains').mockResolvedValue(false);
    const request = vi
      .spyOn(browser.permissions, 'request')
      .mockResolvedValue(true);
    await expect(ensureAllUrlsPermission()).resolves.toBe(true);
    expect(request).toHaveBeenCalledWith({ origins: ALL_URLS });
  });

  it('reports false when the person declines', async () => {
    vi.spyOn(browser.permissions, 'contains').mockResolvedValue(false);
    vi.spyOn(browser.permissions, 'request').mockResolvedValue(false);
    await expect(ensureAllUrlsPermission()).resolves.toBe(false);
  });

  it('reports false rather than throwing when the API rejects', async () => {
    vi.spyOn(browser.permissions, 'contains').mockRejectedValue(
      new Error('no'),
    );
    await expect(ensureAllUrlsPermission()).resolves.toBe(false);
  });
});
```

- [ ] **Step 4: Run the test to see it fail**

Run: `pnpm test tests/unit/permissions.test.ts`
Expected: FAIL, cannot resolve `@/core/permissions`.

- [ ] **Step 5: Write the minimal implementation**

`src/core/permissions.ts`:

```typescript
import { browser } from '#imports';

export const ALL_URLS = ['<all_urls>'];

export async function hasAllUrlsPermission(): Promise<boolean> {
  return browser.permissions.contains({ origins: ALL_URLS });
}

export async function ensureAllUrlsPermission(): Promise<boolean> {
  try {
    if (await hasAllUrlsPermission()) {
      return true;
    }
    return await browser.permissions.request({ origins: ALL_URLS });
  } catch {
    return false;
  }
}
```

- [ ] **Step 6: Run the test to see it pass**

Run: `pnpm test tests/unit/permissions.test.ts`
Expected: 6 tests PASS.

- [ ] **Step 7: Wire it into the popup**

Overwrite `src/entrypoints/popup/Popup.tsx` with the version below. The only change from Task
14 is `handleFeatureChange`, which intercepts turning `global.stripFbclid` on.

```tsx
import { useEffect, useState } from 'preact/hooks';
import { getActiveSite } from '@/core/activeSite';
import { ensureAllUrlsPermission } from '@/core/permissions';
import {
  initSettingsStore,
  setFeature,
  setMasterEnabled,
  settings,
  stopSettingsStore,
} from '@/core/settings/store';
import { featureKey, type Feature, type SiteModule } from '@/sites/types';
import { GLOBAL_FEATURES } from '@/trackers/features';
import { Section } from '@/ui/components/Section';
import { Toggle } from '@/ui/components/Toggle';

const NEEDS_ALL_URLS = 'global.stripFbclid';

export function Popup() {
  const [site, setSite] = useState<SiteModule | null>(null);
  const [siteResolved, setSiteResolved] = useState(false);

  useEffect(() => {
    void initSettingsStore();
    return () => stopSettingsStore();
  }, []);

  useEffect(() => {
    void getActiveSite().then((resolved) => {
      setSite(resolved);
      setSiteResolved(true);
    });
  }, []);

  const current = settings.value;
  const master = current.masterEnabled;

  useEffect(() => {
    const root = document.documentElement;
    if (current.theme === 'system') {
      delete root.dataset.theme;
    } else {
      root.dataset.theme = current.theme;
    }
  }, [current.theme]);

  async function handleFeatureChange(key: string, next: boolean): Promise<void> {
    if (key === NEEDS_ALL_URLS && next) {
      const granted = await ensureAllUrlsPermission();
      if (!granted) {
        return;
      }
    }
    await setFeature(key, next);
  }

  function renderFeature(scope: string, feature: Feature) {
    const key = featureKey(scope, feature.id);
    const planned = feature.status === 'planned';
    return (
      <Toggle
        key={key}
        label={feature.label}
        description={feature.description}
        badge={planned ? 'Soon' : undefined}
        checked={current.features[key] ?? feature.defaultEnabled}
        disabled={!master || planned}
        onChange={(next) => void handleFeatureChange(key, next)}
      />
    );
  }

  return (
    <main class="w-[360px] bg-surface text-text">
      <header class="flex items-center justify-between border-b border-border px-3 py-3">
        <div>
          <h1 class="text-sm font-semibold">Privacy Guard</h1>
          <p class="text-[11px] text-text-muted">
            {master ? 'Protection on' : 'Protection paused'}
          </p>
        </div>
        <Toggle
          label="Protection"
          checked={master}
          onChange={(next) => void setMasterEnabled(next)}
        />
      </header>

      {site ? (
        <Section title={site.displayName}>
          {site.features.map((feature) =>
            renderFeature(site.id, feature),
          )}
        </Section>
      ) : siteResolved ? (
        <p class="border-b border-border px-3 py-3 text-[11px] leading-snug text-text-muted">
          Open Facebook, Messenger or Instagram to see the controls for that
          site. The settings below apply everywhere.
        </p>
      ) : null}

      <Section title="All websites">
        {GLOBAL_FEATURES.map((feature) =>
          renderFeature('global', feature),
        )}
      </Section>

      <footer class="border-t border-border bg-surface-muted px-3 py-2 text-[11px] leading-snug text-text-muted">
        Works only on your own session. Privacy Guard sends no data anywhere.
      </footer>
    </main>
  );
}
```

- [ ] **Step 8: Check everything still passes**

Run: `pnpm compile && pnpm lint && pnpm test && pnpm build`
Expected: all four succeed.

- [ ] **Step 9: Check it by hand on Chrome**

Run: `pnpm dev`
In the popup, turn `Strip fbclid from links` on.
Expected: Chrome shows a permission prompt asking for access to all sites. Accept it, then open
any link carrying `?fbclid=abc123`.
Expected: the address bar shows the cleaned URL with no `fbclid`.

Now turn the toggle off, turn it on again, and decline the prompt.
Expected: the toggle returns to off rather than showing as on while doing nothing.

- [ ] **Step 10: Check it by hand on Firefox**

Firefox added `optional_host_permissions` later than Chrome and its prompt looks different, so
this must be tested separately rather than inferred from the Chrome result.

Run: `pnpm build:firefox`
Load `.output/firefox-mv3` through `about:debugging#/runtime/this-firefox`, open the popup and
turn the toggle on.
Expected: Firefox shows its own permission prompt and the feature works after accepting.

If Firefox refuses to load the manifest because of `optional_host_permissions`, switch that
build to `optional_permissions: ['<all_urls>']` using the existing `browser === 'firefox'`
branch in `wxt.config.ts`, and record which key each browser needs in the README.

- [ ] **Step 11: Commit**

```bash
git add public/rules/fbclid.json src/core/permissions.ts wxt.config.ts src/entrypoints/popup/Popup.tsx tests/unit/permissions.test.ts
git commit -m "feat: strip fbclid behind a permission requested at the moment of use"
```

---

## Task 20: End to end tests with Playwright

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/popup.spec.ts`
- Modify: `package.json`

- [ ] **Step 1: Install Playwright**

Run:
```bash
pnpm add -D @playwright/test@^1.63.0
pnpm exec playwright install chromium
```
Expected: Chromium installs.

- [ ] **Step 2: Create playwright.config.ts**

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  workers: 1,
});
```

`workers: 1` matters. These tests share one persistent browser profile, and running them in
parallel would have them fighting over the same extension storage.

- [ ] **Step 3: Write the end to end test**

`tests/e2e/popup.spec.ts`:

```typescript
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
  await expect(page.getByText('All websites')).toBeVisible();
  await expect(page.getByText('Block Meta tracking pixels')).toBeVisible();
  await page.close();
});

test('has the master switch plus the two global toggles', async () => {
  const page = await openPopup();
  await expect(page.getByRole('switch')).toHaveCount(3);
  await page.close();
});

test('pausing protection disables every other toggle', async () => {
  const page = await openPopup();

  await page.getByRole('switch').first().uncheck({ force: true });

  await expect(page.getByText('Protection paused')).toBeVisible();
  await expect(page.getByRole('switch').nth(1)).toBeDisabled();

  await page.getByRole('switch').first().check({ force: true });
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
```

The popup opens on an extension page rather than on a Facebook tab, so no site section renders
and the switch count is the master switch plus the two global features. Testing against a real
Facebook tab would need an account and would be hopelessly flaky, which is why spec section 8
rules it out.

- [ ] **Step 4: Add the script**

In `package.json`, add to `scripts`:

```json
    "test:e2e": "pnpm build && playwright test",
```

- [ ] **Step 5: Run the end to end tests**

Run: `pnpm test:e2e`
Expected: 4 tests PASS.

If the last test fails intermittently, the cause is the popup closing before the storage write
resolves. Fix it by awaiting the assertion on the first page, as written above, rather than by
adding a sleep. A sleep hides the race instead of removing it.

- [ ] **Step 6: Commit**

```bash
git add playwright.config.ts tests/e2e package.json pnpm-lock.yaml
git commit -m "test: end to end coverage of the popup with a loaded extension"
```

---

## Task 21: README, privacy policy and the final manual pass

This closes M2.

**Files:**
- Create: `README.md`
- Create: `docs/PRIVACY.md`

- [ ] **Step 1: Write the README**

`README.md`:

```markdown
# Privacy Guard

A browser extension that lets you control the signals your social accounts send on your
behalf, and blocks social tracking code across the rest of the web.

One extension, many platforms. Facebook and Instagram ship first.

## Status

In development. Milestones M1 and M2 are complete: the cross browser foundation and tracker
blocking.

## What works today

* Blocks Meta tracking pixels on third party websites
* Strips the `fbclid` tracking parameter from links, behind an optional permission
* A master switch, and a badge that warns you when protection is paused

## What is coming

Hiding read receipts, typing indicators and story views on Facebook and Instagram, stopping
the News Feed reloading, and hiding suggested posts. These toggles already appear in the
interface marked `Soon`, and they are disabled until the interception work lands in M3 and M4.
They are deliberately inert rather than pretending to protect you.

## Requirements

Node 20 or newer, pnpm 9 or newer.

## Development

    pnpm install
    pnpm dev              # Chrome
    pnpm dev:firefox      # Firefox

## Building

    pnpm build:all        # Chrome, Edge, Firefox
    pnpm zip              # package for the Chrome Web Store
    pnpm zip:firefox      # package for addons.mozilla.org

## Checks

    pnpm lint             # ESLint, including the architectural import boundaries
    pnpm compile          # TypeScript
    pnpm test             # unit tests
    pnpm test:e2e         # end to end, needs a graphical session

## Adding a platform

Create a directory under `src/sites`, export a `SiteModule`, and add it to `SITE_MODULES` in
`src/sites/registry.ts`. Settings, the popup and the background script need no changes. The
tests in `tests/unit/sites/features.test.ts` will hold the new module to the same invariants
as the existing ones.

## Browser support

Chrome and Edge share one Manifest V3 build. Firefox needs version 128 or newer, because the
extension uses MAIN world content scripts.

## Important note

Hiding read receipts, typing indicators and story views means interfering with Meta's
protocols, which runs against their terms of service.

The extension only changes the behaviour of your own browser on your own session. It touches
nobody else's data, collects nothing, and transmits nothing. Even so, there is a real risk that
an account gets rate limited or hits a checkpoint. Decide for yourself before enabling those
features.

Meta can change a protocol at any time and silently disable a feature. When that happens the
extension shows a warning and you will need to update.
```

- [ ] **Step 2: Write the privacy policy**

`docs/PRIVACY.md`:

```markdown
# Privacy policy

Last updated: 2026-09-05

## What we collect

Nothing.

## The detail

Privacy Guard collects no personal data, stores nothing on any server, and transmits nothing.
The extension makes no network requests to us or to any third party. There is no analytics, no
crash reporting, and no remotely delivered configuration.

Your settings live in your browser's `storage.local`, on your own machine. Uninstall the
extension and they are gone.

## Permissions and why each one is needed

* `storage`: remembers which features you turned on, on your own machine.
* `declarativeNetRequest`: blocks tracking code using rules declared in advance. The browser
  applies these rules itself, so the extension never sees the contents of your requests.
* Access to `facebook.com`, `messenger.com` and `instagram.com`: runs the protection logic on
  those sites, and lets the popup tell which of them you are currently looking at.
* Access to all websites, optional: requested only when you enable `Strip fbclid from links`,
  because rewriting a link requires permission for the destination site. Decline it and every
  other feature keeps working.

## Contact

Open an issue in the project repository.
```

- [ ] **Step 3: Run every check**

Run: `pnpm lint && pnpm compile && pnpm test && pnpm build:all`
Expected: everything passes and all three builds succeed.

- [ ] **Step 4: The final manual checklist**

Do this on Chrome first, then repeat on Firefox and on Edge.

1. Install the extension from the matching output directory.
2. Open the popup on an unsupported site. Confirm the All websites section shows two toggles,
   with pixel blocking on and fbclid stripping off.
3. Open `facebook.com`. Confirm a Facebook section appears with five toggles, all disabled and
   badged `Soon`.
4. Open `instagram.com`. Confirm an Instagram section appears with three toggles, all badged
   `Soon`.
5. Open a news site that uses the Meta pixel with the Network panel open. Confirm requests to
   `connect.facebook.net` are blocked.
6. Turn `Block Meta tracking pixels` off, reload, and confirm the requests go through.
7. Turn it back on, reload, and confirm they are blocked again.
8. Turn the master switch off. Confirm the badge shows a red `OFF` and pixel requests go
   through.
9. Turn the master switch back on and confirm the badge disappears.
10. Open `facebook.com` and `instagram.com`, scroll, open a conversation, send a test message.
    Confirm there are no extension errors in the console and none of the site's own requests
    are blocked.
11. Restart the browser completely, then repeat step 5. This checks Firefox bug 1921353
    directly, and it is the reason the pixel ruleset ships enabled in the manifest.

- [ ] **Step 5: Commit the milestone**

```bash
git add README.md docs/PRIVACY.md
git commit -m "docs: README, privacy policy, and M2 complete"
```

## Task 21b: Close the final review findings

The branch review found three things. Two are small. One matters, and it was found the only way
it could have been found: by deliberately breaking the code and watching every test stay green.

### The one that matters

`Popup.tsx` gates turning on `stripFbclid` behind a permission request and returns early without
calling `setFeature` when the request is declined. That early return is the entire implementation
of the spec's promise that the interface never shows a feature as on while it is not running.

The reviewer replaced it with a fire and forget call, so the setting would be stored as enabled
whether or not permission was granted. All 117 unit tests and all 4 end to end tests still passed.

`permissions.ts` is tested in isolation. `setFeature` is tested in isolation. Nothing tested the
wire between them, which is where the promise actually lives.

### The boundary the spec describes is not the boundary that matters

Spec section 4.2 says `core` depends on `sites` for types only. That is not what was built:
`schema.ts` imports the value `SITE_MODULES` and `activeSite.ts` imports the function
`findSiteForUrl`. Both are correct and necessary, so the spec sentence is what is wrong.

The boundary genuinely worth enforcing runs the other way. A site module must stay pure data plus
site specific logic. The moment one imports the settings layer, adding a platform stops being
additive and the registry's whole reason for existing is gone. Nothing currently prevents that.

### One export with no caller

`hasAllUrlsPermission` is exported and tested, but only `ensureAllUrlsPermission` calls it, from
inside the same file. It exists for its own test. M3 may want it when it re validates a permission
that was revoked out of band, and if so M3 can export it again in one word. Keeping an export
against a future that has not arrived is the speculative scaffolding this plan refused everywhere
else.

**Files:**
- Modify: `tests/unit/ui/Popup.test.tsx`
- Modify: `src/core/permissions.ts`
- Modify: `tests/unit/permissions.test.ts`
- Modify: `eslint.config.js`
- Modify: `docs/superpowers/specs/2026-09-05-privacy-guard-design.md`

- [ ] **Step 1: Write the failing test for the permission gate**

Append to `tests/unit/ui/Popup.test.tsx`. Add the mock alongside the existing `getActiveSite`
mock at the top of the file:

```tsx
vi.mock('@/core/permissions', () => ({
  ensureAllUrlsPermission: vi.fn(),
}));

const { ensureAllUrlsPermission } = await import('@/core/permissions');
const mockedEnsurePermission = vi.mocked(ensureAllUrlsPermission);
```

Add `mockedEnsurePermission.mockReset();` to the existing `beforeEach`, then add these tests:

```tsx
  it('leaves the setting off when the permission is declined', async () => {
    mockedGetActiveSite.mockResolvedValue(null);
    mockedEnsurePermission.mockResolvedValue(false);
    const { settings } = await import('@/core/settings/store');
    render(<Popup />);

    await waitFor(() => {
      expect(screen.getByText('Strip fbclid from links')).toBeTruthy();
    });

    const row = screen.getByText('Strip fbclid from links').closest('label');
    const input = row?.querySelector('input[role="switch"]') as HTMLInputElement;
    input.click();

    await waitFor(() => {
      expect(mockedEnsurePermission).toHaveBeenCalled();
    });
    expect(settings.value.features['global.stripFbclid']).toBe(false);
  });

  it('turns the setting on when the permission is granted', async () => {
    mockedGetActiveSite.mockResolvedValue(null);
    mockedEnsurePermission.mockResolvedValue(true);
    const { settings } = await import('@/core/settings/store');
    render(<Popup />);

    await waitFor(() => {
      expect(screen.getByText('Strip fbclid from links')).toBeTruthy();
    });

    const row = screen.getByText('Strip fbclid from links').closest('label');
    const input = row?.querySelector('input[role="switch"]') as HTMLInputElement;
    input.click();

    await waitFor(() => {
      expect(settings.value.features['global.stripFbclid']).toBe(true);
    });
  });

  it('does not ask for permission for any other feature', async () => {
    mockedGetActiveSite.mockResolvedValue(null);
    mockedEnsurePermission.mockResolvedValue(true);
    render(<Popup />);

    await waitFor(() => {
      expect(screen.getByText('Block Meta tracking pixels')).toBeTruthy();
    });

    const row = screen.getByText('Block Meta tracking pixels').closest('label');
    const input = row?.querySelector('input[role="switch"]') as HTMLInputElement;
    input.click();

    await waitFor(() => {
      expect(mockedEnsurePermission).not.toHaveBeenCalled();
    });
  });
```

The second and third tests exist so the first cannot pass by the toggle simply never working. A
test that only proves nothing happened is satisfied by code that does nothing at all.

- [ ] **Step 2: Confirm the tests pass, then prove they would catch the regression**

Run: `pnpm test tests/unit/ui/Popup.test.tsx`
Expected: 9 tests PASS, the previous 6 plus these 3.

Now reproduce the reviewer's mutation. In `Popup.tsx`, replace the gate in `handleFeatureChange`:

```tsx
    if (key === NEEDS_ALL_URLS && next) {
      void ensureAllUrlsPermission();
    }
    await setFeature(key, next);
```

Run the file again.
Expected: FAIL, on the declined test, because the setting is now stored as true.

Restore `Popup.tsx` exactly as it was and confirm the file passes again. Quote both outputs.
Without this the new tests are only assumed to be load bearing.

- [ ] **Step 3: Stop exporting `hasAllUrlsPermission`**

In `src/core/permissions.ts`, drop the `export` keyword from `hasAllUrlsPermission` so it becomes
module private. Leave `ALL_URLS` and `ensureAllUrlsPermission` exported.

In `tests/unit/permissions.test.ts`, delete the two tests that call `hasAllUrlsPermission`
directly. Its behaviour is still covered, through `ensureAllUrlsPermission`, by the tests that
assert the request is skipped when the permission is already held and made when it is not.

- [ ] **Step 4: Enforce the boundary that matters**

In `eslint.config.js`, add a third block after the existing two:

```javascript
  {
    files: ['src/sites/**/*.ts', 'src/trackers/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/core/**', '@/core/*', '~/core/*'],
              message:
                'A site module stays pure data plus site logic. Depending on the settings layer makes adding a platform stop being additive.',
            },
            ENTRYPOINT_IMPORTS,
          ],
        },
      ],
    },
  },
```

- [ ] **Step 5: Prove the new rule fires**

Run:
```bash
cat > src/sites/boundary-probe.ts <<'PROBEEOF'
import { DEFAULT_SETTINGS } from '@/core/settings/schema';

export const probe = DEFAULT_SETTINGS;
PROBEEOF
pnpm exec eslint src/sites/boundary-probe.ts; echo "exit=$?"
rm -f src/sites/boundary-probe.ts
```
Expected: an error naming `no-restricted-imports` with the site module message, and `exit=1`.

If it exits 0 the rule does not match and is worse than nothing, because it looks like protection
while providing none. Fix the pattern until it fires.

- [ ] **Step 6: Correct the spec sentence**

In `docs/superpowers/specs/2026-09-05-privacy-guard-design.md`, section 4.2 currently reads:

```
The direction is always outward to inward. Entrypoints depend on core, sites and ui. Core
depends on sites for types only. Nothing depends on entrypoints.
```

Replace with:

```
The direction is always outward to inward. Entrypoints depend on core, sites and ui. Core depends
on the site registry, for the feature declarations its settings schema is built from. Site modules
depend on nothing but their own types, which is what keeps adding a platform additive. Nothing
depends on entrypoints.
```

Then add to the end of section 4.3:

```
A third rule keeps site modules from importing the settings layer. That is the boundary that
decides whether adding a platform stays additive, and it was unenforced until the branch review
pointed out that the spec described a different boundary than the one that mattered.
```

- [ ] **Step 7: Verify everything**

Run: `pnpm lint && pnpm compile && pnpm test && pnpm test:e2e`
Expected: all four succeed, with 118 unit tests, and the 4 end to end tests still passing.

The unit count goes up by 3 for the new popup tests and down by 2 for the deleted permission
tests, from 117 to 118.

- [ ] **Step 8: Commit**

```bash
git add src/core/permissions.ts tests/unit/permissions.test.ts tests/unit/ui/Popup.test.tsx eslint.config.js docs/superpowers/specs/2026-09-05-privacy-guard-design.md
git commit -m "fix: test the permission gate and enforce the site module boundary"
```
