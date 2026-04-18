// YouTube Playlist Tiles Carousel (local-data driven; no heavy embeds)
(function () {
  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function on(win, eventName, handler, opts) {
    try {
      win.addEventListener(eventName, handler, opts);
    } catch {
      // ignore
    }
  }

  function isAutomation() {
    // Keep tests stable: avoid hard network dependency under automation.
    return Boolean(navigator && navigator.webdriver);
  }

  function getApiKey() {
    const k = (window.BOE_YT_API_KEY || '').trim();
    return k ? k : null;
  }

  function getFeaturedVideoId() {
    const id = (window.BOE_FEATURED_VIDEO_ID || '').trim();
    return id ? id : null;
  }

  function setHidden(el, hidden) {
    if (!el) return;
    el.hidden = Boolean(hidden);
  }

  function pauseYouTubeIframe(iframe) {
    if (!iframe) return;
    try {
      iframe.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: 'pauseVideo', args: '' }),
        '*'
      );
    } catch {
      // ignore
    }
  }

  function pauseOtherYouTubeIframes(exceptIframe) {
    try {
      document
        .querySelectorAll(
          'iframe[src*="youtube.com/embed"], iframe[src*="youtube-nocookie.com/embed"]'
        )
        .forEach((f) => {
          if (exceptIframe && f === exceptIframe) return;
          pauseYouTubeIframe(f);
        });
    } catch {
      // ignore
    }
  }

  function resetSpotifyEmbed() {
    const wrap = document.querySelector('[data-testid="spotify-embed"]');
    if (!wrap) return;
    const iframe = wrap.querySelector('iframe');
    if (!iframe) return;

    const src = iframe.getAttribute('src') || '';
    const stored = iframe.getAttribute('data-boe-src') || '';
    const stableSrc = stored || src;
    if (!stableSrc) return;

    if (!stored) iframe.setAttribute('data-boe-src', stableSrc);

    // Force a reload to stop playback (cross-origin embeds can't be paused directly).
    iframe.removeAttribute('src');
    window.requestAnimationFrame(() => {
      iframe.setAttribute('src', stableSrc);
    });
  }

  function installMediaCoordinator() {
    if (window.__boeMediaCoordinatorInstalled) return;
    window.__boeMediaCoordinatorInstalled = true;

    on(window, 'boe:media-play', (ev) => {
      const detail = ev && ev.detail ? ev.detail : {};
      const type = String(detail.type || '').toLowerCase();
      if (type === 'youtube') {
        pauseOtherYouTubeIframes(detail.iframe);
        resetSpotifyEmbed();
      }
      if (type === 'spotify') {
        pauseOtherYouTubeIframes(null);
      }
    });

    const isYouTubeEmbedIframe = (node) => {
      if (!node || node.tagName !== 'IFRAME') return false;
      const src = String(node.getAttribute('src') || '');
      return src.includes('youtube.com/embed') || src.includes('youtube-nocookie.com/embed');
    };

    const notifyYouTubeInteraction = (iframe) => {
      if (!isYouTubeEmbedIframe(iframe)) return;
      try {
        window.dispatchEvent(new CustomEvent('boe:media-play', { detail: { type: 'youtube', source: 'iframe', iframe } }));
      } catch {
        // ignore
      }
    };

    // Cross-origin: we can't observe play events inside the iframe.
    // But we *can* detect user interaction with the iframe element itself.
    document.addEventListener(
      'pointerdown',
      (e) => {
        const t = e && e.target ? e.target : null;
        if (t && t.tagName === 'IFRAME') notifyYouTubeInteraction(t);
      },
      { capture: true, passive: true }
    );

    document.addEventListener(
      'focusin',
      (e) => {
        const t = e && e.target ? e.target : null;
        if (t && t.tagName === 'IFRAME') notifyYouTubeInteraction(t);
      },
      true
    );

    // Clicking/tapping the Spotify iframe is detectable on the iframe element.
    const spotifyWrap = document.querySelector('[data-testid="spotify-embed"]');
    if (spotifyWrap) {
      const notifySpotify = () => {
        try {
          window.dispatchEvent(new CustomEvent('boe:media-play', { detail: { type: 'spotify' } }));
        } catch {
          // ignore
        }
      };

      spotifyWrap.addEventListener('pointerdown', notifySpotify, { capture: true, passive: true });
      spotifyWrap.addEventListener('keydown', notifySpotify, { capture: true, passive: true });
    }
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

  function buildEmbedUrl(videoId) {
    const u = new URL(`https://www.youtube.com/embed/${encodeURIComponent(videoId)}`);
    u.searchParams.set('autoplay', '1');
    u.searchParams.set('rel', '0');
    u.searchParams.set('modestbranding', '1');
    u.searchParams.set('enablejsapi', '1');
    return u.toString();
  }

  function buildIframe(videoId, title) {
    const iframe = document.createElement('iframe');
    iframe.className = 'yt-embed';
    iframe.src = buildEmbedUrl(videoId);
    iframe.title = title || 'YouTube video';
    iframe.loading = 'lazy';
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.allowFullscreen = true;
    return iframe;
  }

  function buildTile(item, playlistId, playlistUrl) {
    const wrap = document.createElement('div');
    wrap.className = 'yt-tile';
    const videoUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(item.videoId)}&list=${encodeURIComponent(playlistId)}`;

    const thumb = document.createElement('div');
    thumb.className = 'yt-thumb';

    const img = document.createElement('img');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.alt = item.title || 'YouTube video thumbnail';
    img.src = item.thumbnailUrl || `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`;

    thumb.appendChild(img);

    const open = document.createElement('a');
    open.className = 'yt-open';
    open.href = videoUrl;
    open.target = '_blank';
    open.rel = 'noopener';
    open.setAttribute('aria-label', item.title || 'Open YouTube video');
    thumb.appendChild(open);

    const playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.className = 'yt-play-btn';
    playBtn.setAttribute('aria-label', item.title ? `Play: ${item.title}` : 'Play video');
    playBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (thumb.querySelector('iframe')) return;
      thumb.innerHTML = '';

      const iframe = buildIframe(item.videoId, item.title || 'YouTube video');
      thumb.appendChild(iframe);

      try {
        window.dispatchEvent(
          new CustomEvent('boe:media-play', {
            detail: { type: 'youtube', source: 'carousel', videoId: item.videoId, iframe }
          })
        );
      } catch {
        // ignore
      }
    });
    thumb.appendChild(playBtn);

    const meta = document.createElement('div');
    meta.className = 'yt-meta';

    const title = document.createElement('a');
    title.className = 'yt-title';
    title.href = videoUrl;
    title.target = '_blank';
    title.rel = 'noopener';
    title.textContent = cleanTitle(item.title || '');

    meta.appendChild(title);

    wrap.appendChild(thumb);
    wrap.appendChild(meta);
    return wrap;
  }

  function signature(items) {
    if (!Array.isArray(items) || !items.length) return '';
    return items
      .map((x) => (x && x.videoId ? String(x.videoId) : ''))
      .filter(Boolean)
      .join(',');
  }

  function moveFeaturedToEnd(items) {
    if (!Array.isArray(items) || !items.length) return items;

    const featuredId = getFeaturedVideoId();
    if (!featuredId) return items;

    const featuredItems = [];
    const rest = [];

    for (const it of items) {
      if (!it || !it.videoId) continue;
      if (String(it.videoId) === featuredId) featuredItems.push(it);
      else rest.push(it);
    }

    if (!featuredItems.length) return items;

    // Avoid duplicates: keep the first occurrence, move it to the end.
    return [...rest, featuredItems[0]];
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
      let bodyText = '';
      try {
        bodyText = await res.text();
      } catch {
        bodyText = '';
      }

      // Try to extract a useful message from the API error payload.
      let details = '';
      try {
        const parsed = JSON.parse(bodyText);
        const msg = parsed?.error?.message;
        const reason = parsed?.error?.errors?.[0]?.reason;
        details = [msg, reason].filter(Boolean).join(' | ');
      } catch {
        details = String(bodyText || '').slice(0, 180);
      }
      throw new Error(details ? `HTTP ${res.status}: ${details}` : `HTTP ${res.status}`);
    }

    return await res.json();
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

        collected.push({ videoId, title, thumbnailUrl });
      }

      pageToken = String(json.nextPageToken || '').trim();
      if (!pageToken) break;
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

      const orderedItems = moveFeaturedToEnd(items);

      if (!orderedItems || !orderedItems.length) {
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

      for (const item of orderedItems) {
        if (!item || !item.videoId) continue;
        track.appendChild(buildTile(item, playlistId, playlistUrl));
      }

      currentSig = signature(orderedItems);

      viewport.scrollLeft = 0;
      updateArrows(root, viewport, leftBtn, rightBtn);
    };

    const cachedItems = readCache(playlistId, 6 * 60 * 60 * 1000);

    // Fast path: show cached or bundled data immediately.
    if (cachedItems && cachedItems.length) {
      renderItems(cachedItems);
    } else {
      renderItems([]);
    }

    // Live refresh (runtime-dynamic) when an API key is provided.
    const apiKey = getApiKey();
    if (apiKey && !isAutomation()) {
      (async () => {
        try {
          const liveItems = await fetchPlaylistItemsViaApi(playlistId, apiKey);
          if (!liveItems || !liveItems.length) return;

          const orderedLiveItems = moveFeaturedToEnd(liveItems);
          writeCache(playlistId, orderedLiveItems);

          // Avoid jarring update if user already started scrolling.
          if (!atStart(viewport)) return;

          const liveSig = signature(orderedLiveItems);
          if (liveSig && liveSig !== currentSig) {
            renderItems(orderedLiveItems);
          }
        } catch (err) {
          // Ignore network/API failures; keep fallback.
          // But make local debugging easier when an API key is present.
          const host = String(window.location && window.location.hostname ? window.location.hostname : '');
          if (host === 'localhost' || host === '127.0.0.1') {
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
    installMediaCoordinator();
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
