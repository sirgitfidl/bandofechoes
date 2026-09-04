// Scrapes the YouTube channel's Community tab and writes a static JS data file
// with the latest posts. There is no public YouTube Data API for community
// posts, so this mirrors generate-youtube-playlist-data.mjs's approach of
// reading ytInitialData out of the rendered page.
import https from 'node:https';
import fs from 'node:fs/promises';

const MAX_POSTS = 50;
const MAX_CONTINUATION_PAGES = 6;
const DATE_FETCH_CONCURRENCY = 5;

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            'user-agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36'
          }
        },
        (res) => {
          let html = '';
          res.on('data', (c) => (html += c));
          res.on('end', () => resolve({ status: res.statusCode ?? 0, html }));
        }
      )
      .on('error', reject);
  });
}

function extractYtInitialData(html) {
  const re = new RegExp('var ytInitialData\\s*=\\s*(\\{.*?\\});\\s*</script>', 's');
  const m = html.match(re);
  if (!m) return null;
  return JSON.parse(m[1]);
}

function extractYtConfig(html) {
  const apiKey = html.match(/"INNERTUBE_API_KEY"\s*:\s*"([^"]+)"/)?.[1] ?? null;
  const clientName = html.match(/"INNERTUBE_CLIENT_NAME"\s*:\s*"([^"]+)"/)?.[1] ?? null;
  const clientVersion = html.match(/"INNERTUBE_CLIENT_VERSION"\s*:\s*"([^"]+)"/)?.[1] ?? null;

  const ctxMatch = html.match(/"INNERTUBE_CONTEXT"\s*:\s*(\{.*?\})\s*,\s*"INNERTUBE_CONTEXT_CLIENT_NAME"/s);
  const context = ctxMatch ? JSON.parse(ctxMatch[1]) : null;

  return { apiKey, clientName, clientVersion, context };
}

function findContinuationToken(root) {
  let found = null;

  function walk(node) {
    if (found || !node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const v of node) walk(v);
      return;
    }

    const token =
      node?.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token ??
      node?.continuationEndpoint?.continuationCommand?.token ??
      null;

    if (typeof token === 'string' && token.length > 10) {
      found = token;
      return;
    }

    for (const k of Object.keys(node)) walk(node[k]);
  }

  walk(root);
  return found;
}

function postJson(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = https.request(
      url,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(payload),
          ...headers
        }
      },
      (res) => {
        let text = '';
        res.on('data', (c) => (text += c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, text }));
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// The community feed's relative "2 days ago" text isn't precise enough for an
// exact date, and its JSON order isn't reliably reverse-chronological either.
// Each post's detail page embeds a schema.org DiscussionForumPosting block
// with an exact "datePublished" timestamp, so we fetch that per post.
async function fetchExactPublishedDate(postId) {
  try {
    const { status, html } = await fetchText(`https://www.youtube.com/post/${encodeURIComponent(postId)}`);
    if (status !== 200) return null;

    const re = /<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs;
    let m;
    while ((m = re.exec(html))) {
      if (!m[1].includes('DiscussionForumPosting')) continue;
      try {
        const parsed = JSON.parse(m[1]);
        if (parsed?.datePublished) return parsed.datePublished;
      } catch {
        // Try the next ld+json block.
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Fallback when a post's detail page can't be fetched: approximate a
// timestamp from its relative "publishedTimeText" (e.g. "2 days ago").
function approxIsoFromRelative(publishedTimeText) {
  const text = String(publishedTimeText || '').toLowerCase();
  const m = text.match(/(\d+)\s*(second|minute|hour|day|week|month|year)/);
  if (!m) return null;

  const amount = Number(m[1]);
  const unitMs = {
    second: 1000,
    minute: 60 * 1000,
    hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    year: 365 * 24 * 60 * 60 * 1000
  }[m[2]];

  return new Date(Date.now() - amount * unitMs).toISOString();
}

function formatDateText(iso) {
  const t = Date.parse(iso || '');
  if (!Number.isFinite(t)) return '';
  return new Date(t).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function largestThumbnailUrl(image) {
  const thumbs = image?.thumbnails;
  if (!Array.isArray(thumbs) || !thumbs.length) return '';
  const url = thumbs[thumbs.length - 1]?.url || '';
  return url.startsWith('//') ? `https:${url}` : url;
}

function collectImages(attachment) {
  if (!attachment) return [];

  if (attachment.backstageImageRenderer) {
    const url = largestThumbnailUrl(attachment.backstageImageRenderer.image);
    return url ? [url] : [];
  }

  if (attachment.postMultiImageRenderer) {
    const images = Array.isArray(attachment.postMultiImageRenderer.images)
      ? attachment.postMultiImageRenderer.images
      : [];
    return images
      .map((img) => largestThumbnailUrl(img?.backstageImageRenderer?.image))
      .filter(Boolean);
  }

  return [];
}

function collectSharedVideo(attachment) {
  const video = attachment?.videoRenderer;
  if (!video) return null;

  const videoId = video.videoId;
  if (!videoId) return null;

  const title = (video.title?.runs?.[0]?.text ?? video.title?.simpleText ?? '').trim();
  const thumbnailUrl = largestThumbnailUrl(video.thumbnail) || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  return { videoId, title, thumbnailUrl };
}

// Used only to rank posts for tile-size priority (newest + most-liked get a
// larger tile) — not shown as text anywhere.
function parseLikeCount(text) {
  const raw = String(text || '').trim().toUpperCase();
  const m = raw.match(/^([\d.,]+)\s*([KM]?)$/);
  if (!m) return 0;
  const num = parseFloat(m[1].replace(/,/g, ''));
  if (!Number.isFinite(num)) return 0;
  const mult = m[2] === 'K' ? 1000 : m[2] === 'M' ? 1000000 : 1;
  return Math.round(num * mult);
}

function collectPosts(root, seen = new Set()) {
  const posts = [];

  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const v of node) walk(v);
      return;
    }

    const renderer = node.backstagePostRenderer;
    if (renderer && renderer.postId && !seen.has(renderer.postId)) {
      seen.add(renderer.postId);

      const text = (renderer.contentText?.runs || [])
        .map((r) => r?.text || '')
        .join('')
        .trim();

      const publishedTimeText = (renderer.publishedTimeText?.runs?.[0]?.text || '').trim();
      const likeCount = parseLikeCount(renderer.voteCount?.simpleText || '');
      const images = collectImages(renderer.backstageAttachment);
      const sharedVideo = collectSharedVideo(renderer.backstageAttachment);

      if (text || images.length || sharedVideo) {
        posts.push({
          postId: renderer.postId,
          url: `https://www.youtube.com/post/${renderer.postId}`,
          text,
          publishedTimeText,
          likeCount,
          images,
          sharedVideo
        });
      }
    }

    for (const k of Object.keys(node)) walk(node[k]);
  }

  walk(root);
  return posts;
}

function jsStringEscape(value) {
  return value.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
}

async function main() {
  const handle = process.argv[2] || '@BandOfEchoes';
  const outFile = process.argv[3] || 'assets/js/data/youtube-posts-items.js';
  const url = `https://www.youtube.com/${encodeURIComponent(handle).replace(/^%40/, '@')}/community`;

  const { status, html } = await fetchText(url);
  if (status !== 200) {
    console.error(`Failed to fetch community page (status ${status})`);
    process.exit(1);
  }

  const data = extractYtInitialData(html);
  if (!data) {
    console.error('Failed to extract ytInitialData (YouTube markup changed?)');
    process.exit(1);
  }

  const cfg = extractYtConfig(html);

  const seen = new Set();
  let allPosts = collectPosts(data, seen);

  let token = findContinuationToken(data);

  if (cfg.apiKey && cfg.context && cfg.clientName && cfg.clientVersion) {
    const endpoint = `https://www.youtube.com/youtubei/v1/browse?key=${encodeURIComponent(cfg.apiKey)}`;
    const headers = {
      'x-youtube-client-name': cfg.clientName,
      'x-youtube-client-version': cfg.clientVersion,
      origin: 'https://www.youtube.com'
    };

    for (let page = 0; page < MAX_CONTINUATION_PAGES && token && allPosts.length < MAX_POSTS; page++) {
      const { status: contStatus, text } = await postJson(
        endpoint,
        { context: cfg.context, continuation: token },
        headers
      );
      if (contStatus !== 200) break;

      let contJson;
      try {
        contJson = JSON.parse(text);
      } catch {
        break;
      }

      const morePosts = collectPosts(contJson, seen);
      if (morePosts.length) allPosts = allPosts.concat(morePosts);

      const nextToken = findContinuationToken(contJson);
      token = nextToken && nextToken !== token ? nextToken : null;
    }
  }

  await mapWithConcurrency(allPosts, DATE_FETCH_CONCURRENCY, async (post) => {
    const iso = await fetchExactPublishedDate(post.postId);
    post.publishedDate = iso || approxIsoFromRelative(post.publishedTimeText);
  });

  allPosts.sort((a, b) => Date.parse(b.publishedDate || 0) - Date.parse(a.publishedDate || 0));
  allPosts = allPosts.slice(0, MAX_POSTS);

  for (const post of allPosts) {
    post.publishedDateText = formatDateText(post.publishedDate);
    delete post.publishedTimeText;
  }

  if (!allPosts.length) {
    console.error('No community posts found in ytInitialData');
    process.exit(1);
  }

  const payload = {
    channelUrl: `https://www.youtube.com/${handle}/community`,
    generatedAt: new Date().toISOString(),
    posts: allPosts
  };

  const js = `// Generated from YouTube community page\n// Channel: ${jsStringEscape(payload.channelUrl)}\n// Generated: ${payload.generatedAt}\n(function(){\n  window.YT_POSTS = ${JSON.stringify(allPosts, null, 2)};\n})();\n`;

  await fs.mkdir(outFile.split('/').slice(0, -1).join('/'), { recursive: true });
  await fs.writeFile(outFile, js, 'utf8');

  console.log(`Wrote ${outFile} with ${allPosts.length} posts.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
