// assets/js/remote-votes.js
// Global vote aggregation via Firebase Firestore
// Requires a config script setting window.FB_CONFIG = { apiKey, authDomain, projectId, ... }
// If no config is present, window.RemoteVotes will be undefined and the app will fall back to local only.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js';
import { getFirestore, doc, setDoc, updateDoc, getDoc, increment, collection, onSnapshot } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

(function() {
  const cfg = window.FB_CONFIG;
  if (!cfg || !cfg.projectId) {
    // No remote configured
    return;
  }
  const app = initializeApp(cfg);
  const db = getFirestore(app);
  const coll = 'photoVotes';

  async function ensureDoc(id) {
    await setDoc(doc(db, coll, id), { yes: 0, no: 0 }, { merge: true });
  }

  async function syncVote(id, prev, next) {
    // prev/next are 'yes' | 'no' | null
    let incY = 0, incN = 0;
    if (prev === 'yes') incY -= 1; else if (prev === 'no') incN -= 1;
    if (next === 'yes') incY += 1; else if (next === 'no') incN += 1;
    if (!incY && !incN) return;
    const ref = doc(db, coll, id);
    await ensureDoc(id);
    await updateDoc(ref, { yes: increment(incY), no: increment(incN) });
  }

  async function getCounts(ids) {
    const out = {};
    await Promise.all(ids.map(async (id) => {
      const snap = await getDoc(doc(db, coll, id));
      out[id] = snap.exists() ? (snap.data() || { yes: 0, no: 0 }) : { yes: 0, no: 0 };
    }));
    return out;
  }

  function subscribeCounts(cb) {
    return onSnapshot(collection(db, coll), (snap) => {
      const data = {};
      snap.forEach(d => { data[d.id] = d.data(); });
      cb(data);
    });
  }

  window.RemoteVotes = { syncVote, getCounts, subscribeCounts };
})();
