// Band of Echoes — app.js (sanity v5)
const CONFIG = {
  featuredVideoId: 'dRs_bLfrtu8',
  youtubeHandleUrl: 'https://youtube.com/@BandOfEchoes',
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

(function init() {
  const year = document.getElementById('year'); if (year) year.textContent = new Date().getFullYear();

  // click-to-play hero
  const wrap = document.getElementById('playerWrap');
  const poster = document.getElementById('poster');
  if (wrap && poster && CONFIG.featuredVideoId) {
    poster.addEventListener('click', (e) => {
      e.preventDefault();
      const f = document.createElement('iframe');
      f.className = 'video-frame';
      f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      f.allowFullscreen = true;
      f.src = `https://www.youtube.com/embed/${CONFIG.featuredVideoId}?autoplay=1&rel=0&modestbranding=1&enablejsapi=1`;
      wrap.innerHTML = ''; wrap.appendChild(f);
    });
  }

  // footer links
  const yt = document.getElementById('ytFooter'); if (yt) yt.href = CONFIG.youtubeHandleUrl;
  const pt = document.getElementById('ptFooter'); if (pt) pt.href = CONFIG.patreonUrl;

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