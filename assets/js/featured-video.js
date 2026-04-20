(function () {
  function applyFeaturedVideo(videoId) {
    const id = String(videoId || '').trim();
    if (!id) return;
    // YouTube IDs are URL-safe; ensure we never inject unexpected characters into URLs/JSON-LD.
    if (!/^[A-Za-z0-9_-]{6,}$/.test(id)) return;

    const posterLink = document.getElementById('poster');
    const playerWrap = document.getElementById('playerWrap');

    if (playerWrap) {
      playerWrap.setAttribute('data-video', id);
    }

    if (posterLink) {
      posterLink.href = `https://youtu.be/${encodeURIComponent(id)}`;
      const img = posterLink.querySelector('img');
      if (img) {
        img.src = `https://i.ytimg.com/vi/${encodeURIComponent(id)}/maxresdefault.jpg`;
      }
    }

    // Update VideoObject JSON-LD (token-based) if present
    const schema = document.getElementById('schema-featured-video');
    if (schema && typeof schema.textContent === 'string') {
      schema.textContent = schema.textContent
        .replaceAll('__BOE_FEATURED_VIDEO_ID__', id)
        // Keep the JSON valid even if it contained an older video ID.
        .replace(/(https:\/\/www\.youtube\.com\/watch\?v=)([A-Za-z0-9_-]{6,})/g, `$1${id}`)
        .replace(/(https:\/\/www\.youtube\.com\/embed\/)([A-Za-z0-9_-]{6,})/g, `$1${id}`)
        .replace(/(https:\/\/youtu\.be\/)([A-Za-z0-9_-]{6,})/g, `$1${id}`)
        .replace(/(https:\/\/i\.ytimg\.com\/vi\/)([A-Za-z0-9_-]{6,})(\/[^\"]+)/g, `$1${id}$3`);
    }
  }

  window.__boeApplyFeaturedVideo = applyFeaturedVideo;

  // Apply current value (manual fallback or prior resolver).
  applyFeaturedVideo((window.BOE_FEATURED_VIDEO_ID || '').trim());

  // Support dynamic updates (e.g. resolving featured from playlist via API).
  window.addEventListener('boe:featured-video', (ev) => {
    try {
      const id = ev && ev.detail ? ev.detail.videoId : '';
      if (id) applyFeaturedVideo(id);
    } catch {
      // ignore
    }
  });
})();
