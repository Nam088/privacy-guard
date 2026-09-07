import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearCapturedVideos,
  extractStoryTargetId,
  extractTargetVideoId,
  getCapturedVideo,
  installMediaDownloader,
  parseAndRecordMediaFromText,
  resolveMediaSource,
  sanitizeMediaUrl,
} from '@/observe/mediaDownloader';

describe('mediaDownloader', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    clearCapturedVideos();
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    document.body.innerHTML = '';
    clearCapturedVideos();
    window.history.replaceState({}, '', '/');
    vi.restoreAllMocks();
  });


  describe('sanitizeMediaUrl', () => {
    it('strips bytestart and byteend query parameters while keeping other params intact', () => {
      const url =
        'https://instagram.fbcdn.net/o1/v/video.mp4?_nc_cat=111&bytestart=1000&byteend=5000&oe=6AA39508';
      const clean = sanitizeMediaUrl(url);
      expect(clean).toContain('_nc_cat=111');
      expect(clean).toContain('oe=6AA39508');
      expect(clean).not.toContain('bytestart');
      expect(clean).not.toContain('byteend');
    });

    it('returns raw URL unchanged when invalid', () => {
      expect(sanitizeMediaUrl('not-a-valid-url')).toBe('not-a-valid-url');
    });
  });

  describe('resolveMediaSource', () => {
    it('resolves direct http src from a video element', () => {
      const container = document.createElement('div');
      const video = document.createElement('video');
      video.src = 'https://video.fbcdn.net/video.mp4?bytestart=0&byteend=100';
      container.appendChild(video);
      document.body.appendChild(container);

      const res = resolveMediaSource(container);
      expect(res).not.toBeNull();
      expect(res?.isVideo).toBe(true);
      expect(res?.url).toBe('https://video.fbcdn.net/video.mp4');
    });

    it('resolves source child src from a video element', () => {
      const container = document.createElement('div');
      const video = document.createElement('video');
      const source = document.createElement('source');
      source.src = 'https://instagram.fbcdn.net/clip.mp4';
      video.appendChild(source);
      container.appendChild(video);
      document.body.appendChild(container);

      const res = resolveMediaSource(container);
      expect(res?.isVideo).toBe(true);
      expect(res?.url).toBe('https://instagram.fbcdn.net/clip.mp4');
    });

    it('resolves from performance resource entries when video src is blob', () => {
      const container = document.createElement('div');
      const video = document.createElement('video');
      video.src = 'blob:https://www.instagram.com/1234-abcd';
      container.appendChild(video);
      document.body.appendChild(container);

      vi.spyOn(performance, 'getEntriesByType').mockReturnValue([
        {
          name: 'https://instagram.fbcdn.net/o1/v/stream.mp4?bytestart=500&byteend=1000',
        } as PerformanceResourceTiming,
      ]);

      const res = resolveMediaSource(container);
      expect(res?.isVideo).toBe(true);
      expect(res?.url).toBe('https://instagram.fbcdn.net/o1/v/stream.mp4');
    });

    it('resolves story image source from img element', () => {
      const container = document.createElement('div');
      const img = document.createElement('img');
      img.src = 'https://instagram.fbcdn.net/story_photo.jpg';
      container.appendChild(img);
      document.body.appendChild(container);

      const res = resolveMediaSource(container);
      expect(res?.isVideo).toBe(false);
      expect(res?.url).toBe('https://instagram.fbcdn.net/story_photo.jpg');
    });

    it('rejects static UI icons and tiny assets on Facebook', () => {
      const container = document.createElement('div');
      const icon = document.createElement('img');
      icon.src = 'https://static.xx.fbcdn.net/rsrc.php/yv/r/QgSPOmVJB_Z.webp';
      container.appendChild(icon);
      document.body.appendChild(container);

      const res = resolveMediaSource(container);
      expect(res).toBeNull();
    });

    it('does not fall back to img when a video element is present in the container', () => {
      const container = document.createElement('div');
      const video = document.createElement('video');
      video.src = 'blob:https://web.facebook.com/dash-media-handle';
      const icon = document.createElement('img');
      icon.src = 'https://scontent.fbcdn.net/avatar.jpg';
      container.appendChild(video);
      container.appendChild(icon);
      document.body.appendChild(container);

      const res = resolveMediaSource(container);
      // Must not return the icon
      expect(res).toBeNull();
    });

    it('extracts Facebook DASH MPD BaseURL from page scripts', () => {
      const script = document.createElement('script');
      script.type = 'application/json';
      script.text = `
        FBQualityLabel=\\"720p\\">\\u003CBaseURL>https:\\/\\/scontent.fbcdn.net\\/video_720.mp4?_nc_cat=1&amp;efg=eyJiaXRyYXRlIjoxMDAwMDAwfQ==\\u003C/BaseURL>
        FBQualityLabel=\\"1080p\\">\\u003CBaseURL>https:\\/\\/scontent.fbcdn.net\\/video_1080.mp4?_nc_cat=1&amp;efg=eyJiaXRyYXRlIjoyMDAwMDAwfQ==\\u003C/BaseURL>
      `;
      document.body.appendChild(script);

      const container = document.createElement('div');
      const video = document.createElement('video');
      video.src = 'blob:https://web.facebook.com/media-source-stream';
      container.appendChild(video);
      document.body.appendChild(container);

      const res = resolveMediaSource(container);
      expect(res?.isVideo).toBe(true);
      expect(res?.url).toContain('video_1080.mp4');
    });

    it('resolves story image from SVG <image> elements while rejecting small avatar thumbnails', () => {
      const container = document.createElement('div');
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
      image.setAttribute(
        'href',
        'https://scontent.fdad1-1.fna.fbcdn.net/v/t39.30808-6/photo_story_hd.jpg?_nc_cat=101',
      );
      // Mock getBoundingClientRect for SVG element
      image.getBoundingClientRect = () =>
        ({
          width: 500,
          height: 800,
          top: 0,
          left: 0,
          bottom: 800,
          right: 500,
          x: 0,
          y: 0,
          toJSON: () => {},
        }) as DOMRect;

      svg.appendChild(image);
      container.appendChild(svg);
      document.body.appendChild(container);

      const res = resolveMediaSource(container);
      expect(res?.isVideo).toBe(false);
      expect(res?.url).toContain('photo_story_hd.jpg');
    });

    it('rejects efg base64 encoded audio streams when selecting script videos', () => {
      const audioEfg = btoa(JSON.stringify({ bitrate: 96000, vencode_tag: 'dash_ln_heaac_vbr3_audio' }));
      const videoEfg = btoa(JSON.stringify({ bitrate: 50000, vencode_tag: 'dash_baseline_1_v1' }));

      const script = document.createElement('script');
      script.type = 'application/json';
      script.text = `
        <BaseURL>https://scontent.fbcdn.net/story_audio.mp4?efg=${audioEfg}</BaseURL>
        <BaseURL>https://scontent.fbcdn.net/story_video.mp4?efg=${videoEfg}</BaseURL>
      `;
      document.body.appendChild(script);

      const container = document.createElement('div');
      const video = document.createElement('video');
      video.src = 'blob:https://web.facebook.com/story-video-handle';
      container.appendChild(video);
      document.body.appendChild(container);

      const res = resolveMediaSource(container);
      expect(res?.isVideo).toBe(true);
      expect(res?.url).toContain('story_video.mp4');
      expect(res?.url).not.toContain('story_audio.mp4');
    });

    it('rejects live stream buffers and selects recorded story video', () => {
      const liveEfg = btoa(JSON.stringify({ bitrate: 2000000, vencode_tag: 'dash_live_hd1_frag_2_video' }));
      const storyEfg = btoa(JSON.stringify({ bitrate: 800000, vencode_tag: 'dash_vp9-basic-gen2_720p' }));

      // Live script appended after story script
      const storyScript = document.createElement('script');
      storyScript.type = 'application/json';
      storyScript.text = `<BaseURL>https://scontent.fbcdn.net/story_clip.mp4?efg=${storyEfg}</BaseURL>`;
      document.body.appendChild(storyScript);

      const liveScript = document.createElement('script');
      liveScript.type = 'application/json';
      liveScript.text = `<BaseURL>https://scontent.fbcdn.net/livestream.mp4?efg=${liveEfg}</BaseURL>`;
      document.body.appendChild(liveScript);

      const container = document.createElement('div');
      const video = document.createElement('video');
      video.src = 'blob:https://web.facebook.com/story-video-dash';
      container.appendChild(video);
      document.body.appendChild(container);

      const res = resolveMediaSource(container);
      expect(res?.isVideo).toBe(true);
      expect(res?.url).toContain('story_clip.mp4');
      expect(res?.url).not.toContain('livestream.mp4');
    });
  });

  describe('installMediaDownloader', () => {
    it('injects style element into document head', () => {
      const cleanup = installMediaDownloader(window, () => true);
      const style = document.getElementById('privacy-guard-media-downloader-css');
      expect(style).not.toBeNull();
      cleanup();
      expect(document.getElementById('privacy-guard-media-downloader-css')).toBeNull();
    });

    it('attaches download button to video containers when active', () => {
      const container = document.createElement('article');
      const video = document.createElement('video');
      video.src = 'https://video.fbcdn.net/post.mp4';
      container.appendChild(video);
      document.body.appendChild(container);

      const cleanup = installMediaDownloader(window, () => true);

      const btn = container.querySelector('.pg-media-dl-btn');
      expect(btn).not.toBeNull();
      expect(btn?.textContent).toContain('Tải HD');

      cleanup();
      expect(container.querySelector('.pg-media-dl-btn')).toBeNull();
    });

    it('does not attach download button when feature is inactive', () => {
      const container = document.createElement('article');
      const video = document.createElement('video');
      video.src = 'https://video.fbcdn.net/post.mp4';
      container.appendChild(video);
      document.body.appendChild(container);

      const cleanup = installMediaDownloader(window, () => false);

      const btn = container.querySelector('.pg-media-dl-btn');
      expect(btn).toBeNull();

      cleanup();
    });
  });

  describe('scrolled reels & network stream capture', () => {

    it('extracts target video ID from data-video-id attribute', () => {
      const card = document.createElement('div');
      card.setAttribute('data-video-id', '2499228857222237');
      const inner = document.createElement('div');
      const video = document.createElement('video');
      inner.appendChild(video);
      card.appendChild(inner);
      document.body.appendChild(card);

      const targetId = extractTargetVideoId(inner);
      expect(targetId).toBe('2499228857222237');
    });

    it('extracts target video ID from video poster attribute', () => {
      const container = document.createElement('div');
      const video = document.createElement('video');
      video.setAttribute(
        'poster',
        'https://scontent.fbcdn.net/v/t15.5256-10/753880958_2196365094480536_6842178513870735879_n.jpg',
      );
      container.appendChild(video);
      document.body.appendChild(container);

      const targetId = extractTargetVideoId(container);
      expect(targetId).toBe('2196365094480536');
    });

    it('parses and records media from network GraphQL text response', () => {
      const efgData = btoa(JSON.stringify({ video_id: 2499228857222237, bitrate: 4500000, vencode_tag: 'dash_hd' }));
      const responseText = `{"data":{"node":{"playback_video":{"dash_manifest":null,"progressive_download_url":"https:\\/\\/scontent.fbcdn.net\\/o1\\/v\\/reel2.mp4?efg=${encodeURIComponent(efgData)}"}}}}`;

      parseAndRecordMediaFromText(responseText);

      const captured = getCapturedVideo('2499228857222237');
      expect(captured).toBeDefined();
      expect(captured?.bitrate).toBe(4500000);
      expect(captured?.url).toContain('reel2.mp4');
    });

    it('resolves distinct videos for scrolled reels without locking onto Reel 0', () => {
      // Reel 0 is in page scripts
      const script = document.createElement('script');
      script.type = 'application/json';
      const reel0Efg = btoa(JSON.stringify({ video_id: 1602974781835804, bitrate: 2000000 }));
      script.text = `<BaseURL>https://scontent.fbcdn.net/reel0.mp4?efg=${reel0Efg}</BaseURL>`;
      document.body.appendChild(script);

      // Reel 1 arrived via GraphQL infinite scroll
      const reel1Efg = btoa(JSON.stringify({ video_id: 2499228857222237, bitrate: 5000000 }));
      parseAndRecordMediaFromText(`progressive_download_url: "https://scontent.fbcdn.net/reel1.mp4?efg=${reel1Efg}"`);

      // Container for Reel 0
      const reel0Card = document.createElement('div');
      reel0Card.setAttribute('data-video-id', '1602974781835804');
      const video0 = document.createElement('video');
      video0.src = 'blob:https://web.facebook.com/reel0-blob';
      reel0Card.appendChild(video0);
      document.body.appendChild(reel0Card);

      // Container for Reel 1
      const reel1Card = document.createElement('div');
      reel1Card.setAttribute('data-video-id', '2499228857222237');
      const video1 = document.createElement('video');
      video1.src = 'blob:https://web.facebook.com/reel1-blob';
      reel1Card.appendChild(video1);
      document.body.appendChild(reel1Card);

      const res0 = resolveMediaSource(reel0Card);
      const res1 = resolveMediaSource(reel1Card);

      expect(res0?.url).toContain('reel0.mp4');
      expect(res1?.url).toContain('reel1.mp4');
      expect(res0?.url).not.toBe(res1?.url);
    });

    it('does NOT fallback to Reel 0 when a requested targetId is not found in scripts', () => {
      const script = document.createElement('script');
      script.type = 'application/json';
      const reel0Efg = btoa(JSON.stringify({ video_id: 1602974781835804, bitrate: 2000000 }));
      script.text = `<BaseURL>https://scontent.fbcdn.net/reel0.mp4?efg=${reel0Efg}</BaseURL>`;
      document.body.appendChild(script);

      // Card for Reel 999 which was not captured and is not in scripts
      const reel999Card = document.createElement('div');
      reel999Card.setAttribute('data-video-id', '9999999999999999');
      const video999 = document.createElement('video');
      video999.src = 'blob:https://web.facebook.com/reel999-blob';
      reel999Card.appendChild(video999);
      document.body.appendChild(reel999Card);

      const res = resolveMediaSource(reel999Card);
      // Must NOT return reel0.mp4!
      expect(res).toBeNull();
    });
  });

  describe('stories navigation & resolution', () => {
    describe('extractStoryTargetId', () => {
      it('extracts numeric story ID from Instagram story path', () => {
        const id = extractStoryTargetId('/stories/taylorswift/3456789012345678901/');
        expect(id).toBe('3456789012345678901');
      });

      it('extracts base64-encoded story ID from Facebook story path', () => {
        // UzpfSVNDOjEwODg5Mzc3MTAxNjk4NzE= decodes to S:_ISC:1088937710169871
        const id = extractStoryTargetId('/stories/1693209027396561/UzpfSVNDOjEwODg5Mzc3MTAxNjk4NzE=/');
        expect(id).toBe('1088937710169871');
      });

      it('extracts raw numeric story ID from Facebook story path', () => {
        const id = extractStoryTargetId('/stories/1693209027396561/1088937710169871/');
        expect(id).toBe('1088937710169871');
      });

      it('returns undefined for non-story paths', () => {
        expect(extractStoryTargetId('/messages/t/123')).toBeUndefined();
      });
    });

    it('resolves photo story as image (never stale video) even when old video scripts exist on page', () => {
      // Historical video script from a previously watched video story
      const oldVideoScript = document.createElement('script');
      oldVideoScript.type = 'application/json';
      const oldVideoEfg = btoa(JSON.stringify({ video_id: 1111111111111111, bitrate: 1500000 }));
      oldVideoScript.text = `<BaseURL>https://scontent.fbcdn.net/old_story_video.mp4?efg=${oldVideoEfg}</BaseURL>`;
      document.body.appendChild(oldVideoScript);

      // Current page is a story page
      window.history.replaceState({}, '', '/stories/1693209027396561/UzpfSVNDOjEwODg5Mzc3MTAxNjk4NzE=/');

      // Container has an image story (no video element)
      const storyContainer = document.createElement('div');
      storyContainer.className = 'x5yr21d';
      const img = document.createElement('img');
      img.src = 'https://scontent.fdad1-1.fna.fbcdn.net/v/t39.30808-6/current_story_photo.jpg';
      Object.defineProperty(img, 'naturalWidth', { value: 1080 });
      Object.defineProperty(img, 'naturalHeight', { value: 1920 });
      storyContainer.appendChild(img);
      document.body.appendChild(storyContainer);

      const res = resolveMediaSource(storyContainer);
      expect(res).not.toBeNull();
      expect(res?.isVideo).toBe(false);
      expect(res?.url).toBe('https://scontent.fdad1-1.fna.fbcdn.net/v/t39.30808-6/current_story_photo.jpg');
      expect(res?.url).not.toContain('old_story_video.mp4');
    });

    it('resolves correct sequential video story and does NOT get stuck on previous story of same author', () => {
      const bucketId = '1693209027396561';
      const story1Token = 'UzpfSVNDOjEwODg5Mzc3MTAxNjk4NzE='; // id: 1088937710169871
      const story2Token = 'UzpfSVNDOjIwOTk4NDg4MjEyODAxODIv'; // id: 2099848821280182

      // Script 1 containing Story 1 video
      const script1 = document.createElement('script');
      script1.type = 'application/json';
      const story1Efg = btoa(JSON.stringify({ video_id: 1088937710169871, bitrate: 2000000 }));
      script1.text = `{"story_card_id":"${story1Token}","bucket_id":"${bucketId}"}<BaseURL>https://scontent.fbcdn.net/story1.mp4?efg=${story1Efg}</BaseURL>`;
      document.body.appendChild(script1);

      // Script 2 containing Story 2 video
      const script2 = document.createElement('script');
      script2.type = 'application/json';
      const story2Efg = btoa(JSON.stringify({ video_id: 2099848821280182, bitrate: 2500000 }));
      script2.text = `{"story_card_id":"${story2Token}","bucket_id":"${bucketId}"}<BaseURL>https://scontent.fbcdn.net/story2.mp4?efg=${story2Efg}</BaseURL>`;
      document.body.appendChild(script2);

      // User navigates to Story 2
      window.history.replaceState({}, '', `/stories/${bucketId}/${story2Token}/`);

      const story2Container = document.createElement('div');
      story2Container.className = 'x5yr21d';
      const video2 = document.createElement('video');
      video2.src = 'blob:https://web.facebook.com/story2-blob';
      story2Container.appendChild(video2);
      document.body.appendChild(story2Container);

      const res = resolveMediaSource(story2Container);
      expect(res).not.toBeNull();
      expect(res?.isVideo).toBe(true);
      expect(res?.url).toContain('story2.mp4');
      expect(res?.url).not.toContain('story1.mp4');
    });

    it('does NOT fallback to Story 1 or Story 2 when Story 3 is not available in scripts', () => {
      const bucketId = '1693209027396561';
      const story1Token = 'UzpfSVNDOjEwODg5Mzc3MTAxNjk4NzE=';

      const script1 = document.createElement('script');
      script1.type = 'application/json';
      const story1Efg = btoa(JSON.stringify({ video_id: 1088937710169871, bitrate: 2000000 }));
      script1.text = `{"story_card_id":"${story1Token}","bucket_id":"${bucketId}"}<BaseURL>https://scontent.fbcdn.net/story1.mp4?efg=${story1Efg}</BaseURL>`;
      document.body.appendChild(script1);

      // User navigates to Story 3 which has token not in scripts
      const story3Token = 'UzpfSVNDOjMzMzMzMzMzMzMzMzMzMzM='; // id: 3333333333333333
      window.history.replaceState({}, '', `/stories/${bucketId}/${story3Token}/`);

      const story3Container = document.createElement('div');
      const video3 = document.createElement('video');
      video3.src = 'blob:https://web.facebook.com/story3-blob';
      story3Container.appendChild(video3);
      document.body.appendChild(story3Container);

      const res = resolveMediaSource(story3Container);
      // Must NOT fallback to story1.mp4!
      expect(res).toBeNull();
    });

    it('does not pick unmatching performance entries on story pages', () => {
      window.history.replaceState({}, '', '/stories/taylorswift/3456789012345678901/');

      // Performance entry from an older cached video (e.g. ad or previous story)
      vi.spyOn(performance, 'getEntriesByType').mockReturnValue([
        {
          name: 'https://instagram.fbcdn.net/o1/v/stale_video.mp4?bytestart=0&byteend=100',
        } as PerformanceResourceTiming,
      ]);

      const container = document.createElement('div');
      const video = document.createElement('video');
      video.src = 'blob:https://www.instagram.com/story-blob';
      container.appendChild(video);
      document.body.appendChild(container);

      const res = resolveMediaSource(container);
      expect(res).toBeNull();
    });
  });

  describe('non-intrusive positioning & container hierarchy', () => {
    it('attaches button to the immediate video wrapper instead of outer article', () => {
      const article = document.createElement('article');
      const postHeader = document.createElement('header');
      postHeader.innerHTML = '<button aria-label="Tùy chọn khác">...</button>';
      article.appendChild(postHeader);

      const videoWrapper = document.createElement('div');
      videoWrapper.className = 'x5yr21d';
      const video = document.createElement('video');
      video.src = 'https://video.fbcdn.net/post.mp4';
      videoWrapper.appendChild(video);
      article.appendChild(videoWrapper);
      document.body.appendChild(article);

      const cleanup = installMediaDownloader(window, () => true);

      // Button must NOT be on article (which would cover the 3-dot menu)
      expect(article.querySelector(':scope > .pg-media-dl-btn')).toBeNull();
      // Button MUST be inside the video wrapper
      const btn = videoWrapper.querySelector('.pg-media-dl-btn');
      expect(btn).not.toBeNull();
      expect(btn?.classList.contains('pg-story-btn')).toBe(false);

      cleanup();
    });

    it('attaches with pg-story-btn on story pages to avoid header collision', () => {
      window.history.replaceState({}, '', '/stories/1693209027396561/UzpfSVNDOjEwODg5Mzc3MTAxNjk4NzE=/');

      const storyWrapper = document.createElement('div');
      storyWrapper.className = 'x5yr21d';
      const video = document.createElement('video');
      video.src = 'https://video.fbcdn.net/story.mp4';
      storyWrapper.appendChild(video);
      document.body.appendChild(storyWrapper);

      const cleanup = installMediaDownloader(window, () => true);

      const btn = storyWrapper.querySelector('.pg-media-dl-btn');
      expect(btn).not.toBeNull();
      expect(btn?.classList.contains('pg-story-btn')).toBe(true);

      cleanup();
    });

    it('skips tiny preview cards in horizontal story trays', () => {
      const trayCard = document.createElement('div');
      trayCard.className = 'x5yr21d';
      const video = document.createElement('video');
      video.src = 'https://video.fbcdn.net/preview.mp4';
      // Mock tiny preview dimensions (e.g. 100x140 in story tray)
      video.getBoundingClientRect = () =>
        ({
          width: 110,
          height: 150,
          top: 0,
          left: 0,
          bottom: 150,
          right: 110,
          x: 0,
          y: 0,
          toJSON: () => {},
        }) as DOMRect;

      trayCard.appendChild(video);
      document.body.appendChild(trayCard);

      const cleanup = installMediaDownloader(window, () => true);

      // Must NOT attach download button to tiny preview tiles
      expect(trayCard.querySelector('.pg-media-dl-btn')).toBeNull();

      cleanup();
    });
  });
});

