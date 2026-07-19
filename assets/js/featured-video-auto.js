(function () {
  function getApiKey() {
    try {
      const k = (window.YT_API_KEY || '').trim();
      return k ? k : null;
    } catch {
      return null;
    }
  }

  function getPlaylistId() {
    try {
      const fromGlobal = (window.YT_PLAYLIST_ID || '').trim();
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
        new CustomEvent('site:featured-video', {
          detail: { videoId, source: 'playlist' }
        })
      );
    } catch {
      // ignore
    }
  }

  function cacheKey(playlistId) {
    return `FEATURED_FROM_PLAYLIST_${playlistId}`;
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

  function chunk(arr, size) {
    const out = [];
    const a = Array.isArray(arr) ? arr : [];
    const s = Math.max(1, Number(size) || 1);
    for (let i = 0; i < a.length; i += s) out.push(a.slice(i, i + s));
    return out;
  }

  function isFutureIsoDate(iso) {
    try {
      const t = Date.parse(String(iso || ''));
      if (!Number.isFinite(t)) return false;
      return t > Date.now() + 5000;
    } catch {
      return false;
    }
  }

  async function fetchUpcomingVideoIdSet(videoIds, apiKey) {
    const ids = (Array.isArray(videoIds) ? videoIds : [])
      .map((x) => String(x || '').trim())
      .filter(Boolean);
    if (!ids.length) return new Set();

    const upcoming = new Set();

    for (const group of chunk(ids, 50)) {
      const url = new URL('https://www.googleapis.com/youtube/v3/videos');
      url.searchParams.set('part', 'snippet,liveStreamingDetails');
      url.searchParams.set('id', group.join(','));
      url.searchParams.set('key', apiKey);

      const res = await fetch(url.toString(), { headers: { accept: 'application/json' } });
      if (!res.ok) continue;

      let json;
      try {
        json = await res.json();
      } catch {
        json = null;
      }

      const items = Array.isArray(json?.items) ? json.items : [];
      for (const it of items) {
        const id = String(it?.id || '').trim();
        if (!id) continue;

        const live = String(it?.snippet?.liveBroadcastContent || '').toLowerCase();
        const scheduled = it?.liveStreamingDetails?.scheduledStartTime;
        const isUpcoming = live === 'upcoming' || isFutureIsoDate(scheduled);
        if (isUpcoming) upcoming.add(id);
      }
    }

    return upcoming;
  }

  async function fetchLatestNonUpcomingVideoId(playlistId, apiKey) {
    const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
    url.searchParams.set('part', 'contentDetails');
    url.searchParams.set('maxResults', '10');
    url.searchParams.set('playlistId', playlistId);
    url.searchParams.set('key', apiKey);

    const res = await fetch(url.toString(), { headers: { accept: 'application/json' } });
    if (!res.ok) return null;

    const json = await res.json();
    const items = Array.isArray(json.items) ? json.items : [];
    const ids = items
      .map((x) => x?.contentDetails?.videoId)
      .filter(Boolean)
      .map((x) => String(x).trim())
      .filter(Boolean);

    if (!ids.length) return null;

    // Ignore scheduled premieres (and other upcoming broadcasts).
    const upcoming = await fetchUpcomingVideoIdSet(ids, apiKey);
    for (const id of ids) {
      if (upcoming && upcoming.has(id)) continue;
      return id;
    }

    return null;
  }

  async function boot() {
    const apiKey = getApiKey();
    if (!apiKey) return;

    const playlistId = getPlaylistId();
    if (!playlistId) return;

    // Use a short cache to reduce quota while still tracking uploads quickly.
    const cached = readCache(playlistId, 15 * 60 * 1000);

    let live = null;
    try {
      live = await fetchLatestNonUpcomingVideoId(playlistId, apiKey);
    } catch {
      live = null;
    }

    const chosen = live || cached;
    if (!chosen) return;

    if (String(window.FEATURED_VIDEO_ID || '').trim() !== chosen) {
      window.FEATURED_VIDEO_ID = chosen;
      dispatchFeatured(chosen);
    }

    if (live) writeCache(playlistId, live);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      boot().catch(() => {});
    });
  } else {
    boot().catch(() => {});
  }
})();
