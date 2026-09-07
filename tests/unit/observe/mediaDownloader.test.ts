import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearCapturedVideos,
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
  });

  afterEach(() => {
    document.body.innerHTML = '';
    clearCapturedVideos();
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
});

