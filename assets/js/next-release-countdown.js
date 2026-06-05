(function () {
  const FALLBACK = {
    year: 2026,
    month: 6,
    day: 18,
    hour: 10,
    minute: 0,
    timeZone: 'America/Los_Angeles'
  };

  const PLAYLIST_PREMIERE_CACHE_MAX_AGE_MS = 15 * 60 * 1000;

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

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

  function isAutomation() {
    // Keep tests stable: avoid hard network dependency under automation.
    return Boolean(navigator && navigator.webdriver);
  }

  function getPremiereUrl() {
    try {
      const u = (window.BOE_NEXT_PREMIERE_URL || '').trim();
      return u ? u : null;
    } catch {
      return null;
    }
  }

  function buildYouTubeWatchUrl(videoId, playlistId) {
    const v = String(videoId || '').trim();
    if (!v) return null;
    const url = new URL('https://www.youtube.com/watch');
    url.searchParams.set('v', v);
    if (playlistId) url.searchParams.set('list', String(playlistId));
    return url.toString();
  }

  function parseYouTubeVideoId(url) {
    try {
      const u = new URL(String(url || ''));
      const host = u.hostname.replace(/^www\./, '');

      // watch?v=
      const v = u.searchParams.get('v');
      if (v && /^[A-Za-z0-9_-]{6,}$/.test(v)) return v;

      // youtu.be/<id>
      if (host === 'youtu.be') {
        const id = u.pathname.split('/').filter(Boolean)[0] || '';
        if (/^[A-Za-z0-9_-]{6,}$/.test(id)) return id;
      }

      // /embed/<id> or /live/<id> or /shorts/<id>
      const parts = u.pathname.split('/').filter(Boolean);
      const idx = parts.findIndex((p) => p === 'embed' || p === 'live' || p === 'shorts');
      if (idx >= 0 && parts[idx + 1] && /^[A-Za-z0-9_-]{6,}$/.test(parts[idx + 1])) return parts[idx + 1];

      // fallback: last segment
      const last = parts[parts.length - 1] || '';
      if (/^[A-Za-z0-9_-]{6,}$/.test(last)) return last;

      return null;
    } catch {
      return null;
    }
  }

  // Convert a wall-clock time in an IANA timezone to a UTC Date.
  // Uses Intl to account for DST correctly.
  function zonedTimeToUtc({ year, month, day, hour, minute, timeZone }) {
    const approxUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));

    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const parts = fmt.formatToParts(approxUtc);
    const map = {};
    for (const p of parts) {
      if (p.type !== 'literal') map[p.type] = p.value;
    }

    const asUtc = Date.UTC(
      Number(map.year),
      Number(map.month) - 1,
      Number(map.day),
      Number(map.hour),
      Number(map.minute),
      Number(map.second)
    );

    // If the formatter shows a different wall-clock than we intended, adjust.
    const offsetMs = asUtc - approxUtc.getTime();
    return new Date(approxUtc.getTime() - offsetMs);
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function formatCountdown(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return { days, hours, minutes, seconds };
  }

  function cacheKey(videoId) {
    return `BOE_PREMIERE_START_${videoId}`;
  }

  function playlistPremiereCacheKey(playlistId) {
    return `BOE_NEXT_PREMIERE_FROM_PLAYLIST_${playlistId}`;
  }

  function readCachedPlaylistPremiere(playlistId, maxAgeMs) {
    try {
      const raw = localStorage.getItem(playlistPremiereCacheKey(playlistId));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.videoId || !parsed.scheduledStartTime || !parsed.fetchedAt) return null;
      if (Date.now() - Number(parsed.fetchedAt) > maxAgeMs) return null;
      return {
        videoId: String(parsed.videoId),
        scheduledStartTime: String(parsed.scheduledStartTime),
        title: String(parsed.title || ''),
        thumbnailUrl: String(parsed.thumbnailUrl || '')
      };
    } catch {
      return null;
    }
  }

  function writeCachedPlaylistPremiere(playlistId, data) {
    try {
      if (!playlistId || !data || !data.videoId || !data.scheduledStartTime) return;
      localStorage.setItem(
        playlistPremiereCacheKey(playlistId),
        JSON.stringify({
          videoId: String(data.videoId),
          scheduledStartTime: String(data.scheduledStartTime),
          title: String(data.title || ''),
          thumbnailUrl: String(data.thumbnailUrl || ''),
          fetchedAt: Date.now()
        })
      );
    } catch {
      // ignore
    }
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

  function readCachedScheduledStart(videoId, maxAgeMs) {
    try {
      const raw = localStorage.getItem(cacheKey(videoId));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.scheduledStartTime || !parsed.fetchedAt) return null;
      if (Date.now() - Number(parsed.fetchedAt) > maxAgeMs) return null;
      return String(parsed.scheduledStartTime);
    } catch {
      return null;
    }
  }

  function writeCachedScheduledStart(videoId, scheduledStartTime) {
    try {
      localStorage.setItem(
        cacheKey(videoId),
        JSON.stringify({ scheduledStartTime, fetchedAt: Date.now() })
      );
    } catch {
      // ignore
    }
  }

  async function fetchPremiereScheduledStart(videoId, apiKey) {
    const url = new URL('https://www.googleapis.com/youtube/v3/videos');
    url.searchParams.set('part', 'liveStreamingDetails');
    url.searchParams.set('id', videoId);
    url.searchParams.set('key', apiKey);

    const res = await fetch(url.toString(), { headers: { accept: 'application/json' } });
    if (!res.ok) return null;

    const json = await res.json();
    const first = Array.isArray(json.items) ? json.items[0] : null;
    const t = first?.liveStreamingDetails?.scheduledStartTime;
    return t ? String(t) : null;
  }

  function chunk(arr, size) {
    const out = [];
    const a = Array.isArray(arr) ? arr : [];
    const s = Math.max(1, Number(size) || 1);
    for (let i = 0; i < a.length; i += s) out.push(a.slice(i, i + s));
    return out;
  }

  async function fetchNextPremiereFromPlaylist(playlistId, apiKey) {
    const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
    url.searchParams.set('part', 'contentDetails,snippet');
    url.searchParams.set('maxResults', '25');
    url.searchParams.set('playlistId', playlistId);
    url.searchParams.set('key', apiKey);

    const res = await fetch(url.toString(), { headers: { accept: 'application/json' } });
    if (!res.ok) return null;

    const json = await res.json();
    const items = Array.isArray(json.items) ? json.items : [];

    const ordered = items
      .map((x) => {
        const videoId = String(x?.contentDetails?.videoId || '').trim();
        if (!videoId) return null;

        const title = String(x?.snippet?.title || '').trim();
        const thumbs = x?.snippet?.thumbnails || {};
        const thumbUrl =
          (thumbs?.maxres?.url || thumbs?.standard?.url || thumbs?.high?.url || thumbs?.medium?.url || thumbs?.default?.url || '').trim() ||
          `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

        return { videoId, title, thumbnailUrl: thumbUrl };
      })
      .filter(Boolean);

    if (!ordered.length) return null;

    // Fetch liveStreamingDetails for these IDs in batches.
    const idList = ordered.map((x) => x.videoId);
    const detailsById = new Map();

    for (const group of chunk(idList, 50)) {
      const vUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
      vUrl.searchParams.set('part', 'snippet,liveStreamingDetails');
      vUrl.searchParams.set('id', group.join(','));
      vUrl.searchParams.set('key', apiKey);

      const vRes = await fetch(vUrl.toString(), { headers: { accept: 'application/json' } });
      if (!vRes.ok) continue;

      let vJson;
      try {
        vJson = await vRes.json();
      } catch {
        vJson = null;
      }

      const vItems = Array.isArray(vJson?.items) ? vJson.items : [];
      for (const it of vItems) {
        const id = String(it?.id || '').trim();
        if (!id) continue;
        const live = String(it?.snippet?.liveBroadcastContent || '').toLowerCase();
        const scheduledStartTime = it?.liveStreamingDetails?.scheduledStartTime
          ? String(it.liveStreamingDetails.scheduledStartTime)
          : '';
        const isUpcoming = live === 'upcoming' || isFutureIsoDate(scheduledStartTime);
        detailsById.set(id, { isUpcoming, scheduledStartTime });
      }
    }

    for (const meta of ordered) {
      const details = detailsById.get(meta.videoId);
      if (!details || !details.isUpcoming) continue;
      const scheduledStartTime = String(details.scheduledStartTime || '').trim();
      if (!isFutureIsoDate(scheduledStartTime)) continue;
      return { ...meta, scheduledStartTime };
    }

    return null;
  }

  function installPremiereCard(root, premiere, playlistId) {
    if (!root || !premiere || !premiere.videoId) return;
    if (root.querySelector('[data-testid="next-premiere"]')) return;

    const mainTimerEl = $('[data-testid="countdown-timer"]', root);
    if (!mainTimerEl) return;

    const href = buildYouTubeWatchUrl(premiere.videoId, playlistId) || buildYouTubeWatchUrl(premiere.videoId);
    if (!href) return;

    const a = document.createElement('a');
    a.className = 'next-premiere';
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener';
    a.setAttribute('data-testid', 'next-premiere');
    a.setAttribute('aria-label', 'Upcoming YouTube premiere');

    const inner = document.createElement('div');
    inner.className = 'next-premiere-inner';

    const imgWrap = document.createElement('div');
    imgWrap.className = 'next-premiere-thumb';

    const img = document.createElement('img');
    img.alt = premiere.title ? `Upcoming premiere: ${premiere.title}` : 'Upcoming premiere';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.src = premiere.thumbnailUrl || `https://i.ytimg.com/vi/${encodeURIComponent(premiere.videoId)}/hqdefault.jpg`;
    imgWrap.appendChild(img);

    const meta = document.createElement('div');
    meta.className = 'next-premiere-meta';

    const title = document.createElement('div');
    title.className = 'next-premiere-title';
    title.textContent = premiere.title || 'Upcoming Premiere';

    const label = document.createElement('div');
    label.className = 'next-premiere-countdown-label';
    label.textContent = 'Premieres in';

    const countdownWrap = document.createElement('div');
    countdownWrap.className = 'next-premiere-countdown';

    // Move the existing main countdown timer into the premiere card.
    countdownWrap.appendChild(label);
    countdownWrap.appendChild(mainTimerEl);

    meta.appendChild(title);
    meta.appendChild(countdownWrap);

    inner.appendChild(imgWrap);
    inner.appendChild(meta);
    a.appendChild(inner);

    // Insert card at the top (before the Patreon link).
    root.insertBefore(a, root.firstChild);

    try {
      root.classList.add('has-premiere');
    } catch {
      // ignore
    }
  }

  async function resolveTargetDate(resolvedPremiere) {
    if (resolvedPremiere && resolvedPremiere.scheduledStartTime) {
      const d = new Date(String(resolvedPremiere.scheduledStartTime));
      if (!Number.isNaN(d.getTime())) return d;
    }

    const premiereUrl = getPremiereUrl();
    const apiKey = getApiKey();

    if (premiereUrl && apiKey) {
      const videoId = parseYouTubeVideoId(premiereUrl);
      if (videoId) {
        const cached = readCachedScheduledStart(videoId, 15 * 60 * 1000);
        if (cached) {
          const d = new Date(cached);
          if (!Number.isNaN(d.getTime())) return d;
        }

        const scheduled = await fetchPremiereScheduledStart(videoId, apiKey);
        if (scheduled) {
          writeCachedScheduledStart(videoId, scheduled);
          const d = new Date(scheduled);
          if (!Number.isNaN(d.getTime())) return d;
        }
      }
    }

    return zonedTimeToUtc(FALLBACK);
  }

  function startCountdown(root, targetDate) {
    const mainTimerEl = $('[data-testid="countdown-timer"]', root);
    const patreonTimerEl = $('[data-testid="countdown-timer-patreon"]', root);

    const startOne = (timerEl, date) => {
      if (!timerEl || !date) return;

      function tick() {
        const now = Date.now();
        const diff = date.getTime() - now;

        if (diff <= 0) {
          timerEl.textContent = '00d 00h 00m 00s';
          return;
        }

        const { days, hours, minutes, seconds } = formatCountdown(diff);
        timerEl.textContent = `${pad2(days)}d ${pad2(hours)}h ${pad2(minutes)}m ${pad2(seconds)}s`;
        window.setTimeout(tick, 250);
      }

      tick();
    };

    startOne(mainTimerEl, targetDate);

    // Patreon Early Access is exactly one week earlier.
    const earlyAccessDate = new Date(targetDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    startOne(patreonTimerEl, earlyAccessDate);
  }

  async function boot() {
    const root = document.querySelector('[data-testid="next-release-countdown"]');
    if (!root) return;

    const apiKey = getApiKey();
    const playlistId = getPlaylistId();

    let playlistPremiere = null;
    if (!isAutomation() && apiKey && playlistId) {
      playlistPremiere = readCachedPlaylistPremiere(playlistId, PLAYLIST_PREMIERE_CACHE_MAX_AGE_MS);

      if (!playlistPremiere) {
        try {
          const live = await fetchNextPremiereFromPlaylist(playlistId, apiKey);
          if (live) {
            playlistPremiere = live;
            writeCachedPlaylistPremiere(playlistId, live);
          }
        } catch {
          // ignore
        }
      }

      if (playlistPremiere && playlistPremiere.videoId) {
        const url = buildYouTubeWatchUrl(playlistPremiere.videoId, playlistId);
        if (url) window.BOE_NEXT_PREMIERE_URL = url;
      }
    }

    if (playlistPremiere && playlistPremiere.videoId) {
      installPremiereCard(root, playlistPremiere, playlistId);
    }

    try {
      const target = await resolveTargetDate(playlistPremiere);
      startCountdown(root, target);
    } catch {
      // If anything goes wrong, fall back to the fixed date.
      startCountdown(root, zonedTimeToUtc(FALLBACK));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      boot().catch(() => {});
    });
  } else {
    boot().catch(() => {});
  }
})();
