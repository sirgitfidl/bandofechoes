// assets/js/remote-votes-gas.js
// Google Apps Script backend client for votes
// Requires window.GAS_ENDPOINT = 'https://script.google.com/macros/s/DEPLOYMENT_ID/exec'

(function() {
  const endpoint = window.GAS_ENDPOINT;
  if (!endpoint) return;

  function uuid() {
    // Simple uuid v4
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  function getUserId() {
    const k = 'bofe-user-id';
    let id = localStorage.getItem(k);
    if (!id) { id = uuid(); localStorage.setItem(k, id); }
    return id;
  }

  async function syncVote(id, prev, next) {
    try {
      const payload = { userId: getUserId(), id, yes: next === 'yes' };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload)
      });
      await res.text();
    } catch (e) {
      // no-op
    }
  }

  async function getCounts(ids) {
    const out = {};
    try {
      const res = await fetch(`${endpoint}?ids=${encodeURIComponent(ids.join(','))}`, { cache: 'no-store' });
      const data = await res.json();
      // Expect { counts: { id: { yes: number } } }
      Object.assign(out, data && data.counts ? data.counts : {});
    } catch {}
    // Ensure shape
    const ensure = {};
    ids.forEach(id => { ensure[id] = { yes: (out[id]?.yes) || 0 }; });
    return ensure;
  }

  function subscribeCounts(cb, intervalMs = 10000) {
    let stopped = false;
    let timer = null;
    async function tick() {
      if (stopped) return;
      try {
        // No ids means server returns all; prefer to call cb with what we got
        const res = await fetch(`${endpoint}`, { cache: 'no-store' });
        const data = await res.json();
        cb((data && data.counts) || {});
      } catch {}
      if (!stopped) timer = setTimeout(tick, intervalMs);
    }
    tick();
    return () => { stopped = true; if (timer) clearTimeout(timer); };
  }

  window.RemoteVotes = { syncVote, getCounts, subscribeCounts };
})();
