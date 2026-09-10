Privacy Guard is a client-side privacy tool that puts you back in control of the signals your social accounts send on your behalf: who knows you read a message, who knows you watched a story, how long you looked at a post, and who follows you around the rest of the web. Every protection runs locally in your browser, and every one of them is a switch you control.

## What It Protects

### Facebook and Messenger

- **Hide read receipts**, so you can read messages and stories without sending a seen marker.
- **Hide typing indicators** in one-to-one chats and group chats.
- **Hide the voice note played marker**, so you can listen without notifying the sender.
- **Invisible mode**, which keeps the green active dot off without giving up chat.
- **Hide when you last opened your inbox**, so Messenger stops recording that timestamp.
- **Hide story views**, so you do not appear in the viewer list.
- **Hide live stream views**, so you can watch Facebook Live anonymously.
- **Scramble dwell time tracking**, which suppresses the Comet Banzai viewport beacons Meta uses to measure the exact seconds you spend on a post or a video.
- **Stealth search with zero trace history**, so looking someone up does not land in recent searches or reshape your recommendations.
- **WebRTC IP leak shield**, which stops your local and public IP addresses leaking during calls.
- **Link Shim bypass**, so external links open directly instead of routing through Facebook's tracking redirect.
- **Feed declutter**: hide sponsored posts, hide suggested posts, hide Reels and short videos, and stop the feed reloading when you switch back to the tab.

### Instagram

- **Hide read receipts** in direct messages.
- **Hide the typing bubble** in direct messages.
- **Hide story views and hide live stream views**, including the join notification Instagram Live normally sends.
- **Invisible mode** for Instagram Direct, with no active status dot.
- **Scramble dwell time tracking**, which suppresses the inline video watch heartbeats behind watch time profiling.
- **Stealth search with zero trace history** for accounts and tags.
- **WebRTC IP leak shield** for Instagram Direct calls.
- **Link Shim bypass** for external links.
- **Feed declutter**: hide sponsored posts and ads, hide suggested posts, and hide Reels shelves and video carousels.

### Across the rest of the web

- **Block Meta tracking pixels** before they load, including `connect.facebook.net/en_US/fbevents.js` and the `signals/config` endpoints, using the browser's own `declarativeNetRequest` engine.
- **Strip tracking parameters** from links you follow: `fbclid`, `igshid`, `utm_*`, `si`, and `gclid`. This one is off by default and asks for permission first, because it is the only feature that needs to read other sites.

## How It Works

Privacy Guard sits between the page and the network. It inspects requests at the `fetch`, `XHR`, `WebSocket`, and `Web Worker` layers, and understands Meta's own transports, including the DGW LightSpeed messaging stack and GraphQL. That is what lets it drop a single telemetry beacon instead of blocking whole endpoints, so messaging, calls, and video keep working normally.

The rule engine is deliberately asymmetric and fails open. If any rule hits an unexpected payload or throws, the request passes through untouched. A bug in a privacy rule can never break your feed, your chats, or your calls.

## Privacy Commitment

- **Runs entirely inside your browser.** There is no backend, no account, and no sign in.
- **Zero remote servers.** No telemetry, no analytics, no crash reporting, no external logging.
- **No data collection.** Your settings live in `browser.storage.local` on your own device and never leave it. The Firefox manifest declares no data collection.
- **Least privilege by default.** Required host access is limited to `facebook.com`, `messenger.com`, `instagram.com`, and `fbsbx.com`. Access to all sites is optional and only requested if you turn on the link parameter cleaner.
- **No remote code.** Everything that runs was shipped in the reviewed package.
- **Open source under the GNU GPLv3 license**, so anyone can audit and inspect exactly what it does.
