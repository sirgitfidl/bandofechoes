(function () {
  const videoId = (window.BOE_FEATURED_VIDEO_ID || '').trim();
  if (!videoId) return;

  const posterLink = document.getElementById('poster');
  const playerWrap = document.getElementById('playerWrap');

  if (playerWrap) {
    playerWrap.setAttribute('data-video', videoId);
  }

  if (posterLink) {
    posterLink.href = `https://youtu.be/${encodeURIComponent(videoId)}`;
    const img = posterLink.querySelector('img');
    if (img) {
      img.src = `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/maxresdefault.jpg`;
    }
  }

  // Update VideoObject JSON-LD (token-based) if present
  const schema = document.getElementById('schema-featured-video');
  if (schema && typeof schema.textContent === 'string') {
    schema.textContent = schema.textContent
      .replaceAll('__BOE_FEATURED_VIDEO_ID__', videoId)
      // Keep the JSON valid even if it contained an older video ID.
      .replace(/(https:\/\/www\.youtube\.com\/watch\?v=)([A-Za-z0-9_-]{6,})/g, `$1${videoId}`)
      .replace(/(https:\/\/www\.youtube\.com\/embed\/)([A-Za-z0-9_-]{6,})/g, `$1${videoId}`)
      .replace(/(https:\/\/youtu\.be\/)([A-Za-z0-9_-]{6,})/g, `$1${videoId}`)
      .replace(/(https:\/\/i\.ytimg\.com\/vi\/)([A-Za-z0-9_-]{6,})(\/[^\"]+)/g, `$1${videoId}$3`);
  }
})();
