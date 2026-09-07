---
name: protocol-mapper
description: >-
  Tooling and operational runbook to read, query, update, and append UI action-to-network
  protocol mappings (Facebook, Messenger, Instagram) in docs/protocol-action-mapping.json.
  Use whenever inspecting DOM selectors, checking DGW/WebSocket/Worker signatures, or adding new surfaces/actions.
---

# Protocol & Action Mapping Skill

This skill provides agents with instant access to the verified, ground-truth mapping between Meta UI surfaces (Chat Nổi, Messenger Full, Feed), user actions, and low-level network protocols (DGW WebSocket, MAWBridge Worker, GraphQL).

---

## 1. Quick CLI Inspection (Zero-Searching)

Never guess DOM selectors or packet signatures. Use the companion CLI tool:

### List All Mapped Surfaces & Actions
```bash
node tools/protocol-map.mjs list
```

### Query a Surface (e.g. Chat Nổi vs Messenger Full)
```bash
node tools/protocol-map.mjs get surface facebook_floating_chat_tab
node tools/protocol-map.mjs get surface messenger_web_full
```

### Query an Action Protocol Specification
```bash
node tools/protocol-map.mjs get action USER_TYPING
node tools/protocol-map.mjs get action USER_OPEN_CHAT
```

---

## 2. Adding / Updating Mappings Programmatically

When discovering new surfaces or new action signatures (e.g. Instagram Direct or Reels):

### Add or Update an Action
```bash
node tools/protocol-map.mjs set-action "USER_VIEW_STORY" '{
  "description": "User clicks or views a Story card",
  "triggerEvents": ["click[aria-label*=\"Story\"]"],
  "emittedNetworkEvents": [
    {
      "layer": "GraphQL HTTP POST",
      "endpoint": "https://web.facebook.com/api/graphql/",
      "bodyPattern": "storiesUpdateSeenStateMutation"
    }
  ],
  "privacyGuardInterception": {
    "rule": "FacebookStoryViewsRule",
    "behaviorWhenOn": "Mocks 200 OK with is_final shape"
  }
}'
```

### Add or Update a Surface
```bash
node tools/protocol-map.mjs set-surface "instagram_direct" '{
  "name": "Instagram Web Direct Messaging",
  "urlPattern": "*://www.instagram.com/direct/*",
  "composerSelector": "div[role=\"textbox\"][contenteditable=\"true\"]",
  "networkProtocols": {
    "gateway": "wss://edge-chat.instagram.com/chat"
  }
}'
```

### Validate Mapping File Integrity
```bash
node tools/protocol-map.mjs validate
```

---

## 3. Ground Truth Reference Highlights

1. **Facebook Chat Nổi (`facebook_floating_chat_tab`)**:
   - Location: Bottom-Right dock (`x > 1000, y > 700`, width `328px`).
   - Composer: `div[role="region"][aria-label="Công cụ soạn cuộc trò chuyện"] div[role="textbox"][contenteditable="true"]`.
   - **98.9% Traffic is `port.postMessage`** to `SharedWorker: MAWMainV4WebWorkerBundle`.
   - Reason legacy tools fails: legacy tools only hooks `WebSocket.send` and has zero awareness of `MessagePort` or Web Workers.
   - Privacy Guard intercepts via `MAWBridgeFireAndForget` runtime hook and `port.postMessage` wrapper.

2. **Stop Typing Signal (`USER_STOP_TYPING`)**:
   - MUST NEVER BE SUPPRESSED (`isStopState(args[2])`). Suppressing `state: 0` freezes the recipient's typing indicator forever.
