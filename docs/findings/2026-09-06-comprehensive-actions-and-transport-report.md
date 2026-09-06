# Comprehensive Report: Meta DGW Transports, Observed Actions & Task Catalog

Date: 2026-09-06
Environment: `messenger.com` / `web.facebook.com` on Chromium (Desktop)
Method: Live protocol capture using `lightspeed-frame-probe-v2.js` and targeted DGW socket listeners.

---

## 1. Executive Summary

During live telemetry probing of Meta's messaging protocols on desktop web, we captured and decoded multiple distinct network streams across Meta's **Device Gateway (DGW)** architecture. 

This document records all observed actions, transport endpoints, frame headers, and task payloads. It serves as the single source of truth for current milestones (**M3b Read/Typing Suppression**) and future roadmap features (**M4 Story View Suppression, M5 Stealth/Invisible Presence Mode, and Anti-Tracking**).

---

## 2. Meta DGW Socket Architecture

Meta web clients communicate over 4 persistent WebSockets connected to `gateway.messenger.com` (or `gateway.facebook.com`):

| Socket Endpoint | Primary Purpose | Framing Format |
| :--- | :--- | :--- |
| **`/ws/lightspeed`** | Core messaging actions (read receipts, thread bumping, contact sync, messages) | 16-byte binary header + JSON payload |
| **`/ws/streamcontroller`** | Stream multiplexing, Online Presence (`presenceReportingAmendment`), Session control | 14-byte binary header + JSON payload |
| **`/ws/realtime`** | Telemetry, analytics batches, background push notifications | Variable framing / compressed batches |
| **`/ws/rpsignaling`** | Realtime Presence & WebRTC Signaling (Audio/Video calls) | Signaling frames |

Query parameters observed on all sockets confirm DGW routing:
* `x-dgw-appid`: App ID (e.g. `772021112871879` for desktop web)
* `x-dgw-deviceid`: Persistent browser/device UUID
* `x-dgw-app-stream-group=group1`: When active, multiplexes ephemeral presence and control streams across `/ws/streamcontroller`.

---

## 3. Catalog of Decoded Actions & Task Payloads

### A. Read Receipts (Đã xem tin nhắn)

#### 1. Primary Read Watermark Task: `Label 21` (`ThreadMarkReadTask`)
* **Transport:** `/ws/lightspeed` (16-byte header: `0f [seq] ... 7b 7d`)
* **Envelope:** `single`
* **Observed Payload:**
```json
{
  "thread_id": 8482072268488190,
  "last_read_watermark_ts": 1788633948478,
  "sync_group": 95,
  "offline_threading_id": null
}
```
* **Significance:** This is the canonical read receipt task corroborating `mautrix-meta`'s `ThreadMarkReadTask`. It sends the exact millisecond watermark (`last_read_watermark_ts`) up to which messages in `thread_id` have been viewed.

#### 2. Companion Read Watermarks: `Label 72` and `Label 235`
* **Transport:** `/ws/lightspeed`
* **Envelope:** `array` (each arrives doubled in its own frame)
* **Observed Payload:**
  * Frame 16: `taskCount: 2`, `labels: ["72", "72"]`, payload field: `thread_key`
  * Frame 17: `taskCount: 2`, `labels: ["235", "235"]`, payload field: `thread_key`
* **Interception Strategy:** Drop frames containing labels `21`, `72`, and `235`. All observed frames were clean (no piggybacked chat messages).

---

### B. Typing & Active Presence (Đang gõ phím & Trạng thái Online)

#### 1. Presence & Focus Amendment (`presenceReportingAmendment`)
* **Transport:** `/ws/streamcontroller`
* **Header:** 14 bytes (`0d 02 00 ... 18 b1 01`)
* **Observed Payloads:**
  * **When clicking into chat / typing:**
    ```json
    {
      "payload": {
        "presenceReportingAmendment": {
          "reportingArguments": {
            "availability": 1,
            "foregrounded": true,
            "mutationId": "6ddb186c-79cf-4088-94eb-1060bd8f0934",
            "capabilities": "10"
          }
        }
      }
    }
    ```
  * **When unfocusing / blurring / idle:**
    ```json
    {
      "payload": {
        "presenceReportingAmendment": {
          "reportingArguments": {
            "availability": 2,
            "foregrounded": false,
            "mutationId": "b1e3339a-40ff-4fa8-b9b5-ee1820d6733c",
            "capabilities": "10"
          }
        }
      }
    }
    ```
* **Future Feature Opportunity (Stealth / Invisible Mode):**
  * Suppressing or pinning `availability: 2, foregrounded: false` on `/ws/streamcontroller` allows users to browse Messenger completely invisible without ever triggering the green active dot ("Chấm xanh online").

#### 2. Lightspeed Typing Task: `Label 3` (`UpdatePresenceTask`)
* **Transport:** Defined in Lightspeed protocol spec (`messagix`) for non-multiplexed sessions.
* **Payload Fields:** `thread_key`, `is_typing: 1`, `is_group_thread`, `attribution`, `sync_group`, `thread_type`.

#### 3. Modern E2EE (Armadillo) Typing Mechanism: `MAWBridgeFireAndForget`
* **Transport:** In modern Meta Messenger 1-to-1 chats (`SECURE_MESSAGE_OVER_WA_ONE_TO_ONE`), typing indicators bypass `/ws/lightspeed` and Relay GraphQL mutations entirely.
* **Invocation:** `useOnTypingStateChanged` dispatches to Meta's Messenger Armadillo Web (MAW) bridge:
  ```javascript
  o("MAWBridgeFireAndForget").fireAndForget("backend", "sendChatStateFromComposer", {
      chatJid: recipientJid,
      state: isTyping ? o("WAChatState").TYPING : o("WAChatState").IDLE
  });
  ```
* **Resolution:** Hooking Meta's module loader (`__d`, `require`, `requireLazy`) in `src/observe/mawBridge.ts` at `document_start` safely intercepts and drops `sendChatStateFromComposer` calls before they reach the Armadillo worker encryption layer. Tested and verified in live browser sessions.


---

### C. Inbox & App Usage Telemetry (Thời gian mở hộp thư đến)

#### `Label 6` (`Inbox / Folder Watermark`)
* **Transport:** `/ws/lightspeed`
* **Envelope:** `single`
* **Observed Payload:**
```json
{
  "parent_thread_key": 0,
  "last_seen_time_ms": 1788633948465
}
```
* **Significance:** `parent_thread_key: 0` indicates the root folder (inbox). It broadcasts when the user last loaded/viewed their chat thread list.
* **Future Feature Opportunity:** Dropping `Label 6` hides the timestamp of when the user opened their Messenger inbox.

---

### D. Thread Bumping & Ephemeral State (Xếp thứ tự hội thoại)

#### `Label 389` (`Thread Bumping / Subtype Handler`)
* **Transport:** `/ws/lightspeed`
* **Observed Payload:**
```json
{
  "bump_timestamp_ms": 1788633948465,
  "thread_key": 8482072268488190,
  "bumped_by_local_device_send": 1,
  "tam_thread_subtype": 0,
  "wa_jid": null,
  "message_ephemeral_duration_in_sec": 0,
  "message_product_type": null,
  "is_message_deletion": 0,
  "is_unbump": 0
}
```
* **Significance:** Updates thread order in the sidebar, controls ephemeral message timers (`message_ephemeral_duration_in_sec`), and handles WhatsApp bridge identifiers (`wa_jid`).

---

### E. Contact Interaction Telemetry (Tương tác danh bạ)

#### `Label 308` (`Contact Touch`)
* **Transport:** `/ws/lightspeed`
* **Observed Payload:**
```json
{
  "contact_id": 100094293981804
}
```
* **Significance:** Sent when a specific contact's thread is focused or interacted with.

---

### F. Bulk Conversation State Synchronization (Đồng bộ hàng loạt hội thoại)

#### `Label 160019` (`Bulk Thread Activity Snapshot`)
* **Transport:** `/ws/lightspeed`
* **Observed Payload:** Array of all active threads containing:
  * `thread_key`
  * `last_read_timestamp_ms`
  * `last_activity_timestamp_ms`
  * `is_last_activity_optimistic`
* **Significance:** Sent on page reconnect or initial sync. Contains bulk read watermarks across 20+ conversations at once.

#### `Label 648` (`Community / Channel Sync`)
* **Transport:** `/ws/lightspeed`
* **Payload Fields:** `server_mode: ["JOINED_PUBLIC_CHANNELS", "JOINED_COMMUNITY_CHANNELS"]`, `from_timestamp_ms`.

---

## 4. Future Action Roadmap (Beyond M3b)

| Feature | Target Milestone | Layer / Endpoint | Mechanism |
| :--- | :--- | :--- | :--- |
| **Hide Story Views** | **M4** | HTTP POST `/api/graphql/` | Intercept `fetch`/`XHR` for `storiesUpdateSeenStateMutation`, drop request & mock HTTP 200 |
| **Stealth / Invisible Mode** | **M5** | WebSocket `/ws/streamcontroller` | Intercept `presenceReportingAmendment`, pin `availability: 2, foregrounded: false` to hide green online dot |
| **Inbox Last-Seen Conceal** | **M5** | WebSocket `/ws/lightspeed` | Drop `Label 6` (`parent_thread_key: 0`) to conceal inbox viewing times |
| **Manual Read Replay** | **M3b+** | WebSocket `/ws/lightspeed` | Cache dropped `Label 21/72/235` frames in an LRU buffer; re-send via `originalSend` on user command |
| **Stop Feed Auto-Reload** | **M4** | DOM / Event Layer | Pin `document.visibilityState = 'visible'`, block `visibilitychange` listeners |
| **Hide Suggested / Ads** | **M4** | DOM MutationObserver | Hide sponsored containers via CSS without unmounting React DOM nodes |
| **Anti-Unsend (Message Recovery)**| **Future** | `WebSocket.onmessage` & IndexedDB | Intercept incoming messages, cache locally; ignore/flag `DeleteMessageTask` (`Label 33/155`) |
| **Voice Memo Stealth Listen** | **Future** | HTTP GraphQL / WebSocket | Intercept audio playback telemetry (`audio_clip_played`) |
| **View-Once Media Preservation**| **Future** | Media Interceptor | Block view-once receipt dispatch, allow persistent display/download |
| **WebRTC IP Leak Shield** | **Future** | `RTCPeerConnection` (`/ws/rpsignaling`)| Block non-relay ICE candidates, enforce TURN-only to prevent real IP exposure |
| **Instagram Web Parity** | **Future** | `gateway.instagram.com` | Probe & map Instagram-specific DGW task numbers for Direct Messages & Stories |
| **Dwell Time & Telemetry Scrambler**| **Future** | `navigator.sendBeacon` & `/ajax/bz` | Filter/fuzz dwell-time and video watch duration analytics |

---

## 5. Strategic Long-Term Privacy Blueprint (Future Expansion Architecture)

Để dự án `fb-security` không chỉ dừng lại ở một extension nhỏ mà trở thành một **Hệ thống bảo vệ quyền riêng tư toàn diện (Privacy & Stealth Suite)** cho Facebook, Messenger và Instagram, dưới đây là các phân tích chi tiết cho 7 trụ cột tương lai:

### 1. Vùng mù số 1: Tin nhắn mã hóa đầu cuối (E2EE Chats) ⚠️
* **Bối cảnh:** Meta đã và đang chuyển dịch các cuộc trò chuyện cá nhân sang End-to-End Encryption (E2EE) mặc định.
* **Cơ chế mạng:** Các đoạn chat E2EE không đi thuần qua socket `/ws/lightspeed` thông thường, mà chạy qua:
  * Socket riêng: `wss://web-chat-e2ee.facebook.com/ws/chat`
  * Hoặc cầu nối ngầm qua iframe proxy: `https://www.fbsbx.com/maw_proxy_page/` (sử dụng thư viện mã hóa WhatsApp/Signal Protocol qua WebAssembly/Workers).
* **Nguy cơ:** Khi người dùng bật E2EE, tín hiệu "đã xem" được mã hóa trong payload nhị phân của Signal protocol trước khi gửi đi, khiến việc chỉ lọc nhãn `21`, `72` trên `/ws/lightspeed` không còn tác dụng.
* **Kế hoạch triển khai:** Nghiên cứu luồng gửi của `web-chat-e2ee` và `maw_proxy_page`, hook vào tầng API trước khi gói tin bị mã hóa nhị phân để chặn tín hiệu Read Receipt E2EE.

### 2. Tính năng "Đã nghe" tin nhắn thoại (Voice Note Played Receipt) 🎙️
* **Bối cảnh:** Khi nghe tin nhắn thoại (voice memo), Messenger có trạng thái riêng: **Đã nghe (Played)** — độc lập với "Đã xem".
* **Cơ chế:** Khi audio player phát xong hoặc bắt đầu phát, client bắn một mutation GraphQL hoặc task báo event `audio_clip_played`.
* **Kế hoạch triển khai:** Bắt và chặn request báo phát audio để người dùng có thể nghe tin nhắn thoại hoàn toàn bí mật.

### 3. Xem ảnh / video "Tự hủy" (View-Once Ephemeral Media) 📸
* **Bối cảnh:** Tính năng gửi ảnh/video xem 1 lần (View-once) trên Messenger và Instagram DMs tự động biến mất sau khi người nhận mở ra.
* **Kế hoạch triển khai:** 
  1. Chặn tín hiệu phản hồi xác nhận đã mở media gửi về server.
  2. Lưu trữ bản sao blob nhị phân của ảnh/video tạm thời vào bộ nhớ cục bộ (IndexedDB/blob URL) để người dùng có thể xem lại nhiều lần mà đối phương không biết.

### 4. Chống gỡ / Đọc tin nhắn bị thu hồi (Anti-Unsend / Ghost Messages) 👻
* **Bối cảnh:** Tính năng được 99% người dùng mong muốn nhất để chống lại hành vi "Thu hồi tin nhắn với mọi người".
* **Cơ chế:** Khi người gửi unsend, Meta gửi task xóa tin nhắn (`DeleteMessageTask` — trong mã nguồn `mautrix-meta` mang nhãn `33` hoặc `155`).
* **Kế hoạch triển khai:** 
  1. Hook vào luồng nhận tin nhắn đến (`WebSocket.onmessage`).
  2. Tự động lưu cache nội dung tin nhắn và media vào `IndexedDB` trên trình duyệt.
  3. Khi nhận được lệnh xóa từ socket, extension chặn hành vi xóa khỏi giao diện DOM, thay vào đó hiển thị nhãn cảnh báo: *"⚠️ Tin nhắn này đã bị người gửi thu hồi: [Nội dung]"*.

### 5. Chống rò rỉ địa chỉ IP thực qua WebRTC (`/ws/rpsignaling`) 🌐
* **Bối cảnh:** Socket `/ws/rpsignaling` điều phối kết nối WebRTC cho cuộc gọi thoại/video.
* **Nguy cơ rò rỉ:** Khi có lời mời gọi thoại/video, WebRTC sinh ra các ICE Candidates để thiết lập kết nối ngang hàng (P2P), vô tình để lộ địa chỉ IP thật của người dùng ra ngoài dù đang có extension proxy.
* **Kế hoạch triển khai:** Intercept `RTCPeerConnection.prototype.createOffer / createAnswer`, lọc bỏ host candidates cục bộ, chỉ cho phép relay candidates qua TURN server của Meta.

### 6. Đồng bộ sang Instagram Web (`gateway.instagram.com`) 📸
* **Bối cảnh:** Instagram Web dùng chung hạ tầng DGW của Meta nhưng dưới domain `gateway.instagram.com`.
* **Kế hoạch triển khai:**
  1. Nhãn tác vụ của Instagram không dùng chung số với Messenger (ví dụ Instagram có ID riêng).
  2. Áp dụng file probe đa socket để quét riêng domain `instagram.com/direct/inbox/`, xây dựng bảng từ điển nhãn độc lập trong `src/sites/instagram/signatures.ts`.

### 7. Chặn theo dõi thời gian dừng xem Story & Reels (Dwell Time Telemetry) ⏱️
* **Bối cảnh:** Meta liên tục gửi telemetry ngầm qua `/ajax/bz` và `navigator.sendBeacon` để đo chính xác từng mili-giây người dùng dừng lại xem một bài viết, Story hay Reel.
* **Kế hoạch triển khai:** Bọc `navigator.sendBeacon` và `fetch`, lọc bỏ các gói tin chứa `dwell_time`, `video_playback_logging` để triệt tiêu thuật toán theo dõi hành vi tâm lý của Meta.

---

## 6. Actionable Implementation Solutions (Mã Nguồn Mẫu & Thuật Toán Chặn Chi Tiết)

Để không phải "đoán mò" khi bắt tay vào code, dưới đây là các đoạn mã giải pháp thực chiến (Production-ready patterns) cho từng tính năng:

### 🛠️ Solution 1: Chặn Đã Xem Tin Nhắn (M3b - `hideReadReceipts`)
* **Nguyên tắc:** Drop frame nhị phân nếu nó chỉ chứa các task `21`, `72`, `235`.
```typescript
// src/interceptors/readReceipt.ts
const READ_RECEIPT_LABELS = new Set(['21', '72', '235']);

export function shouldDropReadReceiptFrame(url: string, data: Uint8Array): boolean {
  if (!url.includes('/ws/lightspeed')) return false;
  if (data.length < 30) return false; // Bỏ qua gói control/ping ngắn

  const decoded = decodeLightspeedFrame(data);
  if (!decoded || !decoded.tasks || decoded.tasks.length === 0) return false;

  // An toàn tuyệt đối: Chỉ drop khi 100% các task trong frame đều là nhãn đã xem
  const allReadReceipts = decoded.tasks.every(t => READ_RECEIPT_LABELS.has(String(t.label)));
  return allReadReceipts;
}
```

---

### 🛠️ Solution 2: Chế độ Tàng hình / Ẩn Chấm Xanh Online (M5 - `stealthMode`)
* **Nguyên tắc:** Ép các gói báo trạng thái hoạt động trên `/ws/streamcontroller` luôn ở trạng thái `offline/away` (`availability: 2`, `foregrounded: false`).
```typescript
// src/interceptors/stealthPresence.ts
export function transformStreamControllerPresence(url: string, text: string): string | null {
  if (!url.includes('/ws/streamcontroller')) return text;
  if (!text.includes('presenceReportingAmendment')) return text;

  try {
    const json = JSON.parse(text);
    if (json?.payload?.presenceReportingAmendment?.reportingArguments) {
      // Ghim chặt trạng thái Offline dù người dùng đang bấm gõ trong tab
      json.payload.presenceReportingAmendment.reportingArguments.availability = 2;
      json.payload.presenceReportingAmendment.reportingArguments.foregrounded = false;
      return JSON.stringify(json);
    }
  } catch {
    // Fallback nếu không parse được
  }
  return text;
}
```

---

### 🛠️ Solution 3: Xem Story Ẩn Danh (M4 - `hideStoryViews`)
* **Nguyên tắc:** Hook `window.fetch` và `XMLHttpRequest`, chặn request GraphQL báo view Story và trả về HTTP 200 giả lập để giao diện không bị giật/lỗi.
```typescript
// src/interceptors/storyView.ts
const STORY_MUTATION_NAMES = [
  'storiesUpdateSeenStateMutation',
  'StoriesUpdateSeenStateMutation',
  'useStoriesSeenMutation',
  'StoriesSeenMutation'
];

export function patchStoryGraphQLFetch(originalFetch: typeof fetch): typeof fetch {
  return async function (input: RequestInfo | URL, init?: RequestInit) {
    const url = typeof input === 'string' ? input : (input instanceof Request ? input.url : input.href);
    
    if (url.includes('/api/graphql/')) {
      const body = String(init?.body || '');
      const isStorySeen = STORY_MUTATION_NAMES.some(name => body.includes(name));

      if (isStorySeen) {
        // Drop request và trả về phản hồi 200 giả lập ngay lập tức
        return new Response(
          JSON.stringify({ data: { stories_update_seen_state: { success: true } } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
    return originalFetch(input, init);
  };
}
```

---

### 🛠️ Solution 4: Ẩn Thời Gian Vào Hộp Thư Đến (M5 - `hideInboxLastSeen`)
* **Nguyên tắc:** Drop frame chứa `Label 6` có `parent_thread_key: 0`.
```typescript
// src/interceptors/inboxWatermark.ts
export function shouldDropInboxWatermark(task: { label: string; payload: string }): boolean {
  if (task.label !== '6') return false;
  try {
    const data = JSON.parse(task.payload);
    // parent_thread_key === 0 là đánh dấu xem root inbox
    return data.parent_thread_key === 0;
  } catch {
    return false;
  }
}
```

---

### 🛠️ Solution 5: Chống Gỡ Tin Nhắn / Đọc Tin Nhắn Thu Hồi (M6+ - `antiUnsend`)
* **Nguyên tắc:** Lưu cache tin nhắn đến vào IndexedDB; khi server phát task xóa `Label 33/155`, chặn không cho xóa khỏi UI mà đổi style hiển thị.
```typescript
// src/interceptors/antiUnsend.ts
export function handleIncomingWebSocketMessage(eventData: string) {
  // 1. Khi nhận tin nhắn mới: Lưu vào cache
  if (eventData.includes('"insertMessage"')) {
    saveMessageToIndexedDB(parseMessage(eventData));
  }

  // 2. Khi nhận lệnh xóa từ người gửi (Label 33: DeleteMessageTask)
  if (eventData.includes('"label":"33"') || eventData.includes('"label":"155"')) {
    // Thay vì xóa element trong DOM, đánh dấu element có viền đỏ: "Tin nhắn đã bị gỡ"
    markMessageAsRevokedInDOM(parseRevokedMessageId(eventData));
    // Chặn không cho client xóa message nội bộ
    return false;
  }
  return true;
}
```

---

### 🛠️ Solution 6: Chống Rò Rỉ Địa Chỉ IP Thật Qua WebRTC (M6+ - `webrtcShield`)
* **Nguyên tắc:** Lọc bỏ các ICE Candidates kiểu `host` hoặc `srflx`, chỉ cho phép `relay` (TURN).
```typescript
// src/interceptors/webrtcShield.ts
export function patchRTCPeerConnection() {
  const OriginalPC = window.RTCPeerConnection;
  if (!OriginalPC) return;

  window.RTCPeerConnection = function (config?: RTCConfiguration) {
    if (config && config.iceCandidatePoolSize) {
      config.iceCandidatePoolSize = 0;
    }
    // Ép WebRTC chỉ dùng TURN server trung gian, không dò IP P2P trực tiếp
    if (config) {
      config.iceTransportPolicy = 'relay';
    }
    return new OriginalPC(config);
  } as unknown as typeof RTCPeerConnection;
}
```


