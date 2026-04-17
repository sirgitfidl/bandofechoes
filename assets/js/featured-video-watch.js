(function () {
  const videoId = (window.BOE_FEATURED_VIDEO_ID || '').trim();
  if (!videoId) return;

  const url = `https://youtu.be/${encodeURIComponent(videoId)}`;

  const a = document.getElementById('watchLink');
  if (a) a.href = url;

  // Use replace() so "back" doesn’t land on the redirect page.
  window.location.replace(url);
})();
