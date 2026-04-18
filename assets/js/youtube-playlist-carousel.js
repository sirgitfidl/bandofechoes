// YouTube Playlist Tiles Carousel (local-data driven; no heavy embeds)
(function () {
  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function isAutomation() {
    // Keep tests stable: avoid hard network dependency under automation.
    return Boolean(navigator && navigator.webdriver);
  }

  function getApiKey() {
    const k = (window.BOE_YT_API_KEY || '').trim();
    return k ? k : null;
  }

  function isDebug() {
    try {
      return /(?:^|[?&])ytdebug=1(?:&|$)/.test(String(window.location && window.location.search ? window.location.search : ''));
    } catch {
      return false;
    }
  }

  function setHidden(el, hidden) {
    if (!el) return;
    el.hidden = Boolean(hidden);
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function cleanTitle(title) {
    const t = String(title || '').trim();
    if (!t) return '';

    // Remove common suffix we don't want displayed under tiles.
    // Example: "Hurt – Nine Inch Nails (Acoustic Cover) | Band of Echoes"
    return t
      .replace(/\s*\(Acoustic Cover\)\s*\|\s*Band of Echoes\s*$/i, '')
      .replace(/\s*\|\s*Band of Echoes\s*$/i, '')
      .trim();
  }

  function isScrollable(el) {
    if (!el) return false;
    return el.scrollWidth > el.clientWidth + 2;
  }

  function atStart(el) {
    return !el || el.scrollLeft <= 2;
  }

  function atEnd(el) {
    if (!el) return true;
    return el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;
  }

  function updateArrows(root, viewport, leftBtn, rightBtn) {
    const scrollable = isScrollable(viewport);
    if (!scrollable) {
      setHidden(leftBtn, true);
      setHidden(rightBtn, true);
      return;
    }

    const showLeft = !atStart(viewport);
    const showRight = !atEnd(viewport);

    setHidden(leftBtn, !showLeft);
    setHidden(rightBtn, !showRight);
  }

  function buildTile(item, playlistId, playlistUrl) {
    const a = document.createElement('a');
    a.className = 'yt-tile';
    const videoUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(item.videoId)}&list=${encodeURIComponent(playlistId)}`;
    a.href = videoUrl;
    a.target = '_blank';
    a.rel = 'noopener';
    a.setAttribute('aria-label', item.title || 'YouTube video');

    const thumb = document.createElement('div');
    thumb.className = 'yt-thumb';

    const img = document.createElement('img');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.alt = item.title || 'YouTube video thumbnail';
    img.src = item.thumbnailUrl || `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`;

    thumb.appendChild(img);

    if (item.length) {
      const dur = document.createElement('span');
      dur.className = 'yt-duration';
      dur.textContent = item.length;
      thumb.appendChild(dur);
    }

    const meta = document.createElement('div');
    meta.className = 'yt-meta';

    const title = document.createElement('div');
    title.className = 'yt-title';
    title.textContent = cleanTitle(item.title || '');

    meta.appendChild(title);

    a.appendChild(thumb);
    a.appendChild(meta);
    return a;
  }

  function signature(items) {
    if (!Array.isArray(items) || !items.length) return '';
    return items
      .map((x) => (x && x.videoId ? String(x.videoId) : ''))
      .filter(Boolean)
      .join(',');
  }

  function cacheKey(playlistId) {
    return `BOE_YT_PLAYLIST_CACHE_${playlistId}`;
  }

  function readCache(playlistId, maxAgeMs) {
    try {
      const raw = localStorage.getItem(cacheKey(playlistId));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.items) || !parsed.fetchedAt) return null;
      if (Date.now() - Number(parsed.fetchedAt) > maxAgeMs) return null;
      return parsed.items;
    } catch {
      return null;
    }
  }

  function writeCache(playlistId, items) {
    try {
      localStorage.setItem(
        cacheKey(playlistId),
        JSON.stringify({ fetchedAt: Date.now(), items })
      );
    } catch {
      // ignore
    }
  }

  async function fetchJson(url) {
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.json();
  }

  function parseIso8601DurationToSeconds(iso) {
    const m = String(iso || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return 0;
    const h = Number(m[1] || 0);
    const min = Number(m[2] || 0);
    const s = Number(m[3] || 0);
    return h * 3600 + min * 60 + s;
  }

  function formatSeconds(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad2 = (n) => String(n).padStart(2, '0');
    if (h > 0) return `${h}:${pad2(m)}:${pad2(s)}`;
    return `${m}:${pad2(s)}`;
  }

  async function fetchPlaylistItemsViaApi(playlistId, apiKey) {
    const collected = [];
    let pageToken = '';

    for (let page = 0; page < 50; page++) {
      const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
      url.searchParams.set('part', 'snippet,contentDetails');
      url.searchParams.set('maxResults', '50');
      url.searchParams.set('playlistId', playlistId);
      url.searchParams.set('key', apiKey);
      if (pageToken) url.searchParams.set('pageToken', pageToken);

      const json = await fetchJson(url.toString());
      const items = Array.isArray(json.items) ? json.items : [];

      for (const it of items) {
        const videoId =
          it?.contentDetails?.videoId ||
          it?.snippet?.resourceId?.videoId ||
          '';
        const title = (it?.snippet?.title || '').trim();
        if (!videoId || !title) continue;
        if (title === 'Private video' || title === 'Deleted video') continue;

        const thumbs = it?.snippet?.thumbnails || {};
        const thumbnailUrl =
          thumbs.maxres?.url ||
          thumbs.standard?.url ||
          thumbs.high?.url ||
          thumbs.medium?.url ||
          thumbs.default?.url ||
          `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

        collected.push({ videoId, title, thumbnailUrl, length: '' });
      }

      pageToken = String(json.nextPageToken || '').trim();
      if (!pageToken) break;
    }

    // Enrich with durations (videos.list) in batches of 50.
    const ids = collected.map((x) => x.videoId).filter(Boolean);
    const durationById = new Map();

    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50);
      if (!chunk.length) continue;
      const url = new URL('https://www.googleapis.com/youtube/v3/videos');
      url.searchParams.set('part', 'contentDetails');
      url.searchParams.set('id', chunk.join(','));
      url.searchParams.set('key', apiKey);

      const json = await fetchJson(url.toString());
      const items = Array.isArray(json.items) ? json.items : [];
      for (const it of items) {
        const id = String(it?.id || '').trim();
        const iso = it?.contentDetails?.duration;
        if (!id || !iso) continue;
        const sec = parseIso8601DurationToSeconds(iso);
        if (sec > 0) durationById.set(id, formatSeconds(sec));
      }
    }

    for (const it of collected) {
      const d = durationById.get(it.videoId);
      if (d) it.length = d;
    }

    return collected;
  }

  function init(root) {
    const playlistId = root.getAttribute('data-playlist-id');
    const playlistUrl = root.getAttribute('data-playlist-url') || '';

    const viewport = $('[data-testid="yt-carousel-viewport"]', root);
    const track = $('[data-testid="yt-carousel-track"]', root);
    const leftBtn = $('[data-testid="yt-carousel-left"]', root);
    const rightBtn = $('[data-testid="yt-carousel-right"]', root);

    if (!playlistId || !viewport || !track || !leftBtn || !rightBtn) return;

    let currentSig = '';

    const renderItems = (items) => {
      track.innerHTML = '';

      if (!items || !items.length) {
        // Fallback: keep a minimal affordance if data isn't available.
        const fallback = document.createElement('a');
        fallback.className = 'btn';
        fallback.href = playlistUrl || `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`;
        fallback.target = '_blank';
        fallback.rel = 'noopener';
        fallback.textContent = 'View playlist on YouTube';
        track.appendChild(fallback);
        viewport.scrollLeft = 0;
        updateArrows(root, viewport, leftBtn, rightBtn);
        currentSig = '';
        return;
      }

      for (const item of items) {
        if (!item || !item.videoId) continue;
        track.appendChild(buildTile(item, playlistId, playlistUrl));
      }

      currentSig = signature(items);

      viewport.scrollLeft = 0;
      updateArrows(root, viewport, leftBtn, rightBtn);
    };

    /** @type {any[]} */
    const localItems = (window.BOE_YT_PLAYLISTS && window.BOE_YT_PLAYLISTS[playlistId]) || [];
    const cachedItems = readCache(playlistId, 6 * 60 * 60 * 1000);

    // Fast path: show cached or bundled data immediately.
    if (cachedItems && cachedItems.length) {
      renderItems(cachedItems);
    } else if (localItems && localItems.length) {
      renderItems(localItems);
    } else {
      renderItems([]);
    }

    // Live refresh (runtime-dynamic) when an API key is provided.
    const apiKey = getApiKey();
    if (apiKey && !isAutomation()) {
      (async () => {
        try {
          if (isDebug()) {
            // eslint-disable-next-line no-console
            console.info('[boe] Fetching YouTube playlist via API…');
          }
          const liveItems = await fetchPlaylistItemsViaApi(playlistId, apiKey);
          if (!liveItems || !liveItems.length) return;

          if (isDebug()) {
            // eslint-disable-next-line no-console
            console.info(`[boe] YouTube API returned ${liveItems.length} items.`);
          }

          writeCache(playlistId, liveItems);

          // Avoid jarring update if user already started scrolling.
          if (!atStart(viewport)) return;

          const liveSig = signature(liveItems);
          if (liveSig && liveSig !== currentSig) {
            renderItems(liveItems);
          }
        } catch (err) {
          // Ignore network/API failures; keep fallback.
          // But make local debugging easier when an API key is present.
          const host = String(window.location && window.location.hostname ? window.location.hostname : '');
          if (host === 'localhost' || host === '127.0.0.1') {
            // eslint-disable-next-line no-console
            console.warn('[boe] YouTube playlist live fetch failed; using fallback.', err);
          }

          if (isDebug()) {
            // eslint-disable-next-line no-console
            console.warn('[boe] YouTube playlist live fetch failed; using fallback.', err);
          }
        }
      })();
    }

    const scrollStep = () => clamp(Math.floor(viewport.clientWidth * 0.9), 240, 900);

    leftBtn.addEventListener('click', () => {
      viewport.scrollBy({ left: -scrollStep(), behavior: 'smooth' });
    });

    rightBtn.addEventListener('click', () => {
      viewport.scrollBy({ left: scrollStep(), behavior: 'smooth' });
    });

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        updateArrows(root, viewport, leftBtn, rightBtn);
      });
    };

    viewport.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    // Initial: force clean start state
    viewport.scrollLeft = 0;
    updateArrows(root, viewport, leftBtn, rightBtn);
  }

  function boot() {
    const root = document.querySelector('[data-testid="yt-playlist"]');
    if (!root) return;
    init(root);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
