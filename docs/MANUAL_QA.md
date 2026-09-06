# Manual QA checklist, M1 and M2

Everything here needs a real browser, so none of it is covered by the automated suite. Ordered to
minimise switching between browsers: Chrome first because it iterates fastest, then Firefox, then
Edge.

Build everything once before starting:

    pnpm build:all

## Why some of these matter more than they look

**Item 8** is the only check that catches a broken `excludedInitiatorDomains`. If those exclusions
are wrong, the extension blocks the requests Facebook and Instagram need in order to work, and
every automated test still passes. Do not skip it.

**Item 16** is the only check of the promise that the interface never shows a feature as on while
it is not running. There is a unit test for the wiring now, but nothing has watched a real
permission dialog get dismissed.

**Item 21** is the reason the pixel ruleset ships enabled in the manifest rather than being turned
on at startup. Firefox 132 and earlier fail to reload static rulesets after a restart when none was
enabled at install time.

## Chrome, load `.output/chrome-mv3`

- [ ] 1. Load unpacked. Pass: no error, icon in the toolbar.
- [ ] 2. Open the popup on an unsupported site. Pass: only the `All websites` section, two toggles, pixel blocking on, fbclid stripping off.
- [ ] 3. Right click inside the popup, Inspect, console: `performance.getEntriesByType('navigation')[0].duration`. Pass: under 50. If over, add the `storage.session` cache from spec 5.1 and record both numbers.
- [ ] 4. DevTools, Rendering, force `prefers-color-scheme: dark`. Pass: dark surface, light text, borders still visible.
- [ ] 5. Open `facebook.com`. Pass: a `Facebook` section with five toggles, every one disabled and badged `Soon`.
- [ ] 6. Open `messenger.com`. Pass: the same `Facebook` section, since both hosts belong to one module.
- [ ] 7. Open `instagram.com`. Pass: an `Instagram` section with three toggles, all disabled and badged `Soon`.
- [ ] 8. On facebook.com and instagram.com: scroll the feed, open a conversation, send a test message, watch the console and the Network panel. Pass: no extension errors, and none of their own requests blocked.
- [ ] 9. Open a news site that embeds the Meta pixel, Network panel open. Pass: requests to `connect.facebook.net`, `facebook.com/tr` and `facebook.net/signals/` show as blocked.
- [ ] 10. Turn `Block Meta tracking pixels` off, reload. Pass: those requests go through.
- [ ] 11. Turn it back on, reload. Pass: blocked again.
- [ ] 12. Turn the master switch off. Pass: red `OFF` badge on the toolbar icon, and pixel requests go through even though the feature toggle is still on.
- [ ] 13. Turn the master switch back on. Pass: badge disappears, requests blocked again.
- [ ] 14. Turn on `Strip fbclid from links`. Pass: Chrome asks for access to all sites.
- [ ] 15. Accept. Pass: the toggle stays on, and following a link carrying `?fbclid=` lands on a URL with the parameter gone.
- [ ] 16. Turn it off, turn it on again, and decline the prompt this time. Pass: the toggle springs back to off by itself.

## Firefox, load `.output/firefox-mv3`

Load through `about:debugging#/runtime/this-firefox`, Load Temporary Add-on, pick `manifest.json`.

- [ ] 17. Loads without error, icon appears, popup opens, toggles work.
- [ ] 18. Repeat items 2, 3, 4, 5 and 7.
- [ ] 19. Repeat item 9.
- [ ] 20. Repeat items 14 to 16. The dialog is Firefox's own and looks different. If Firefox refuses the manifest over `optional_host_permissions`, switch that build to `optional_permissions` using the existing `browser === 'firefox'` branch in `wxt.config.ts`, and record which key each browser needs in the README.
- [ ] 21. Quit Firefox completely, relaunch, reload the add-on, and repeat item 9. Pass: the pixel is blocked immediately, with no window where it is not.

## Edge, load `.output/edge-mv3`

`edge://extensions`, Developer mode, Load unpacked.

- [ ] 22. Loads without error, popup opens and works.
- [ ] 23. Spot check items 2, 5, 7, 9, 12 and 13. Edge shares Chrome's engine, so confirming it loads and the core paths work is worth more than repeating everything.

## Known, not a bug

The Firefox build prints a warning about `data_collection_permissions`. That manifest key becomes
required for new Firefox submissions and belongs with the store submission work in M5.

## M3b, read receipt suppression

This is the first feature that changes what a page sends, so item 26 matters more than the rest:
it is the only check that the app still works. Everything else can pass while Messenger is broken.

Needs two accounts, or one account plus somebody willing to send a message and report back.

- [ ] 24. Open the popup on `messenger.com`. Pass: `Hide read receipts` is enabled and on, with no `Soon` badge. The other four Facebook toggles are still disabled and badged.
- [ ] 25. Open Messenger with the extension loaded, open a conversation that has unread messages, and ask the other account whether it now shows as seen. Pass: it does not.
- [ ] 26. In that same conversation, send a message, receive one, scroll the history, and open three other threads. Pass: everything works normally. Any freeze, missing message or spinner that never resolves means a frame was dropped that should not have been, and the feature has to come back out.
- [ ] 27. Turn `Hide read receipts` off in the popup, **without reloading the page**, then open another unread conversation. Pass: the other account now sees it as read. This is the only check that the toggle reaches an already open tab.
- [ ] 28. Turn the master switch off, open an unread conversation. Pass: read as normal, because the master switch overrides the feature.
- [ ] 29. Open `instagram.com` direct messages and read an unread conversation. Pass: it is marked as read. Instagram is deliberately unprotected, and appearing to protect it would be the lie this project is built to avoid.
- [ ] 30. Right click the popup, Inspect, and watch the background console while using Messenger. Pass: `websocket.suppressed` events appear when opening unread threads. If `websocket.mixed` appears, record how often: it means read receipts are being batched with other tasks and leaking, which changes the design.
- [ ] 31. Repeat item 25 on an **end to end encrypted** conversation, the ones with the lock icon. Expected to **fail**: the receipt is encrypted before it reaches the socket this reads. Record whether it failed, because the extension currently shows the feature as on regardless, and a feature that silently does nothing on some threads is the problem this project is built to avoid. If it fails, the popup has to say so before this ships.
