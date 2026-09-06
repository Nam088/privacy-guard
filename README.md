# Privacy Guard

Privacy Guard is an advanced, privacy-focused browser extension designed to eliminate behavioral tracking, invasive telemetry, and social surveillance on Meta platforms (Facebook, Messenger, and Instagram).

The extension intercepts network signals, real-time WebSocket frames, and Web Worker threads to protect user privacy without breaking website functionality.

---

## Languages / Ngôn ngữ

- [English Documentation](#english)
- [Tài liệu Tiếng Việt](#tieng-viet)

---

<a name="english"></a>
## English

### Key Features

#### 1. Messaging and Privacy Protection
- **Hide Read Receipts (`hideReadReceipts`)**: Read incoming messages on Facebook and Messenger without triggering "Seen" indicators. Suppresses read watermark frames (labels 21, 72, 235) across WebSocket DGW endpoints (`/ws/lightspeed`, `/ws/realtime`), GraphQL mutations (`useReadReceiptMutation`, `MarkThreadReadMutation`), and Armadillo E2EE Web Worker actions.
- **Hide Typing Indicator (`hideTyping`)**: Completely removes the three animated typing dots in popup chats, full-screen Messenger, and End-to-End Encrypted (E2EE) conversations. Prevents `sendChatStateFromComposer` events from leaking typing status while preserving the stop/idle signal when you stop typing.
- **Invisible Mode / Hide Online Status (`hideOnlineStatus`)**: Browse Messenger without exposing the green active presence dot. Transforms outgoing presence stream packets on `/ws/streamcontroller` to report offline state while allowing incoming messages to be received normally.
- **Hide Story Views (`hideStoryViews`)**: Watch Facebook stories anonymously. Suppresses story impression telemetry and view mutations sent to `/api/graphql/`, preventing your profile from appearing in the viewer list.
- **Hide Inbox Last Seen (`hideInboxLastSeen`)**: Blocks the root-level watermark (label 6 with parent thread key 0) sent when opening Messenger, hiding the exact timestamp you accessed your inbox.
- **WebRTC IP Leak Shield (`protectWebRtcIp`)**: Prevents exposure of private LAN and public IP addresses during Messenger voice and video calls by filtering ICE candidate gathering.
- **Hide Voice Note Played Marker (`hideVoicePlayed`)**: Listens to voice messages safely. Defends against audio playback receipts and telemetry mutations.
- **Bypass Link Shim Tracking (`bypassLinkShim`)**: Automatically strips Meta's tracking redirect (`l.facebook.com/l.php?u=...` and `lm.facebook.com`) on links. Opens external websites directly and accelerates navigation without Meta logging your outbound destinations.

#### 2. Feed and Content Control
- **Hide Sponsored Posts (`hideSponsoredPosts`)**: Automatically filters out sponsored advertisements and promotional campaigns from your main feed.
- **Hide Suggested Posts (`hideSuggestedPosts`)**: Cleanses the feed of algorithmically recommended content ("Suggested for you"), displaying only updates from friends and followed pages.
- **Hide Reels and Short Videos (`hideReels`)**: Removes Reels shelves and short video players from your feed to minimize distraction.
- **Stop Feed Auto-Reload (`blockFeedAutoRefresh`)**: Disables background page visibility events that cause Facebook to reload or scroll away from your current feed position when switching tabs.
- **Scramble Dwell Time Tracking (`scrambleDwellTime`)**: Blocks Meta's Merlin Unified Protocol telemetry on `/ws/realtime`, preventing Meta from measuring exact milliseconds spent viewing posts.

#### 3. Global Anti-Tracking
- **Block Meta Tracking Pixels (`meta-pixel`)**: Blocks third-party tracking scripts (`fbevents.js`, `facebook.com/tr/`, `signals/`) across the web using declarativeNetRequest rules.
- **Strip `fbclid` Parameter (`fbclid`)**: Automatically removes the `fbclid` query parameter from external URLs to prevent cross-site correlation.

---

### Technical Architecture

Privacy Guard utilizes a decoupled, defense-in-depth architecture:
- **WebSocket Protocol Interception**: Parses binary frames from Meta's Device Gateway (DGW) across `/ws/lightspeed` and `/ws/realtime` using zero-copy byte extraction.
- **Worker and MessagePort Proxying**: Traps background worker bridges (`MAWBridgeFireAndForget`) and postMessage channels to intercept Armadillo E2EE states before encryption.
- **Cross-Browser Engine**: Native Manifest V3 support across Chromium (Chrome, Edge, Brave) and Gecko (Firefox 128+). Firefox includes declarative CSP modification and Xray vision serialization (`cloneInto`).

---

### Installation and Development

#### Prerequisites
- Node.js 22 or newer
- pnpm 9 or newer

#### Setup
```bash
pnpm install
```

#### Run in Development Mode
```bash
# Chromium (Chrome, Edge, Brave)
pnpm dev

# Firefox (auto-loads temporary profile)
pnpm dev:firefox
```

#### Production Builds
```bash
# Build all browsers (Chrome, Edge, Firefox)
pnpm build:all

# Output directories:
# .output/chrome-mv3
# .output/edge-mv3
# .output/firefox-mv3
```

#### Running Verification Suite
```bash
pnpm compile    # Typecheck with tsc
pnpm test       # Run Vitest unit tests
pnpm lint       # ESLint rules
```

---

<a name="tieng-viet"></a>
## Tiếng Việt

### Danh sách tính năng

#### 1. Quyền riêng tư và Bảo mật tin nhắn
- **Chặn Đã xem (`hideReadReceipts`)**: Đọc tin nhắn trên Facebook và Messenger mà không gửi thông báo Đã xem (Seen). Chặn các gói tin watermark (nhãn 21, 72, 235) trên cả kênh WebSocket DGW (`/ws/lightspeed`, `/ws/realtime`), GraphQL mutation (`useReadReceiptMutation`, `MarkThreadReadMutation`) và Web Worker mã hóa đầu cuối Armadillo.
- **Ẩn 3 chấm đang soạn tin (`hideTyping`)**: Triệt tiêu hoàn toàn bong bóng 3 chấm nhấp nháy khi bạn gõ phím trong khung chat popup, Messenger toàn màn hình và cả cuộc trò chuyện mã hóa E2EE. Chặn event `sendChatStateFromComposer` nhưng vẫn bảo toàn tín hiệu dừng gõ khi bạn ngưng nhập liệu.
- **Chế độ tàng hình / Ẩn chấm xanh Online (`hideOnlineStatus`)**: Lướt Messenger mà không hiện chấm xanh hoạt động. Chỉnh sửa gói tin presence trên kênh `/ws/streamcontroller` sang trạng thái offline nhưng vẫn nhận tin nhắn đến bình thường.
- **Xem Story ẩn danh (`hideStoryViews`)**: Xem Story của bạn bè mà không xuất hiện trong danh sách người đã xem. Chặn toàn bộ request ghi nhận lượt xem gửi lên `/api/graphql/`.
- **Ẩn thời gian mở hộp thư (`hideInboxLastSeen`)**: Chặn watermark gốc (nhãn 6 với parent thread key 0), ngăn Messenger lưu lại mốc thời gian bạn vừa truy cập danh sách chat.
- **Chống rò rỉ IP qua WebRTC (`protectWebRtcIp`)**: Bảo vệ địa chỉ IP mạng nội bộ (LAN) và IP công cộng khỏi bị lộ khi thực hiện cuộc gọi thoại và video trên Messenger.
- **Phòng thủ tin nhắn thoại (`hideVoicePlayed`)**: Nghe tin nhắn thoại an toàn, chặn các receipt telemetry về việc phát âm thanh.
- **Bỏ qua chuyển hướng Link Shim (`bypassLinkShim`)**: Tự động gọt bỏ link chuyển hướng theo dõi `l.facebook.com/l.php?u=...` và `lm.facebook.com`. Mở thẳng liên kết đích giúp tăng tốc độ tải trang và ngăn Meta ghi nhận bạn vừa bấm vào liên kết nào.

#### 2. Kiểm soát Bảng tin (Feed)
- **Ẩn bài viết quảng cáo (`hideSponsoredPosts`)**: Tự động loại bỏ các bài viết Được tài trợ (Sponsored) khỏi bảng tin.
- **Ẩn bài viết gợi ý (`hideSuggestedPosts`)**: Lọc sạch nội dung đề xuất thuật toán (Gợi ý cho bạn), chỉ hiển thị bài đăng từ bạn bè và các trang bạn đang theo dõi.
- **Ẩn Reels và video ngắn (`hideReels`)**: Ẩn hoàn toàn khay Reels và các clip ngắn trên bảng tin để tránh xao nhãng.
- **Chặn tự động tải lại trang (`blockFeedAutoRefresh`)**: Ngăn Facebook tự động cuộn hoặc reload làm mất vị trí bài viết khi bạn chuyển tab.
- **Chặn đo thời gian dừng xem (`scrambleDwellTime`)**: Chặn giao thức Merlin Unified Protocol trên `/ws/realtime`, không cho Meta ghi nhận số mili-giây bạn dừng lại xem bài viết hoặc video.

#### 3. Chặn theo dõi toàn diện
- **Chặn Meta Pixel (`meta-pixel`)**: Chặn các đoạn mã theo dõi hành vi (`fbevents.js`, `facebook.com/tr/`, `signals/`) trên các trang web bên ngoài bằng quy tắc declarativeNetRequest.
- **Gọt bỏ tham số `fbclid` (`fbclid`)**: Tự động xóa đuôi theo dõi `fbclid` trên thanh địa chỉ URL khi bấm chuyển trang ra ngoài.

---

### Kiến trúc kỹ thuật

Privacy Guard được thiết kế theo mô hình phòng thủ đa lớp:
- **Chặn bắt giao thức WebSocket**: Giải mã nhị phân các khung DGW trên `/ws/lightspeed` và `/ws/realtime` với độ trễ cực thấp.
- **Proxy Web Worker và MessagePort**: Bắt các kênh nội bộ của Meta (`MAWBridgeFireAndForget`) để kiểm soát trạng thái chat E2EE trước khi dữ liệu bị mã hóa.
- **Hỗ trợ đa trình duyệt**: Chuẩn Manifest V3 cho cả Chromium (Chrome, Edge, Brave) và Gecko (Firefox 128+). Bản Firefox tích hợp sẵn bộ lọc CSP và cơ chế xử lý Xray vision (`cloneInto`).

---

### Hướng dẫn Cài đặt và Phát triển

#### Yêu cầu hệ thống
- Node.js phiên bản 22 trở lên
- pnpm phiên bản 9 trở lên

#### Cài đặt dependencies
```bash
pnpm install
```

#### Chạy trong môi trường phát triển
```bash
# Cho Chrome, Edge, Brave
pnpm dev

# Cho Firefox (tự động mở cửa sổ thử nghiệm)
pnpm dev:firefox
```

#### Build bản phát hành
```bash
# Build cho tất cả trình duyệt
pnpm build:all

# Thư mục đầu ra sau khi build:
# .output/chrome-mv3   (Cho Chrome và Chromium)
# .output/edge-mv3     (Cho Microsoft Edge)
# .output/firefox-mv3  (Cho Mozilla Firefox)
```

#### Kiểm tra chất lượng mã nguồn
```bash
pnpm compile    # Kiểm tra kiểu dữ liệu TypeScript
pnpm test       # Chạy toàn bộ test suite Vitest
pnpm lint       # Kiểm tra cú pháp và quy tắc ESLint
```
