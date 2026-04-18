// Optional: YouTube Data API key for runtime-dynamic playlist loading.
//
// 1) Create an API key in Google Cloud Console.
// 2) Restrict it to the YouTube Data API v3.
// 3) Restrict HTTP referrers to your site (e.g. https://bandofechoes.com/*).
//
// Leave empty to fall back to the bundled snapshot data.
//
// IMPORTANT: Do not commit your key to the repo.
//
// This repo loads an optional override file at:
//   assets/js/data/youtube-api.private.js
//
// In production (GitHub Pages via Actions), that file should be generated from a
// GitHub Secret at deploy time. In git, it can exist as an empty placeholder so
// the <script> tag doesn't 404.
window.BOE_YT_API_KEY = '';
