// YouTube Community Posts feed (build-time scraped data; no live client fetch
// because YouTube's community posts have no public API and their pages don't
// allow cross-origin fetches from the browser). Renders as a horizontally
// scrolling collage: each column fills the full row height, either with one
// large post or a stack of two smaller posts. All scraped posts (capped at
// 50 by the generator script) are mounted up front, since mounting them
// progressively as the user scrolled caused odd carousel/arrow behavior.
(function () {

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function setArrowHidden(el, hidden) {
    if (!el) return;
    const isHidden = Boolean(hidden);
    el.classList.toggle('is-disabled', isHidden);
    el.disabled = isHidden;
    el.setAttribute('aria-disabled', isHidden ? 'true' : 'false');
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function isScrollable(el) {
    if (!el) return false;
    return el.scrollWidth > el.clientWidth + 2;
  }

  function atStart(el) {
    return !el || el.scrollLeft <= 2;
  }

  function atEnd(el) {
    if (!el) return true;
    return el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;
  }

  function buildImage(url, alt) {
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.alt = String(alt || '');
    img.src = url;
    return img;
  }

  function buildPostContentNodes(post, { includeLink } = {}) {
    const nodes = [];

    const header = document.createElement('div');
    header.className = 'yt-post-header';

    if (post.publishedDateText) {
      const time = document.createElement('span');
      time.className = 'yt-post-time';
      time.textContent = post.publishedDateText;
      header.appendChild(time);
    }

    nodes.push(header);

    if (post.text) {
      const body = document.createElement('p');
      body.className = 'yt-post-text';
      body.textContent = String(post.text).trim();
      nodes.push(body);
    }

    const images = Array.isArray(post.images) ? post.images.filter(Boolean) : [];
    if (images.length) {
      const media = document.createElement('div');
      media.className = 'yt-post-media';
      media.classList.toggle('yt-post-media--multi', images.length > 1);

      for (const url of images) {
        media.appendChild(buildImage(url, 'Community post image'));
      }

      nodes.push(media);
    } else if (post.sharedVideo && post.sharedVideo.videoId) {
      const media = document.createElement('a');
      media.className = 'yt-post-media yt-post-media--video';
      media.href = `https://www.youtube.com/watch?v=${encodeURIComponent(post.sharedVideo.videoId)}`;
      media.target = '_blank';
      media.rel = 'noopener';
      media.appendChild(buildImage(post.sharedVideo.thumbnailUrl, post.sharedVideo.title || 'Shared video'));
      nodes.push(media);
    }

    if (includeLink) {
      const footer = document.createElement('a');
      footer.className = 'yt-post-link';
      footer.href = post.url;
      footer.target = '_blank';
      footer.rel = 'noopener';
      footer.textContent = 'View on YouTube';
      nodes.push(footer);
    }

    return nodes;
  }

  // YouTube square-crops community post images server-side, so there's no
  // real photo aspect ratio to size columns from. A large (full-height)
  // column is sized by content type (multi-image/video posts read a bit
  // wider than a lone square image) and by how much text there is; a
  // stacked column (two smaller posts sharing the height) just uses a
  // fixed compact width since two different posts share it.
  function computeColumnWidth(post, isLarge) {
    if (!isLarge) return 230;

    const imageCount = Array.isArray(post.images) ? post.images.filter(Boolean).length : 0;
    const hasVideo = imageCount === 0 && post.sharedVideo && post.sharedVideo.videoId;
    const textLen = String(post.text || '').trim().length;

    let base;
    if (imageCount > 1) base = 340;
    else if (hasVideo) base = 360;
    else if (imageCount === 1) base = 240;
    else base = 220;

    if (textLen > 220) base += 80;
    else if (textLen > 100) base += 40;

    return clamp(Math.round(base * 1.2), 280, 440);
  }

  // The newest post and the two most-liked posts get a full-height "large"
  // tile; everything else is sized down so the feed reads as a collage
  // rather than a uniform row.
  function computeLargePostIds(posts) {
    const newestId = posts[0] && posts[0].postId;

    const topLiked = posts
      .filter((p) => Number(p.likeCount) > 0)
      .slice()
      .sort((a, b) => Number(b.likeCount) - Number(a.likeCount))
      .slice(0, 2)
      .map((p) => p.postId);

    return new Set([newestId, ...topLiked].filter(Boolean));
  }

  function buildPostCell(post, isLarge) {
    const card = document.createElement('article');
    card.className = `yt-post-card ${isLarge ? 'yt-post-card--large' : 'yt-post-card--small'}`;
    card.setAttribute('data-testid', 'yt-post-card');
    card.tabIndex = 0;

    for (const node of buildPostContentNodes(post, { includeLink: false })) card.appendChild(node);

    return card;
  }

  function buildColumn(width) {
    const column = document.createElement('div');
    column.className = 'yt-posts-column';
    column.setAttribute('data-testid', 'yt-posts-column');
    column.style.width = `${width}px`;
    return column;
  }

  function renderFallback(track, channelUrl) {
    const fallback = document.createElement('a');
    fallback.className = 'btn';
    fallback.href = channelUrl;
    fallback.target = '_blank';
    fallback.rel = 'noopener';
    fallback.textContent = 'View posts on YouTube';
    track.appendChild(fallback);
  }

  function buildSeeMoreTile(communityUrl) {
    const card = document.createElement('article');
    card.className = 'yt-post-card yt-post-card--large yt-post-card--more';
    card.setAttribute('data-testid', 'yt-post-see-more');

    const link = document.createElement('a');
    link.className = 'yt-post-see-more-link';
    link.href = communityUrl;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = 'See more on YouTube';

    card.appendChild(link);

    const column = buildColumn(280);
    column.appendChild(card);
    return column;
  }

  function init(root) {
    const viewport = $('[data-testid="yt-posts-viewport"]', root);
    const track = $('[data-testid="yt-posts-track"]', root);
    const leftBtn = $('[data-testid="yt-posts-left"]', root);
    const rightBtn = $('[data-testid="yt-posts-right"]', root);

    if (!viewport || !track || !leftBtn || !rightBtn) return;

    const channelUrl = root.getAttribute('data-channel-url') || 'https://youtube.com/@BandOfEchoes';
    const communityUrl = `${channelUrl.replace(/\/$/, '')}/community`;
    const posts = Array.isArray(window.YT_POSTS) ? window.YT_POSTS.filter((p) => p && p.postId) : [];

    track.innerHTML = '';

    if (!posts.length) {
      renderFallback(track, channelUrl);
      setArrowHidden(leftBtn, true);
      setArrowHidden(rightBtn, true);
      return;
    }

    const largePostIds = computeLargePostIds(posts);

    // Full-screen single-post view: clicking a tile opens it here, and its
    // own prev/next buttons step through every mounted post.
    const lightbox = document.getElementById('postLightbox');
    const lightboxBody = lightbox ? $('[data-testid="post-lightbox-body"]', lightbox) : null;
    const lightboxClose = lightbox ? $('[data-testid="post-lightbox-close"]', lightbox) : null;
    const lightboxPrev = lightbox ? $('[data-testid="post-lightbox-prev"]', lightbox) : null;
    const lightboxNext = lightbox ? $('[data-testid="post-lightbox-next"]', lightbox) : null;
    let openIndex = -1;
    let lastFocus = null;

    const updateLightboxNav = () => {
      if (!lightboxPrev || !lightboxNext) return;
      // Prev/next wrap around at the ends; only disable them when there's
      // nowhere else to go (a single post).
      const onlyOnePost = posts.length <= 1;
      setArrowHidden(lightboxPrev, onlyOnePost);
      setArrowHidden(lightboxNext, onlyOnePost);
    };

    const renderLightbox = (index) => {
      const post = posts[index];
      if (!lightboxBody || !post) return;
      lightboxBody.innerHTML = '';
      for (const node of buildPostContentNodes(post, { includeLink: true })) lightboxBody.appendChild(node);
      updateLightboxNav();
    };

    const closeLightbox = () => {
      if (!lightbox) return;
      lightbox.classList.remove('open');
      if (lightboxBody) lightboxBody.innerHTML = '';
      document.body.style.overflow = '';
      openIndex = -1;
      (lastFocus || document.body)?.focus?.();
    };

    const openLightboxAt = (index) => {
      if (!lightbox || !lightboxBody) return;
      if (index < 0 || index >= posts.length) return;

      openIndex = index;
      renderLightbox(openIndex);
      lightbox.classList.add('open');
      lastFocus = document.activeElement;
      document.body.style.overflow = 'hidden';
      (lightboxClose || lightboxBody).focus?.();
    };

    const stepLightbox = (delta) => {
      if (openIndex < 0 || !posts.length) return;
      const next = (openIndex + delta + posts.length) % posts.length;
      openIndex = next;
      renderLightbox(openIndex);
    };

    lightboxClose && lightboxClose.addEventListener('click', closeLightbox);
    lightboxPrev && lightboxPrev.addEventListener('click', () => stepLightbox(-1));
    lightboxNext && lightboxNext.addEventListener('click', () => stepLightbox(1));
    lightbox && lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) closeLightbox();
    });
    document.addEventListener('keydown', (e) => {
      if (!lightbox || !lightbox.classList.contains('open')) return;
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowLeft') stepLightbox(-1);
      else if (e.key === 'ArrowRight') stepLightbox(1);
    });

    const wireCell = (cell, index) => {
      cell.addEventListener('click', (e) => {
        if (e.target.closest('a')) return;
        openLightboxAt(index);
      });
      cell.addEventListener('keydown', (e) => {
        if (e.target.closest('a')) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openLightboxAt(index);
        }
      });
    };

    // A post only gets the narrow "small" stacked treatment when it actually
    // has another small post to share the column with; otherwise a tall,
    // skinny tile looks broken, so it renders full-width like a large post.
    const mountAlone = (post, index) => {
      const cell = buildPostCell(post, true);
      wireCell(cell, index);
      const column = buildColumn(computeColumnWidth(post, true));
      column.appendChild(cell);
      track.appendChild(column);
    };

    const mountStackedPair = (postA, indexA, postB, indexB) => {
      const column = buildColumn(computeColumnWidth(postA, false));

      const cellA = buildPostCell(postA, false);
      wireCell(cellA, indexA);
      column.appendChild(cellA);

      const cellB = buildPostCell(postB, false);
      wireCell(cellB, indexB);
      column.appendChild(cellB);

      track.appendChild(column);
    };

    const mountAllPosts = () => {
      for (let i = 0; i < posts.length; i++) {
        const post = posts[i];

        if (largePostIds.has(post.postId)) {
          mountAlone(post, i);
          continue;
        }

        const next = posts[i + 1];
        const nextIsLarge = next && largePostIds.has(next.postId);

        if (next && !nextIsLarge) {
          mountStackedPair(post, i, next, i + 1);
          i++;
          continue;
        }

        mountAlone(post, i);
      }

      track.appendChild(buildSeeMoreTile(communityUrl));
    };

    const updateArrows = () => {
      const scrollable = isScrollable(viewport);
      if (!scrollable) {
        setArrowHidden(leftBtn, true);
        setArrowHidden(rightBtn, true);
        return;
      }

      setArrowHidden(leftBtn, atStart(viewport));
      setArrowHidden(rightBtn, atEnd(viewport));
    };

    mountAllPosts();
    viewport.scrollLeft = 0;
    updateArrows();

    const scrollStep = () => clamp(Math.floor(viewport.clientWidth * 0.9), 240, 900);

    leftBtn.addEventListener('click', () => {
      viewport.scrollBy({ left: -scrollStep(), behavior: 'smooth' });
    });

    rightBtn.addEventListener('click', () => {
      viewport.scrollBy({ left: scrollStep(), behavior: 'smooth' });
    });

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        updateArrows();
      });
    };

    viewport.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
  }

  function boot() {
    const root = document.querySelector('[data-testid="yt-posts-feed"]');
    if (!root) return;
    init(root);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

