// Optional: upcoming YouTube Premiere URL to seed the countdown.
//
// Leave empty until a premiere is scheduled; the countdown will fall back to a
// fixed date/time.
window.BOE_NEXT_PREMIERE_URL = '';

// Countdown preview-image automation.
//
// Suggested naming convention:
// - currentPreview: image shown until main premiere goes live.
// - upcomingPreview: image automatically shown after main countdown expires.
window.BOE_COUNTDOWN_PREVIEW = {
  currentPreview: 'metallicaLogo.png',
  upcomingPreview: 'ninLogo.png'
};

// Two-stage release scheduling:
// - current: the release currently counting down on the live page
// - upcoming: the release that should take over automatically after current ends
window.BOE_NEXT_RELEASE_SCHEDULE = {
  upcoming: {
    year: 2026,
    month: 10,
    day: 15,
    hour: 10,
    minute: 0,
    timeZone: 'America/Los_Angeles'
  }
};

