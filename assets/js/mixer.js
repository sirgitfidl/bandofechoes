// Stem mixer (buffer-based) — clean, fixed (no orientation overrides)
// Band of Echoes — "Right In Two" stem player
(() => {
  const CH_NAMES = ["guitar", "cello", "eric", "kathryn"];
  const EL = (s, r = document) => r.querySelector(s);
  const ELS = (s, r = document) => Array.from(r.querySelectorAll(s));

  // Core UI elements
  const playBtn = EL('#playBtn');
  const rewBtn = EL('#rewBtn');
  const progress = EL('#progress');
  const timeReadout = EL('#timeReadout');
  const overlay = EL('#loadingOverlay');
  const loadingMsg = EL('#loadingMsg');

  // Hidden <audio> tags providing URLs
  const media = {
    guitar: EL('#audio-guitar'),
    cello: EL('#audio-cello'),
    eric: EL('#audio-eric'),
    kathryn: EL('#audio-kathryn'),
  };

  // Web Audio state
  let ctx;
  const nodes = {
    chGain: new Map(),
    chAnalyser: new Map(),
    masterGain: null,
    masterAnalyser: null,
  };
  const buffers = new Map();           // decoded AudioBuffers by channel
  const pendingArrays = new Map();     // prefetched ArrayBuffers by channel
  let sources = new Map();             // live BufferSources by channel
  let startedAt = 0, offsetAtPause = 0, endTimer = null;

  const state = {
    playing: false,
    duration: 0,
    solos: new Set(),
    mutes: new Set(),
    faderValues: new Map(),
    masterFader: 70, // ~0 dB on our taper
  };

  // UI constants
  const PROG_THUMB_W = 28; // keep in sync with injectProgressCapStyles()

  // ===== Helpers =====
  function faderToGain(val) {
    // 0..70 -> -50..0 dB, 70..100 -> 0..+6 dB (console-ish taper)
    const p = Math.max(0, Math.min(1, val / 100));
    const dB = p <= 0.7 ? -50 + (p / 0.7) * 50 : ((p - 0.7) / 0.3) * 6;
    return Math.pow(10, dB / 20);
  }
  function gainToDb(g) { if (g <= 0) return '−∞'; const dB = 20 * Math.log10(g); return dB.toFixed(1); }
  function fmt(sec) { if (!isFinite(sec)) return '00:00'; const m = Math.floor(sec / 60), s = Math.floor(sec % 60); return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; }

  function showLoading(msg) { if (!overlay) return; overlay.hidden = false; overlay.setAttribute('aria-busy', 'true'); if (msg) loadingMsg.textContent = msg; playBtn.disabled = true; }
  function updateLoading(msg) { if (overlay && msg) loadingMsg.textContent = msg; }
  function hideLoading() { if (!overlay) return; overlay.setAttribute('aria-busy', 'false'); overlay.hidden = true; playBtn.disabled = false; }

  // ===== Audio Graph =====
  function ensureGraph() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();

    nodes.masterGain = ctx.createGain();
    nodes.masterGain.gain.value = faderToGain(state.masterFader);

    nodes.masterAnalyser = ctx.createAnalyser();
    nodes.masterAnalyser.fftSize = 1024;
    nodes.masterAnalyser.smoothingTimeConstant = 0.5;

    for (const ch of CH_NAMES) {
      const g = ctx.createGain();
      g.gain.value = faderToGain(state.faderValues.get(ch) ?? 70);
      const an = ctx.createAnalyser();
      an.fftSize = 1024; an.smoothingTimeConstant = 0.5;
      g.connect(nodes.masterGain);
      g.connect(an);
      nodes.chGain.set(ch, g);
      nodes.chAnalyser.set(ch, an);
    }

    nodes.masterGain.connect(nodes.masterAnalyser).connect(ctx.destination);
    applyGains();
  }

  // ===== Loading (prefetch + decode) =====
  async function prefetchStems() {
    const toFetch = CH_NAMES.filter(ch => !buffers.has(ch) && !pendingArrays.has(ch));
    if (!toFetch.length) return;
    try {
      await Promise.all(toFetch.map(async ch => {
        const url = media[ch].getAttribute('src');
        const res = await fetch(url, { cache: 'force-cache' });
        if (!res.ok) throw new Error(`Prefetch failed ${url}: ${res.status}`);
        const arr = await res.arrayBuffer();
        pendingArrays.set(ch, arr);
      }));
    } catch (e) { console.warn(e); }
  }

  async function loadAllBuffers() {
    ensureGraph();
    const toLoad = CH_NAMES.filter(ch => !buffers.has(ch));
    if (!toLoad.length) return;

    showLoading(`Loading stems (0/${toLoad.length})…`);
    let done = 0;
    try {
      await Promise.all(toLoad.map(async ch => {
        const url = media[ch].getAttribute('src');
        let arr;
        if (pendingArrays.has(ch)) arr = pendingArrays.get(ch);
        else { const res = await fetch(url); if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`); arr = await res.arrayBuffer(); }
        const buf = await (ctx.decodeAudioData.length === 1 ? ctx.decodeAudioData(arr) : new Promise((res2, rej2) => ctx.decodeAudioData(arr, res2, rej2)));
        buffers.set(ch, buf); pendingArrays.delete(ch);
      }).map(p => p.finally(() => { done++; updateLoading(`Loading stems (${done}/${toLoad.length})…`); })));
    } finally { hideLoading(); }

    state.duration = Math.max(...CH_NAMES.map(ch => buffers.get(ch)?.duration || 0));
    setTimeReadout();
  }

  // ===== Transport =====
  function clearEnd() { if (endTimer) { clearTimeout(endTimer); endTimer = null; } }

  function startFrom(offsetSec = 0) {
    clearEnd();
    for (const [, s] of sources) { try { s.stop(); } catch { } }
    sources.clear();

    for (const ch of CH_NAMES) {
      const buf = buffers.get(ch); if (!buf) continue;
      const src = ctx.createBufferSource();
      src.buffer = buf; src.connect(nodes.chGain.get(ch));
      if (offsetSec < buf.duration) src.start(0, offsetSec);
      sources.set(ch, src);
    }

    startedAt = ctx.currentTime - offsetSec;
    state.playing = true; playBtn.textContent = 'Pause'; playBtn.setAttribute('aria-pressed', 'true');
    rafMeters();
    const remain = Math.max(0, state.duration - offsetSec);
    endTimer = setTimeout(onEnded, remain * 1000 + 20);
  }

  function onEnded() { if (!state.playing) return; pausePlayback(false); offsetAtPause = 0; setTimeReadout(); updateProgressUI(0); }
  function getCurrentPos() { return Math.min(state.duration, state.playing ? (ctx.currentTime - startedAt) : offsetAtPause); }

  function pausePlayback(updateBtn = true) {
    clearEnd();
    for (const [, s] of sources) { try { s.stop(); } catch { } }
    sources.clear();
    offsetAtPause = getCurrentPos();
    state.playing = false;
    if (updateBtn) { playBtn.textContent = 'Play'; playBtn.setAttribute('aria-pressed', 'false'); }
    startMeterDecay();
  }

  async function playPause() {
    ensureGraph();
    try { await ctx.resume(); } catch { }
    if (!state.playing) { await loadAllBuffers(); startFrom(offsetAtPause); }
    else { pausePlayback(true); }
  }

  function setTimeReadout() { const cur = getCurrentPos(); const dur = state.duration || 0; timeReadout.textContent = `${fmt(cur)} / ${fmt(dur)}`; }

  // ===== Gains & UI =====
  function applyGains() {
    const anySolo = state.solos.size > 0;
    for (const ch of CH_NAMES) {
      const userGain = faderToGain(state.faderValues.get(ch) ?? 70);
      const isMuted = state.mutes.has(ch); const isSolo = state.solos.has(ch);
      const audible = anySolo ? isSolo : !isMuted; // Solo overrides mute
      const g = audible ? userGain : 0.0;

      const strip = document.querySelector(`.strip[data-channel="${ch}"]`);
      if (strip) {
        const dbEl = strip.querySelector('.db');
        if (dbEl) { const val = state.faderValues.get(ch) ?? 70; dbEl.textContent = (val === 0 || g === 0) ? '−∞ dB' : `${gainToDb(g)} dB`; }
      }
      const gn = nodes.chGain.get(ch); if (gn) gn.gain.value = g;
    }

    const masterGainLin = state.mutes.has('master') ? 0.0 : faderToGain(state.masterFader);
    const masterDbEl = document.querySelector(`.strip[data-channel="master"] .db`);
    if (masterDbEl) masterDbEl.textContent = (state.masterFader === 0 || masterGainLin === 0) ? '−∞ dB' : `${gainToDb(masterGainLin)} dB`;

    if (!ctx || !nodes.masterGain) return; nodes.masterGain.gain.value = masterGainLin;
  }

  function bindStrip(strip) {
    const channel = strip.dataset.channel;
    const fader = strip.querySelector('.fader');
    const soloBtn = strip.querySelector('.chip.solo');
    const muteBtn = strip.querySelector('.chip.mute');
    const unsoloBtn = strip.querySelector('.chip.unsolo');

    if (channel !== 'master') {
      fader.addEventListener('input', () => { state.faderValues.set(channel, Number(fader.value)); applyGains(); });
      if (soloBtn) soloBtn.addEventListener('click', () => { const on = !soloBtn.classList.contains('active'); if (on) state.solos.add(channel); else state.solos.delete(channel); updateSoloChips(); applyGains(); });
      if (muteBtn) muteBtn.addEventListener('click', () => { const on = !muteBtn.classList.contains('active'); muteBtn.classList.toggle('active', on); muteBtn.setAttribute('aria-checked', String(on)); if (on) state.mutes.add(channel); else state.mutes.delete(channel); applyGains(); });
    } else {
      fader.addEventListener('input', () => { state.masterFader = Number(fader.value); applyGains(); });
      if (muteBtn) muteBtn.addEventListener('click', () => { const on = !muteBtn.classList.contains('active'); muteBtn.classList.toggle('active', on); muteBtn.setAttribute('aria-checked', String(on)); if (on) state.mutes.add('master'); else state.mutes.delete('master'); applyGains(); });
      if (unsoloBtn) unsoloBtn.addEventListener('click', () => { state.solos.clear(); updateSoloChips(); applyGains(); });
    }
  }

  // ===== Meters =====
  const meterBars = new Map();
  const meterBufs = { master: null, ch: new Map() };
  let meterDecayRAF = null;

  function startMeterDecay() {
    if (meterDecayRAF) { cancelAnimationFrame(meterDecayRAF); meterDecayRAF = null; }
    function step() {
      let any = false;
      for (const [, bar] of meterBars) { if (!bar) continue; const cur = parseFloat(bar.style.width) || 0; const next = Math.max(0, cur - 6); if (next > 0) any = true; bar.style.width = next + '%'; }
      if (any) meterDecayRAF = requestAnimationFrame(step);
    }
    step();
  }

  function setupMeters() { for (const ch of [...CH_NAMES, 'master']) { const span = document.querySelector(`.strip[data-channel="${ch}"] .meter > span`); meterBars.set(ch, span); } }

  function analyserRms(an, key) {
    if (!an) return 0; let buf = key === 'master' ? meterBufs.master : meterBufs.ch.get(key);
    if (!buf || buf.length !== an.fftSize) { buf = new Float32Array(an.fftSize); if (key === 'master') meterBufs.master = buf; else meterBufs.ch.set(key, buf); }
    if (an.getFloatTimeDomainData) an.getFloatTimeDomainData(buf); else { const t = new Uint8Array(an.fftSize); an.getByteTimeDomainData(t); for (let i = 0; i < t.length; i++) buf[i] = (t[i] - 128) / 128; }
    let sum = 0; for (let i = 0; i < buf.length; i++) { const v = buf[i]; sum += v * v; }
    const rms = Math.sqrt(sum / buf.length) + 1e-8; const db = 20 * Math.log10(rms); let x = (db + 80) / 80; x = Math.max(0, Math.min(1, x)); return Math.max(0, Math.min(100, Math.pow(x, 1.1) * 100));
  }

  function rafMeters() {
    if (!state.playing) return;
    for (const ch of CH_NAMES) { const pct = analyserRms(nodes.chAnalyser.get(ch), ch); const bar = meterBars.get(ch); if (bar) bar.style.width = `${pct}%`; }
    const masterPct = analyserRms(nodes.masterAnalyser, 'master'); const mbar = meterBars.get('master'); if (mbar) mbar.style.width = `${masterPct}%`;
    const pos = getCurrentPos(); updateProgressUI(pos); setTimeReadout(); requestAnimationFrame(rafMeters);
  }

  // ===== Progress / Scrubbing =====
  function updateProgressUI(posSec) { if (!state.duration) { progress.value = '0'; return; } const v = Math.max(0, Math.min(1000, Math.round((posSec / state.duration) * 1000))); progress.value = String(v); }

  playBtn.addEventListener('click', playPause);
  rewBtn.addEventListener('click', () => { ensureGraph(); const wasPlaying = state.playing; if (wasPlaying) startFrom(0); else { offsetAtPause = 0; setTimeReadout(); updateProgressUI(0); } });

  let scrubbing = false, wasPlayingOnScrub = false;
  function scrubToEvent(clientX) {
    const rect = progress.getBoundingClientRect();
    const trackW = rect.width;
    const half = PROG_THUMB_W / 2;
    // Clamp pointer to the usable track (accounting for the cap width) so
    // clicks in the middle of the cap don't jump its left edge.
    const localX = Math.max(half, Math.min(trackW - half, clientX - rect.left));
    const t = (localX - half) / Math.max(1, (trackW - PROG_THUMB_W));
    const sec = t * (state.duration || 0);
    progress.value = String(Math.round(t * 1000));
    timeReadout.textContent = `${fmt(sec)} / ${fmt(state.duration || 0)}`;
    return sec;
  }
  progress.addEventListener('pointerdown', e => { if (!state.duration) return; progress.setPointerCapture(e.pointerId); scrubbing = true; wasPlayingOnScrub = state.playing; if (wasPlayingOnScrub) pausePlayback(true); scrubToEvent(e.clientX); });
  progress.addEventListener('pointermove', e => { if (!scrubbing) return; scrubToEvent(e.clientX); });
  function endScrub(e) { if (!scrubbing) return; const sec = scrubToEvent(e.clientX); scrubbing = false; if (wasPlayingOnScrub) startFrom(sec); else { offsetAtPause = sec; setTimeReadout(); } }
  progress.addEventListener('pointerup', endScrub); progress.addEventListener('pointercancel', endScrub);

  // ===== Group banners (additive toggles) =====
  function groupIncluded(channels) { return channels.every(ch => state.solos.has(ch)); }
  function updateGroupBanners() { const instBtn = document.querySelector('.group-banner.instruments'); const vocBtn = document.querySelector('.group-banner.vocals'); if (instBtn) instBtn.classList.toggle('held', groupIncluded(['guitar', 'cello'])); if (vocBtn) vocBtn.classList.toggle('held', groupIncluded(['eric', 'kathryn'])); }
  function updateSoloChips() { for (const ch of CH_NAMES) { const el = document.querySelector(`.strip[data-channel="${ch}"] .chip.solo`); if (!el) continue; const on = state.solos.has(ch); el.classList.toggle('active', on); el.setAttribute('aria-checked', String(on)); } updateGroupBanners(); }
  function attachGroupToggle(btn, channels) { if (!btn) return; const toggle = () => { if (groupIncluded(channels)) { for (const ch of channels) state.solos.delete(ch); } else { for (const ch of channels) state.solos.add(ch); } updateSoloChips(); applyGains(); }; btn.addEventListener('click', toggle); btn.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); } }); }

  // ===== Progress CAP styling via inline SVG (drawn in JS) =====
  function svgCapDataURI({ w = 28, h = 18, r = 4, top = '#f9fbfd', bottom = '#dbe3ea', stripe = '#1b1f24' } = {}) {
    const svg =
      `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>` +
      `<defs><linearGradient id='g' x1='0' y1='0' x2='0' y2='1'>` +
      `<stop offset='0' stop-color='${top}'/><stop offset='1' stop-color='${bottom}'/>` +
      `</linearGradient></defs>` +
      `<rect x='0.5' y='0.5' width='${w - 1}' height='${h - 1}' rx='${r}' ry='${r}' fill='url(#g)' stroke='#9aa6b1'/>` +
      `<rect x='${w / 2 - 1}' y='2' width='2' height='${h - 4}' rx='1' fill='${stripe}' opacity='0.95'/>` +
      `</svg>`;
    const encoded = encodeURIComponent(svg)
      .replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29');
    return `url('data:image/svg+xml;charset=utf-8,${encoded}')`;
  }

  function injectProgressCapStyles() {
    if (document.getElementById('mixer-progress-cap')) return;
    const bg = svgCapDataURI({ w: 28, h: 18, r: 4 });
    const css = `
      input#progress.progress::-webkit-slider-thumb{
        -webkit-appearance:none !important; appearance:none !important;
        width:28px !important; height:18px !important; border:0 !important; border-radius:4px !important;
        background:${bg} center / contain no-repeat !important;
        margin-top:-5px; /* center on 8px track */
        box-shadow:0 2px 4px rgba(0,0,0,.45), inset 0 -1px 0 rgba(0,0,0,.15), inset 0 1px 0 rgba(255,255,255,.5);
      }
      input#progress.progress::-moz-range-thumb{
        width:28px; height:18px; border:0; border-radius:4px;
        background:${bg} center / contain no-repeat;
        box-shadow:0 2px 4px rgba(0,0,0,.45), inset 0 -1px 0 rgba(0,0,0,.15), inset 0 1px 0 rgba(255,255,255,.5);
      }
    `;
    const s = document.createElement('style'); s.id = 'mixer-progress-cap'; s.textContent = css; document.head.appendChild(s);
  }

  // ===== Fader CAP overlays via inline SVG (applied to all faders) =====
  function injectMasterCapStyles() {
    if (document.getElementById('mixer-track-caps')) return;

    const capW = 28, capH = 18; // transport-like proportions, rotated later
    const bgTrack = svgCapDataURI({ w: capW, h: capH, r: 4 });
    const bgMaster = svgCapDataURI({ w: capW, h: capH, r: 4, top: '#ffd8d8', bottom: '#ff9c9c', stripe: '#6b1a1a' });
    const channels = ['master', ...CH_NAMES];

    const css = `
      ${channels.map(ch => `.strip[data-channel='${ch}']`).join(', ')}{ position: relative; }
      ${channels.map(ch => `.strip[data-channel='${ch}'] .fader::-webkit-slider-thumb`).join(', ')}{ opacity: 0 !important; }
      ${channels.map(ch => `.strip[data-channel='${ch}'] .fader::-moz-range-thumb`).join(', ')}{ opacity: 0 !important; }
      .cap-overlay{
  position: absolute; left: 50%; top: 0; width: ${capW}px; height: ${capH}px;
        pointer-events: none; z-index: 3;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,.45));
  transform: translate(-50%,0) rotate(90deg);
        transform-origin: 50% 50%;
        will-change: transform;
      }
    `;
    const style = document.createElement('style');
    style.id = 'mixer-track-caps';
    style.textContent = css;
    document.head.appendChild(style);

    const placeFns = new Map();

  channels.forEach((ch) => {
      const strip = document.querySelector(`.strip[data-channel='${ch}']`);
      if (!strip) return;
      const fader = strip.querySelector('.fader');
      if (!fader) return;

      let cap = strip.querySelector('.cap-overlay');
      if (!cap) {
        cap = document.createElement('div');
        cap.className = 'cap-overlay';
        strip.appendChild(cap);
      }
      // Per-channel color: red for master, silver for others
      cap.style.background = ((ch === 'master') ? bgMaster : bgTrack) + ' center / contain no-repeat';

      const place = () => {
        const r = fader.getBoundingClientRect();
        const usable = Math.max(0, r.height - capH);
        const val = Number(fader.value) || 0; // 0..100
        const t = 1 - (val / 100);
        // Position relative to strip via left:50%; only translate vertically
        // Compute vertical offset relative to fader top inside its strip
        const parentRect = strip.getBoundingClientRect();
        const y = (r.top - parentRect.top) + (t * usable);
        cap.style.transform = `translate(-50%, ${Math.round(y)}px) rotate(90deg)`;
      };

      placeFns.set(ch, place);
      place();
      fader.addEventListener('input', place);
      fader.addEventListener('change', place);
    });

    function redoAll() {
      channels.forEach(ch => { const fn = placeFns.get(ch); if (fn) fn(); });
    }
    window.addEventListener('resize', () => redoAll());
    window.addEventListener('orientationchange', () => setTimeout(() => redoAll(), 40));
  }
  // Lock Play/Pause button width so label swap doesn't shift layout
  function lockPlayButtonWidth() {
    if (!playBtn) return;
    const clone = playBtn.cloneNode(true);
    clone.textContent = 'Pause'; // widest label
    clone.style.position = 'absolute';
    clone.style.visibility = 'hidden';
    clone.style.pointerEvents = 'none';
    clone.style.width = 'auto';
    clone.style.height = 'auto';
    document.body.appendChild(clone);
    const w = clone.offsetWidth; // includes padding/border due to clone
    document.body.removeChild(clone);
    playBtn.style.minWidth = w + 'px';
  }

  // ===== Init =====
  ELS('.strip').forEach(bindStrip);
  setupMeters();
  (function initDb() { for (const ch of CH_NAMES) { const f = EL(`.strip[data-channel="${ch}"] .fader`); state.faderValues.set(ch, Number(f.value)); } state.masterFader = Number(EL(`.strip[data-channel="master"] .fader`).value); applyGains(); })();

  attachGroupToggle(document.querySelector('.group-banner.instruments'), ['guitar', 'cello']);
  attachGroupToggle(document.querySelector('.group-banner.vocals'), ['eric', 'kathryn']);
  updateGroupBanners();

  // Responsive CSS is now in assets/css/mixer-responsive.css

  // Draw the progress cap now
  injectProgressCapStyles();

  // Draw the master fader cap now
  injectMasterCapStyles();

  // Fix play/pause button width so it doesn't jump
  lockPlayButtonWidth();

  // Background prefetch so first Play is nearly instant
  prefetchStems().catch(console.warn);

  // === Mobile whole-console scale-to-fit (title + mixer) ===
  (function scaleToFit() {
    const MAX_W = 700; // Only scale below this width.
    let appliedScale = 1; // monotonic: only decrease
    let initialized = false;
    function measureAndScale() {
      const all = document.getElementById('mixAll');
      if (!all) return;
      document.body.classList.add('scaled-fit');
      all.classList.add('scaled');
      // Reset scale to get natural height
      all.style.transform = 'none';
      const natH = all.getBoundingClientRect().height;
      const vpH = window.innerHeight;
      let scale = 1;
      if (window.innerWidth <= MAX_W && natH > vpH) {
        scale = Math.max(0.62, Math.min(1, vpH / natH)); // clamp
      }
      // Monotonic: only apply if smaller than current appliedScale
      if (scale < appliedScale - 0.003) {
        appliedScale = scale;
        all.style.transformOrigin = 'top center';
  const yOffset = 0; // keep at top; adjust if needed later
  all.style.transform = (appliedScale < 1) ? `translateY(${yOffset}px) scale(${appliedScale.toFixed(4)})` : 'none';
        // Keep user at top if initial shrink; prevents hidden title
        if (!initialized) {
          window.scrollTo({ top: 0, behavior: 'instant' });
        }
      } else {
        // Re-apply previously chosen scale if we decided not to enlarge
  const yOffset2 = 0;
  all.style.transform = (appliedScale < 1) ? `translateY(${yOffset2}px) scale(${appliedScale.toFixed(4)})` : 'none';
      }
      // Reveal after first stable measurement
      if (all.classList.contains('pre-fit')) {
        requestAnimationFrame(() => all.classList.remove('pre-fit'));
      }
      initialized = true;
    }
    let rafId = null;
    function queue() { if (rafId) cancelAnimationFrame(rafId); rafId = requestAnimationFrame(measureAndScale); }
    window.addEventListener('resize', queue, { passive: true });
    window.addEventListener('orientationchange', () => setTimeout(measureAndScale, 50));
    setTimeout(measureAndScale, 30);
    window.addEventListener('load', () => setTimeout(measureAndScale, 30));
  })();
})();
