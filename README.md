Band of Echoes — local dev 

Run the static site on a local port so audio fetch/Web Audio works and the mixer Play button operates correctly.

Quick start:

1) Install deps (only needed for tests/server):
   npm install

2) Serve locally (http://localhost:3000):
   npm start

3) Run tests (spins its own server on :3000 automatically):
   npm test

Notes:
- The mixer fetches MP3 stems; file:// will block fetch and autoplay policies. Use the local server above.
- If port 3000 is busy, change the port in package.json serve script and playwright.config.ts webServer.url/baseURL.
