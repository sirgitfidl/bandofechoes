(function () {
  function getApiKey() {
    try {
      const k = (window.BOE_YT_API_KEY || '').trim();
      return k ? k : null;
    } catch {
      return null;
    }
  }

  function getPlaylistId() {
    try {
      const fromGlobal = (window.BOE_YT_PLAYLIST_ID || '').trim();
      if (fromGlobal) return fromGlobal;
    } catch {
      // ignore
    }

    try {
      const el = document.querySelector('[data-testid="yt-playlist"]');
      const id = (el && el.getAttribute('data-playlist-id')) || '';
      return String(id).trim() || null;
    } catch {
      return null;
    }
  }

  function dispatchFeatured(videoId) {
    try {
      window.dispatchEvent(
        new CustomEvent('boe:featured-video', {
          detail: { videoId, source: 'playlist' }
        })
      );
    } catch {
      // ignore
    }
  }

  function cacheKey(playlistId) {
    return `BOE_FEATURED_FROM_PLAYLIST_${playlistId}`;
  }

  function readCache(playlistId, maxAgeMs) {
    try {
      const raw = localStorage.getItem(cacheKey(playlistId));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.videoId || !parsed.fetchedAt) return null;
      if (Date.now() - Number(parsed.fetchedAt) > maxAgeMs) return null;
      return String(parsed.videoId).trim() || null;
    } catch {
      return null;
    }
  }

  function writeCache(playlistId, videoId) {
    try {
      localStorage.setItem(cacheKey(playlistId), JSON.stringify({ videoId, fetchedAt: Date.now() }));
    } catch {
      // ignore
    }
  }

  async function fetchLatestVideoId(playlistId, apiKey) {
    const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
    url.searchParams.set('part', 'contentDetails');
    url.searchParams.set('maxResults', '1');
    url.searchParams.set('playlistId', playlistId);
    url.searchParams.set('key', apiKey);

    const res = await fetch(url.toString(), { headers: { accept: 'application/json' } });
    if (!res.ok) return null;

    const json = await res.json();
    const first = Array.isArray(json.items) ? json.items[0] : null;
    const id = first?.contentDetails?.videoId;
    return id ? String(id).trim() : null;
  }

  async function boot() {
    const apiKey = getApiKey();
    if (!apiKey) return;

    const playlistId = getPlaylistId();
    if (!playlistId) return;

    // Use a short cache to reduce quota while still tracking uploads quickly.
    const cached = readCache(playlistId, 15 * 60 * 1000);
    if (cached) {
      window.BOE_FEATURED_VIDEO_ID = cached;
      dispatchFeatured(cached);
    }

    const live = await fetchLatestVideoId(playlistId, apiKey);
    if (!live) return;

    if (String(window.BOE_FEATURED_VIDEO_ID || '').trim() !== live) {
      window.BOE_FEATURED_VIDEO_ID = live;
      dispatchFeatured(live);
    }

    writeCache(playlistId, live);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      boot().catch(() => {});
    });
  } else {
    boot().catch(() => {});
  }
})();
