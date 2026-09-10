# Chrome Web Store - Privacy & Permission Justifications

Paste-ready answers for the **Privacy Practices** (Quyền riêng tư) tab on Chrome Web Store Developer Dashboard.

---

## 1. Single Purpose (Mục đích duy nhất)

### Tiếng Việt (Khuyên dùng nếu CWS đang ở giao diện Tiếng Việt):
```text
Bảo vệ quyền riêng tư người dùng trên Facebook, Messenger và Instagram bằng cách ngăn chặn các tín hiệu viễn trắc (telemetry) gửi ngầm như dấu đã xem (seen), thông báo đang nhập (typing), bộ đếm thời gian xem (dwell time), và chặn các pixel theo dõi của Meta trên web. Toàn bộ quá trình xử lý diễn ra cục bộ trên thiết bị của người dùng mà không gửi dữ liệu ra bên ngoài.
```

### English:
```text
Protects user privacy across Facebook, Messenger, and Instagram by intercepting background telemetry signals (read receipts, typing indicators, dwell-time trackers) and blocking Meta tracking pixels across the web. All processing runs entirely locally on the user's browser with zero external data transmission.
```

---

## 2. Permission Justifications (Lý do yêu cầu quyền)

### Lý do yêu cầu `storage`:
- **Tiếng Việt:**
```text
Quyền 'storage' được sử dụng duy nhất để lưu các tùy chọn cài đặt và trạng thái bật/tắt các tính năng bảo vệ của người dùng cục bộ trên trình duyệt (thông qua chrome.storage.local). Tiện ích không thu thập, không lưu trữ thông tin cá nhân và không truyền tải bất kỳ dữ liệu cài đặt nào ra khỏi thiết bị của người dùng.
```
- **English:**
```text
The 'storage' permission is strictly used to store user feature preferences and protection toggles locally on their device via chrome.storage.local. No personal data or browsing history is stored, and no settings data is ever transmitted outside the user's local machine.
```

### Lý do yêu cầu `declarativeNetRequest`:
- **Tiếng Việt:**
```text
Quyền 'declarativeNetRequest' được sử dụng để chặn các script theo dõi của Meta (như Meta Pixel connect.facebook.net/.../fbevents.js) và loại bỏ tham số theo dõi (fbclid) ở tầng mạng bằng các quy tắc đã khai báo sẵn. Cơ chế này cho phép trình duyệt tự thực thi việc chặn mà mã tiện ích không cần đọc hay can thiệp vào nội dung request của người dùng, đảm bảo tối đa quyền riêng tư và hiệu năng.
```
- **English:**
```text
The 'declarativeNetRequest' permission is used to block known Meta tracking scripts (e.g. Meta Pixel connect.facebook.net/.../fbevents.js) and remove tracking parameters (fbclid) at the network layer using pre-declared rule sets. This allows the browser to perform blocking directly without the extension inspecting user request payloads, guaranteeing privacy and optimal performance.
```

### Lý do yêu cầu Quyền từ phía máy chủ (Host Permissions):
- **Tiếng Việt:**
```text
Quyền từ phía máy chủ chỉ giới hạn trong 4 tên miền thuộc Meta (*.facebook.com, *.messenger.com, *.instagram.com, *.fbsbx.com). Quyền này là bắt buộc để nạp content script và page observer cục bộ nhằm chặn các beacon telemetry ngầm (dấu đã xem, bong bóng đang nhập, theo dõi thời gian dừng trên bài viết và ngăn lộ địa chỉ IP qua WebRTC) ngay trên giao diện các trang mạng xã hội này. Tiện ích không truy cập bất kỳ website máy chủ nào khác theo mặc định.
```
- **English:**
```text
Host permissions are strictly limited to 4 Meta domains (*.facebook.com, *.messenger.com, *.instagram.com, *.fbsbx.com). This access is necessary to inject local content scripts and page observers to intercept background telemetry beacons (read receipts, typing indicators, dwell time trackers, and WebRTC IP leak prevention) directly within these social web applications. The extension does not access any other host by default.
```

---

## 3. Remote Code (Mã từ xa)

- **Lựa chọn:** Chọn **`Không, tôi hiện không sử dụng Mã từ xa`** (No, I am not using remote code).
- *Lưu ý:* Tiện ích tuân thủ Manifest V3, toàn bộ mã chạy từ gói nén cục bộ, không có `eval()` và không nạp script từ bên ngoài.

---

## 4. Data Usage (Sử dụng dữ liệu)

- **Bạn định thu thập loại dữ liệu nào của người dùng bây giờ hoặc trong tương lai?**
  👉 **ĐỂ TRỐNG TOÀN BỘ (KHÔNG TÍCH BẤT KỲ Ô NÀO)**.
  - Theo chính sách Chrome Web Store, xử lý logic cục bộ mà không gửi dữ liệu ra máy chủ từ xa/bên thứ ba/analytics thì không tính là "thu thập dữ liệu". Privacy Guard hoàn toàn không truyền tải bất kỳ dữ liệu nào ra khỏi máy người dùng.

- **Cam kết (Tôi xác nhận rằng các thông tin công bố sau đây đều đúng sự thật):**
  👉 **TÍCH CHỌN CẢ 3 Ô**:
  - [x] Tôi không bán hoặc chuyển dữ liệu người dùng cho bên thứ ba, ngoài những trường hợp sử dụng đã được phê duyệt
  - [x] Tôi không sử dụng hoặc chuyển dữ liệu người dùng cho các mục đích không liên quan đến mục đích duy nhất của mặt hàng mà tôi sở hữu
  - [x] Tôi không sử dụng hoặc chuyển dữ liệu người dùng để xác định khả năng thanh toán nợ hoặc phục vụ mục đích cho vay

---

## 5. Privacy Policy URL (URL đến chính sách quyền riêng tư)

```text
https://github.com/Nam088/privacy-guard/blob/main/docs/PRIVACY.md
```
