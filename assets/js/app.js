// Band of Echoes — app.js (sanity v5)
const CONFIG = {
  featuredVideoId: 'qqMLXwzeRE0' // updated hero video
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

(function init() {
  const year = document.getElementById('year'); if (year) year.textContent = new Date().getFullYear();

  // Landing intro: full-screen looping video overlay, dissolved on click/keypress
  const landingOverlay = document.getElementById('landingOverlay');
  if (landingOverlay) {
    if (isAutomation()) {
      landingOverlay.remove();
    } else {
      document.body.classList.add('landing-active');
      const landingVideo = landingOverlay.querySelector('video');
      const dismissLanding = () => {
        if (landingOverlay.classList.contains('is-dismissed')) return;
        landingOverlay.classList.add('is-dismissed');
        document.body.classList.remove('landing-active');
        if (landingVideo) landingVideo.pause();
        window.setTimeout(() => landingOverlay.remove(), 700);
      };
      landingOverlay.addEventListener('click', dismissLanding);
      landingOverlay.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); dismissLanding(); }
      });
    }
  }

  // About: collapsible bio on narrow viewports, with a "Read more" toggle
  const aboutCopy = document.getElementById('aboutCopy');
  const aboutToggle = document.querySelector('[data-testid="about-toggle"]');
  if (aboutCopy && aboutToggle) {
    const aboutMq = window.matchMedia('(max-width: 600px)');
    const ABOUT_COLLAPSED_HEIGHT = 155;
    const setupAboutToggle = () => {
      // scrollHeight reflects the full content height even while clipped, so this stays accurate on repeated calls
      const needsToggle = aboutMq.matches && aboutCopy.scrollHeight > ABOUT_COLLAPSED_HEIGHT + 20;
      aboutCopy.classList.toggle('is-collapsible', needsToggle);
      aboutToggle.hidden = !needsToggle;
      if (!needsToggle) {
        aboutCopy.classList.remove('is-expanded');
        aboutToggle.setAttribute('aria-expanded', 'false');
        aboutToggle.textContent = 'Read more';
      }
    };
    aboutToggle.addEventListener('click', () => {
      const expanded = aboutCopy.classList.toggle('is-expanded');
      aboutToggle.setAttribute('aria-expanded', String(expanded));
      aboutToggle.textContent = expanded ? 'Read less' : 'Read more';
    });
    setupAboutToggle();
    window.addEventListener('resize', setupAboutToggle);
  }

  // Hero: Latest release text (populated from playlist carousel data)
  const heroLatest = document.querySelector('[data-testid="hero-latest"]');
  const heroLatestLink = document.getElementById('heroLatestLink');
  const setHeroLatest = (title, videoId) => {
    if (!heroLatest || !heroLatestLink) return;
    const t = String(title || '').trim();
    const id = String(videoId || '').trim();
    if (!t || !id) return;

    heroLatestLink.textContent = t;
    heroLatestLink.href = `https://youtu.be/${encodeURIComponent(id)}`;
    heroLatest.hidden = false;
  };
  try {
    setHeroLatest(window.FEATURED_VIDEO_TITLE, window.FEATURED_VIDEO_ID);
  } catch { }
  window.addEventListener('site:featured-video', (e) => {
    try {
      setHeroLatest(
        e && e.detail ? e.detail.title : '',
        e && e.detail ? e.detail.videoId : ''
      );
    } catch { }
  });

  // click-to-play hero
  const wrap = document.getElementById('playerWrap');
  const poster = document.getElementById('poster');
  if (wrap && poster) {
    poster.addEventListener('click', (e) => {
      e.preventDefault();
      const featuredId = String(
        (wrap && wrap.dataset && wrap.dataset.video) ||
          window.FEATURED_VIDEO_ID ||
          CONFIG.featuredVideoId ||
          ''
      ).trim();
      if (!featuredId) return;
      const f = document.createElement('iframe');
      f.className = 'video-frame';
      f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      f.allowFullscreen = true;
      f.src = `https://www.youtube.com/embed/${featuredId}?autoplay=1&rel=0&modestbranding=1&enablejsapi=1`;
      wrap.innerHTML = ''; wrap.appendChild(f);

      try {
        if (typeof window.__registerYouTubeIframe === 'function') {
          window.__registerYouTubeIframe(f);
        }
      } catch { }

      try {
        window.dispatchEvent(
          new CustomEvent('site:media-play', {
            detail: { type: 'youtube', source: 'hero', videoId: featuredId, iframe: f }
          })
        );
      } catch { }
    });
  }

  // links section pulse
  const linksGroups = document.querySelector('.links-groups');
  const pulseLinksSection = () => {
    if (!linksGroups) return;
    linksGroups.classList.remove('links-groups--pulse');
    // Force reflow so repeated clicks retrigger animation.
    void linksGroups.offsetWidth;
    linksGroups.classList.add('links-groups--pulse');
    window.setTimeout(() => {
      try { linksGroups.classList.remove('links-groups--pulse'); } catch { }
    }, 2200);
  };

  // Patreon CTA glow (twice) when Support is opened from the nav menu
  const patreonCta = document.querySelector('[data-testid="cta-patreon"]');
  const pulsePatreonCta = () => {
    if (!patreonCta) return;
    patreonCta.classList.remove('patreon-cta--pulse');
    // Force reflow so repeated clicks retrigger animation.
    void patreonCta.offsetWidth;
    patreonCta.classList.add('patreon-cta--pulse');
    window.setTimeout(() => {
      try { patreonCta.classList.remove('patreon-cta--pulse'); } catch { }
    }, 2000);
  };

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
      (navMenu.querySelector('a:not([hidden])') || navMenu)?.focus?.();
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
    const linksMenuItem = navMenu.querySelector('[data-testid="menu-links"]');
    if (linksMenuItem) {
      linksMenuItem.addEventListener('click', () => {
        // Trigger only from explicit Links menu navigation, not scroll.
        pulseLinksSection();
      });
    }
    const supportMenuItem = navMenu.querySelector('[data-testid="menu-support"]');
    if (supportMenuItem) {
      supportMenuItem.addEventListener('click', () => {
        // Trigger only from explicit Support menu navigation, not scroll.
        pulsePatreonCta();
      });
    }
    navMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
  }

})();
// (orientation guard moved to orientation-guard.js)