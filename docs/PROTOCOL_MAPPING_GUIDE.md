# Hướng Dẫn Sử Dụng Protocol & Action Mapping Cho Agent & Developer

Tài liệu này và file định nghĩa [protocol-action-mapping.json](file:///Users/nam088/code/nam088/fb-security/docs/protocol-action-mapping.json) cung cấp **bản đồ chuẩn (Ground Truth)** ánh xạ giữa các hành vi người dùng trên giao diện web (UI Actions) với các gói tin mạng, WebSocket Gateway, Web Worker và quy tắc can thiệp của Privacy Guard.

Các Agent hoặc Developer tiếp theo **không cần phải dò tìm lại bằng tay (manual hunting)** mà có thể nạp trực tiếp file JSON này để kiểm thử và đối soát.

---

## 1. Cấu Trúc File `docs/protocol-action-mapping.json`

File JSON được phân chia thành 3 phần chính:

1. **`surfaces`**: Chứa thông tin về từng bề mặt giao diện của Facebook/Messenger:
   - `facebook_popup_chat`: Cửa sổ chat nhỏ (docked popup chat / flyout) ở góc dưới bên phải Facebook (`web.facebook.com`).
   - `messenger_web_full`: Giao diện toàn màn hình của Messenger (`messenger.com`).
   - `facebook_feed`: Bảng tin chính của Facebook.
   *Mỗi surface định nghĩa rõ selector DOM của khung soạn thảo (`composerSelector`), vùng chứa (`containerSelector`), cách mở popup (`openTrigger`) và danh sách WebSocket/Worker Gateways.*

2. **`actions`**: Danh sách tất cả các hành vi người dùng được chuẩn hóa:
   - `USER_TYPING`: Người dùng nhấn phím trong khung soạn thảo.
   - `USER_STOP_TYPING`: Người dùng dừng gõ phím (> 1.5s) hoặc nhấp chuột ra ngoài (blur).
   - `USER_SEND_MESSAGE`: Người dùng bấm Enter hoặc click nút Gửi.
   - `USER_OPEN_CHAT`: Người dùng nhấp mở cuộc trò chuyện hoặc tab chat.
   - `USER_VIEW_STORY`: Người dùng bấm xem Story.
   - `USER_SCROLL_FEED`: Người dùng cuộn bảng tin.
   *Mỗi action định nghĩa: Sự kiện DOM kích hoạt, Gói tin mạng phát ra (Layer, Module, Endpoint, Payload format), và Quy tắc can thiệp của Privacy Guard khi BẬT / TẮT.*

3. **`anomalyDefinitions`**: Các ngưỡng phát hiện lỗi sai logic:
   - `OUTBOUND_MESSAGE_BLOCKED` (CRITICAL): Gửi tin nhắn thật nhưng bị chặn nhầm.
   - `STOP_TYPING_SUPPRESSED` (HIGH): Tín hiệu dừng gõ bị chặn nhầm làm đối phương bị kẹt 3 chấm vĩnh viễn.
   - `MIXED_FRAME_LEAK` (MEDIUM): Frame hỗn hợp cho qua làm rò rỉ tín hiệu.

---

## 2. Cách Agent / Developer Đọc File JSON Bằng Code

### Trong Node.js / Playwright:
```javascript
import fs from 'node:fs';

const mapping = JSON.parse(fs.readFileSync('docs/protocol-action-mapping.json', 'utf8'));

// 1. Lấy selector khung chat của Popup Chat Facebook
const popupComposerSelector = mapping.surfaces.facebook_popup_chat.composerSelector;
console.log('Popup Composer Selector:', popupComposerSelector);

// 2. Tra cứu gói tin phát ra khi người dùng gõ phím
const typingConfig = mapping.actions.USER_TYPING;
console.log('Typing Gateways:', typingConfig.emittedNetworkEvents);

// 3. Kiểm tra điều kiện Anomaly khi test
function checkAnomaly(action, eventDetail) {
  if (action === 'USER_SEND_MESSAGE' && eventDetail.kind.includes('suppressed')) {
    return mapping.anomalyDefinitions.OUTBOUND_MESSAGE_BLOCKED;
  }
  return null;
}
```

---

## 3. Chi Tiết Thực Nghiệm: Thao Tác Gõ Trong Facebook Popup Chat

Khi gõ tin nhắn trong **Popup Chat Facebook** (`web.facebook.com`), hệ thống Meta vận hành theo luồng sau:

### A. Vị trí phần tử (DOM Target)
- Vùng chứa Popup: `div[aria-label="Công cụ soạn cuộc trò chuyện"]` hoặc `div[data-pagelet="CometChatTab"]`.
- Khung gõ văn bản: `div[aria-label="Công cụ soạn cuộc trò chuyện"] div[role="textbox"][contenteditable="true"]`.

### B. Các sự kiện mạng phát sinh khi gõ:
1. **Tầng Runtime Bridge (MAWBridge)**:
   - Meta kích hoạt hàm nội bộ `MAWBridgeFireAndForget.fireAndForget("backend", "sendChatStateFromComposer", threadKey, 1)`.
   - Giao tiếp với `SharedWorker` (`MAWMainV4WebWorkerBundle`) qua kênh `port.postMessage`.
2. **Tầng WebSocket Realtime**:
   - Gói tin nhị phân được gửi qua WebSocket Gateway `wss://gateway.facebook.com/ws/realtime?x-dgw-appid=2220391788200892` và `/ws/streamcontroller`.
   - Chứa thông tin trạng thái `state: 1` (Typing).
3. **Khi Dừng Gõ (`USER_STOP_TYPING`)**:
   - Khi blur hoặc hết timeout gõ phím, module `WAChatState` kích hoạt gửi gói tin trạng thái dừng: `state: 0` (Idle / Stop).

### C. Cơ chế can thiệp của Privacy Guard:
- **Khi BẢO VỆ TẮT**: Cả tín hiệu `TYPING` (1) và `STOP` (0) đi qua máy chủ Meta 100% không bị cản trở.
- **Khi BẢO VỆ BẬT**:
  - Tín hiệu `TYPING` (1) bị bắt và nuốt tại `src/observe/mawBridge.ts` và `src/sites/facebook/rules.ts` $\rightarrow$ Frame mạng không bị đẩy lên server $\rightarrow$ Đối phương **không** thấy 3 chấm đang gõ.
  - Tín hiệu `STOP` (0) được bộ lọc `isStopState()` nhận diện và **cho qua an toàn** $\rightarrow$ Đảm bảo không bao giờ gây lỗi kẹt biểu tượng 3 chấm ở phía người nhận.
