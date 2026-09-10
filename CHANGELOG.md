# Changelog

All notable changes to Privacy Guard are documented here. Dates are the tag dates
in this repository.

## [0.12.0] 2026-09-10

- Rebuilt the popup layout for a cleaner, denser dashboard.
- Removed focus rings on mouse clicks while keeping them for keyboard navigation.
- Reduced the popup mount delay so the panel paints faster on open.
- Synced the CI release workflow and cleaned up a lint warning.

## [0.11.0] 2026-09-07

- Documentation and project assets only: screenshot previews, MIT license,
  contributing guide, and security policy. No change to extension behaviour.

## [0.10.0] 2026-09-07

- Documentation only: rewritten README with an architecture diagram and a full
  feature matrix. No change to extension behaviour.

## [0.9.1] 2026-09-07

- Fixed a missing icon in the popup for the "Hide live stream views" toggle.

## [0.9.0] 2026-09-07

- **New:** Stealth search (zero trace history) for Facebook and Instagram.
  Search people, profiles, accounts, and tags without writing to recent searches
  or feeding the recommendation model. Off by default.
- **New:** Scramble dwell time tracking. Suppresses Facebook Comet Banzai
  viewport telemetry and Instagram inline video watch heartbeats, so Meta cannot
  measure the exact seconds spent on a post or video. Off by default.
- Both toggles ship with English and Vietnamese labels.

## [0.8.0] 2026-09-07

- Internal tooling only: added a protocol detector workflow used to probe live
  Meta network traffic when signatures change. No change to extension behaviour.

## [0.7.0] 2026-09-07

- **New:** Hide live stream views. Watch Facebook Live and Instagram Live
  anonymously, without appearing in the viewer list and without triggering join
  notifications. Enabled by default.
- Added Vietnamese and English strings for the new toggle.

## [0.6.1] 2026-09-07

- Build fix: resynced the lockfile so continuous integration installs succeed.

## [0.6.0] 2026-09-07

- Expanded the tracking parameter cleaner. Alongside `fbclid` it now strips
  `igshid`, `utm_*`, `si`, and `gclid` when following links. Off by default, and
  it asks for permission before reading other sites.
- Refactored feed decluttering and worker helpers, and added an observation
  filter plus developer inspection tools.
- A media quick downloader was trialled during this cycle and then removed before
  release, so it is not part of the shipped build.

## [0.5.1] 2026-09-06

- Resolved the Mozilla add on validation warnings for the Firefox MV3 build.

## [0.5.0] 2026-09-06

- Redesigned the popup into a rounded dashboard with sidebar navigation across
  Facebook, Instagram, and global sections.

## [0.4.0] 2026-09-06

- Rewrote the Facebook and Instagram request signatures against live traffic,
  which makes detection more precise and less likely to touch unrelated requests.
- Fixed outbound chat message protection.
- Feed decluttering now works across languages instead of English only.

## [0.3.0] 2026-09-06

- Upgraded Instagram Direct support to Meta's unified DGW LightSpeed transport,
  restoring read receipt, typing, and presence controls after Meta migrated the
  messaging stack.

## [0.2.0] 2026-09-06

- Extended Instagram coverage: direct messages, stories, and feed controls.

## [0.1.0] 2026-09-06

First release.

- **Facebook feed:** hide sponsored posts, hide suggested posts, hide Reels and
  short videos, stop the feed reloading when you return to the tab.
- **Messenger and Facebook privacy:** hide read receipts, hide typing indicator,
  hide story views, hide inbox last seen, invisible mode, hide the voice note
  played marker, WebRTC IP leak shield for calls, and Link Shim bypass so
  external links open directly.
- **Instagram:** hide read receipts, hide typing indicator, hide story views.
- **Across the web:** block Meta tracking pixels on third party sites, and strip
  `fbclid` from links.

---

## Notes that apply to every version

- All settings are stored locally through the browser storage API. The add on
  collects no data, sends nothing to any server, and declares "no data
  collection" in its Firefox manifest.
- Host permissions are limited to `facebook.com`, `messenger.com`,
  `instagram.com`, and `fbsbx.com`. Access to all sites is optional and only
  requested when the link parameter cleaner is enabled.
- Every toggle is opt in or opt out individually, and nothing runs on a site that
  has not been enabled.

[0.12.0]: https://github.com/Nam088/privacy-guard/releases/tag/v0.12.0
[0.11.0]: https://github.com/Nam088/privacy-guard/releases/tag/v0.11.0
[0.10.0]: https://github.com/Nam088/privacy-guard/releases/tag/v0.10.0
[0.9.1]: https://github.com/Nam088/privacy-guard/releases/tag/v0.9.1
[0.9.0]: https://github.com/Nam088/privacy-guard/releases/tag/v0.9.0
[0.8.0]: https://github.com/Nam088/privacy-guard/releases/tag/v0.8.0
[0.7.0]: https://github.com/Nam088/privacy-guard/releases/tag/v0.7.0
[0.6.1]: https://github.com/Nam088/privacy-guard/releases/tag/v0.6.1
[0.6.0]: https://github.com/Nam088/privacy-guard/releases/tag/v0.6.0
[0.5.1]: https://github.com/Nam088/privacy-guard/releases/tag/v0.5.1
[0.5.0]: https://github.com/Nam088/privacy-guard/releases/tag/v0.5.0
[0.4.0]: https://github.com/Nam088/privacy-guard/releases/tag/v0.4.0
[0.3.0]: https://github.com/Nam088/privacy-guard/releases/tag/v0.3.0
[0.2.0]: https://github.com/Nam088/privacy-guard/releases/tag/v0.2.0
[0.1.0]: https://github.com/Nam088/privacy-guard/releases/tag/v0.1.0
