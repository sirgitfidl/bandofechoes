// YouTube Data API key override for runtime-dynamic playlist loading.
//
// Keep this file EMPTY in git (do not commit secrets).
// If you deploy via GitHub Pages + Actions, the deploy workflow overwrites this
// file inside the deployed artifact using the YT_API_KEY GitHub Secret.
//
// IMPORTANT: This key is still visible to site visitors in the browser.
// Protect it by restricting HTTP referrers in Google Cloud Console.
window.YT_API_KEY = '';
