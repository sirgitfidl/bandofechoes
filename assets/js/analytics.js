(function () {
  function getMeasurementId() {
    try {
      const id = (window.GA_MEASUREMENT_ID || '').trim();
      return id ? id : null;
    } catch {
      return null;
    }
  }

  function ensureGtagScript(id) {
    try {
      if (document.getElementById('analytics-gtag')) return;
      const s = document.createElement('script');
      s.id = 'analytics-gtag';
      s.async = true;
      s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
      document.head.appendChild(s);
    } catch {
      // ignore
    }
  }

  function ensureGtagInit(id) {
    try {
      if (window.__analyticsInitialized) return;
      window.__analyticsInitialized = true;

      window.dataLayer = window.dataLayer || [];
      // eslint-disable-next-line no-inner-declarations
      function gtag() {
        // eslint-disable-next-line prefer-rest-params
        window.dataLayer.push(arguments);
      }

      // Preserve any existing gtag if present.
      if (typeof window.gtag !== 'function') window.gtag = gtag;

      window.gtag('js', new Date());
      window.gtag('config', id, {
        transport_type: 'beacon',
        page_path: String(window.location && window.location.pathname ? window.location.pathname : '/')
      });
    } catch {
      // ignore
    }
  }

  function track(eventName, params) {
    try {
      if (typeof window.gtag !== 'function') return;
      window.gtag('event', String(eventName || 'event'), params || {});
    } catch {
      // ignore
    }
  }

  function wireOutboundLinkTracking(root) {
    const links = Array.from((root || document).querySelectorAll('a[href]'));
    for (const a of links) {
      const href = String(a.getAttribute('href') || '');
      if (!href) continue;

      // Track only the key outbound links we care about for "on-site behavior".
      const testid = String(a.getAttribute('data-testid') || '');
      const id = String(a.id || '');
      const isPatreon = href.includes('patreon.com') || testid.includes('patreon') || id.toLowerCase().includes('patreon');
      if (!isPatreon) continue;

      a.addEventListener(
        'click',
        () => {
          track('outbound_click', {
            link_url: href,
            link_text: String(a.textContent || '').trim(),
            link_id: id,
            link_testid: testid
          });
        },
        { passive: true }
      );
    }
  }

  function wireMediaTracking() {
    // Fired from hero and playlist tiles.
    window.addEventListener('site:media-play', (ev) => {
      try {
        const d = ev && ev.detail ? ev.detail : {};
        if (!d || d.type !== 'youtube') return;
        track('video_play', {
          video_provider: 'youtube',
          video_id: String(d.videoId || '').trim(),
          video_source: String(d.source || '').trim()
        });
      } catch {
        // ignore
      }
    });
  }

  function boot() {
    const id = getMeasurementId();
    if (!id) return;

    ensureGtagScript(id);
    ensureGtagInit(id);

    wireOutboundLinkTracking(document);
    wireMediaTracking();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
