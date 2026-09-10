---
name: protocol-detector
description: >-
  Operational runbook and automated tooling to detect, probe, sniff, and decode real-time Meta network protocols
  (Facebook, Messenger, Instagram). Use whenever diagnosing live network traffic, sniffing DGW/WebSocket/Worker frames,
  capturing live video/stream heartbeats, or verifying extension interception anomalies.
---

# Protocol & Network Auto-Detector Skill

This skill defines the operational runbook and automated toolchain to capture, inspect, and decode live network traffic across Meta web surfaces (Facebook, Messenger, Instagram).

---

## 1. Core Rule: Zero-Guesswork & Ground Truth

> **CRITICAL**: Never guess or extrapolate GraphQL operation names, WebSocket task labels, or REST endpoints.
> Always launch a real browser session against the user's dedicated profile (`.dev-profile`), capture raw wire frames, and verify before modifying code or rules.

---

## 2. Detection Toolchain Overview

The repository equips developers and agents with specialized detection tooling located in `tools/`:

| Tool / Probe | Location | Primary Purpose |
| :--- | :--- | :--- |
| **Agent Browser** | `tools/agent-browser.mjs` | Launches Chromium with `.dev-profile`, loads Privacy Guard extension, opens Remote DevTools on port `9222`, and correlates user UI actions with intercepted events. |
| **Facebook Auto-Detector** | `tools/probes/facebook-auto-detector.js` | Zero-friction in-page probe logging DGW frames, worker messages, XHR/Fetch GraphQL calls, and outbound chat packets directly to DevTools Console. |
| **Instagram Auto-Detector** | `tools/probes/instagram-auto-detector.js` | In-page probe specialized for Instagram Direct, Stories, and Reels on unified DGW/MQTT bypass stack. |
| **Extension Doctor** | `tools/probes/extension-doctor.js` | Health audit probe checking which channels are patched (`WebSocket.send`, `fetch`, `XMLHttpRequest.send`, `MessagePort.postMessage`) and counting suppressed items. |
| **Gateway Frame Probe** | `tools/probes/gateway-frame-probe.js` | Low-level binary decoder extracting tasks and labels from DGW varint-prefixed byte streams. |

---

## 3. Quick-Start Workflows

### Workflow A: Launching Live Detection Session

To launch an interactive browser session inspecting a specific Facebook or Instagram URL:

```bash
# Launch with Privacy Guard active on a specific video/live stream
node tools/agent-browser.mjs "https://web.facebook.com/dennystreams/videos/2031926677463766"

# Launch in unhindered baseline mode (Protection OFF) to observe raw native traffic
node tools/agent-browser.mjs --off "https://www.instagram.com/direct/inbox/"
```

#### Interactive Console Commands:
* **`t` + Enter**: Toggle master protection shield (`ON` ⇋ `OFF`) on the fly.
* **`s` + Enter**: Print live anomaly and action statistics across all open tabs.
* **`c` + Enter**: Clear in-memory event and anomaly logs.

---

### Workflow B: Headless Programmatic CDP Sniffing

When investigating a live endpoint without manual interaction, connect directly to Chrome DevTools Protocol (CDP) on port `9222`:

```javascript
// Quick CDP Inspection Snippet (Node 22+)
const wsUrl = "ws://localhost:9222/devtools/page/<PAGE_ID>";
const ws = new WebSocket(wsUrl);

let id = 1;
function send(method, params = {}) {
  ws.send(JSON.stringify({ id: id++, method, params }));
}

ws.onopen = () => {
  send("Network.enable");
  send("Runtime.enable");
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.method === "Network.requestWillBeSent") {
    const { url, method, postData } = msg.params.request;
    if (url.includes("/api/graphql/") || url.includes("/video/unified_cvc/")) {
      console.log(`[TARGET REQ] ${method} ${url}`, postData?.slice(0, 200));
    }
  }
};
```

---

## 4. Specific Detection Playbooks

### Playbook 1: Live Stream & Video Presence (CVC Heartbeat)

* **Surface**: Facebook Live (`comet.fbweb.CometTahoeRoute`), Instagram Live.
* **Key Endpoint**: `POST https://web.facebook.com/video/unified_cvc/`
* **Payload Structure**:
  ```json
  {
    "pps": { "m": false, "pf": 0, "s": "playing", "sa": 954699 },
    "ps": { "m": false, "pf": 3181, "s": "playing", "sa": 954699 },
    "si": "f43bc329f7b406a1b",
    "so": "tahoe"
  }
  ```
* **Detection Signature**:
  * `unified_cvc`: Concurrent Viewer Count heartbeat.
  * GraphQL mutations: `LiveViewerJoinMutation`, `LiveVideoViewerPingMutation`, `LiveVideoCometNuxForCVCQuery`.
* **Verification Criteria**:
  * Blocking `unified_cvc` MUST NOT break video chunks (`scontent.*.fbcdn.net/hvideo-*`).
  * Video player MUST retain `readyState: 4` (`HAVE_ENOUGH_DATA`) and continue uninterrupted playback.

---

### Playbook 2: Messaging, E2EE Armadillo & Typing Stop Signals

* **Surface**: Messenger Web, Floating Chat Tab (`facebook_floating_chat_tab`).
* **Critical Protocol Path**:
  * 98.9% of modern chat traffic traverses `port.postMessage` to `SharedWorker: MAWMainV4WebWorkerBundle`.
  * Traditional `WebSocket.send` hooks fail because they miss worker ports entirely.
* **Verification Criteria**:
  * `USER_SEND_MESSAGE`: Outbound message payloads (`body`, `text`, `offline_threading_id`) MUST NEVER BE DROPPED. Dropping outbound messages causes the red "Failed to send" error.
  * `USER_STOP_TYPING`: Idle/stop signal (`state: 0`, `state: "IDLE"`) MUST BE PASSED THROUGH. Dropping stop signals causes the recipient's 3-dots typing indicator to freeze permanently.

---

### Playbook 3: Stories & Ephemeral Highlights

* **Surface**: Facebook Stories Tray, Instagram Stories Viewer.
* **Target Signatures**:
  * Facebook: `storiesUpdateSeenStateMutation`, `CometStoriesSeenMutation`, `StoriesSeenTrayItemMutation`.
  * Instagram: `/api/v1/stories/reel/seen/`, `/api/v1/media/seen/`, `PolarisStoriesSeenMutation`.
* **Interception Behavior**:
  * Synthetic `200 OK` matching Facebook Relay's `{"data":{},"extensions":{"is_final":true}}` shape MUST be returned so the story tray does not glitch or reload.

---

## 5. Anomaly Severity & Triaging

When running automated sessions, watch for these specific anomalies:

| Anomaly Code | Severity | Root Cause | Immediate Action |
| :--- | :---: | :--- | :--- |
| `OUTBOUND_MESSAGE_BLOCKED` | **CRITICAL** | Suppression rule matched outgoing message frame. | Fix rule pattern; add negative lookahead for message body keys. |
| `STOP_TYPING_SUPPRESSED` | **HIGH** | `isStopState()` failed to recognize idle signal. | Update `STOP_STATE_NAME` regex in `mawBridge.ts`. |
| `PLAYBACK_STALLED` | **CRITICAL** | Over-aggressive URL pattern matched media CDN chunks (`fbcdn.net`). | Narrow target paths strictly to `/video/unified_cvc/` or GraphQL. |
| `MIXED_FRAME_LEAK` | **MEDIUM** | Multiplexed frame carries suppressed task along with essential sync task. | Split frame or log warning; pass through to prevent service disruption. |

---

## 6. Closing the Loop

Whenever a new action or protocol is discovered via this runbook:
1. Document the exact signature in `docs/protocol-action-mapping.json` using:
   ```bash
   node tools/protocol-map.mjs set-action "<ACTION_NAME>" '{ ... }'
   ```
2. Implement corresponding unit tests under `tests/unit/sites/<platform>/`.
3. Verify all 55+ test suites pass with `pnpm test`.
