// Expose the pool of possible WITNESS URLs and a single randomized pick at page load
(function () {
    const urls = [
        'https://www.youtube.com/shorts/hkYhlXNTsJQ', // kathryn in studio (Right Where It Belongs)
        'https://www.youtube.com/shorts/hkYhlXNTsJQ', // duplicate placeholder for now
    ];
    // Make list available (not required to be a window property, but helpful for debugging)
    try { window.WITNESS_URLS = urls; } catch (_) { /* no-op */ }
    // Pick once at load; used by collage-puzzle.js and tests via window.__WITNESS_URL
    try {
        window.__WITNESS_URL = urls[Math.floor(Math.random() * urls.length)] || urls[0];
    } catch (_) {
        // Fallback if window is not available for some reason
    }
})();