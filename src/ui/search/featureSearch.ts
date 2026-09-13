import { ALL_FEATURES, type FeatureEntry } from '@/core/settings/schema';
import { en } from '@/i18n/locales/en';
import { vi } from '@/i18n/locales/vi';
import type { SupportedLocale } from '@/i18n/types';
import type { Feature } from '@/sites/types';

/**
 * Normalizes text for multi-language, diacritic-insensitive, case-insensitive searching.
 * Removes Vietnamese diacritics (accents), maps 'đ'/'Đ' to 'd', and collapses punctuation & whitespace.
 */
export function normalizeSearchText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove combining diacritical marks
    .replace(/[đĐ]/g, 'd')
    .replace(/[^\w\s]/g, ' ') // replace punctuation with spaces
    .replace(/\s+/g, ' ') // collapse consecutive whitespace
    .trim();
}

/**
 * Curated multi-lingual keywords, synonyms, and search aliases for each feature.
 * Enables instant discovery via natural query terms (both EN & VI, with/without diacritics).
 */
export const FEATURE_KEYWORDS: Record<string, readonly string[]> = {
  'facebook.hideReadReceipts': [
    'seen',
    'unseen',
    'read',
    'receipt',
    'read receipt',
    'da xem',
    'đã xem',
    'doc tin',
    'đọc tin',
    'mark read',
    'tick xanh',
    'tich xanh',
    'message',
    'tin nhan',
  ],
  'instagram.hideReadReceipts': [
    'seen',
    'unseen',
    'read',
    'receipt',
    'direct',
    'dm',
    'da xem',
    'đã xem',
    'doc tin',
    'đọc tin',
    'tin nhan',
  ],
  'facebook.hideTyping': [
    'typing',
    'indicator',
    'bubble',
    'dots',
    'three dots',
    'dang go',
    'đang gõ',
    'go phim',
    'gõ phím',
    'soan tin',
    'soạn tin',
    'chat',
  ],
  'instagram.hideTyping': [
    'typing',
    'indicator',
    'bubble',
    'direct',
    'dm',
    'dang go',
    'đang gõ',
    'soan tin',
    'soạn tin',
  ],
  'facebook.hideStoryViews': [
    'story',
    'stories',
    'view',
    'viewer',
    'watch',
    'an danh',
    'ẩn danh',
    'xem story',
    'tin 24h',
    'story view',
  ],
  'instagram.hideStoryViews': [
    'story',
    'stories',
    'view',
    'viewer',
    'watch',
    'an danh',
    'ẩn danh',
    'xem story',
    'tin 24h',
    'ig story',
  ],
  'facebook.hideLiveStreamViews': [
    'live',
    'livestream',
    'stream',
    'truc tiep',
    'trực tiếp',
    'xem live',
    'viewer list',
    'an danh',
    'ẩn danh',
  ],
  'instagram.hideLiveStreamViews': [
    'live',
    'livestream',
    'stream',
    'ig live',
    'truc tiep',
    'trực tiếp',
    'xem live',
    'viewer',
  ],
  'facebook.hideOnlineStatus': [
    'online',
    'active',
    'green dot',
    'cham xanh',
    'chấm xanh',
    'offline',
    'invisible',
    'tang hinh',
    'tàng hình',
    'an online',
    'ẩn online',
    'trang thai',
    'trạng thái hoạt động',
  ],
  'instagram.hideOnlineStatus': [
    'online',
    'active',
    'active status',
    'green dot',
    'offline',
    'invisible',
    'tang hinh',
    'tàng hình',
    'an online',
    'ẩn online',
    'direct',
  ],
  'facebook.hideVoicePlayed': [
    'voice',
    'audio',
    'sound',
    'memo',
    'voice note',
    'played',
    'listen',
    'nghe',
    'am thanh',
    'âm thanh',
    'giong noi',
    'giọng nói',
    'tin nhan thoai',
    'tin nhắn thoại',
    'da nghe',
    'đã nghe',
  ],
  'facebook.hideInboxLastSeen': [
    'inbox',
    'last seen',
    'chat list',
    'hop thu',
    'hộp thư',
    'lan cuoi',
    'lần cuối',
    'danh sach chat',
    'danh sách chat',
    'open inbox',
  ],
  'facebook.protectWebRtcIp': [
    'webrtc',
    'ip',
    'leak',
    'ip leak',
    'call',
    'voice call',
    'video call',
    'shield',
    'cuoc goi',
    'cuộc gọi',
    'bao ve ip',
    'bảo vệ ip',
    'lo ip',
    'lộ ip',
  ],
  'instagram.protectWebRtcIp': [
    'webrtc',
    'ip',
    'leak',
    'ip leak',
    'call',
    'video call',
    'shield',
    'cuoc goi',
    'cuộc gọi',
    'bao ve ip',
    'bảo vệ ip',
    'lo ip',
    'lộ ip',
  ],
  'facebook.bypassLinkShim': [
    'link',
    'shim',
    'linkshim',
    'redirect',
    'tracking url',
    'chuyen huong',
    'chuyển hướng',
    'mo truc tiep',
    'mở trực tiếp',
    'lien ket',
    'liên kết',
  ],
  'instagram.bypassLinkShim': [
    'link',
    'shim',
    'linkshim',
    'redirect',
    'tracking',
    'chuyen huong',
    'chuyển hướng',
    'mo truc tiep',
    'mở trực tiếp',
  ],
  'facebook.stealthSearch': [
    'search',
    'history',
    'recent',
    'zero trace',
    'tim kiem',
    'tìm kiếm',
    'lich su',
    'lịch sử',
    'an vet',
    'ẩn vết',
    'xoa lich su',
    'xoá lịch sử',
    'khong luu',
    'không lưu',
  ],
  'instagram.stealthSearch': [
    'search',
    'history',
    'recent searches',
    'tags',
    'accounts',
    'tim kiem',
    'tìm kiếm',
    'lich su',
    'lịch sử',
    'an vet',
    'ẩn vết',
  ],
  'facebook.hideSponsoredPosts': [
    'ads',
    'adblock',
    'sponsored',
    'sponsor',
    'quang cao',
    'quảng cáo',
    'tai tro',
    'tài trợ',
    'an quang cao',
    'ẩn quảng cáo',
    'feed',
    'bang tin',
  ],
  'instagram.hideSponsoredPosts': [
    'ads',
    'adblock',
    'sponsored',
    'sponsor',
    'quang cao',
    'quảng cáo',
    'tai tro',
    'tài trợ',
    'an quang cao',
    'ẩn quảng cáo',
  ],
  'facebook.hideSuggestedPosts': [
    'suggested',
    'suggestion',
    'recommend',
    'follow',
    'goi y',
    'gợi ý',
    'de xuat',
    'đề xuất',
    'bai viet goi y',
    'bài viết gợi ý',
  ],
  'instagram.hideSuggestedPosts': [
    'suggested',
    'suggestion',
    'algorithmic',
    'goi y',
    'gợi ý',
    'de xuat',
    'đề xuất',
  ],
  'facebook.hideReels': [
    'reels',
    'reel',
    'short',
    'short video',
    'video ngan',
    'video ngắn',
    'cuon',
    'cuộn',
    'clip',
    'an reels',
    'ẩn reels',
  ],
  'instagram.hideReels': [
    'reels',
    'reel',
    'short',
    'video',
    'video ngan',
    'video ngắn',
    'shelves',
    'carousel',
  ],
  'facebook.blockFeedAutoRefresh': [
    'reload',
    'refresh',
    'feed reload',
    'auto refresh',
    'load lai',
    'load lại',
    'tu reload',
    'tự tải lại',
    'giu cho',
    'giữ chỗ',
    'bang tin',
    'bảng tin',
  ],
  'facebook.scrambleDwellTime': [
    'dwell',
    'dwell time',
    'timer',
    'seconds',
    'tracking',
    'thoi gian',
    'thời gian xem',
    'dung lai',
    'dừng lại',
    'do luong',
    'đo lường',
  ],
  'instagram.scrambleDwellTime': [
    'dwell',
    'dwell time',
    'timer',
    'seconds',
    'tracking',
    'thoi gian',
    'thời gian xem',
    'do luong',
    'đo lường',
  ],
  'global.stripFbclid': [
    'fbclid',
    'click id',
    'url',
    'tracker',
    'query param',
    'link',
    'xoa tracking',
    'xoá tracking',
    'toan web',
    'toàn web',
  ],
  'facebook.piiLeakShield': [
    'pii',
    'leak',
    'shield',
    'card',
    'credit card',
    'bank card',
    'cccd',
    'cmnd',
    'citizen id',
    'api key',
    'secret',
    'token',
    'jwt',
    'password',
    'the ngan hang',
    'thẻ ngân hàng',
    'dan',
    'dán',
    'paste',
    'lo thong tin',
    'lộ thông tin',
    'canh bao',
    'cảnh báo',
    'che giau',
    'che giấu',
  ],
  'instagram.piiLeakShield': [
    'pii',
    'leak',
    'shield',
    'card',
    'credit card',
    'bank card',
    'cccd',
    'cmnd',
    'citizen id',
    'api key',
    'secret',
    'token',
    'jwt',
    'password',
    'the ngan hang',
    'thẻ ngân hàng',
    'dan',
    'dán',
    'paste',
    'direct',
    'dm',
  ],
  'facebook.cleanShareLinks': [
    'share',
    'copy',
    'clipboard',
    'link',
    'clean',
    'sao chep',
    'sao chép',
    'chia se',
    'chia sẻ',
    'lien ket',
    'liên kết',
    'mibextid',
    'rdid',
    'cft',
    'tracking',
    'chong theo doi',
    'chống theo dõi',
  ],
  'instagram.cleanShareLinks': [
    'share',
    'copy',
    'clipboard',
    'link',
    'clean',
    'sao chep',
    'sao chép',
    'chia se',
    'chia sẻ',
    'lien ket',
    'liên kết',
    'igsh',
    'igshid',
    'utm',
    'tracking',
    'chong theo doi',
    'chống theo dõi',
  ],
  'facebook.antiFingerprint': [
    'fingerprint',
    'anti-fingerprint',
    'canvas',
    'webgl',
    'hardware',
    'cpu',
    'ram',
    'memory',
    'thiet bi',
    'thiết bị',
    'dau van tay',
    'dấu vân tay',
    'phan cung',
    'phần cứng',
    'dinh danh',
    'định danh',
  ],
  'instagram.antiFingerprint': [
    'fingerprint',
    'anti-fingerprint',
    'canvas',
    'webgl',
    'hardware',
    'cpu',
    'ram',
    'memory',
    'thiet bi',
    'thiết bị',
    'dau van tay',
    'dấu vân tay',
    'phan cung',
    'phần cứng',
    'dinh danh',
    'định danh',
  ],
};

export interface SearchableFeature {
  readonly id: string;
  readonly key: string;
  readonly scope: string; // 'facebook' | 'instagram' | 'global'
  readonly category: string;
  readonly feature: Feature;
  readonly platformLabel: string;
  readonly activeLocaleLabel: string;
  readonly activeLocaleDescription: string;
  readonly enLabel: string;
  readonly enDescription: string;
  readonly viLabel: string;
  readonly viDescription: string;
  readonly keywords: readonly string[];
  /** Pre-normalized combined search corpus for super fast token/substring matching */
  readonly searchCorpus: string;
  /** Normalized label in active locale */
  readonly normalizedActiveLabel: string;
  /** Normalized label in EN */
  readonly normalizedEnLabel: string;
  /** Normalized label in VI */
  readonly normalizedViLabel: string;
}

export interface SearchResultItem {
  readonly item: SearchableFeature;
  readonly score: number;
}

export interface SearchOptions {
  /** Filter to a specific platform scope ('facebook' | 'instagram' | 'global' | 'all') */
  scope?: string;
  /** Active UI locale for prioritizing display strings */
  activeLocale?: SupportedLocale;
}

const SEARCH_INDEX_CACHE = new Map<SupportedLocale, SearchableFeature[]>();

/**
 * Builds an in-memory index of searchable features with multi-lingual corpus.
 * Results are cached by locale for fast instant lookups.
 */
export function buildSearchIndex(activeLocale: SupportedLocale = 'en'): SearchableFeature[] {
  const cached = SEARCH_INDEX_CACHE.get(activeLocale);
  if (cached) {
    return cached;
  }

  const items = ALL_FEATURES.map((entry: FeatureEntry) => {
    const key = entry.key;
    const scope = entry.scope;
    const feature = entry.feature;

    const enTrans = en.features[key];
    const viTrans = vi.features[key];

    const enLabel = enTrans?.label ?? feature.label;
    const enDesc = enTrans?.description ?? feature.description;
    const viLabel = viTrans?.label ?? feature.label;
    const viDesc = viTrans?.description ?? feature.description;

    const activeLabel = activeLocale === 'vi' ? viLabel : enLabel;
    const activeDesc = activeLocale === 'vi' ? viDesc : enDesc;

    const platformLabel =
      scope === 'facebook'
        ? activeLocale === 'vi'
          ? vi.site.facebook
          : en.site.facebook
        : scope === 'instagram'
        ? activeLocale === 'vi'
          ? vi.site.instagram
          : en.site.instagram
        : activeLocale === 'vi'
        ? vi.tabs.global
        : en.tabs.global;

    const keywords = FEATURE_KEYWORDS[key] ?? [];

    const platformAliases =
      scope === 'facebook'
        ? ['fb', 'facebook', 'messenger', 'fbchat']
        : scope === 'instagram'
        ? ['ig', 'insta', 'instagram', 'direct', 'dm']
        : ['global', 'toan web', 'all', 'web'];

    // Construct rich multi-lingual corpus including:
    // - key & feature.id
    // - scope & platform names and aliases (EN + VI)
    // - category names
    // - English label & description
    // - Vietnamese label & description
    // - Custom keywords / synonyms
    const rawCorpusParts = [
      key,
      feature.id,
      scope,
      ...platformAliases,
      platformLabel,
      feature.category || '',
      enLabel,
      enDesc,
      viLabel,
      viDesc,
      ...keywords,
    ];

    const searchCorpus = normalizeSearchText(rawCorpusParts.join(' '));

    return {
      id: feature.id,
      key,
      scope,
      category: feature.category ?? 'privacy',
      feature,
      platformLabel,
      activeLocaleLabel: activeLabel,
      activeLocaleDescription: activeDesc,
      enLabel,
      enDescription: enDesc,
      viLabel,
      viDescription: viDesc,
      keywords,
      searchCorpus,
      normalizedActiveLabel: normalizeSearchText(activeLabel),
      normalizedEnLabel: normalizeSearchText(enLabel),
      normalizedViLabel: normalizeSearchText(viLabel),
    };
  });

  SEARCH_INDEX_CACHE.set(activeLocale, items);
  return items;
}

/**
 * Performs lazy, multi-language search with token matching and relevance scoring.
 *
 * Scoring:
 * - 100+: Exact or prefix match on label or key
 * - 60+: Substring match in active/EN/VI label
 * - 40+: Match in keywords/aliases
 * - 20+: Substring match in description or other corpus tokens
 * - Scope boost: If scope matches the requested filter, boosts score
 */
export function searchFeatures(
  items: readonly SearchableFeature[],
  rawQuery: string,
  options: SearchOptions = {},
): SearchResultItem[] {
  const normalizedQuery = normalizeSearchText(rawQuery);
  if (!normalizedQuery) {
    // If no query, return items filtered by scope (if specified)
    const scopeFilter = options.scope;
    const filtered =
      scopeFilter && scopeFilter !== 'all'
        ? items.filter((i) => i.scope === scopeFilter)
        : items;
    return filtered.map((item) => ({ item, score: 0 }));
  }

  const queryTokens = normalizedQuery.split(' ').filter(Boolean);
  const results: SearchResultItem[] = [];

  for (const item of items) {
    // Scope filter check (optional: if strict scope filter is desired)
    if (options.scope && options.scope !== 'all' && item.scope !== options.scope) {
      continue;
    }

    // Every query token must match at least something in the searchCorpus
    const allTokensMatch = queryTokens.every((token) => item.searchCorpus.includes(token));
    if (!allTokensMatch) {
      continue;
    }

    // Calculate relevance score
    let score = 0;

    // 1. Exact match in active label or key
    if (
      item.normalizedActiveLabel === normalizedQuery ||
      item.normalizedEnLabel === normalizedQuery ||
      item.normalizedViLabel === normalizedQuery ||
      item.key.toLowerCase() === rawQuery.toLowerCase()
    ) {
      score += 120;
    }
    // 2. Prefix match in active label
    else if (
      item.normalizedActiveLabel.startsWith(normalizedQuery) ||
      item.normalizedEnLabel.startsWith(normalizedQuery) ||
      item.normalizedViLabel.startsWith(normalizedQuery)
    ) {
      score += 90;
    }
    // 3. Substring match in active label
    else if (
      item.normalizedActiveLabel.includes(normalizedQuery) ||
      item.normalizedEnLabel.includes(normalizedQuery) ||
      item.normalizedViLabel.includes(normalizedQuery)
    ) {
      score += 70;
    }

    // 4. Keyword matches
    for (const kw of item.keywords) {
      const normalizedKw = normalizeSearchText(kw);
      if (normalizedKw === normalizedQuery) {
        score += 50;
        break;
      } else if (normalizedKw.includes(normalizedQuery) || normalizedQuery.includes(normalizedKw)) {
        score += 35;
        break;
      }
    }

    // 5. Query tokens individually matching label
    for (const token of queryTokens) {
      if (
        item.normalizedActiveLabel.includes(token) ||
        item.normalizedEnLabel.includes(token) ||
        item.normalizedViLabel.includes(token)
      ) {
        score += 15;
      }
    }

    // 6. Scope bonus (if matching current preferred scope)
    if (options.scope && item.scope === options.scope) {
      score += 10;
    }

    results.push({ item, score: Math.max(score, 10) });
  }

  // Sort by score descending; if tied, sort alphabetically by active label
  results.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.item.activeLocaleLabel.localeCompare(b.item.activeLocaleLabel);
  });

  return results;
}
