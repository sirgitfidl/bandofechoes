import https from 'node:https';
import fs from 'node:fs/promises';

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
  // Pull the fields we need from the ytcfg blob. (YouTube changes frequently; keep it tolerant.)
  const apiKey = html.match(/\"INNERTUBE_API_KEY\"\s*:\s*\"([^\"]+)\"/)?.[1] ?? null;
  const clientName = html.match(/\"INNERTUBE_CLIENT_NAME\"\s*:\s*\"([^\"]+)\"/)?.[1] ?? null;
  const clientVersion = html.match(/\"INNERTUBE_CLIENT_VERSION\"\s*:\s*\"([^\"]+)\"/)?.[1] ?? null;

  // INNERTUBE_CONTEXT is a JSON object; grab a bounded region to keep parsing reliable.
  const ctxMatch = html.match(/\"INNERTUBE_CONTEXT\"\s*:\s*(\{.*?\})\s*,\s*\"INNERTUBE_CONTEXT_CLIENT_NAME\"/s);
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

function collectPlaylistItems(root, seen = new Set()) {
  const items = [];

  const rendererCounts = {
    playlistVideoRenderer: 0,
    playlistPanelVideoRenderer: 0,
    videoRenderer: 0,
    gridVideoRenderer: 0,
    compactVideoRenderer: 0
  };

  function isUpcomingCandidate(candidate) {
    if (!candidate || typeof candidate !== 'object') return false;

    // YouTube varies, but upcoming premieres/livestreams often include one of:
    // - upcomingEventData
    // - thumbnailOverlayTimeStatusRenderer.style === 'UPCOMING'
    // - overlay text like "UPCOMING" / "PREMIERE"
    try {
      if (candidate.upcomingEventData) return true;
    } catch {
      // ignore
    }

    try {
      const overlays = Array.isArray(candidate.thumbnailOverlays)
        ? candidate.thumbnailOverlays
        : [];
      for (const ov of overlays) {
        const r = ov?.thumbnailOverlayTimeStatusRenderer;
        if (!r) continue;

        const style = String(r.style || '').toUpperCase();
        if (style === 'UPCOMING') return true;

        const text =
          (r.text?.simpleText ?? r.text?.runs?.[0]?.text ?? '').toString().toUpperCase();
        if (text.includes('UPCOMING') || text.includes('PREMIERE')) return true;
      }
    } catch {
      // ignore
    }

    return false;
  }

  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const v of node) walk(v);
      return;
    }

    for (const k of Object.keys(rendererCounts)) {
      if (node[k]) rendererCounts[k] += 1;
    }

    const candidate =
      node.playlistVideoRenderer ||
      node.playlistPanelVideoRenderer ||
      node.videoRenderer ||
      node.gridVideoRenderer ||
      node.compactVideoRenderer;

    if (candidate) {
      const videoId = candidate.videoId;
      if (videoId && !seen.has(videoId)) {
        // Exception: skip scheduled premieres / upcoming items.
        if (isUpcomingCandidate(candidate)) {
          seen.add(videoId);
          // Still mark as seen so we don't accidentally pick it up from a
          // different renderer later in the tree.
        } else {
        const title =
          (candidate.title?.runs?.[0]?.text ?? candidate.title?.simpleText ?? '').trim();
        const length =
          (candidate.lengthText?.simpleText ?? candidate.lengthText?.runs?.[0]?.text ?? '').trim();
        const thumbs = candidate.thumbnail?.thumbnails;
        const thumbnailUrl =
          (thumbs && thumbs.length ? thumbs[thumbs.length - 1].url : '') ||
          `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

        if (title) {
          items.push({ videoId, title, length, thumbnailUrl });
          seen.add(videoId);
        }
        }
      }
    }

    for (const k of Object.keys(node)) walk(node[k]);
  }

  walk(root);
  return { items, rendererCounts, seen };
}

function jsStringEscape(value) {
  return value.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
}

async function main() {
  const playlistId = process.argv[2];
  if (!playlistId) {
    console.error('Usage: node scripts/generate-youtube-playlist-data.mjs <PLAYLIST_ID> [outputFile]');
    process.exit(1);
  }

  const outFile = process.argv[3] || 'assets/js/data/youtube-playlist-items.js';
  const url = `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`;

  const { status, html } = await fetchText(url);
  if (status !== 200) {
    console.error(`Failed to fetch playlist page (status ${status})`);
    process.exit(1);
  }

  const data = extractYtInitialData(html);
  if (!data) {
    console.error('Failed to extract ytInitialData (YouTube markup changed?)');
    process.exit(1);
  }

  const cfg = extractYtConfig(html);

  const seen = new Set();
  let allItems = [];

  const { items: initialItems, rendererCounts } = collectPlaylistItems(data, seen);
  allItems = allItems.concat(initialItems);

  let token = findContinuationToken(data);

  if (cfg.apiKey && cfg.context && cfg.clientName && cfg.clientVersion && token) {
    const endpoint = `https://www.youtube.com/youtubei/v1/browse?key=${encodeURIComponent(cfg.apiKey)}`;
    const headers = {
      'x-youtube-client-name': cfg.clientName,
      'x-youtube-client-version': cfg.clientVersion,
      origin: 'https://www.youtube.com'
    };

    for (let page = 0; page < 12 && token; page++) {
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

      const { items: moreItems } = collectPlaylistItems(contJson, seen);
      if (moreItems.length) allItems = allItems.concat(moreItems);

      const nextToken = findContinuationToken(contJson);
      token = nextToken && nextToken !== token ? nextToken : null;
    }
  }

  if (!allItems.length) {
    console.error('No playlist items found in ytInitialData');
    console.error('Renderer counts:', rendererCounts);
    process.exit(1);
  }

  const payload = {
    playlistId,
    playlistUrl: `https://www.youtube.com/playlist?list=${playlistId}`,
    generatedAt: new Date().toISOString(),
    items: allItems
  };

  const js = `// Generated from YouTube playlist page\n// Playlist: ${jsStringEscape(payload.playlistUrl)}\n// Generated: ${payload.generatedAt}\n(function(){\n  window.BOE_YT_PLAYLISTS = window.BOE_YT_PLAYLISTS || {};\n  window.BOE_YT_PLAYLISTS[${JSON.stringify(playlistId)}] = ${JSON.stringify(allItems, null, 2)};\n})();\n`;

  await fs.mkdir(outFile.split('/').slice(0, -1).join('/'), { recursive: true });
  await fs.writeFile(outFile, js, 'utf8');

  console.log(`Wrote ${outFile} with ${allItems.length} items.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
