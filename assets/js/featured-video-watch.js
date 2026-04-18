(function () {
  const fallbackUrl = 'https://youtube.com/@BandOfEchoes';
  const a = document.getElementById('watchLink');
  if (a) a.href = fallbackUrl;

  const go = (videoId) => {
    const id = String(videoId || '').trim();
    if (!id) return false;
    const url = `https://youtu.be/${encodeURIComponent(id)}`;
    if (a) a.href = url;
    // Use replace() so "back" doesn’t land on the redirect page.
    window.location.replace(url);
    return true;
  };

  if (go(window.BOE_FEATURED_VIDEO_ID)) return;

  let done = false;
  const onFeatured = (ev) => {
    if (done) return;
    try {
      const id = ev && ev.detail ? ev.detail.videoId : '';
      if (go(id)) done = true;
    } catch {
      // ignore
    }
  };

  window.addEventListener('boe:featured-video', onFeatured);

  // If we can't resolve quickly, keep the fallback link and stop listening.
  window.setTimeout(() => {
    done = true;
    window.removeEventListener('boe:featured-video', onFeatured);
  }, 6000);
})();
