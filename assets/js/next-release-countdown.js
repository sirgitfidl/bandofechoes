(function () {
  const FALLBACK = {
    year: 2026,
    month: 6,
    day: 18,
    hour: 10,
    minute: 0,
    timeZone: 'America/Los_Angeles'
  };

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

  function getPremiereUrl() {
    try {
      const u = (window.BOE_NEXT_PREMIERE_URL || '').trim();
      return u ? u : null;
    } catch {
      return null;
    }
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

  async function resolveTargetDate() {
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

    try {
      const target = await resolveTargetDate();
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
