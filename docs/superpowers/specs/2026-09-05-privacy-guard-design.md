# Privacy Guard: Design

Date: 2026-09-05
Status: approved, ready for implementation planning
Supersedes: the earlier single site "FB Security" design of the same date

## 1. Goal

Build one browser extension that lets people control the signals their social media
clients send on their behalf, and that blocks social tracking code across the rest of the web.

The extension is Manifest V3, written in TypeScript, and runs on Chrome, Edge and Firefox.

The product is deliberately not tied to a single platform. Facebook and Instagram ship in v1,
and adding a third platform later must mean adding a directory, not editing the core.

### 1.1 Two kinds of feature

This distinction drives the entire architecture.

**Site features** depend on one platform's internal protocol. Hiding a read receipt means
recognising and dropping a specific MQTT frame that only Messenger sends. These belong to a
site module and are meaningless outside it.

**Global features** already apply to the whole web. Blocking the Meta pixel affects every
news site a person visits, not Facebook itself. These belong to no site.

Mixing the two is what makes single platform extensions impossible to extend. Keeping them
apart is what makes a second platform cheap.

### 1.2 Features in scope for v1

Site features, Facebook:

1. Hide read receipts in Messenger.
2. Hide the typing indicator.
3. Hide story view receipts.
4. Stop the News Feed reloading when the tab regains focus.
5. Hide suggested posts.
6. Send a read receipt manually for the open conversation.

Site features, Instagram:

7. Hide read receipts in direct messages.
8. Hide the typing indicator in direct messages.
9. Hide story view receipts.
10. Send a read receipt manually for the open conversation.

Global features:

11. Block Meta tracking pixels on third party websites.
12. Strip the `fbclid` tracking parameter from links.

### 1.3 Out of scope for v1

Account privacy auditing, phishing detection, cookie and session isolation, config sync
across devices, Safari support, mobile web layouts, and any platform beyond Facebook and
Instagram.

### 1.4 Success criteria

The popup opens in under 50 milliseconds. Each UI screen ships under 60KB gzipped. With every
feature enabled, Messenger and Instagram direct messages still send and receive normally, and
the extension contributes no JavaScript errors to the page console.

Adding a third platform requires creating one directory under `src/sites` and registering it.
It must require no change to settings storage, to the popup, or to the background script.

## 2. Technology choices

| Area | Choice | Why |
| :-- | :-- | :-- |
| Build framework | WXT | Generates a per browser manifest from one source tree, ships HMR and TypeScript, and provides the `injectScript` and `createShadowRootUi` helpers this project needs |
| Language | TypeScript, strict | Catches errors at the boundaries between layers, where data crosses realms |
| UI | Preact with @preact/signals | About 4KB gzipped at runtime, React like syntax so the talent pool and the examples are large, and `preact/compat` keeps the React ecosystem available if a screen ever needs it |
| Styling | Tailwind v4, CSS first config | No runtime, and the emitted CSS contains only classes actually used |
| Components | Six hand written components | Toggle, Section, Card, StatTile, Sparkline, Banner. Enough for all screens, and the smallest possible bundle |
| Charts | Hand drawn SVG | A 30 bar column chart is roughly 60 lines of SVG. The lightest charting library still adds more than 40KB |
| Validation | zod | Settings schema and versioned migrations |
| Testing | vitest for unit, Playwright for E2E | vitest shares Vite with WXT, Playwright can load a built extension |
| Lint | ESLint flat config with typescript-eslint | Enforces the architectural import boundaries in section 4.3 |

## 3. Architecture

### 3.1 Four layers

**Layer 1, the MAIN world interceptor.** Entrypoint `page_hook.ts`, running at
`document_start`. A normal content script lives in an isolated world, so it sees its own copy
of `window.WebSocket` rather than the one the page uses. Dropping a frame requires running in
the same realm as the page. This layer patches four things: `WebSocket.prototype.send`,
`window.fetch`, `XMLHttpRequest.prototype.send`, and the `document.visibilityState` getter.

This layer must never touch an extension API. That is a hard limit of the MAIN world on both
Chromium and Firefox, not a stylistic preference.

Patching the top frame is not enough on current Messenger. The socket that carries read receipts
runs inside a worker loaded through an iframe on `fbsbx.com`, so a hook installed only on the
page's own `window.WebSocket` never sees those frames at all. The content script therefore
declares `all_frames: true`, and the manifest needs a host permission for `fbsbx.com`. Section
3.7 records how far this has been verified.

**Layer 2, the isolated world content script.** A two way bridge. It reads settings from
`storage.local`, pushes them down to the MAIN world through a `CustomEvent` dispatched on the
injected script tag, and carries counters back up to the background. It also owns the floating
panel, built in a Shadow DOM so the host page CSS cannot break the panel and the panel CSS
cannot leak into the page.

**Layer 3, the background.** A service worker on Chromium, an event page on Firefox. It is the
single source of truth for settings. It manages `declarativeNetRequest` rulesets, aggregates
counters, paints the badge, and broadcasts settings changes to every open tab.

**Layer 4, the Preact UI.** Popup, options and dashboard all read and write through one
`settingsStore` built on signals, so every screen stays in sync without a state management
library.

### 3.2 The site module registry

A site module is data plus a small amount of site specific logic. The core knows the shape,
never the contents.

```typescript
interface SiteModule {
  id: SiteId;                    // 'facebook'
  displayName: string;           // 'Facebook'
  matches: string[];             // host permission patterns
  features: SiteFeature[];       // what this platform can control
  signatures: SignatureSet;      // MQTT topics and GraphQL operation names
}
```

The registry resolves a URL to at most one module. The popup asks the registry what the active
tab is, and renders that module's features above the global ones. On an unsupported site the
popup shows the global section alone.

Reading the active tab's URL does not require the `tabs` permission. With host permissions for
the supported sites, `tabs.query` already returns the URL for those tabs and omits it for
others, which is exactly the behaviour needed.

Adding a platform means adding a directory under `src/sites`, exporting a `SiteModule`, and
adding one line to the registry. Nothing in settings storage, the popup, or the background
changes. Section 1.4 states this as a success criterion because an abstraction that is never
exercised is usually wrong; shipping two modules in v1 is how the abstraction gets tested.

### 3.3 Data flow

Someone flips a toggle in the popup. The `settingsStore` writes to `storage.local` and sends a
runtime message. The background receives it, updates the `declarativeNetRequest` rulesets if a
global feature changed, and forwards the change to every content script. Each content script
passes the new settings down to the MAIN world with a `CustomEvent`. The interceptor updates
its in memory config and applies it to the very next frame, with no page reload.

In the other direction the interceptor counts dropped frames, batches them every 5 seconds,
and sends them up through the content script to the background, which accumulates the totals
in `storage.local` and repaints the badge.

### 3.4 Where each feature is intercepted

| Feature | Interception point | Mechanism |
| :-- | :-- | :-- |
| Hide read receipts, Facebook | Two transports, see below | Patch `WebSocket.prototype.send` in every frame, recognise the read watermark task in either transport, and drop it |
| Hide read receipts, Instagram | Same two transports on Instagram's hosts | Same mechanism, different host and signature set, declared in the Instagram module |
| Hide typing indicator | Same socket, typing state topic `/t_st` | Drop the frame |
| Hide story view receipts | `POST` to the GraphQL endpoint whose `fb_api_req_friendly_name` matches the story seen state mutation | Patch `fetch` and `XMLHttpRequest.send`, return a synthetic but well formed 200 so the page UI does not throw |
| Send read receipt manually | The already patched socket | The interceptor keeps the most recent dropped mark as read frame per conversation in an in memory LRU of at most 20 entries. Pressing the button on the panel replays it through the original `send` |
| Stop feed auto refresh | The page reloads the feed when the tab returns to the foreground | Pin `document.visibilityState` to `visible` and selectively block the `visibilitychange` listeners the page registers |
| Hide suggested posts | DOM | A `MutationObserver` plus a heuristic over `aria-label` and text content. Hide with CSS rather than removing nodes, so the page's React tree does not crash |
| Block Meta pixels | Network layer | A static `declarativeNetRequest` ruleset blocking `connect.facebook.net/*/fbevents.js` and `facebook.com/tr` |
| Strip `fbclid` | Network layer | A `declarativeNetRequest` redirect rule removing the query parameter |

### 3.4.1 One parser per transport that is proven to exist

Two transports are known to have carried read receipts. The older one is MQTT over a WebSocket,
with the read watermark as a labelled task inside a publish frame. The newer one wraps the same
task list in a JSON envelope carrying an `app_id` and a `payload` string, over a different socket.

Meta completed its default end to end encryption rollout for Messenger during 2024, first for one
to one chats and then for groups and Instagram, so ordinary conversations in 2026 are very likely
served entirely by the newer transport. The older path is probably dead weight.

Probably is not good enough to write code against in either direction, so the rule is:

**Write a parser only for a transport that a captured frame proves is in use.** M3 begins by
recording real outbound frames from a live session, before any interception code exists. Whatever
those frames actually contain determines how many parsers get written. If only the newer
transport appears, only `dgw.ts` is written and the older one is never implemented. If the older
transport still shows up somewhere, on a page inbox or a business thread, then and only then does
`mqtt.ts` earn its place, with a fixture proving why.

This is the opposite of the usual instinct, which is to support both and feel safe. Supporting a
transport nobody uses is not safety, it is untested code carrying a maintenance cost forever,
and its tests pass against fixtures that no longer resemble anything real.

Whatever is written lives in `src/protocol/` as a pure function from bytes to a task list, with no
browser dependency, tested in plain Node against captured fixtures.

Task labels are numbers Meta changes. They belong in the site module's `signatures.ts` as an array
of accepted values, never as a literal in the parser.

### 3.7 What has been verified, and what has not

The transport details above come from a reverse engineering report reviewed on 2026-09-05, not
from documentation Meta publishes. They are recorded here with the confidence they actually
carry, so nobody builds on them believing they are settled fact.

**Observed directly on 2026-09-05.** A live session was run with the observer loaded. The full
record is `docs/findings/2026-09-05-messenger-transport.md`. In summary: the sockets are created in
the top level frame and are reachable from a content script, so no worker interception is needed;
the host is `gateway.messenger.com`, not `gateway.facebook.com` as the research claimed; the
messaging socket is `/ws/lightspeed`; the hidden `fbsbx.com/maw_proxy_page` iframe is real; and a
`SharedWorker` exists but does not own the sockets that matter.

Frames are a twelve byte binary header followed by JSON nested three levels deep as strings. The
header contains the bytes `7b 7d`, an ASCII `{}`, so a parser that scans for the first brace finds
an empty object and reports success on a frame it has not read.

Task labels 54, 117, 145, 207, 209, 751 and 767 were seen during ordinary navigation. Neither 21
nor 389 appeared, so the research report's numbers are not what this build sends.

A controlled comparison then isolated the read receipt: opening a thread with unread messages sends
tasks **72** and **235**, each carrying `thread_key` alone, while opening a thread already read
sends neither. Both go on `/ws/lightspeed`, and both must be dropped, since an implementation that
drops only one still leaks.

Typing is task **3**, and it exposed something more useful than its own number: it does not use the
same envelope. A read receipt arrives as `{ epoch_id, tasks, version_id }` with an array, typing as
`{ label, payload, version }` with a single task. A parser written for one silently passes the
other through while appearing to work, so both shapes must be handled.

Instagram uses `gateway.instagram.com`, a different host, which is why the site modules keep
separate host lists. No Instagram task label was observed at all, and the Instagram module must not
inherit the Messenger numbers. Assuming it would, because both are Meta, is the same reasoning that
produced the wrong numbers in the original research.

These are numbers from one account on one day, so they belong in the site module's signature array
rather than in the parser. The research report's numbers were also observed by someone once.

**Independently corroborated before that.** The `fbsbx.com` proxy page appears in public URL
analysis records. `Lightspeed` is a genuine Meta messaging identifier, visible in `mautrix-meta`, a
publicly reverse engineered implementation of this protocol.

**Contradicted by observation.** The specific numeric task labels the research named. They did not
appear at all in a live session, which is the strongest reason yet to keep every recognition string
in a data file rather than a literal.

**Corroborated separately.** Meta's own announcements confirm default end to end encryption
reached every Messenger conversation during 2024. That is the strongest available evidence that
the older transport no longer carries ordinary read receipts, and it is why section 3.4.1 refuses
to implement a parser for it without a captured frame.

The unverified items are also the ones most likely to change, which is exactly why section 3.5
keeps every recognition string in a data file with room for several variants. Before M3 writes a
line of interception code, its first task is to capture real frames from a live session and turn
them into fixtures. The numbers in that report are a starting hypothesis to test, not a
specification to implement.

**One boundary that is not negotiable.** Knowing how Meta frames a packet is a fact about a
protocol, and facts are not owned by anyone. The source code of another extension is owned by its
authors. Findings from reading it may inform this implementation; its code must not be copied
into it, and no file here should be a translation of one of theirs.

**The observation bridge is forgeable, and cannot be made otherwise.** The injected observer and
the page's own scripts share one realm and one `document`, so any script on the page can dispatch
the same `CustomEvent` the observer uses and have it accepted. A nonce would not help, since it
would be readable by exactly the scripts that could forge the event, and adding one would look
like authentication without being any.

The consequence is bounded but real. Observation is a research tool, so a page feeding it false
frames wastes an investigation rather than causing harm. It becomes serious the moment anything
decides what to block based on observed data, so no later milestone may treat an observed event as
trustworthy on its own.

### 3.4.2 Identifiers that JavaScript cannot hold

Meta's payloads carry numeric identifiers larger than JavaScript can represent exactly. An epoch
id observed in a real frame was 19 digits, well past `Number.MAX_SAFE_INTEGER` at roughly
9.007e15, so parsing it into a number and printing it back does not return the same digits.

This is a trap for M3b rather than a curiosity. Any code that reads a payload, changes one field
and writes the payload back will silently corrupt every oversized id it passed through, and the
result is a well formed frame carrying wrong identifiers. Nothing would throw.

Two consequences follow, and both belong in M3b's plan rather than being rediscovered during it.

**Prefer dropping a frame over rewriting one.** Dropping needs no round trip, so the question never
arises. The spec's existing design already drops rather than edits, and this is a second reason to
keep it that way.

**If a frame ever must be rewritten, do not round trip it through `JSON.parse`.** Operate on the
text, or parse with a reviver that keeps large integers as strings.

Note how narrow the margin is on the identifiers that do fit today. A thread key observed at 16
digits sits about six percent under the limit. One extra digit and it does not fit either, so
treating the current sizes as permanently safe would be a mistake.

### 3.5 Three defensive decisions

**Signatures live apart from logic.** Meta renames MQTT topics and GraphQL operation names
often. Every recognition string sits in the owning site module's `signatures.ts` as plain data,
and each feature carries an array of variants so one build can match several concurrent
versions of the platform. Adapting to a protocol change means editing one data file.

**Fail open by default.** If parsing an MQTT frame throws, the frame passes through untouched.
Leaking a read receipt is better than breaking someone's messenger. Anyone who wants the
opposite can enable strict mode in options, which drops suspicious frames instead.

**Self detected staleness.** If seven consecutive days pass with no frame matching any
signature while the person is still visiting the platform, the extension shows a banner saying
the protocol has probably changed and an update is needed. The extension never downloads rules
from a server: the Chrome Web Store forbids remote code, and dynamic rule delivery invites a
failed review.

### 3.6 Browser differences

**Chrome and Edge** share one build. MV3 service worker, `declarativeNetRequest`, and
`world: "MAIN"` declared directly in the manifest. The two differ only at submission time.

**Firefox** has no service worker in MV3; it uses `background.scripts` as an event page.
Declaring both the `scripts` and `service_worker` keys lets each browser take its own half, and
WXT handles this when building with `wxt build -b firefox --mv3`. Note that WXT defaults
Firefox to MV2, so the `--mv3` flag is required. `world: "MAIN"` arrived in Firefox 128, so the
Firefox build sets `strict_min_version` to `128.0` rather than carrying a fallback path.

Firefox does support `declarativeNetRequest` with static rulesets and `updateEnabledRulesets`,
so tracker blocking uses one mechanism on all three browsers with no `webRequest` fallback.
One bug needs avoiding: on Firefox 132 and earlier, static rulesets fail to load after a
browser restart if no ruleset was enabled at install time (Firefox bug 1921353). The workaround
is to ship the tracker ruleset enabled in the manifest, matching the default setting value, and
only then toggle it with `updateEnabledRulesets`.

Runtime branching uses WXT's `import.meta.env.FIREFOX`, wrapped in `src/utils/browser.ts` so
the rest of the code never needs to know where it is running.

Sources checked: Manifest V3 updates landed in Firefox 128 on the Mozilla add ons blog,
the MDN `background` manifest key reference, and the MDN `declarativeNetRequest` reference.

## 4. Code structure

### 4.1 Directory layout

```
privacy-guard/
  wxt.config.ts
  eslint.config.js
  vitest.config.ts
  playwright.config.ts
  public/
    rules/meta-pixel.json           static ruleset blocking Meta pixels
    rules/fbclid.json               static ruleset stripping the tracking parameter
    icon/                           16, 32, 48, 128
  src/
    core/
      settings/
        schema.ts                   zod schema, defaults, feature key helpers
        storage.ts                  versioned storage item, safe read and write
        store.ts                    signals store, two way sync with storage
      badge.ts                      resolve and apply the toolbar badge
      rulesets.ts                   map settings to the set of enabled rulesets
      permissions.ts                request and check optional host permissions
      messaging.ts                  typed messages between content and background
    sites/
      types.ts                      SiteModule, SiteFeature, SignatureSet
      registry.ts                   all modules, and URL to module resolution
      facebook/
        index.ts                    module declaration
        features.ts                 feature list with labels and descriptions
        signatures.ts               MQTT topics and GraphQL operation names
      instagram/
        index.ts
        features.ts
        signatures.ts
    trackers/
      features.ts                   global feature list
    interceptors/                   pure TypeScript, no extension APIs allowed
      websocket.ts
      fetch.ts
      xhr.ts
      visibility.ts
    protocol/
      mqtt.ts                       parse fixed header, remaining length, topic
      graphql.ts                    read the request body, extract the operation name
    ui/
      components/                   Toggle, Section, Card, StatTile, Sparkline, Banner
      hooks/useSettings.ts
      styles/tokens.css
    entrypoints/
      background.ts
      page_hook.ts                  unlisted script, runs in the MAIN world
      site.content/                 isolated world bridge and Shadow DOM panel
      popup/
      options/
      dashboard/
    utils/
      logger.ts
      browser.ts
  tests/
    unit/
    fixtures/                       real MQTT frames, anonymised
    e2e/
```

### 4.2 Dependency direction

The direction is always outward to inward. Entrypoints depend on core, sites and ui. Core depends
on the site registry, for the feature declarations its settings schema is built from. Site modules
depend on nothing but their own types, which is what keeps adding a platform additive. Nothing
depends on entrypoints.

### 4.3 Enforced import boundaries

Two rules in `eslint.config.js`, both using `no-restricted-imports`.

First, nothing under `src/core` may import from `src/entrypoints`. This keeps the dependency
direction honest.

Second, nothing under `src/interceptors` or `src/protocol` may import an extension API such as
`#imports` or `wxt/browser`. This one matters most: violating it compiles cleanly and fails
only at runtime on a real page, which is the worst failure mode available. These modules
receive their configuration as function arguments, which is also what makes them testable in
plain Node.

A third rule keeps site modules from importing the settings layer. That is the boundary that
decides whether adding a platform stays additive, and it was unenforced until the branch review
pointed out that the spec described a different boundary than the one that mattered.

## 5. User interface

### 5.1 Popup, 360 by 520 pixels

A master switch and status line at the top. Below it, the active site's section, then the
global section. On an unsupported site the site section is replaced by a single line naming the
platforms that are supported.

The popup never shows a loading state. It renders immediately from in memory defaults and
swaps in the stored values once `storage.local` resolves, which normally takes a few
milliseconds. A `storage.session` cache is only worth adding if a real measurement exceeds the
50 millisecond criterion in section 1.4. Building that cache before measuring is premature
optimisation.

A blocked count in the footer arrives with milestone M3. Counting
`declarativeNetRequest` matches requires the `declarativeNetRequestFeedback` permission, which
produces an alarming install prompt and works against the minimal permission principle in
section 6. From M3 the interceptor counts for free. Until then the footer carries a short
reminder that the extension sends no data anywhere.

### 5.2 Options

A sidebar and a content pane, with five sections: General, Sites, Trackers, Advanced, Backup.
The Sites section lists every registered module with its features, so a person can configure a
platform without visiting it first. Advanced holds strict mode and the manual read receipt
setting. Backup exports and imports settings as JSON and restores defaults.

### 5.3 Dashboard

Four stat tiles, a 30 day column chart drawn in SVG, and an event log table with a type filter.
The log is a 500 entry ring buffer in `storage.local`, with a clear button, and it never leaves
the machine.

### 5.4 In page panel

Built with WXT's `createShadowRootUi`, so it is fully isolated from the host page CSS.
Collapsed it is a small circular button in a corner. Expanded it offers quick toggles and the
button that sends a read receipt for the open conversation. Its position is draggable and
remembered.

### 5.5 Design system

Tailwind v4 with CSS first configuration, plus a set of design tokens as CSS custom properties.
Dark mode follows `prefers-color-scheme`, and options can force light or dark. No third party
component library.

## 6. Manifest permissions

The extension requests `storage`, `declarativeNetRequest`, and host permissions for
`*.facebook.com`, `*.messenger.com` and `*.instagram.com`.

From M3 it also needs `*.fbsbx.com`, because the socket carrying read receipts lives in a worker
loaded through an iframe on that host. The permission is added in M3 rather than now, since
requesting access to a host the extension does not yet touch would be asking for something it
cannot justify.

It deliberately does not request `tabs` and does not request `<all_urls>` at install time.
Blocking pixels on third party sites still works, because the `declarativeNetRequest`
permission allows blocking without host permissions. Reading the active tab's URL works through
the host permissions already granted for supported sites.

Stripping `fbclid` is the one exception. A `declarativeNetRequest` redirect rule requires host
permission for the URL being rewritten, so that feature needs `<all_urls>`. It is declared under
`optional_host_permissions` and requested in the same click that enables the toggle. If the
request is declined the setting stays off, so the interface never claims protection that is not
running.

The extension makes no network requests of its own, has no analytics, no crash reporting, and
no remote configuration. Section 10 covers what this means for the store listing.

## 7. Error handling

Every patched function is wrapped in a try and catch. On an exception the default behaviour is
to call the original function with the arguments untouched, which is to say fail open. The
exception is logged internally at warning level with the feature name, and never rethrown into
the page.

If patching fails outright, for example because the page froze a prototype first, the
interceptor emits a `hook_failed` event to the content script. The popup then shows a degraded
state rather than continuing to advertise protection. Lying to someone about whether they are
protected is the most serious failure this class of extension can commit.

When the settings schema version changes, `settings/schema.ts` runs stepwise migrations. If a
migration throws, the extension restores defaults and shows a banner explaining what happened,
rather than continuing with corrupt settings.

The settings store registers its storage watcher before its initial read, and tags every commit
with a revision so a slow initial read cannot overwrite a change someone made while it was still
in flight. Without both, flipping a toggle in the first few milliseconds after the popup opens
would visibly flip itself back.

The settings store updates its signal before awaiting the write, because that is what makes the
interface respond instantly. If the write then fails, the signal rolls back to its previous
value and the error propagates to the caller. Leaving the signal on a value that was never
persisted would show a feature as enabled while it is not stored, which is the same lie about
protection state that this section forbids, merely arriving through a different door.

Stale feature keys are deliberately never pruned from stored settings. The schema accepts
unknown keys so that settings written by a newer build do not make an older build discard
everything, and the extension is the only writer, so growth is bounded by the number of features
this product has ever shipped. A prune step belongs with the settings export and import work in
M5, not before.

## 8. Testing strategy

**Unit, with vitest.** The MQTT parser against real captured frames. The signature matchers.
The settings store and its migrations. The registry's URL resolution. This is pure logic and
should be covered almost completely.

**Integration.** A `FakeWebSocket` verifying that the interceptor drops exactly the frames it
should and passes everything else through untouched. The single most important test in the
project is the one asserting nothing is dropped by mistake, because a false positive breaks
messaging.

**End to end, with Playwright loading the built extension.** Open the popup, flip toggles,
assert storage and the badge. No end to end runs against the live platforms, which would need
real accounts and would be hopelessly flaky.

**Fixture capture.** A development mode that records real MQTT frames with identifiers
stripped. When a protocol changes, the workflow is to capture fresh fixtures and edit the
relevant `signatures.ts`, which turns a reverse engineering session into a few minutes of work.

## 9. Milestones

**M1, foundation.** WXT with Preact and Tailwind, the site module registry with both modules
declared, settings storage and store, a working popup, the badge, and builds for all three
browsers.

**M2, tracker blocking.** The Meta pixel ruleset, `fbclid` stripping behind an optional
permission, and the settings to ruleset mapping. Deliberately scheduled before the messaging
work because it does not depend on any platform internals and therefore almost never breaks.
At the end of M2 the extension is genuinely useful.

**M3, the interception core.** The MAIN world hook, the MQTT parser, and read receipt and
typing suppression for Facebook. The highest risk work, done once the foundation is solid, and
driven by tests against captured fixtures.

**M4, stories, feed and the in page panel.** Story view suppression through GraphQL, feed auto
refresh blocking, suggested post hiding, the Shadow DOM panel and the manual read receipt
button. Instagram's interception lands here too, reusing the M3 machinery with its own
signatures.

**M5, options, dashboard and packaging.** Import and export, the event log, the chart, the
staleness banner, the privacy policy, store screenshots, and submission to all three stores.

## 10. Risk and compliance

Hiding read receipts, typing indicators and story view receipts means interfering with Meta's
protocols, which runs against their terms of service.

There is no legal problem: the extension changes the behaviour of a person's own browser on
their own session, touches nobody else's data, and collects and transmits nothing.

The operational risk is real and must be stated plainly to the user. An account may be rate
limited or hit a checkpoint. Meta may change a protocol at any time and silently disable a
feature. The response is a disclaimer on the first run screen and in the store listing, plus
the staleness detection described in section 3.5.

Store review risk: the listing must describe a single purpose, as the Chrome Web Store
requires. Here that purpose is privacy control on social platforms. No unrelated features get
bundled into the same extension.
