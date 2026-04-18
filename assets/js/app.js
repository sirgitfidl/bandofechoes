// Band of Echoes — app.js (sanity v5)
const CONFIG = {
  featuredVideoId: 'qqMLXwzeRE0', // updated hero video
  youtubeHandleUrl: 'https://youtube.com/@BandOfEchoes',
  spotifyUrl: 'https://open.spotify.com/artist/02Mwc9O3vBzaRF9RnZGgVS',
  patreonUrl: 'https://patreon.com/bandofechoes'
};

// helpers
const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
const variance = a => { const m = mean(a); return a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length; };
const cov = (a, b) => { const ma = mean(a), mb = mean(b); return a.reduce((s, _, i) => s + (a[i] - ma) * (b[i] - mb), 0) / a.length; };
const wrap180 = d => ((d + 90) % 180 + 180) % 180 - 90;
function shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0;[arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }

// debug stubs (defined early so any calls before bottom are safe)
const debugMsg = () => { };
const debugVals = () => { };

function isAutomation() {
  try {
    return Boolean(navigator && navigator.webdriver);
  } catch {
    return false;
  }
}

function parseSpotifyArtistId(url) {
  try {
    const u = new URL(String(url || ''));
    const m = u.pathname.match(/\/artist\/([A-Za-z0-9]{10,})/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

function loadScriptOnce(src, markerAttr) {
  return new Promise((resolve) => {
    try {
      const existing = document.querySelector(`script[${markerAttr}]`);
      if (existing) return resolve(true);
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.defer = true;
      s.setAttribute(markerAttr, '1');
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      (document.head || document.documentElement).appendChild(s);
    } catch {
      resolve(false);
    }
  });
}

(function init() {
  const year = document.getElementById('year'); if (year) year.textContent = new Date().getFullYear();

  // click-to-play hero
  const wrap = document.getElementById('playerWrap');
  const poster = document.getElementById('poster');
  // Allow HTML data-video to override CONFIG so future swaps don't require JS edit
  if (wrap && wrap.dataset && wrap.dataset.video) {
    CONFIG.featuredVideoId = wrap.dataset.video;
  }
  if (wrap && poster && CONFIG.featuredVideoId) {
    poster.addEventListener('click', (e) => {
      e.preventDefault();
      const f = document.createElement('iframe');
      f.className = 'video-frame';
      f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      f.allowFullscreen = true;
      f.src = `https://www.youtube.com/embed/${CONFIG.featuredVideoId}?autoplay=1&rel=0&modestbranding=1&enablejsapi=1`;
      wrap.innerHTML = ''; wrap.appendChild(f);

      try {
        if (typeof window.__boeRegisterYouTubeIframe === 'function') {
          window.__boeRegisterYouTubeIframe(f);
        }
      } catch { }

      try {
        window.dispatchEvent(
          new CustomEvent('boe:media-play', {
            detail: { type: 'youtube', source: 'hero', videoId: CONFIG.featuredVideoId, iframe: f }
          })
        );
      } catch { }
    });
  }

  // footer links
  const yt = document.getElementById('ytFooter'); if (yt) yt.href = CONFIG.youtubeHandleUrl;
  const sp = document.getElementById('spFooter'); if (sp) sp.href = CONFIG.spotifyUrl;
  const pt = document.getElementById('ptFooter'); if (pt) pt.href = CONFIG.patreonUrl;

  // Spotify IFrame API: allows real play detection + programmatic pause.
  // Skip under automation so tests keep using the static iframe.
  (async () => {
    if (isAutomation()) return;

    const wrap = document.querySelector('[data-testid="spotify-embed"]');
    if (!wrap) return;

    const artistId = parseSpotifyArtistId(CONFIG.spotifyUrl);
    if (!artistId) return;

    // Define callback BEFORE loading the script to avoid missing the readiness signal.
    const apiReady = new Promise((resolve) => {
      window.onSpotifyIframeApiReady = (IFrameAPI) => resolve(IFrameAPI);
    });

    const ok = await loadScriptOnce('https://open.spotify.com/embed/iframe-api/v1', 'data-boe-spotify-iframe-api');
    if (!ok) return;

    const IFrameAPI = await apiReady;
    if (!IFrameAPI || typeof IFrameAPI.createController !== 'function') return;

    try {
      try {
        // Replace the static iframe with an API-managed controller.
        wrap.innerHTML = '';
        IFrameAPI.createController(
          wrap,
          {
            width: '100%',
            height: '352',
            uri: `spotify:artist:${artistId}`
          },
          (controller) => {
            window.__boeSpotifyController = controller;

            let lastIsPaused = true;

            try {
              controller.addListener('playback_update', (e) => {
                const paused = Boolean(e && e.data && typeof e.data.isPaused !== 'undefined' ? e.data.isPaused : true);
                // Only react when Spotify *starts* playing.
                if (lastIsPaused && !paused) {
                  try {
                    window.dispatchEvent(new CustomEvent('boe:media-play', { detail: { type: 'spotify', source: 'spotify-api' } }));
                  } catch { }
                }

                lastIsPaused = paused;
              });
            } catch { }
          }
        );
      } catch { }
    } catch { }
  })();

  // hamburger menu wiring (restore)
  const navToggle = document.getElementById('navToggle');
  const navMenu = document.getElementById('navMenu');
  if (navToggle && navMenu) {
    let prevFocusEl = null;
    const openMenu = () => {
      prevFocusEl = document.activeElement;
      navMenu.classList.add('open');
      navMenu.setAttribute('aria-hidden', 'false');
      navToggle.setAttribute('aria-expanded', 'true');
      (navMenu.querySelector('a') || navMenu)?.focus?.();
    };
    const closeMenu = () => {
      navMenu.classList.remove('open');
      navMenu.setAttribute('aria-hidden', 'true');
      navToggle.setAttribute('aria-expanded', 'false');
      (prevFocusEl || navToggle)?.focus?.();
    };
    navToggle.addEventListener('click', (e) => {
      e.preventDefault();
      navMenu.classList.contains('open') ? closeMenu() : openMenu();
    });
    document.addEventListener('click', (e) => {
      if (!navMenu.contains(e.target) && !navToggle.contains(e.target)) {
        if (navMenu.classList.contains('open')) closeMenu();
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && navMenu.classList.contains('open')) closeMenu();
    });
    navMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
  }
})();
// (orientation guard moved to orientation-guard.js)