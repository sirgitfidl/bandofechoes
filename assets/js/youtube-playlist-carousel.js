// YouTube Playlist Carousel (click-to-load; avoids loading YT until user intent)
(function () {
  /** @type {Promise<void> | null} */
  let ytApiPromise = null;

  function loadYouTubeIframeApi() {
    if (window.YT && window.YT.Player) return Promise.resolve();
    if (ytApiPromise) return ytApiPromise;

    ytApiPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-yt-iframe-api]');
      if (existing) {
        // If another script already injected it, just wait for readiness callback.
        const prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = function () {
          try { prev && prev(); } catch (_) { }
          resolve();
        };
        return;
      }

      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () {
        try { prev && prev(); } catch (_) { }
        resolve();
      };

      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.async = true;
      s.defer = true;
      s.dataset.ytIframeApi = '1';
      s.onerror = () => reject(new Error('Failed to load YouTube IFrame API'));
      document.head.appendChild(s);
    });

    return ytApiPromise;
  }

  function setEnabled(btn, enabled) {
    if (!btn) return;
    btn.disabled = !enabled;
    btn.setAttribute('aria-disabled', enabled ? 'false' : 'true');
  }

  function initCarousel(root) {
    const playlistId = root.getAttribute('data-playlist-id');
    const playlistUrl = root.getAttribute('data-playlist-url');

    const stage = document.getElementById('ytPlaylistStage');
    const poster = document.getElementById('ytPlaylistPoster');
    const playerMount = document.getElementById('ytPlaylistPlayer');
    const prevBtn = document.getElementById('ytPlaylistPrev');
    const nextBtn = document.getElementById('ytPlaylistNext');
    const openLink = document.getElementById('ytPlaylistOpen');

    if (!playlistId || !stage || !poster || !playerMount) return;

    if (playlistUrl && openLink) openLink.href = playlistUrl;

    /** @type {any} */
    let player = null;
    let isLoading = false;

    function ensurePlayer() {
      if (player) return Promise.resolve(player);
      if (isLoading) return Promise.resolve(null);
      isLoading = true;

      // Swap poster -> player mount
      poster.setAttribute('hidden', '');
      playerMount.hidden = false;

      setEnabled(prevBtn, false);
      setEnabled(nextBtn, false);

      return loadYouTubeIframeApi()
        .then(() => {
          if (!window.YT || !window.YT.Player) throw new Error('YouTube API unavailable');

          player = new window.YT.Player(playerMount, {
            videoId: '',
            playerVars: {
              listType: 'playlist',
              list: playlistId,
              rel: 0,
              modestbranding: 1,
              playsinline: 1
            },
            events: {
              onReady: () => {
                setEnabled(prevBtn, true);
                setEnabled(nextBtn, true);
                isLoading = false;
              },
              onError: () => {
                isLoading = false;
              }
            }
          });

          return player;
        })
        .catch(() => {
          isLoading = false;
          // Fallback: restore poster and keep the open link.
          playerMount.hidden = true;
          poster.removeAttribute('hidden');
          setEnabled(prevBtn, false);
          setEnabled(nextBtn, false);
          return null;
        });
    }

    poster.addEventListener('click', (e) => {
      // Treat poster click as intent to load (not navigate away)
      e.preventDefault();
      ensurePlayer();
    });

    prevBtn && prevBtn.addEventListener('click', () => {
      if (!player || !player.previousVideo) return;
      player.previousVideo();
    });

    nextBtn && nextBtn.addEventListener('click', () => {
      if (!player || !player.nextVideo) return;
      player.nextVideo();
    });

    // Keyboard convenience when focused inside the stage
    stage.addEventListener('keydown', (e) => {
      if (!player) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        player.previousVideo && player.previousVideo();
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        player.nextVideo && player.nextVideo();
      }
    });
  }

  function boot() {
    const root = document.querySelector('[data-testid="yt-playlist"]');
    if (!root) return;
    initCarousel(root);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
