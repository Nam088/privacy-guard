Privacy Guard là công cụ bảo vệ quyền riêng tư chạy hoàn toàn phía máy bạn, giúp bạn lấy lại quyền kiểm soát những tín hiệu mà tài khoản mạng xã hội đang tự động gửi đi thay bạn: ai biết bạn đã đọc tin nhắn, ai biết bạn đã xem story, bạn dừng lại bao nhiêu giây trên một bài viết, và ai đang theo dõi bạn trên khắp phần còn lại của Internet. Mọi tính năng đều chạy cục bộ trong trình duyệt, và mỗi tính năng là một công tắc do bạn quyết định.

## Bảo vệ những gì

### Facebook và Messenger

- **Ẩn dấu đã xem (seen)**, đọc tin nhắn và story mà không gửi tín hiệu đã đọc.
- **Ẩn dấu đang nhập** trong chat riêng và chat nhóm.
- **Ẩn dấu đã nghe tin nhắn thoại**, nghe mà người gửi không được thông báo.
- **Chế độ ẩn (invisible)**, tắt chấm xanh đang hoạt động nhưng vẫn chat bình thường.
- **Ẩn thời điểm bạn mở hộp thư**, Messenger không còn ghi lại mốc thời gian đó.
- **Ẩn lượt xem story**, bạn không xuất hiện trong danh sách người đã xem.
- **Ẩn lượt xem livestream**, xem Facebook Live một cách ẩn danh.
- **Làm nhiễu dữ liệu thời gian xem**, chặn các beacon Comet Banzai mà Meta dùng để đo chính xác số giây bạn dừng lại trên một bài viết hoặc video.
- **Tìm kiếm ẩn danh, không lưu lịch sử**: Tìm một người không còn bị ghi vào tìm kiếm gần đây và không làm lệch gợi ý của bạn.
- **Chống lộ IP qua WebRTC**, ngăn địa chỉ IP nội bộ và IP công khai bị rò rỉ trong lúc gọi.
- **Bỏ qua Link Shim**, mở link ngoài trực tiếp thay vì đi qua trang chuyển hướng theo dõi của Facebook.
- **Dọn dẹp bảng tin**: ẩn bài được tài trợ, ẩn bài gợi ý, ẩn Reels và video ngắn, và chặn bảng tin tự tải lại khi bạn quay lại tab.

### Instagram

- **Ẩn dấu đã xem** trong tin nhắn trực tiếp.
- **Ẩn bong bóng đang nhập** trong tin nhắn trực tiếp.
- **Ẩn lượt xem story và lượt xem livestream**, bao gồm cả thông báo tham gia mà Instagram Live thường gửi đi.
- **Chế độ ẩn cho Instagram Direct**, không còn chấm trạng thái đang hoạt động.
- **Làm nhiễu dữ liệu thời gian xem**, chặn các heartbeat theo dõi video nội tuyến dùng để lập hồ sơ thời lượng xem.
- **Tìm kiếm ẩn danh, không lưu lịch sử** cho tài khoản và hashtag.
- **Chống lộ IP qua WebRTC** khi gọi trên Instagram Direct.
- **Bỏ qua Link Shim** cho link ngoài.
- **Dọn dẹp bảng tin**: ẩn quảng cáo và bài được tài trợ, ẩn bài gợi ý, ẩn kệ Reels và carousel video.

### Trên khắp phần còn lại của Internet

- **Chặn pixel theo dõi của Meta** ngay trước khi nó được tải, gồm `connect.facebook.net/en_US/fbevents.js` và các endpoint `signals/config`, dùng chính cơ chế `declarativeNetRequest` của trình duyệt.
- **Xóa tham số theo dõi** khỏi link bạn bấm vào: `fbclid`, `igshid`, `utm_*`, `si` và `gclid`. Tính năng này mặc định tắt và sẽ xin quyền trước, vì đây là tính năng duy nhất cần đọc các trang web khác.

## Cơ chế hoạt động

Privacy Guard đứng giữa trang web và mạng. Nó kiểm tra request ở các lớp `fetch`, `XHR`, `WebSocket` và `Web Worker`, đồng thời hiểu được các giao thức riêng của Meta, gồm hạ tầng nhắn tin DGW LightSpeed và GraphQL. Nhờ vậy nó chỉ loại bỏ đúng một beacon telemetry thay vì chặn cả endpoint, nên nhắn tin, gọi điện và video vẫn hoạt động bình thường.

Bộ máy xử lý quy tắc được thiết kế theo hướng bất đối xứng và luôn ưu tiên cho request đi qua khi có sự cố. Nếu một quy tắc gặp dữ liệu lạ hoặc phát sinh lỗi, request sẽ được cho qua nguyên vẹn. Một lỗi trong quy tắc bảo mật sẽ không bao giờ làm hỏng bảng tin, tin nhắn hay cuộc gọi của bạn.

## Cam kết về quyền riêng tư

- **Chạy hoàn toàn trong trình duyệt của bạn.** Không có backend, không cần tài khoản, không cần đăng nhập.
- **Không có server từ xa.** Không telemetry, không analytics, không báo lỗi, không ghi log ra bên ngoài.
- **Không thu thập dữ liệu.** Cấu hình của bạn nằm trong `browser.storage.local` trên chính thiết bị của bạn và không bao giờ rời khỏi đó. Manifest cho Firefox khai báo không thu thập dữ liệu.
- **Quyền tối thiểu theo mặc định.** Quyền truy cập bắt buộc chỉ gồm `facebook.com`, `messenger.com`, `instagram.com` và `fbsbx.com`. Quyền truy cập mọi trang là tùy chọn và chỉ được xin khi bạn bật tính năng xóa tham số theo dõi trong link.
- **Không tải mã từ xa.** Mọi thứ chạy trong tiện ích đều nằm trong gói đã được kiểm duyệt.
- **Mã nguồn mở theo giấy phép GNU GPLv3**, ai cũng có thể tự do kiểm chứng và đóng góp cho dự án.
