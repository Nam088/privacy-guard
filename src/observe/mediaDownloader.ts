/**
 * Media Quick Downloader.
 *
 * Injects a subtle, glassmorphism download button on hover over videos and stories
 * on Facebook and Instagram. Fetches media as a native Blob and triggers download
 * via HTML5 <a> without requiring any dangerous browser extension permissions.
 */

const STYLE_ID = 'privacy-guard-media-downloader-css';
const BTN_CLASS = 'pg-media-dl-btn';
const ATTR_PROCESSED = 'data-pg-dl-attached';

const DOWNLOADER_CSS = `
.${BTN_CLASS} {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 2147483640;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(15, 23, 42, 0.78);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 9999px;
  color: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  padding: 6px 12px;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
  opacity: 0;
  transform: translateY(-4px);
  transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.2s;
  pointer-events: none;
  user-select: none;
}

*:hover > .${BTN_CLASS},
.${BTN_CLASS}:hover {
  opacity: 1 !important;
  transform: translateY(0) !important;
  pointer-events: auto !important;
}

.${BTN_CLASS}:hover {
  background: rgba(15, 23, 42, 0.92);
  border-color: rgba(255, 255, 255, 0.45);
}

.${BTN_CLASS}:active {
  transform: scale(0.96) !important;
}

.${BTN_CLASS}.pg-loading {
  opacity: 1 !important;
  pointer-events: auto !important;
  background: rgba(30, 58, 138, 0.85);
  cursor: wait;
}

.${BTN_CLASS}.pg-success {
  opacity: 1 !important;
  pointer-events: auto !important;
  background: rgba(22, 101, 52, 0.88);
  border-color: rgba(74, 222, 128, 0.5);
}
`;

const SVG_ICON_DOWNLOAD = `
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
  <polyline points="7 10 12 15 17 10"></polyline>
  <line x1="12" y1="15" x2="12" y2="3"></line>
</svg>
`;

const SVG_ICON_SPINNER = `
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="animation: pg-spin 0.8s linear infinite;">
  <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
</svg>
`;

const SVG_ICON_CHECK = `
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="20 6 9 17 4 12"></polyline>
</svg>
`;

/**
 * Strips byte-range query parameters (bytestart, byteend) to retrieve
 * the clean, full progressive media URL.
 */
export function sanitizeMediaUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.searchParams.has('bytestart')) {
      parsed.searchParams.delete('bytestart');
    }
    if (parsed.searchParams.has('byteend')) {
      parsed.searchParams.delete('byteend');
    }
    return parsed.href;
  } catch {
    return rawUrl;
  }
}

export interface CapturedVideoEntry {
  bitrate: number;
  url: string;
  timestamp: number;
}

const capturedVideos = new Map<string, CapturedVideoEntry>();
const MAX_CAPTURED = 100;

export function recordCapturedVideo(videoId: string, url: string, bitrate = 0): void {
  const existing = capturedVideos.get(videoId);
  if (!existing || bitrate > existing.bitrate) {
    if (capturedVideos.size >= MAX_CAPTURED) {
      const oldestKey = capturedVideos.keys().next().value;
      if (oldestKey) {
        capturedVideos.delete(oldestKey);
      }
    }
    capturedVideos.set(videoId, { bitrate, url, timestamp: Date.now() });
  }
}

export function getCapturedVideo(videoId: string): CapturedVideoEntry | undefined {
  return capturedVideos.get(videoId);
}

export function clearCapturedVideos(): void {
  capturedVideos.clear();
}

/**
 * Parses raw text from network responses (GraphQL / video endpoints) to extract
 * and index progressive MP4 stream URLs by their video_id.
 */
export function parseAndRecordMediaFromText(text: string): void {
  if (!text || !text.includes('.mp4')) {
    return;
  }
  const matches = text.match(/https:(?:\\\/\\\/|\/\/)[^<"'\s]+?\.mp4[^<"'\s]*/g) || [];
  for (const m of matches) {
    let clean = m
      .replace(/\\\/\\\//g, '//')
      .replace(/\\\//g, '/')
      .replace(/&amp;/g, '&')
      .replace(/\\u0025/g, '%')
      .replace(/\\u0026/g, '&');
    clean = clean.split(/\\u003C|<|"|'/)[0] ?? '';
    if (
      !clean.includes('.mp4') ||
      clean.includes('audio') ||
      clean.includes('vbr3_audio') ||
      clean.includes('dash_live')
    ) {
      continue;
    }
    try {
      const u = new URL(clean);
      const efg = u.searchParams.get('efg');
      if (efg && typeof atob === 'function') {
        const decoded = JSON.parse(atob(decodeURIComponent(efg)));
        const tag = decoded.vencode_tag ? String(decoded.vencode_tag) : '';
        if (tag.includes('audio') || tag.includes('live')) {
          continue;
        }
        if (decoded.video_id) {
          const videoId = String(decoded.video_id);
          const bitrate = Number(decoded.bitrate) || 0;
          recordCapturedVideo(videoId, clean, bitrate);
        }
      }
    } catch {
      // ignore malformed URLs or invalid base64
    }
  }
}

/**
 * Extracts the specific video or post ID associated with a DOM element container.
 * Prioritizes container-level attributes and poster IDs to avoid sticking to page URL in feeds.
 */
export function extractTargetVideoId(el: HTMLElement): string | undefined {
  // 1. Direct or ancestor/descendant data-video-id (Facebook Reels / Watch container)
  const dataEl = el.closest('[data-video-id]') || el.querySelector('[data-video-id]');
  const dataId = dataEl?.getAttribute('data-video-id');
  if (dataId && /^[0-9]+$/.test(dataId)) {
    return dataId;
  }

  // 2. Direct or descendant links containing /reel/<id>, /videos/<id>, or /watch/<id>
  const linkMatch = el.querySelector('a[href*="/reel/"], a[href*="/videos/"], a[href*="/watch/"]')
    ?.getAttribute('href')
    ?.match(/\/(?:reel|videos?|watch)\/([0-9]+)/);
  if (linkMatch) {
    return linkMatch[1];
  }

  // 3. Check video poster attribute for embedded video ID
  const video = el.tagName === 'VIDEO' ? el : el.querySelector('video');
  const poster = video?.getAttribute('poster');
  if (poster) {
    // Facebook poster URLs typically have pattern: .../<prefix>_<videoId>_<photoId>_n.jpg
    const posterMatches = poster.match(/(?:_|^)([0-9]{14,20})(?:_|\?|\.|$)/g);
    if (posterMatches && posterMatches.length > 0) {
      return posterMatches[0].replace(/^_+|_+$/g, '');
    }
  }


  // 4. Fallback: only if the page has exactly ONE video or the video is currently at the top of the viewport
  if (typeof window !== 'undefined' && window.location) {
    const doc = el.ownerDocument || window.document;
    const allVideos = doc.querySelectorAll('video');
    const isSingleVideo = allVideos.length <= 1;
    let isPrimaryTopVideo = false;
    if (video && typeof video.getBoundingClientRect === 'function') {
      const rect = video.getBoundingClientRect();
      isPrimaryTopVideo = rect.top >= -50 && rect.top <= 200;
    }

    if (isSingleVideo || isPrimaryTopVideo) {
      const pageMatch = window.location.pathname.match(/\/(?:reel|videos?|watch)\/([0-9]+)/);
      if (pageMatch) {
        return pageMatch[1];
      }
    }
  }

  return undefined;
}

/**
 * Extracts clean progressive HD MP4 URLs embedded in Facebook Comet page scripts (DASH MPD BaseURLs).
 */
export function extractFacebookScriptVideos(targetId?: string): string | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const isStory = typeof window !== 'undefined' && window.location?.pathname?.includes('/stories/');
  const storyParts = isStory && window.location ? window.location.pathname.split('/').filter(Boolean) : [];
  const storyBucketId = storyParts[1];
  const storyToken = storyParts[2];

  const candidates: Array<{ bitrate: number; url: string }> = [];
  const scripts = Array.from(document.scripts);

  const scanScript = (text: string, filterTarget: boolean) => {
    if (!text || (!text.includes('BaseURL') && !text.includes('playable_url') && !text.includes('.mp4'))) {
      return;
    }

    // On stories, match scripts that contain the specific story author/bucket or token
    if (isStory && (storyToken || storyBucketId) && filterTarget) {
      const matchesStory = (storyToken && text.includes(storyToken)) || (storyBucketId && text.includes(storyBucketId));
      if (!matchesStory) {
        return;
      }
    }

    // Matches both JSON-escaped https:\/\/ and regular https:// URLs
    const matches = text.match(/https:(?:\\\/\\\/|\/\/)[^<"'\s]+?\.mp4[^<"'\s]*/g) || [];
    for (const m of matches) {
      let clean = m
        .replace(/\\\//g, '/')
        .replace(/&amp;/g, '&')
        .replace(/\\u0025/g, '%')
        .replace(/\\u0026/g, '&');
      clean = clean.split(/\\u003C|<|"|'/)[0] ?? '';
      if (
        !clean.includes('.mp4') ||
        clean.includes('audio') ||
        clean.includes('vbr3_audio') ||
        clean.includes('dash_live')
      ) {
        continue;
      }
      let bitrate = 0;
      let decodedVideoId: string | undefined;
      try {
        const u = new URL(clean);
        const efg = u.searchParams.get('efg');
        if (efg && typeof atob === 'function') {
          const decoded = JSON.parse(atob(decodeURIComponent(efg)));
          // Filter out audio streams and livestreams whose tags are encoded inside efg
          const tag = decoded.vencode_tag ? String(decoded.vencode_tag) : '';
          if (tag.includes('audio') || tag.includes('live')) {
            continue;
          }
          bitrate = Number(decoded.bitrate) || 0;
          if (decoded.video_id) {
            decodedVideoId = String(decoded.video_id);
          }
        }
      } catch {
        bitrate = 0;
      }

      if (filterTarget && targetId) {
        const matchesTarget =
          clean.includes(targetId) ||
          text.includes(targetId) ||
          decodedVideoId === targetId;
        if (!matchesTarget) {
          continue;
        }
      }

      candidates.push({ bitrate, url: clean });
    }
  };


  // Pass 1: Scan scripts backwards, targeting specific story token / targetId
  for (let i = scripts.length - 1; i >= 0; i -= 1) {
    const text = scripts[i]?.text;
    if (text) {
      scanScript(text, Boolean(targetId) || Boolean(isStory && (storyToken || storyBucketId)));
    }
    if (candidates.length > 0) {
      break;
    }
  }

  // Pass 2: If targeted search yielded nothing AND no targetId was specified, fallback to relaxed scan.
  // When a specific targetId was requested, never return an unrelated video from Pass 2.
  if (candidates.length === 0 && !targetId) {
    for (let i = scripts.length - 1; i >= 0; i -= 1) {
      const text = scripts[i]?.text;
      if (text) {
        scanScript(text, false);
      }
      if (candidates.length > 0) {
        break;
      }
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.bitrate - a.bitrate);
    return candidates[0]?.url ?? null;
  }
  return null;
}

/**
 * Finds the best available video or image source URL from a media element or page resources.
 */
export function resolveMediaSource(el: HTMLElement): { url: string; isVideo: boolean } | null {
  // 1. If element is or contains a <video>
  const video = (el.tagName === 'VIDEO' ? el : el.querySelector('video')) as HTMLVideoElement | null;
  if (video) {
    if (video.src && !video.src.startsWith('blob:')) {
      return { url: sanitizeMediaUrl(video.src), isVideo: true };
    }
    if (video.currentSrc && !video.currentSrc.startsWith('blob:')) {
      return { url: sanitizeMediaUrl(video.currentSrc), isVideo: true };
    }
    const source = video.querySelector('source');
    if (source?.src && !source.src.startsWith('blob:')) {
      return { url: sanitizeMediaUrl(source.src), isVideo: true };
    }

    const targetVideoId = extractTargetVideoId(el);

    // A. Check network-captured progressive streams (scrolled Reels / dynamic GraphQL)
    if (targetVideoId) {
      const captured = getCapturedVideo(targetVideoId);
      if (captured) {
        return { url: sanitizeMediaUrl(captured.url), isVideo: true };
      }
    }

    // B. Check Facebook Comet embedded DASH MPD BaseURL in page scripts
    const fbScriptVideo = extractFacebookScriptVideos(targetVideoId);
    if (fbScriptVideo) {
      return { url: fbScriptVideo, isVideo: true };
    }

    // C. Sniff from recent browser network performance entries (Instagram / Progressive video)
    if (typeof performance !== 'undefined' && typeof performance.getEntriesByType === 'function') {
      const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      for (let i = entries.length - 1; i >= 0; i -= 1) {
        const name = entries[i]?.name;
        if (
          name &&
          (name.includes('.mp4') || name.includes('/o1/v/')) &&
          (name.includes('fbcdn.net') || name.includes('cdninstagram.com')) &&
          !name.includes('audio') &&
          !name.includes('vbr3_audio') &&
          !name.includes('dash_live')
        ) {
          if (!targetVideoId || name.includes(targetVideoId)) {
            return { url: sanitizeMediaUrl(name), isVideo: true };
          }
        }
      }
    }

    // If container has a video, NEVER fall through to <img> (avoids downloading 36x36 UI icons)
    return null;
  }


  // 2. On Facebook / Instagram Story pages: check if a story video is embedded in scripts
  const isStory = typeof window !== 'undefined' && window.location?.pathname?.includes('/stories/');
  if (isStory) {
    const fbStoryVideo = extractFacebookScriptVideos();
    if (fbStoryVideo) {
      return { url: fbStoryVideo, isVideo: true };
    }
  }

  // 3. If element is strictly an image container (Story / Photo) WITHOUT any video
  const img = (el.tagName === 'IMG' ? el : el.querySelector('img')) as HTMLImageElement | null;
  if (img) {
    const src = img.currentSrc || img.src;
    const isExcluded =
      src.includes('static.xx.fbcdn.net') ||
      src.includes('rsrc.php') ||
      src.includes('emoji.php') ||
      src.includes('.gif');
    const isMediaCdn = src.includes('scontent') || src.includes('cdninstagram.com') || src.includes('instagram.fbcdn.net');
    const isRealSize =
      img.naturalWidth === 0 ||
      (img.naturalWidth >= 150 && img.naturalHeight >= 150) ||
      (img.clientWidth >= 150 && img.clientHeight >= 150);

    if (src && !isExcluded && (isMediaCdn || src.includes('fbcdn.net')) && isRealSize) {
      return { url: src, isVideo: false };
    }
  }

  // 3. Check SVG <image> elements (Facebook story photo viewer)
  const svgImg = (el.tagName.toLowerCase() === 'image' ? el : el.querySelector('image')) as SVGImageElement | null;
  if (svgImg) {
    const href = svgImg.getAttribute('href') || svgImg.getAttribute('xlink:href');
    if (href) {
      const isExcluded =
        href.includes('static.xx.fbcdn.net') ||
        href.includes('rsrc.php') ||
        href.includes('ctp=s80x80') ||
        href.includes('ctp=s50x50');
      const isMediaCdn = href.includes('scontent') || href.includes('cdninstagram.com') || href.includes('fbcdn.net');
      const rect = svgImg.getBoundingClientRect ? svgImg.getBoundingClientRect() : { width: 200, height: 200 };
      const isRealSize = rect.width === 0 || (rect.width >= 150 && rect.height >= 150);

      if (!isExcluded && isMediaCdn && isRealSize) {
        return { url: href, isVideo: false };
      }
    }
  }

  return null;
}

/**
 * Triggers native browser download without requiring chrome.downloads permission.
 */
export async function downloadMediaFile(url: string, filename: string): Promise<boolean> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }
    const blob = await resp.blob();
    // Guard against small error bodies (e.g. 22-byte 403 "URL signature mismatch" or tiny icons)
    if (blob.size < 1000) {
      throw new Error(`Downloaded blob too small (${blob.size} bytes), likely error payload`);
    }
    const blobUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
    return true;
  } catch (err) {
    console.warn('[Privacy Guard Media Downloader] Download failed:', err);
    return false;
  }
}

/**
 * Attaches the floating download button to a video/story container.
 */
function attachDownloadButton(container: HTMLElement): void {
  if (container.hasAttribute(ATTR_PROCESSED) || container.querySelector(`.${BTN_CLASS}`)) {
    return;
  }
  container.setAttribute(ATTR_PROCESSED, 'true');

  // Ensure positioning context
  const computed = window.getComputedStyle(container);
  if (computed.position === 'static') {
    container.style.position = 'relative';
  }

  const btn = document.createElement('button');
  btn.className = BTN_CLASS;
  btn.setAttribute('type', 'button');
  btn.setAttribute('aria-label', 'Download media');
  btn.innerHTML = `${SVG_ICON_DOWNLOAD}<span>Tải HD</span>`;

  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    e.preventDefault();

    const media = resolveMediaSource(container);
    if (!media) {
      btn.innerHTML = `${SVG_ICON_DOWNLOAD}<span>Không tìm thấy file</span>`;
      setTimeout(() => {
        btn.innerHTML = `${SVG_ICON_DOWNLOAD}<span>Tải HD</span>`;
      }, 2000);
      return;
    }

    btn.classList.add('pg-loading');
    btn.innerHTML = `${SVG_ICON_SPINNER}<span>Đang tải...</span>`;

    const ext = media.isVideo ? 'mp4' : 'jpg';
    const sitePrefix = location.hostname.includes('instagram') ? 'instagram' : 'facebook';
    const filename = `${sitePrefix}_${media.isVideo ? 'video' : 'story'}_${Date.now()}.${ext}`;

    const success = await downloadMediaFile(media.url, filename);
    btn.classList.remove('pg-loading');

    if (success) {
      btn.classList.add('pg-success');
      btn.innerHTML = `${SVG_ICON_CHECK}<span>Đã lưu</span>`;
      setTimeout(() => {
        btn.classList.remove('pg-success');
        btn.innerHTML = `${SVG_ICON_DOWNLOAD}<span>Tải HD</span>`;
      }, 2000);
    } else {
      btn.innerHTML = `${SVG_ICON_DOWNLOAD}<span>Thử lại</span>`;
    }
  });

  container.appendChild(btn);
}

/**
 * Installs the Media Quick Downloader in the window.
 */
export function installMediaDownloader(
  win: Window,
  isActive: () => boolean,
): () => void {
  const doc = win.document;
  if (!doc) {
    return () => {};
  }

  // 1. Inject Stylesheet
  let styleEl = doc.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = doc.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = DOWNLOADER_CSS;
    (doc.head || doc.documentElement).appendChild(styleEl);
  }

  // 2. Scan and attach to media containers
  function scanMediaContainers(): void {
    if (!isActive()) {
      return;
    }

    // 1. Query video elements and attach to their parent containers
    const videos = doc.querySelectorAll('video');
    videos.forEach((video) => {
      const container = (video.closest('article, [role="dialog"], [data-pagelet^="FeedUnit_"], div[role="feed"] > div, .x1y1aw1k') ||
        video.parentElement) as HTMLElement | null;
      if (container) {
        attachDownloadButton(container);
      }
    });

    // 2. Scan story viewer containers for image/photo stories
    const isStoryPage = typeof win !== 'undefined' && win.location?.pathname?.includes('/stories/');
    if (isStoryPage) {
      const storyImages = doc.querySelectorAll<HTMLElement>(
        'div[data-pagelet="StoriesReader"] img, section[role="region"] img, div[role="dialog"] img, div.x5yr21d img, svg image'
      );
      storyImages.forEach((imgEl) => {
        // Skip if container already has a video
        if (imgEl.closest('div.x5yr21d')?.querySelector('video') || imgEl.parentElement?.querySelector('video')) {
          return;
        }
        const rect = imgEl.getBoundingClientRect ? imgEl.getBoundingClientRect() : { width: 0, height: 0 };
        const isSvg = imgEl.tagName.toLowerCase() === 'image';
        const isLarge = isSvg
          ? rect.width >= 150 && rect.height >= 150
          : rect.width >= 150 || ((imgEl as HTMLImageElement).naturalWidth ?? 0) >= 150;

        if (isLarge) {
          const container = (imgEl.closest('article, [role="dialog"], div.x5yr21d, section') ||
            imgEl.parentElement) as HTMLElement | null;
          if (container) {
            attachDownloadButton(container);
          }
        }
      });
    }
  }

  scanMediaContainers();

  // 3. Observe dynamic video loading
  let observer: MutationObserver | null = null;
  if (typeof MutationObserver === 'function') {
    observer = new MutationObserver(() => {
      if (isActive()) {
        scanMediaContainers();
      }
    });

    const root = doc.body || doc.documentElement;
    if (root) {
      observer.observe(root, { childList: true, subtree: true });
    }
  }

  // 4. Teardown
  return () => {
    clearCapturedVideos();
    if (observer) {
      observer.disconnect();
    }

    const currentStyle = doc.getElementById(STYLE_ID);
    if (currentStyle) {
      currentStyle.remove();
    }
    const buttons = doc.querySelectorAll(`.${BTN_CLASS}`);
    buttons.forEach((b) => b.remove());
    const processed = doc.querySelectorAll(`[${ATTR_PROCESSED}]`);
    processed.forEach((el) => el.removeAttribute(ATTR_PROCESSED));
  };
}
