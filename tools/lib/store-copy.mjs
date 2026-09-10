/**
 * Localised copy and popup control labels for the store artwork.
 *
 * Kept separate from the layout code so adding a locale means adding a block
 * here, not editing the renderers. Every string a locale needs is in one place,
 * which is what stops a locale from being half translated.
 */

/** Locales that get a full set of artwork. */
export const LOCALES = ['en', 'vi'];

/**
 * The popup's own control labels are localised, so driving it requires the
 * labels in the locale being captured. Theme and language buttons are the
 * exception: their titles are hardcoded in SidebarFooter.tsx and never change.
 *
 * Keys here are stable identifiers; the values are what the popup actually
 * renders. If a label changes in src/i18n, it changes here too.
 */
export const POPUP_LABELS = {
  en: {
    platform: { facebook: 'Facebook', instagram: 'Instagram', global: 'Global' },
    subTab: { all: 'All', privacy: 'Privacy', feed: 'Feed' },
    preset: { stealth: '1-Tap Stealth', clean: '1-Tap Clean' },
  },
  vi: {
    platform: { facebook: 'Facebook', instagram: 'Instagram', global: 'Toàn web' },
    subTab: { all: 'Tất cả', privacy: 'Riêng tư', feed: 'Bảng tin' },
    preset: { stealth: 'Tàng hình 1 chạm', clean: 'Lọc sạch 1 chạm' },
  },
};

/** Trust line along the bottom of every screenshot. */
export const FOOTNOTE = {
  en: '100% on-device • No accounts required • Zero tracking • Open source',
  vi: '100% trên máy bạn • Không cần tài khoản • Không thu thập dữ liệu • Mã nguồn mở',
};

/**
 * The five screenshots, in listing order.
 *
 * `popup` describes the state to capture using the stable keys above, so the
 * same definition works for every locale. `copy` carries the marketing text.
 *
 * The toggles visible in a slide must back the claims beside them, which is
 * what `presets` is for: a bullet saying something is hidden, next to a switch
 * that is off, reads as a false claim.
 */
export const SLIDES = [
  {
    file: '01-facebook-privacy.png',
    popup: { theme: 'dark', platform: 'facebook', subTab: 'all', presets: ['stealth'] },
    copy: {
      en: {
        eyebrow: 'Facebook & Messenger',
        headline: 'Read and watch.\nLeave zero trace.',
        body: 'Granular, independent controls over every background signal Facebook and Messenger send on your behalf.',
        bullets: [
          'No read receipts, no typing indicators, no voice memo markers',
          'Watch Stories and Livestreams completely anonymously',
          'Invisible mode: browse offline while chatting seamlessly',
        ],
      },
      vi: {
        eyebrow: 'Facebook & Messenger',
        headline: 'Đọc tin, xem story.\nHoàn toàn vô hình.',
        body: 'Chủ động kiểm soát từng tín hiệu ngầm mà Facebook và Messenger tự ý gửi đi thay bạn.',
        bullets: [
          'Không hiện đã xem, không hiện 3 chấm đang gõ, không báo đã nghe voice',
          'Xem Story và Livestream ẩn danh, không lộ tên người xem',
          'Chế độ tàng hình: ẩn chấm xanh online nhưng vẫn nhắn tin bình thường',
        ],
      },
    },
  },
  {
    file: '02-facebook-feed.png',
    popup: { theme: 'dark', platform: 'facebook', subTab: 'feed', presets: ['clean'] },
    copy: {
      en: {
        eyebrow: 'Clean & Focused Feed',
        headline: 'A clean feed,\nfree of distractions.',
        body: 'Filter out algorithmic clutter and preserve your exact reading position when switching tabs.',
        bullets: [
          'Hide sponsored ads and intrusive suggested posts',
          'Remove addicting Reels and short video trays',
          'Prevent the feed from auto-refreshing when switching tabs',
        ],
      },
      vi: {
        eyebrow: 'Bảng tin sạch & tập trung',
        headline: 'Lướt bảng tin sạch,\nkhông còn quảng cáo.',
        body: 'Lọc sạch các nội dung thuật toán chèn vào, luôn giữ đúng vị trí bài viết bạn đang đọc khi quay lại tab.',
        bullets: [
          'Ẩn toàn bộ bài viết tài trợ (Ads) và bài viết gợi ý ngoài luồng',
          'Ẩn khay Thước phim (Reels) và video ngắn gây xao nhãng',
          'Chặn bảng tin tự động cuộn hoặc tải lại ngoài ý muốn',
        ],
      },
    },
  },
  {
    file: '03-instagram.png',
    popup: { theme: 'dark', platform: 'instagram', subTab: 'all', presets: ['stealth'] },
    copy: {
      en: {
        eyebrow: 'Instagram Direct & Stories',
        headline: 'Chat and browse\nin total stealth.',
        body: 'Enjoy seamless Instagram messaging and browsing while preventing all background tracking signals.',
        bullets: [
          'Block "Seen" indicators and typing bubbles in Direct messages',
          'Watch Stories and Livestreams anonymously without viewer counts',
          'Hide your active status dot while staying connected',
        ],
      },
      vi: {
        eyebrow: 'Instagram Direct & Stories',
        headline: 'Nhắn tin riêng tư,\ntuyệt đối kín đáo.',
        body: 'Thoải mái trò chuyện và lướt Instagram mà không lo bị lộ hoạt động hay tín hiệu viễn trắc ngầm.',
        bullets: [
          'Chặn chữ "Đã xem" và bong bóng soạn tin trong Instagram Direct',
          'Xem Story và Livestream ẩn danh, không gửi thông báo cho đối phương',
          'Ẩn chấm xanh online, giữ trạng thái hoạt động luôn kín đáo',
        ],
      },
    },
  },
  {
    file: '04-global-trackers.png',
    // The Global tab has no presets; its two toggles are shown at their defaults.
    popup: { theme: 'dark', platform: 'global', subTab: null, presets: [] },
    copy: {
      en: {
        eyebrow: 'Web-Wide Protection',
        headline: 'Stop Meta trackers\nacross the web.',
        body: 'Meta tracking follows your browsing activity across third-party websites. Privacy Guard neutralizes it before it loads.',
        bullets: [
          'Block third-party Meta Pixels (fbevents.js) on other websites',
          'Automatically clean tracking parameters: fbclid, igshid, utm_*',
          'Runs at browser network layer for zero latency and maximum privacy',
        ],
      },
      vi: {
        eyebrow: 'Bảo vệ trên toàn web',
        headline: 'Ngăn Meta theo dõi\nbạn trên các trang web.',
        body: 'Meta âm thầm theo dõi bạn ngay cả khi không ở trên Facebook. Tiện ích triệt tiêu các mã theo dõi này ngay từ tầng mạng.',
        bullets: [
          'Chặn đứng mã theo dõi Meta Pixel (fbevents.js) trên mọi website',
          'Tự động gọt sạch tham số định danh theo dõi trong liên kết (fbclid, igshid, utm_*)',
          'Chặn trực tiếp ở tầng mạng của trình duyệt, không làm chậm tốc độ lướt web',
        ],
      },
    },
  },
  {
    file: '05-themes-locales.png',
    // The only light theme slide, so the listing shows both themes exist.
    popup: { theme: 'light', platform: 'facebook', subTab: 'feed', presets: ['clean'] },
    copy: {
      en: {
        eyebrow: 'Full Customization',
        headline: 'Dark or light mode.\nEnglish or Vietnamese.',
        body: 'Every privacy feature is an independent toggle. You stay in complete control of your settings.',
        bullets: [
          'Complete, native English and Vietnamese user interface',
          'Sleek dark mode, crisp light mode, or follow system theme',
          'All your preferences remain strictly stored on your own device',
        ],
      },
      vi: {
        eyebrow: 'Tùy biến linh hoạt',
        headline: 'Giao diện Sáng - Tối.\nTiếng Việt trọn vẹn.',
        body: 'Mỗi tính năng là một công tắc riêng biệt. Bạn luôn nắm quyền chủ động 100% trong tay.',
        bullets: [
          'Hỗ trợ đầy đủ ngôn ngữ tiếng Việt và tiếng Anh bản ngữ',
          'Tùy chọn giao diện Tối (Dark), Sáng (Light) hoặc theo hệ thống',
          'Mọi thiết lập lưu trữ an toàn trên máy bạn, không bao giờ gửi ra ngoài',
        ],
      },
    },
  },
];

/**
 * Popup state shown on the marquee tile. Shaped like a slide so it goes through
 * the same `resolvePopupState` validation as the screenshots.
 */
export const MARQUEE_POPUP = {
  popup: { theme: 'dark', platform: 'facebook', subTab: 'all', presets: ['stealth'] },
};

/** Copy for the small 440x280 promo tile. */
export const SMALL_PROMO_COPY = {
  en: {
    tagline: 'Take back your privacy on Facebook and Instagram. No seen, no tracking.',
    trust: '100% On-Device',
  },
  vi: {
    tagline: 'Lướt Facebook & Instagram ẩn danh: không hiện đã xem, không lưu lịch sử.',
    trust: '100% trên máy bạn',
  },
};

/** Copy for the wide 1400x560 marquee tile. */
export const MARQUEE_COPY = {
  en: {
    headline: 'Read, watch, and browse.',
    headlineAccent: 'Leave zero trace behind.',
    body: 'Block seen receipts, hide typing bubbles, watch stories anonymously, and eliminate tracking pixels. Full privacy control, running 100% locally on your machine.',
    marks: ['100% On-Device', 'Zero Tracking', 'Open Source'],
  },
  vi: {
    headline: 'Đọc tin, xem story.',
    headlineAccent: 'Hoàn toàn vô hình.',
    body: 'Chặn thông báo đã xem, ẩn đang soạn tin, xem Story & Livestream ẩn danh, dọn sạch quảng cáo và pixel theo dõi. Bạn toàn quyền quyết định mọi tín hiệu ngay trên máy mình.',
    marks: ['100% trên máy bạn', 'Không thu thập dữ liệu', 'Mã nguồn mở'],
  },
};

/**
 * Resolves a slide's popup state into the labels the popup actually renders in
 * the given locale.
 */
export function resolvePopupState(slide, locale) {
  const labels = POPUP_LABELS[locale];
  if (!labels) {
    throw new Error(`No popup labels defined for locale "${locale}"`);
  }

  const platform = labels.platform[slide.popup.platform];
  if (!platform) {
    throw new Error(`No "${slide.popup.platform}" platform label for locale "${locale}"`);
  }

  return {
    theme: slide.popup.theme,
    locale,
    platform,
    subTab: slide.popup.subTab ? labels.subTab[slide.popup.subTab] : null,
    presets: slide.popup.presets.map((key) => {
      const label = labels.preset[key];
      if (!label) {
        throw new Error(`No "${key}" preset label for locale "${locale}"`);
      }
      return label;
    }),
  };
}

/**
 * Asserts that every configured locale has complete copy definitions for all
 * promo tiles, footnotes, popup labels, and screenshot slides.
 */
export function assertLocaleCoverage() {
  for (const locale of LOCALES) {
    if (!FOOTNOTE[locale]) {
      throw new Error(`Missing FOOTNOTE for locale "${locale}"`);
    }
    if (!SMALL_PROMO_COPY[locale]) {
      throw new Error(`Missing SMALL_PROMO_COPY for locale "${locale}"`);
    }
    if (!MARQUEE_COPY[locale]) {
      throw new Error(`Missing MARQUEE_COPY for locale "${locale}"`);
    }
    if (!POPUP_LABELS[locale]) {
      throw new Error(`Missing POPUP_LABELS for locale "${locale}"`);
    }
    for (const slide of SLIDES) {
      if (!slide.copy[locale]) {
        throw new Error(`Missing copy in slide "${slide.file}" for locale "${locale}"`);
      }
    }
  }
}
