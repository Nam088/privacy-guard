import type { TranslationDictionary } from '../types';

export const vi: TranslationDictionary = {
  app: {
    name: 'Privacy Guard',
    protectionOn: 'Bảo vệ đang bật',
    protectionPaused: 'Đang tạm dừng bảo vệ',
    protection: 'Bảo vệ',
    openSiteHint:
      'Mở Facebook, Messenger hoặc Instagram để điều khiển cho trang đó. Các cài đặt bên dưới áp dụng cho mọi trang web.',
    footerNotice: 'Chỉ hoạt động trên phiên của bạn. Privacy Guard không gửi dữ liệu đi bất cứ đâu.',
    trustCaption: 'Không thu thập dữ liệu',
    socialAssistant: 'Trợ lý bảo vệ mạng xã hội',
    webAssistant: 'Trợ lý bảo vệ web',
    activeProtectionSummary: (siteName: string) => `Đang bảo vệ riêng tư & lọc sạch trên ${siteName}.`,
    standbySummary: 'Sẵn sàng kích hoạt tự động khi bạn mở Facebook hoặc Instagram.',
    resumeHint: 'Gạt công tắc ở góc trên bên phải để bật lại bảo vệ.',
    e2eeNotice: 'Đã trang bị lớp bảo vệ kép cho cả Messenger tiêu chuẩn & mã hóa E2EE (Armadillo).',
  },
  quickPresets: {
    stealthTitle: 'Tàng hình 1 chạm',
    stealthSubtitle: 'Chặn xem & gõ phím',
    stealthTooltip: 'Bật tất cả tính năng tàng hình (chặn xem, gõ phím, story, online)',
    cleanTitle: 'Lọc sạch 1 chạm',
    cleanSubtitle: 'Ẩn tài trợ & reels',
    cleanTooltip: 'Bật tất cả tính năng dọn dẹp bảng tin (tài trợ, gợi ý, reels)',
  },
  section: {
    allWebsites: 'Tất cả trang web',
    feed: 'Bảng tin & Nội dung',
    privacy: 'Tin nhắn & Quyền riêng tư',
  },
  tabs: {
    feed: 'Bảng tin',
    privacy: 'Riêng tư',
    global: 'Toàn web',
    all: 'Tất cả',
    facebook: 'Facebook',
    instagram: 'Instagram',
  },
  dashboard: {
    totalActiveFeatures: (count: number) => `${count} tính năng đang bật`,
    activeNow: 'Đang mở',
    platformSubtitle: (name: string) => `Cấu hình bảo vệ riêng tư & lọc nội dung ${name}`,
    globalDescription: 'Các lớp bảo vệ quyền riêng tư hoạt động trên mọi trang web bạn truy cập.',
  },
  common: {
    soon: 'Sắp ra mắt',
    auto: 'Tự động',
    activeCount: 'đang bật',
    activeSite: 'Trang hiện tại',
  },
  site: {
    facebook: 'Facebook',
    messenger: 'Messenger',
    instagram: 'Instagram',
  },
  search: {
    placeholder: 'Tìm kiếm tính năng (vd: đang gõ, quảng cáo, reels)...',
    noResultsTitle: 'Không tìm thấy tính năng',
    noResultsHint: 'Thử tìm bằng từ khoá khác hoặc tiếng Anh (vd: typing, ads, reels, story)',
    clear: 'Xoá tìm kiếm',
    resultsCount: (count: number) => `Tìm thấy ${count} tính năng`,
    allPlatforms: 'Tất cả nền tảng',
    shortcutHint: 'Nhấn / để tìm, Esc để xoá',
  },
  features: {
    'facebook.hideReadReceipts': {
      label: 'Chặn đã xem tin nhắn',
      description: 'Đọc tin nhắn mà không để người gửi biết bạn đã xem',
    },
    'facebook.hideTyping': {
      label: 'Chặn đang soạn tin nhắn',
      description: 'Không hiển thị ba dấu chấm khi bạn đang gõ phím',
    },
    'facebook.hideStoryViews': {
      label: 'Xem tin ẩn danh (Story)',
      description: 'Xem story mà không xuất hiện trong danh sách người xem',
    },
    'facebook.hideLiveStreamViews': {
      label: 'Xem trực tiếp ẩn danh (Livestream)',
      description: 'Xem video trực tiếp Facebook mà không xuất hiện trong danh sách người xem',
    },
    'facebook.blockFeedAutoRefresh': {
      label: 'Chặn tự động tải lại bảng tin',
      description: 'Giữ nguyên vị trí đang lướt khi bạn chuyển tab quay lại',
    },
    'facebook.hideInboxLastSeen': {
      label: 'Ẩn thời điểm bạn mở hộp thư',
      description: 'Không để Messenger ghi lại thời điểm bạn xem danh sách trò chuyện lần cuối',
    },
    'facebook.hideSponsoredPosts': {
      label: 'Ẩn bài viết được tài trợ',
      description: 'Ẩn các bài viết quảng cáo và tài trợ trên bảng tin của bạn',
    },
    'facebook.hideSuggestedPosts': {
      label: 'Ẩn bài viết gợi ý',
      description: 'Chỉ hiển thị bài viết từ bạn bè và các trang bạn đang theo dõi',
    },
    'facebook.hideReels': {
      label: 'Ẩn Reels & Video ngắn',
      description: 'Ẩn các mục Reels, Thước phim và khay video ngắn trên bảng tin',
    },
    'facebook.hideOnlineStatus': {
      label: 'Chế độ tàng hình (Ẩn chấm xanh)',
      description: 'Lướt Messenger hoàn toàn ẩn danh không bao giờ hiện chấm xanh hoạt động',
    },
    'facebook.protectWebRtcIp': {
      label: 'Chống rò rỉ IP qua WebRTC',
      description: 'Ngăn chặn lộ địa chỉ IP thật của bạn trong các cuộc gọi Messenger',
    },
    'facebook.hideVoicePlayed': {
      label: 'Ẩn trạng thái đã nghe tin nhắn thoại',
      description: 'Nghe tin nhắn thoại mà không để đối phương biết bạn đã nghe',
    },
    'facebook.scrambleDwellTime': {
      label: 'Chặn theo dõi chuột & thời gian xem',
      description: 'Chặn Meta thu thập cử chỉ chuột, bản đồ nhiệt hover và số giây dừng xem',
    },
    'facebook.bypassLinkShim': {
      label: 'Bỏ qua chuyển hướng theo dõi (Link Shim)',
      description: 'Mở trực tiếp liên kết bên ngoài mà không qua máy chủ theo dõi của Facebook',
    },
    'facebook.stealthSearch': {
      label: 'Tìm kiếm vô danh (Không lưu lịch sử)',
      description: 'Tìm kiếm trang và trang cá nhân mà không lưu vào lịch sử tìm kiếm gần đây hoặc làm lệch gợi ý',
    },
    'facebook.piiLeakShield': {
      label: 'Chống rò rỉ dữ liệu nhạy cảm (PII Shield)',
      description: 'Cảnh báo và hỗ trợ che giấu khi dán thẻ ngân hàng, CCCD, mật khẩu hoặc API key vào chat',
    },
    'facebook.cleanShareLinks': {
      label: 'Làm sạch link chia sẻ (Chống tracking)',
      description: 'Tự động gỡ bỏ mibextid, rdid và mã định danh theo dõi khi sao chép liên kết',
    },
    'facebook.antiFingerprint': {
      label: 'Chống nhận diện dấu vân tay thiết bị (Anti-Fingerprinting)',
      description: 'Che giấu cấu hình phần cứng CPU/RAM, WebGL và thêm vi nhiễu Canvas chống định danh thiết bị',
    },
    'instagram.hideReadReceipts': {
      label: 'Chặn đã xem tin nhắn',
      description: 'Đọc tin nhắn Instagram Direct mà không gửi thông báo đã xem',
    },
    'instagram.hideTyping': {
      label: 'Chặn đang soạn tin nhắn',
      description: 'Không hiển thị bong bóng đang gõ trong tin nhắn Direct',
    },
    'instagram.hideStoryViews': {
      label: 'Xem tin ẩn danh (Story)',
      description: 'Xem story mà không xuất hiện trong danh sách người xem',
    },
    'instagram.hideLiveStreamViews': {
      label: 'Xem trực tiếp ẩn danh (Livestream)',
      description: 'Xem livestream Instagram mà không gửi thông báo tham gia cho chủ phòng',
    },
    'instagram.bypassLinkShim': {
      label: 'Bỏ qua chuyển hướng theo dõi (Link Shim)',
      description: 'Mở trực tiếp liên kết bên ngoài mà không qua máy chủ theo dõi của Instagram',
    },
    'instagram.hideSuggestedPosts': {
      label: 'Ẩn bài viết gợi ý',
      description: 'Lọc sạch các bài viết thuật toán gợi ý khỏi bảng tin Instagram',
    },
    'instagram.hideReels': {
      label: 'Ẩn Reels và video ngắn',
      description: 'Ẩn hoàn toàn khay Reels và clip ngắn trên bảng tin Instagram',
    },
    'instagram.hideOnlineStatus': {
      label: 'Chế độ tàng hình (Ẩn chấm xanh)',
      description: 'Lướt Instagram Direct hoàn toàn ẩn danh không bao giờ hiện chấm xanh hoạt động',
    },
    'instagram.hideSponsoredPosts': {
      label: 'Ẩn bài viết được tài trợ & quảng cáo',
      description: 'Ẩn các bài viết quảng cáo và tài trợ trên bảng tin Instagram của bạn',
    },
    'instagram.protectWebRtcIp': {
      label: 'Chống rò rỉ IP qua WebRTC',
      description: 'Ngăn chặn lộ địa chỉ IP thật của bạn trong các cuộc gọi Instagram Direct',
    },
    'instagram.scrambleDwellTime': {
      label: 'Chặn theo dõi chuột & thời gian xem',
      description: 'Chặn Instagram thu thập cử chỉ chuột, bản đồ nhiệt hover và số giây dừng xem',
    },
    'instagram.stealthSearch': {
      label: 'Tìm kiếm vô danh (Không lưu lịch sử)',
      description: 'Tìm kiếm tài khoản và thẻ mà không ghi vào lịch sử tìm kiếm gần đây hoặc làm lệch gợi ý khám phá',
    },
    'instagram.piiLeakShield': {
      label: 'Chống rò rỉ dữ liệu nhạy cảm (PII Shield)',
      description: 'Cảnh báo và hỗ trợ che giấu khi dán thẻ ngân hàng, CCCD, mật khẩu hoặc API key vào chat',
    },
    'instagram.cleanShareLinks': {
      label: 'Làm sạch link chia sẻ (Chống tracking)',
      description: 'Tự động gỡ bỏ igsh, igshid và mã UTM theo dõi khi sao chép liên kết',
    },
    'instagram.antiFingerprint': {
      label: 'Chống nhận diện dấu vân tay thiết bị (Anti-Fingerprinting)',
      description: 'Che giấu cấu hình phần cứng CPU/RAM, WebGL và thêm vi nhiễu Canvas chống định danh thiết bị',
    },
    'global.stripFbclid': {
      label: 'Xóa tham số theo dõi URL',
      description: 'Tự động gỡ bỏ các mã định danh theo dõi (fbclid, igshid, utm_*, si, gclid) khỏi các liên kết',
    },
    'global.blockMetaPixel': {
      label: 'Chặn mã theo dõi Meta Pixel',
      description: 'Chặn các đoạn mã theo dõi Meta Pixel và phân tích trên các trang web bên thứ ba',
    },
  },
};
