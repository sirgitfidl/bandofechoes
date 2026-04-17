Band of Echoes — local dev 

Run the static site on a local port so audio fetch/Web Audio works and the mixer Play button operates correctly.

Quick start:

1) Install deps (only needed for tests/server):
   npm install

2) Serve locally (http://localhost:3000):
   npm start

YouTube playlist tiles:
- The carousel can load the playlist dynamically at runtime via the YouTube Data API.
- To enable this without committing secrets, create an untracked file at [assets/js/data/youtube-api.private.js](assets/js/data/youtube-api.private.js) with:
   - `window.BOE_YT_API_KEY = 'YOUR_KEY_HERE';`
   - Restrict the key to YouTube Data API v3 and your site’s HTTP referrers (e.g. `https://bandofechoes.com/*`).
   - For local dev, add `http://localhost:*/*` to the allowed referrers.
- If no API key is set (or the API fails), the site falls back to the bundled snapshot at [assets/js/data/youtube-playlist-items.js](assets/js/data/youtube-playlist-items.js).

GitHub Pages (recommended for keeping the key out of git):
- If you publish Pages directly from the `main` branch, you cannot inject a secret at deploy time.
- This repo includes a workflow that deploys via GitHub Actions and generates `assets/js/data/youtube-api.private.js` from a GitHub Secret.
- Setup:
   - Repo Settings → Secrets and variables → Actions → New repository secret:
      - Name: `BOE_YT_API_KEY`
      - Value: your YouTube Data API key
   - Repo Settings → Pages → Build and deployment:
      - Source: `GitHub Actions`

3) Run tests (spins its own server on :3000 automatically):
   npm test

Notes:
- The mixer fetches MP3 stems; file:// will block fetch and autoplay policies. Use the local server above.
- If port 3000 is busy, change the port in package.json serve script and playwright.config.ts webServer.url/baseURL.
