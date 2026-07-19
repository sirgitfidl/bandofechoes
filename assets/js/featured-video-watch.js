(function () {
  const fallbackUrl = 'https://youtube.com/@BandOfEchoes';
  const a = document.getElementById('watchLink');
  if (a) a.href = fallbackUrl;

  const go = (videoId) => {
    const id = String(videoId || '').trim();
    if (!id) return false;
    if (!/^[A-Za-z0-9_-]{6,}$/.test(id)) return false;
    const url = `https://youtu.be/${encodeURIComponent(id)}`;
    if (a) a.href = url;
    // Use replace() so "back" doesn’t land on the redirect page.
    window.location.replace(url);
    return true;
  };

  if (go(window.FEATURED_VIDEO_ID)) return;

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

  window.addEventListener('site:featured-video', onFeatured);

  // If we can't resolve quickly, keep the fallback link and stop listening.
  window.setTimeout(() => {
    done = true;
    window.removeEventListener('site:featured-video', onFeatured);
  }, 6000);
})();
