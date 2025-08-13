// Band of Echoes — app.js (sanity v5)
// Goal: keep ALL existing behaviors; add cache-busting log, periodic solver, ultra-lenient gates.
const CONFIG = {
  featuredVideoId: 'dRs_bLfrtu8',
  youtubeHandleUrl: 'https://youtube.com/@BandOfEchoes',
  patreonUrl: 'https://patreon.com/bandofechoes'
};

// helpers
const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
const variance = a => { const m = mean(a); return a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length; };
const cov = (a, b) => { const ma = mean(a), mb = mean(b); return a.reduce((s, _, i) => s + (a[i] - ma) * (b[i] - mb), 0) / a.length; };
const wrap180 = d => ((d + 90) % 180 + 180) % 180 - 90;
function shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0;[arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }

// debug stubs (defined early so any calls before bottom are safe)
const debugMsg = () => { };
const debugVals = () => { };

(function init() {
  const year = document.getElementById('year'); if (year) year.textContent = new Date().getFullYear();

  // click-to-play hero
  const wrap = document.getElementById('playerWrap');
  const poster = document.getElementById('poster');
  if (wrap && poster && CONFIG.featuredVideoId) {
    poster.addEventListener('click', (e) => {
      e.preventDefault();
      const f = document.createElement('iframe');
      f.className = 'video-frame';
      f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      f.allowFullscreen = true;
      f.src = `https://www.youtube.com/embed/${CONFIG.featuredVideoId}?autoplay=1&rel=0&modestbranding=1&enablejsapi=1`;
      wrap.innerHTML = ''; wrap.appendChild(f);
    });
  }

  // footer links
  const yt = document.getElementById('ytFooter'); if (yt) yt.href = CONFIG.youtubeHandleUrl;
  const pt = document.getElementById('ptFooter'); if (pt) pt.href = CONFIG.patreonUrl;

  // hamburger menu wiring (restore)
  const navToggle = document.getElementById('navToggle');
  const navMenu = document.getElementById('navMenu');
  if (navToggle && navMenu) {
    let prevFocusEl = null;
    const openMenu = () => {
      prevFocusEl = document.activeElement;
      navMenu.classList.add('open');
      navMenu.setAttribute('aria-hidden', 'false');
      navToggle.setAttribute('aria-expanded', 'true');
      (navMenu.querySelector('a') || navMenu)?.focus?.();
    };
    const closeMenu = () => {
      navMenu.classList.remove('open');
      navMenu.setAttribute('aria-hidden', 'true');
      navToggle.setAttribute('aria-expanded', 'false');
      (prevFocusEl || navToggle)?.focus?.();
    };
    navToggle.addEventListener('click', (e) => {
      e.preventDefault();
      navMenu.classList.contains('open') ? closeMenu() : openMenu();
    });
    document.addEventListener('click', (e) => {
      if (!navMenu.contains(e.target) && !navToggle.contains(e.target)) {
        if (navMenu.classList.contains('open')) closeMenu();
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && navMenu.classList.contains('open')) closeMenu();
    });
    navMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
  }
  // Polaroid mobile sizing CSS is now in app-dynamic.css

  // Mobile touch guards CSS is now in app-dynamic.css
  // Still need to prevent context menu, selection, and set draggable=false for images
  const root = document.querySelector('.collage');
  if (root) {
    root.addEventListener('contextmenu', e => { e.preventDefault(); }, { capture: true });
    root.addEventListener('selectstart', e => { e.preventDefault(); }, { capture: true });
    // Safari gesture events (pinch/long‑press)
    root.addEventListener('gesturestart', e => { e.preventDefault(); });
  }
  document.querySelectorAll('.collage img').forEach(img => {
    img.setAttribute('draggable', 'false');
  });

  // scatter once (after layout) — preserves your look
  const collage = document.querySelector('.collage');
  let zCounter = 10000;
  // Scatter (initial random offsets/tilt)
  function scatter() {
    if (!collage) return;
    const items = collage.querySelectorAll('.polaroid');
    const vw = window.innerWidth || document.documentElement.clientWidth;
    const mobileMode = vw <= 560;
    let repW = 0, repH = 0;
    if (mobileMode) {
      // Pick first polaroid width as representative; approximate full card height (~ image aspect + frame)
      const first = items[0];
      if (first) {
        repW = first.offsetWidth || 200;
        repH = repW * 1.22; // empirical card height multiplier
        // Set a compact fixed container height so grid auto placement doesn't balloon.
        const targetH = Math.round(repH * 2.15); // roughly fits 2 rows with heavy overlap
        collage.style.position = 'relative';
        collage.style.height = targetH + 'px';
      }
    } else {
      // Clear any mobile inline overrides when returning to desktop
      if (collage.style.height) {
        collage.style.height = '';
        collage.style.position = '';
      }
    }

    items.forEach((el, i) => {
      const w = el.offsetWidth || repW || 300;
      // Biased rotation: mostly upright (near 0°), occasional inverted (~±180°)
      const ROTATION_DISTRIBUTION = { uprightBias: 0.78, uprightSpread: 55, invertedSpread: 26 };
      const wrap = (a) => ((a + 180) % 360 + 360) % 360 - 180; // [-180,180)
      const randomBiased = () => {
        const tri = () => (Math.random() + Math.random()) / 2; // triangular in [0,1]
        if (Math.random() < ROTATION_DISTRIBUTION.uprightBias) {
          // Centered near 0
            const centered = (tri() * 2 - 1); // [-1,1]
          return wrap(centered * ROTATION_DISTRIBUTION.uprightSpread);
        } else {
          // Inverted cluster near ±180
          const sign = Math.random() < 0.5 ? 1 : -1;
          const offset = (tri() * 2 - 1) * ROTATION_DISTRIBUTION.invertedSpread;
          return wrap(sign * 180 + offset);
        }
      };
      const randomRot = randomBiased;
      if (mobileMode) {
        // Force absolute positioning so layout boxes don't stack vertically
        if (el.style.position !== 'absolute') {
          el.style.position = 'absolute';
          el.style.top = '0';
          el.style.left = '0';
        }
        // Centered overlap cloud: distribute around container center for more balanced look
        const h = repH || (w * 1.22);
        const containerW = collage.clientWidth || (w * 3);
        const containerH = parseFloat(collage.style.height) || (h * 2.1);
        const cx = containerW / 2;
        const cy = containerH / 2;
        // Spread radii (controls density)
        const spreadX = w * 1.15; // allow about a bit over one width left/right
        const spreadY = h * 0.55;  // about half height up/down
        // Use triangular distribution (sum of two uniforms - 1) for more center weight
        const tri = () => (Math.random() + Math.random() - 1); // range [-1,1]
        const rxLocal = tri() * spreadX;
        const ryLocal = tri() * spreadY;
        const rx = cx - w / 2 + rxLocal;
        const ry = cy - h / 2 + ryLocal;
  const rot = randomRot();
        el.style.setProperty('--tx', `${rx}px`);
        el.style.setProperty('--ty', `${ry}px`);
        // Slight layering tweak: front-load z for later items for visual variation
        el.style.setProperty('--rot', `${rot}deg`);
      } else {
        // Desktop original scatter logic
        const maxX = Math.max(40, Math.min(220, w * 0.55));
        const maxY = Math.max(14, Math.min(80, w * 0.20));
        let rx = (Math.random() * 2 - 1) * maxX;
        if ((i % 5) === 4 && rx > 0) rx = Math.min(rx, maxX * 0.4);
        if (i >= 5) rx = Math.max(-maxX * 1.1, Math.min(maxX * 1.1, rx * 1.1));
        const ry = Math.pow(Math.random(), 1.2) * maxY;
  const rot = randomRot();
        el.style.setProperty('--tx', `${rx}px`);
        el.style.setProperty('--ty', `${ry}px`);
        el.style.setProperty('--rot', `${rot}deg`);
        // Reset any absolute positioning from mobile mode
        if (el.style.position === 'absolute' && !mobileMode) {
          el.style.position = '';
          el.style.top = '';
          el.style.left = '';
        }
      }
      if (!el.style.zIndex) el.style.zIndex = String(10 + i);
    });
  }

  // --- Grouping & snapping infra --------------------------------------
  let groupSeq = 1;
  const groups = new Map(); // id -> Set<HTMLElement>
  const newGroupId = () => 'g' + (groupSeq++);
  function ensureGroup(el) {
    if (!el.dataset.group) {
      const id = newGroupId(); el.dataset.group = id; groups.set(id, new Set([el]));
    }
    return el.dataset.group;
  }
  function membersOf(el) { const id = ensureGroup(el); return groups.get(id) || new Set([el]); }
  function mergeGroups(a, b) { const ia = ensureGroup(a), ib = ensureGroup(b); if (ia === ib) return ia; const A = groups.get(ia), B = groups.get(ib); B.forEach(n => { n.dataset.group = ia; A.add(n); }); groups.delete(ib); A.forEach(n => { updateFlipper(n); updateRotor(n); }); return ia; }
  function unsnap(el) { const id = ensureGroup(el); const set = groups.get(id); if (!set || set.size <= 1) return; set.delete(el); const nid = newGroupId(); el.dataset.group = nid; groups.set(nid, new Set([el])); updateFlipper(el); updateRotor(el); set.forEach(n => { updateFlipper(n); updateRotor(n); }); }
  function getStyleNum(el, name) { const v = getComputedStyle(el).getPropertyValue(name); const n = parseFloat(v); return isNaN(n) ? 0 : n; }
  function applyDeltaToGroup(el, dx, dy, dRot) { membersOf(el).forEach(n => { const ux = getStyleNum(n, '--ux'); const uy = getStyleNum(n, '--uy'); const rot = getStyleNum(n, '--rot'); n.style.setProperty('--ux', (ux + dx) + 'px'); n.style.setProperty('--uy', (uy + dy) + 'px'); n.style.setProperty('--rot', (rot + dRot) + 'deg'); }); }
  // Temporarily disable transitions for a set of nodes during precise snaps
  function withoutAnim(nodes, fn) { const list = []; nodes.forEach(n => { list.push([n, n.style.transition]); n.style.transition = 'none'; }); try { fn(); } finally { list.forEach(([n, t]) => { n.style.transition = t; }); } }
  function updateFlipper(el) {
    let btn = el.querySelector('.flipper');
    if (!btn) return;

    // Always clickable; never bubble to the card (so lightbox doesn't open)
    btn.style.pointerEvents = 'auto';
    btn.onpointerdown = (ev) => { ev.preventDefault(); ev.stopPropagation(); };
    btn.onmousedown = (ev) => { ev.preventDefault(); ev.stopPropagation(); };

    const grouped = membersOf(el).size > 1;
    const isBack = el.dataset.flipped === '1';

    if (grouped) {
      // Coupled pieces cannot flip — only de‑snap
      btn.textContent = '⎌';
      btn.title = 'De-snap';
      btn.setAttribute('aria-label', 'De-snap');
      btn.onclick = (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        unsnap(el);
        setTimeout(() => { delete el.dataset.didDrag; }, 0);
        checkSolvedSoon();
        updateFlipper(el);
      };
    } else {
      // Solo piece: flip front/back
      btn.textContent = '⇄';
      btn.title = isBack ? 'Flip to front' : 'Flip to back';
      btn.setAttribute('aria-label', btn.title);
      btn.onclick = (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        el.dataset.flipped = isBack ? '0' : '1';
        el.dataset.didDrag = '1';
        setTimeout(() => { delete el.dataset.didDrag; }, 120);
        updateFlipper(el);
        checkSolvedSoon();
      };
    }
  }

  // Disable/enable the rotor based on grouping state
  function updateRotor(el) {
    const knob = el.querySelector('.rotor');
    if (!knob) return;
    const grouped = membersOf(el).size > 1;

    // Install hover wiring once to avoid duplicate listeners
    if (!el.dataset.peInit) {
      el.dataset.peInit = '1';
      knob.style.pointerEvents = 'none';
      el.addEventListener('mouseenter', () => { if (membersOf(el).size <= 1) knob.style.pointerEvents = 'auto'; });
      el.addEventListener('mouseleave', () => { knob.style.pointerEvents = 'none'; });
    }

    if (grouped) {
      knob.setAttribute('disabled', '');
      knob.style.opacity = '0.35';
      knob.style.pointerEvents = 'none';
      knob.title = 'Rotate (disabled while snapped)';
    } else {
      knob.removeAttribute('disabled');
      knob.style.opacity = '';
      knob.style.pointerEvents = 'auto'; // ensure immediate usability after de‑snap
      knob.title = 'Rotate';
    }
  }

  // rotation knob — group-aware
  function addRotor(el) {
    // Ensure a knob exists
    let knob = el.querySelector('.rotor');
    if (!knob) {
      knob = document.createElement('button');
      knob.type = 'button';
      knob.className = 'rotor';
      knob.textContent = '⟲';
      knob.title = 'Rotate';
      knob.setAttribute('aria-label', 'Rotate photo');
      el.appendChild(knob);
    }
    // reflect initial state (disabled when grouped)
    updateRotor(el);

    // Smooth, low-jitter rotation:
    // - rotate SOLO tiles only
    // - no layout reads inside RAF
    // - never adjust --ux/--uy while rotating a solo tile
    let id = null, prev = 0, baseRot = 0, acc = 0, raf = null, prevOrigin = '';

    const angleAt = (e, pivot) => {
      return Math.atan2(e.clientY - pivot.y, e.clientX - pivot.x) * 180 / Math.PI;
    };

    function down(e) {
      // If part of any coupling, rotation is disabled entirely
      if (membersOf(el).size > 1) { e.preventDefault(); e.stopPropagation(); return; }
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();

      id = e.pointerId;
      acc = 0;
      baseRot = getStyleNum(el, '--rot');

      // pivot = this card's center (read once on pointerdown)
      const r = el.getBoundingClientRect();
      const pivot = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      prev = angleAt(e, pivot);

      // tighten rotation math; mark state
      el.classList.add('rotating');
      el.dataset.didDrag = '1';
      setTimeout(() => { delete el.dataset.didDrag; }, 120);

      // rotate about true center for stability
      prevOrigin = el.style.transformOrigin;
      el.style.transformOrigin = '50% 50%';

      // stash pivot on the knob for move handler
      knob.__pivot = pivot;
      knob.setPointerCapture?.(id);
    }

    function move(e) {
      if (id === null || e.pointerId !== id) return;
      // normalize delta to avoid ±180° flips
      const pivot = knob.__pivot || { x: 0, y: 0 };
      let d = angleAt(e, pivot) - prev;
      if (d > 180) d -= 360; else if (d < -180) d += 360;
      prev += d; acc += d;

      if (!raf) {
        raf = requestAnimationFrame(() => {
          el.style.setProperty('--rot', `${baseRot + acc}deg`);
          raf = null;
        });
      }
    }

    function up(e) {
      if (id === null || e.pointerId !== id) return;
      knob.releasePointerCapture?.(id);
      id = null;
      el.classList.remove('rotating');
      // restore origin so layout returns to normal
      el.style.transformOrigin = prevOrigin;
      try { trySnap(el); } catch (_) { }
      triggerSolveDoubleCheck();
    }

    knob.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    knob.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); });
  }
  document.querySelectorAll('.polaroid').forEach(addRotor);

  // flip button (bottom-left)
  function addFlipper(el) {
    // Create once, then delegate behavior to updateFlipper (so we can swap flip ⇄ / de‑snap ⎌).
    let b = el.querySelector('.flipper');
    if (!b) { b = document.createElement('button'); b.type = 'button'; b.className = 'flipper'; el.appendChild(b); }
    updateFlipper(el);
  }
  document.querySelectorAll('.polaroid').forEach(addFlipper);

  // Bring hovered/focused/touched card to front
  document.querySelectorAll('.polaroid').forEach(el => {
    const raise = () => { zCounter += 1; el.style.zIndex = String(zCounter); };
    el.addEventListener('mouseenter', raise);
    el.addEventListener('focusin', raise);
    el.addEventListener('touchstart', raise, { passive: true });
  });

  // Drag & drop (restore)
  function makeDraggable(el) {
    let id = null, sx = 0, sy = 0, moved = false, raf = null, lastDX = 0, lastDY = 0;
    const num = v => parseFloat(String(v).replace('px', '')) || 0;
    let baseMap = null; // Map<HTMLElement,{ux,uy}>

    function down(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return; // left click only
      id = e.pointerId; sx = e.clientX; sy = e.clientY; moved = false;

      // Build per-member baselines so the whole snapped group drags rigidly
      const group = membersOf(el);
      baseMap = new Map();
      group.forEach(n => {
        const cs = getComputedStyle(n);
        baseMap.set(n, {
          ux: num(cs.getPropertyValue('--ux')),
          uy: num(cs.getPropertyValue('--uy'))
        });
        // raise the entire group to front and mark dragging
        zCounter += 1; n.style.zIndex = String(zCounter);
        n.classList.add('dragging');
      });

      el.setPointerCapture?.(id);
    }

    function move(e) {
      if (id === null || e.pointerId !== id) return;
      if (e.pointerType === 'mouse' && e.buttons === 0) return; // ignore stray moves
      lastDX = e.clientX - sx; lastDY = e.clientY - sy;
      if (!moved && (Math.abs(lastDX) > 3 || Math.abs(lastDY) > 3)) moved = true;

      if (!raf) {
        raf = requestAnimationFrame(() => {
          if (!baseMap) { raf = null; return; }
          baseMap.forEach((b, n) => {
            n.style.setProperty('--ux', `${b.ux + lastDX}px`);
            n.style.setProperty('--uy', `${b.uy + lastDY}px`);
          });
          raf = null;
        });
      }
    }

    function up(e) {
      if (id === null || e.pointerId !== id) return;
      // clear dragging state on whole group and suppress click-to-zoom right after drag
      if (baseMap) {
        baseMap.forEach((_, n) => {
          n.classList.remove('dragging');
          if (moved) { n.dataset.didDrag = '1'; setTimeout(() => { delete n.dataset.didDrag; }, 120); }
        });
      }
      el.releasePointerCapture?.(id);
      id = null; baseMap = null;
      try { trySnap(el); } catch (_) { }
      triggerSolveDoubleCheck();
    }

    el.addEventListener('pointerdown', down);
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
  }
  document.querySelectorAll('.polaroid').forEach(makeDraggable);

  // Initial scatter after layout
  scatter();
  // Track mode to re-scatter only when crossing breakpoint so mobile cluster recenters
  let __lastScatterMode = (window.innerWidth || document.documentElement.clientWidth) <= 560 ? 'mobile' : 'desktop';
  function responsiveRescatter() {
    const mode = (window.innerWidth || document.documentElement.clientWidth) <= 560 ? 'mobile' : 'desktop';
    if (mode === __lastScatterMode) return; // no breakpoint crossing
    // Re-scatter fresh for new mode (keeps user drag offsets if any by resetting ux/uy/rot deltas first)
    document.querySelectorAll('.polaroid').forEach(el => {
      // If user has moved pieces, preserve zIndex but reset offsets for clean cluster switch
      el.style.setProperty('--ux', '0px');
      el.style.setProperty('--uy', '0px');
      // keep rotation randomization to scatter() (we clear previous deltas)
    });
    scatter();
    __lastScatterMode = mode;
  }
  let __rszTimer = null;
  window.addEventListener('resize', () => {
    if (__rszTimer) clearTimeout(__rszTimer);
    __rszTimer = setTimeout(responsiveRescatter, 140); // debounce
  });

  // snapping logic ----------------------------------------------------------
  const SNAP = { ang: 8, frac: 0.12, gap: 0 };
  function trySnap(anchor) {
    if (anchor.dataset.flipped !== '1') return; // only when both are flipped

    const ra = getStyleNum(anchor, '--rot');
    const ar = anchor.getBoundingClientRect();
    const ax = ar.left + ar.width / 2, ay = ar.top + ar.height / 2;
    const aw0 = anchor.offsetWidth, ah0 = anchor.offsetHeight; // layout sizes for exact math

    const ca = Math.cos(ra * Math.PI / 180), sa = Math.sin(ra * Math.PI / 180);

    let snapped = false;
    const others = [...document.querySelectorAll('.polaroid')]
      .filter(o => o !== anchor && o.dataset.flipped === '1' && ensureGroup(o) !== ensureGroup(anchor));

    for (const o of others) {
      const rb = getStyleNum(o, '--rot');
      let dAng = wrap180(rb - ra);
      if (Math.abs(dAng) > SNAP.ang) continue;

      const br = o.getBoundingClientRect();
      const bx = br.left + br.width / 2, by = br.top + br.height / 2;
      const bw0 = o.offsetWidth, bh0 = o.offsetHeight;

      // Relative position of B in A's local frame
      const dxw = bx - ax, dyw = by - ay;
      let dx = dxw * ca + dyw * sa;
      let dy = -dxw * sa + dyw * ca;

      const horizontal = Math.abs(dx) >= Math.abs(dy);
      const idealDX = horizontal ? Math.sign(dx) * ((aw0 + bw0) / 2 - SNAP.gap) : 0;
      const idealDY = horizontal ? 0 : Math.sign(dy) * ((ah0 + bh0) / 2 - SNAP.gap);

      const tolX = SNAP.frac * ((aw0 + bw0) / 2);
      const tolY = SNAP.frac * ((ah0 + bh0) / 2);

      const ex0 = idealDX - dx;
      const ey0 = idealDY - dy;
      if (Math.abs(ex0) > tolX || Math.abs(ey0) > tolY) continue;

      // Build sets for no-anim block
      const setA = membersOf(anchor);
      const setB = membersOf(o);
      const both = new Set([...setA, ...setB]);

      // Rigid-body seat: rotate entire incoming group B about its own pivot, then translate so tile o is flush
      withoutAnim(both, () => {
        // target center for o in world coords when flush
        const targetX = ax + (idealDX * ca - idealDY * sa);
        const targetY = ay + (idealDX * sa + idealDY * ca);

        // rotation delta needed to align B with A
        const dAng2 = wrap180(ra - rb);
        const rad = dAng2 * Math.PI / 180;
        const cosA = Math.cos(rad), sinA = Math.sin(rad);

        // pivot = bounding-box center of group B (stable under layout)
        let minL = Infinity, minT = Infinity, maxR = -Infinity, maxB = -Infinity;
        setB.forEach(n => { const r = n.getBoundingClientRect(); minL = Math.min(minL, r.left); minT = Math.min(minT, r.top); maxR = Math.max(maxR, r.right); maxB = Math.max(maxB, r.bottom); });
        const pivotX = (minL + maxR) / 2, pivotY = (minT + maxB) / 2;

        // o's rotated center (about pivot), then translation needed to hit target
        const obr = o.getBoundingClientRect();
        const ocx = obr.left + obr.width / 2, ocy = obr.top + obr.height / 2;
        const orx = pivotX + ((ocx - pivotX) * cosA - (ocy - pivotY) * sinA);
        const ory = pivotY + ((ocx - pivotX) * sinA + (ocy - pivotY) * cosA);
        const tX = Math.round(targetX - orx);
        const tY = Math.round(targetY - ory);

        // apply rigid transform to every member of B
        setB.forEach(n => {
          const r = n.getBoundingClientRect();
          const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
          const rx = pivotX + ((cx - pivotX) * cosA - (cy - pivotY) * sinA);
          const ry = pivotY + ((cx - pivotX) * sinA + (cy - pivotY) * cosA);
          const deltaX = (rx + tX) - cx;
          const deltaY = (ry + tY) - cy;
          const ux = getStyleNum(n, '--ux'), uy = getStyleNum(n, '--uy'), rot = getStyleNum(n, '--rot');
          n.style.setProperty('--ux', `${ux + deltaX}px`);
          n.style.setProperty('--uy', `${uy + deltaY}px`);
          n.style.setProperty('--rot', `${rot + dAng2}deg`);
        });
      });

      mergeGroups(anchor, o);
      snapped = true;
    }

    if (snapped) { membersOf(anchor).forEach(n => { updateFlipper(n); updateRotor(n); }); }
  }

  // assign puzzle backs (3x3 slices) — upright orientation, true shuffle
  function assignPuzzleBacks(imgPath = 'assets/images/hidden_messages/hiddenMessage.png') {
    const cards = Array.from(document.querySelectorAll('.polaroid')).slice(0, 9);
    if (cards.length < 9) return;
    const coords = shuffle(Array.from({ length: 9 }, (_, k) => ({ r: Math.floor(k / 3), c: k % 3 })));
    cards.forEach((card, i) => {
      const backFace = card.querySelector('.face.back'); if (!backFace) return;
      const old = backFace.querySelector('img'); if (old) old.style.display = 'none';
      let ink = backFace.querySelector('.ink'); if (!ink) { ink = document.createElement('div'); ink.className = 'ink'; backFace.appendChild(ink); }
      Object.assign(ink.style, { position: 'absolute', inset: '0', backgroundImage: `url('${imgPath}')`, backgroundRepeat: 'no-repeat', backgroundSize: '300% 300%', transformOrigin: '50% 50%' });
      const { r, c } = coords[i];
      ink.style.backgroundPosition = `${c * 50}% ${r * 50}%`;
      // Keep all slices upright so the final image has a single, consistent orientation
      ink.style.transform = 'rotate(0deg)'; // randomize back segment orientation (0°/180°)
      backFace.dataset.gridR = String(r); backFace.dataset.gridC = String(c);
      card.dataset.gridR = String(r); card.dataset.gridC = String(c);
    });
  }
  assignPuzzleBacks('assets/images/hidden_messages/hiddenMessage.png');

  // lightbox (fronts only)
  const lb = document.getElementById('lightbox'), lbImg = document.getElementById('lightboxImg');
  const lbClose = document.querySelector('.lightbox-close'), lbPrev = document.querySelector('.lightbox-arrow.prev'), lbNext = document.querySelector('.lightbox-arrow.next');
  const cards = [...document.querySelectorAll('.polaroid')];
  const gallery = [...document.querySelectorAll('.polaroid .face.front img')];
  let current = -1, lastFocus = null;
  function openAt(i) {
    current = (i + gallery.length) % gallery.length;
    if (!lb || !lbImg) return;
    lbImg.src = gallery[current]?.src || '';
    lb.classList.add('open');
    lastFocus = document.activeElement;
    document.body.style.overflow = 'hidden';
    (lbClose || lbImg)?.focus?.();
  }
  function close() {
    if (!lb || !lbImg) return;
    lb.classList.remove('open');
    lbImg.src = '';
    document.body.style.overflow = '';
    (lastFocus || document.body)?.focus?.();
  }
  function next(n) {
    if (!gallery.length) return;
    current = (current + n + gallery.length) % gallery.length;
    if (lbImg) lbImg.src = gallery[current]?.src || '';
  }
  cards.forEach((card, i) => {
    card.addEventListener('click', (ev) => {
      // Block lightbox when using controls, when on back, or immediately after drag/rotate
      if (ev.target.closest('.flipper, .rotor')) return;
      if (card.dataset.flipped === '1') return;
      if (card.dataset.didDrag) return;
      if (card.classList.contains('dragging') || card.classList.contains('rotating')) return;
      openAt(i);
    });
    card.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && card.dataset.flipped !== '1') {
        e.preventDefault();
        openAt(i);
      }
    });
  });

  lb && lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
  lbClose && lbClose.addEventListener('click', close);
  lbPrev && lbPrev.addEventListener('click', () => next(-1));
  lbNext && lbNext.addEventListener('click', () => next(1));

  // ---------------- Super-lenient solver with periodic check ----------------
  const TOL = {
    // playably-lenient (one tile can be a hair out)
    rotDeg: 12,      // rotation tolerance (±deg) around axial mean
    rms: 0.20,       // overall fit tolerance
    scale: 0.14,     // axis scale mismatch
    minSpacing: 22,  // ensure it forms a real grid
    okCount: 8,      // allow 1 tile slightly out of its window
    windowFrac: 0.40 // slightly larger per-tile windows
  };
  let solved = false, checking = false;
  function axialMeanDeg(deg) { let sx = 0, sy = 0; for (const d of deg) { const r = (d * 2) * Math.PI / 180; sx += Math.cos(r); sy += Math.sin(r); } return 0.5 * Math.atan2(sy, sx) * 180 / Math.PI; }

  function checkSolved() {
    const DBG = !!window.PUZZLE_DEBUG;
    const fail = (reason, extra) => {
      window.PUZZLE_LAST_FAIL = { ts: Date.now(), reason, ...(extra || {}) };
      if (DBG) {
        // eslint-disable-next-line no-console
        console.debug('[puzzle][fail]', reason, extra || '');
        if (extra && extra.badTiles) {
          extra.badTiles.forEach(t => { t.style.outline = '2px solid #d22'; setTimeout(() => { t.style.outline = ''; }, 1200); });
        }
      }
      return false;
    };

    const nine = [...document.querySelectorAll('.polaroid')].slice(0, 9);
    if (nine.length !== 9) return fail('not-enough-tiles', { count: nine.length });
    if (!nine.every(n => n.dataset.flipped === '1')) { setSolved(false); return fail('not-all-flipped', { flipped: nine.map(n => n.dataset.flipped) }); }

    // All 9 must be in a single snapped group
    const gid = nine[0].dataset.group;
    const gset = gid ? groups.get(gid) : null;
    if (!gid || !gset || !nine.every(n => n.dataset.group === gid) || gset.size < 9) { setSolved(false); return fail('not-single-group', { gid, gsetSize: gset ? gset.size : 0, perGroup: nine.map(n => n.dataset.group) }); }

    // Work in the puzzle's local frame (so global rotation doesn't matter)
    const rots = nine.map(n => parseFloat(getComputedStyle(n).getPropertyValue('--rot')) || 0);
    const rAvg = axialMeanDeg(rots); // average rotation of the snapped block

    // centers in screen coords
    const pts = nine.map(n => { const r = n.getBoundingClientRect(); return { n, cx: r.left + r.width / 2, cy: r.top + r.height / 2, rI: +(n.dataset.gridR || 0), cI: +(n.dataset.gridC || 0) }; });
    const mx = mean(pts.map(p => p.cx)), my = mean(pts.map(p => p.cy));
    const ang = -rAvg * Math.PI / 180, ca = Math.cos(ang), sa = Math.sin(ang);
    pts.forEach(p => { const dx = p.cx - mx, dy = p.cy - my; p.xn = dx * ca - dy * sa; p.yn = dx * sa + dy * ca; });

    // Adaptive clustering: derive spacing and allow slightly larger tolerance; then merge to exactly 3 centers if needed.
    const cluster = (vals, eps) => { const s = [...vals].sort((a, b) => a - b); const reps = [], cnt = []; for (const v of s) { if (!reps.length || Math.abs(v - reps[reps.length - 1]) > eps) { reps.push(v); cnt.push(1); } else { const i = reps.length - 1; reps[i] = (reps[i] * cnt[i] + v) / (cnt[i] + 1); cnt[i]++; } } return reps; };
    const nearestIndex = (v, reps, eps) => { let best = -1, bd = Infinity; for (let i = 0; i < reps.length; i++) { const d = Math.abs(v - reps[i]); if (d < bd) { bd = d; best = i; } } return (bd <= eps) ? best : -1; };
    const xsRaw = pts.map(p => p.xn), ysRaw = pts.map(p => p.yn);
    function median(a) { const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
    function medianSpacing(sortedVals) { const diffs = []; for (let i = 1; i < sortedVals.length; i++) { const d = sortedVals[i] - sortedVals[i - 1]; if (d > 4) diffs.push(d); } diffs.sort((a, b) => a - b); const m = Math.floor(diffs.length / 2); return diffs.length ? diffs[m] : 0; }
    const xsSorted = [...xsRaw].sort((a, b) => a - b), ysSorted = [...ysRaw].sort((a, b) => a - b);
    const dxMed = medianSpacing(xsSorted) || (xsSorted[xsSorted.length - 1] - xsSorted[0]) / 2 || 100;
    const dyMed = medianSpacing(ysSorted) || (ysSorted[ysSorted.length - 1] - ysSorted[0]) / 2 || 100;
    // eps scaled to spacing; clamp reasonable bounds
    const epsX = Math.min(Math.max(dxMed * 0.22, 6), 48);
    const epsY = Math.min(Math.max(dyMed * 0.22, 6), 48);
    let colReps = cluster(xsRaw, epsX);
    let rowReps = cluster(ysRaw, epsY);
    // If we got more than 3 reps, iteratively merge closest until 3.
    function reduceToThree(reps) { reps = [...reps].sort((a, b) => a - b); while (reps.length > 3) { let bi = 0, bg = Infinity; for (let i = 1; i < reps.length; i++) { const g = reps[i] - reps[i - 1]; if (g < bg) { bg = g; bi = i; } } const merged = (reps[bi] + reps[bi - 1]) / 2; reps.splice(bi - 1, 2, merged); } return reps; }
    if (colReps.length > 3) colReps = reduceToThree(colReps);
    if (rowReps.length > 3) rowReps = reduceToThree(rowReps);
    if (rowReps.length !== 3 || colReps.length !== 3) { setSolved(false); return fail('cluster-mismatch', { rowReps, colReps, epsX, epsY, dxMed, dyMed }); }

    // Check each tile maps to its assigned (r,c)
    let bad = [];
    for (const p of pts) {
      const rr = nearestIndex(p.yn, rowReps, epsY);
      const cc = nearestIndex(p.xn, colReps, epsX);
      if (rr < 0 || cc < 0) { bad.push(p.n); continue; }
      if (p.rI !== rr || p.cI !== cc) { bad.push(p.n); }
    }
    if (bad.length) { setSolved(false); return fail('tile-mismatch', { badTiles: bad, tiles: pts.map(p => ({ id: p.n.id, rI: p.rI, cI: p.cI, xn: Math.round(p.xn), yn: Math.round(p.yn) })) }); }

    // Orientation gate (lightweight): ensure no tile is ~180° inverted relative to the group's mean orientation.
    // We purposefully do this AFTER grid validation so we don't block snapping or grouping.
    const norm = d => { d = ((d % 360) + 360) % 360; if (d > 180) d -= 360; return d; }; // [-180,180)
    const raw = rots.map(norm);
    // First-order circular mean (NOT axial) so a lone 180° outlier is detected.
    let sx = 0, sy = 0; raw.forEach(r => { const rad = r * Math.PI / 180; sx += Math.cos(rad); sy += Math.sin(rad); });
    const meanDir = Math.atan2(sy, sx) * 180 / Math.PI;
    const diff = (a, b) => { let d = a - b; while (d > 180) d -= 360; while (d < -180) d += 360; return d; };
    let inverted = false;
    for (const r of raw) { const delta = Math.abs(diff(r, meanDir)); if (delta > 120) { inverted = true; break; } }
    if (inverted) { setSolved(false); return fail('orientation-inverted', { meanDir: Math.round(meanDir * 10) / 10, rots: raw.map(r => Math.round(r * 10) / 10) }); }

    if (DBG) { console.debug('[puzzle][solved]', { rotations: raw.map(r => Math.round(r * 10) / 10) }); }
    window.PUZZLE_LAST_FAIL = null;
    setSolved(true); return true;
  }

  // Public debug helpers (no-op unless enabled)
  if (!window.dumpPuzzleState) {
    window.dumpPuzzleState = () => {
      const nine = [...document.querySelectorAll('.polaroid')].slice(0, 9);
      const data = nine.map(n => {
        const cs = getComputedStyle(n);
        return {
          id: n.id || null,
          flipped: n.dataset.flipped,
          group: n.dataset.group,
          rot: parseFloat(cs.getPropertyValue('--rot')) || 0,
          ux: cs.getPropertyValue('--ux'),
          uy: cs.getPropertyValue('--uy'),
          gridR: n.dataset.gridR, gridC: n.dataset.gridC
        };
      });
      // eslint-disable-next-line no-console
      console.table(data);
      return data;
    };
  }
  if (!window.forcePuzzleCheck) {
    window.forcePuzzleCheck = () => { const ok = checkSolved(); console.debug('[puzzle][forceCheck]', { ok, lastFail: window.PUZZLE_LAST_FAIL }); return ok; };
  }

  function checkSolvedSoon() { if (checking) return; checking = true; setTimeout(() => { checking = false; checkSolved(); }, 80); }
  window.PUZZLE_LAST_CHECKS = window.PUZZLE_LAST_CHECKS || [];
  function checkSolvedSoon() {
    if (checking) return;
    const t0 = Date.now();
    checking = true;
    setTimeout(() => {
      checking = false;
      const ok = checkSolved();
      window.PUZZLE_LAST_CHECKS.push({ t: t0, ran: Date.now(), ok });
      if (window.PUZZLE_DEBUG) console.debug('[puzzle][autoCheck]', { ok, queuedAt: t0 });
    }, 80);
  }
  function triggerSolveDoubleCheck() {
    checkSolvedSoon();
    setTimeout(() => {
      const ok = checkSolved();
      window.PUZZLE_LAST_CHECKS.push({ t: Date.now(), ran: Date.now(), ok, forced: true });
      if (window.PUZZLE_DEBUG) console.debug('[puzzle][doubleCheck]', { ok });
    }, 170);
  }

  // Stop all audio on the site (YT, <audio>/<video>)
  function stopAllSiteAudio() {
    try {
      document.querySelectorAll('iframe[src*="youtube.com/embed"], iframe[src*="youtube-nocookie.com/embed"]').forEach(f => {
        try { f.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: '' }), '*'); } catch (_) { }
      });
    } catch (_) { }
    try {
      document.querySelectorAll('audio, video').forEach(m => { try { m.pause(); } catch (_) { } });
    } catch (_) { }
  }

  // === NEW: Fullscreen modal that hosts the mixer page as an iframe ===
  function openMixerModal() {
    // Remove any existing instance
    const existing = document.getElementById('mixerModal');
    if (existing) existing.remove();

    // stop any site audio before opening the mixer
    try { stopAllSiteAudio(); } catch (_) { }

    // Overlay: semi‑transparent dark with slight blur
    const overlay = document.createElement('div');
    overlay.id = 'mixerModal';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Stem Mixer');
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'display:block',
      'overflow:hidden',
      'background:rgba(0,0,0,.72)',
      'backdrop-filter:blur(3px)',
      'z-index:2147483647',
      'opacity:1',
      'transition:opacity .25s ease',
      'overscroll-behavior:none'
    ].join(';');

    // Full‑viewport container (no internal scrollbars)
    const box = document.createElement('div');
    box.style.cssText = [
      'position:relative',
      'width:100vw',
      'height:100dvh',
      'max-width:100vw',
      'max-height:100dvh',
      'border:0',
      'border-radius:0',
      'overflow:hidden',
      'background:transparent', 'padding-top: env(safe-area-inset-top, 0px)', 'padding-bottom: env(safe-area-inset-bottom, 0px)'].join(';');

    // Close button — larger and near the console
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close mixer');
    closeBtn.style.cssText = [
      'position:absolute', 'top:calc(env(safe-area-inset-top, 0px) + 6px)', 'right:8px',
      'z-index:2',
      'background:rgba(0,0,0,.55)',
      'border:1px solid #2a3246',
      'color:#e7eaf3',
      'padding:10px 12px',
      'border-radius:12px',
      'font-size:28px',
      'line-height:1',
      'cursor:pointer',
      'box-shadow:0 4px 12px rgba(0,0,0,.35)',
      'transition:transform .12s ease, opacity .12s ease'
    ].join(';');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('mouseenter', () => { closeBtn.style.transform = 'scale(1.06)'; });
    closeBtn.addEventListener('mouseleave', () => { closeBtn.style.transform = ''; });

    // Iframe hosting the console page — keep it OPAQUE (dark) so only the overlay is translucent
    const frame = document.createElement('iframe');
    frame.src = 'theseAreNotTheTracksYoureLookingFor.html';
    frame.title = 'Band of Echoes — Stem Mixer';
    frame.loading = 'eager';
    frame.allow = 'autoplay *; clipboard-read; clipboard-write';
    frame.style.cssText = [
      'position:absolute',
      'inset:0',
      'display:block',
      'width:100%',
      'height:100%',
      'border:0',
      'background:#0b0d12' // opaque, prevents white bleed-through
    ].join(';');

    // Hide scrollbars inside the iframe (same‑origin) without touching backgrounds
    frame.addEventListener('load', () => {
      try {
        const d = frame.contentDocument || frame.contentWindow?.document;
        if (!d) return;
        d.documentElement.classList.add('mixer-iframe-style');
      } catch (_) { /* ignore if cross‑origin */ }
    });

    box.appendChild(closeBtn);
    box.appendChild(frame);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    // Fit the inner box to the *visual* viewport on mobile (iOS URL bar shrink/expand)
    const fitBox = () => {
      const vv = window.visualViewport;
      const h = (vv?.height || window.innerHeight);
      const w = (vv?.width || window.innerWidth);
      box.style.height = h + 'px';
      box.style.width = w + 'px';
    };
    fitBox();
    window.addEventListener('resize', fitBox);
    try { window.visualViewport && window.visualViewport.addEventListener('resize', fitBox); } catch (_) { }

    // Close handlers with fade‑out
    const prevFocus = document.activeElement;
    let closing = false;
    function finishClose() {
      try { window.removeEventListener('resize', fitBox); } catch (_) { }
      try { window.visualViewport && window.visualViewport.removeEventListener('resize', fitBox); } catch (_) { }
      overlay.remove();
      document.body.style.overflow = '';
      (prevFocus || document.body)?.focus?.();
      document.removeEventListener('keydown', onKey);
    }
    function dismiss() {
      if (closing) return; closing = true;
      overlay.style.opacity = '0';
      const tid = setTimeout(finishClose, 300);
      overlay.addEventListener('transitionend', (e) => {
        if (e.propertyName === 'opacity') { clearTimeout(tid); finishClose(); }
      }, { once: true });
    }
    function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); dismiss(); } }

    overlay.addEventListener('click', (e) => { if (e.target === overlay) dismiss(); });
    closeBtn.addEventListener('click', dismiss);
    document.addEventListener('keydown', onKey);

    // No fade-in: show immediately
    document.body.style.overflow = 'hidden';
    closeBtn.focus();
  }

  function setSolved(v) {
    if (v === solved) return; solved = v;
    document.body.classList.toggle('puzzle-solved', v);

    // clear any pending timers from previous solves
    if (!window.__solveTimers) window.__solveTimers = [];
    window.__solveTimers.forEach(t => clearTimeout(t));
    window.__solveTimers = [];

    if (!v) { return; }

    // Helper to apply/remove a brief glow to all nine tiles (final coupling)
    const cards9 = Array.from(document.querySelectorAll('.polaroid')).slice(0, 9);
    const applyGlow = (on) => {
      cards9.forEach(c => {
        if (on) {
          // remember previous inline styles to restore
          if (!c.dataset._prevShadow) c.dataset._prevShadow = c.style.boxShadow || '';
          if (!c.dataset._prevFilter) c.dataset._prevFilter = c.style.filter || '';
          c.style.boxShadow = '0 14px 36px rgba(0,0,0,.45), 0 0 0 3px rgba(212,175,55,.9), 0 0 36px rgba(212,175,55,.55)';
          c.style.filter = 'brightness(1.06)';
        } else {
          c.style.boxShadow = c.dataset._prevShadow || '';
          c.style.filter = c.dataset._prevFilter || '';
          delete c.dataset._prevShadow; delete c.dataset._prevFilter;
        }
      });
    };

    // Build the overlay modal (hidden initially for fade‑in)
    const buildModal = () => {
      const old = document.getElementById('puzzleModal');
      if (old) old.remove();

      // Phrase pool (extendable). Expose globally once for easy tweaking in console.
      if (!window.PUZZLE_SOLVE_PHRASES) {
        window.PUZZLE_SOLVE_PHRASES = [
          'Look at you, skulking behind that screen of yours',
          'Puzzled? Sure. Amused? Hardly.',
          'My name is Chappie Johnson and I can\'t open this damn pickle jar'
        ];
      }
      const phraseList = window.PUZZLE_SOLVE_PHRASES;
      const solvePhrase = phraseList[Math.floor(Math.random() * phraseList.length)] || 'You found something';

      const overlay = document.createElement('div');
      overlay.id = 'puzzleModal';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;z-index:2147483647;opacity:0;transition:opacity 1.5s ease;';

      const box = document.createElement('div');
      box.style.cssText = 'position:relative;background:#0f0f0f;border:1px solid #333;color:#fff;padding:22px;border-radius:14px;box-shadow:0 20px 80px rgba(0,0,0,.7);width:min(480px,calc(100vw - 32px));text-align:center;';
      box.innerHTML = `
        <button id="pmClose" aria-label="Close" style="position:absolute;top:8px;right:8px;background:transparent;border:0;color:#bbb;font-size:22px;line-height:1;cursor:pointer">×</button>
        <h3 id="pmPhrase" style="margin:0 0 12px;font:600 20px/1.3 system-ui"></h3>
        <div style="display:flex;gap:18px;margin-top:10px;flex-wrap:wrap;justify-content:center;align-items:center">
          <a id="pmCMND" href="https://youtube.com/shorts/hkYhlXNTsJQ?feature=share" target="_blank" rel="noopener" style="text-decoration:none;padding:10px 14px;border-radius:10px;background:#e7e7e7;color:#111;font-weight:700">WITNESS</a>
          <a id="pmCNTRL" href="theseAreNotTheTracksYoureLookingFor.html" style="text-decoration:none;padding:10px 14px;border-radius:10px;background:#1b1b1b;color:#e7e7e7;font-weight:700;border:1px solid #333">REJECT</a>
       </div>`;
      const phraseEl = box.querySelector('#pmPhrase');
      if (phraseEl) phraseEl.textContent = solvePhrase;

      overlay.appendChild(box);
      document.body.appendChild(overlay);

      // Install hover/glow styles for modal buttons (only once)
      // Modal button hover/glow styles are now in app-dynamic.css

      const dismiss = () => { overlay.remove(); window.__doSolveResetOnce?.(); };
      box.querySelector('#pmClose').addEventListener('click', dismiss);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) dismiss(); });
      const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); dismiss(); document.removeEventListener('keydown', onKey); } };
      document.addEventListener('keydown', onKey);

      const linkCMND = box.querySelector('#pmCMND');
      const linkCNTRL = box.querySelector('#pmCNTRL');

      // WITNESS: keep opening in new tab and reset once
      if (linkCMND) {
        linkCMND.setAttribute('target', '_blank');
        linkCMND.setAttribute('rel', 'noopener');
        linkCMND.addEventListener('click', () => { try { stopAllSiteAudio(); } catch (_) { } overlay.remove(); window.__doSolveResetOnce?.(); });
      }

      // === CHANGED: REJECT now opens the mixer in a modal instead of a new tab ===
      if (linkCNTRL) {
        linkCNTRL.removeAttribute('target');
        linkCNTRL.removeAttribute('rel');
        linkCNTRL.addEventListener('click', (ev) => {
          ev.preventDefault();
          try { stopAllSiteAudio(); } catch (_) { }
          overlay.remove();
          window.__doSolveResetOnce?.();
          openMixerModal();
        });
      }

      // fade in the overlay (force reflow, then next frame for reliable transition)
      overlay.style.opacity = '0';
      void overlay.offsetWidth; // reflow so the transition is honored
      requestAnimationFrame(() => { requestAnimationFrame(() => { overlay.style.opacity = '1'; }); });
    };

    // Sequence: glow 1s → begin 5s fade of solved grid → show modal at 1.2s (overlaps)
    // A single reset function ensures we only reset/scatter once.
    window.__didAutoReset = false;
    function doResetOnce() {
      if (window.__didAutoReset) return;
      window.__didAutoReset = true;
      // cancel any pending timers
      if (window.__solveTimers) { window.__solveTimers.forEach(t => clearTimeout(t)); window.__solveTimers = []; }
      // Reset groups & cards, then scatter; keep a quick fade-in for polish
      groups.clear(); groupSeq = 1;
      cards9.forEach(c => {
        c.classList.remove('dragging', 'rotating');
        c.dataset.group = ''; ensureGroup(c);
        c.dataset.flipped = '0'; delete c.dataset.didDrag;
        c.style.setProperty('--ux', '0px'); c.style.setProperty('--uy', '0px'); c.style.setProperty('--rot', '0deg');
        c.style.transition = ''; // clear custom fades
        c.style.opacity = '0';
        updateFlipper(c); updateRotor(c);
      });
      scatter();
      requestAnimationFrame(() => { cards9.forEach(c => { c.style.transition = 'opacity .45s ease'; c.style.opacity = '1'; setTimeout(() => { c.style.transition = ''; }, 500); }); });
    }
    // Expose so modal handlers can trigger the same reset
    window.__doSolveResetOnce = doResetOnce;

    applyGlow(true);
    // stop glow after 1s
    const t1 = setTimeout(() => { applyGlow(false); }, 1000);
    // start long fade of solved grid right after glow ends
    const t3 = setTimeout(() => {
      cards9.forEach(c => { c.style.transition = 'opacity 5s ease'; c.style.opacity = '0'; });
      const t4 = setTimeout(() => { doResetOnce(); }, 5000);
      window.__solveTimers.push(t4);
    }, 1000);
    // show modal slightly after glow begins to fade
    const t2 = setTimeout(() => { buildModal(); }, 1200);
    window.__solveTimers.push(t1, t2, t3);
  }

  // Helper used by modal dismiss AND by back/forward restore
  function resetAfterSolveWithFade() {
    // Clear state flag so we don't think it's still solved
    document.body.classList.remove('puzzle-solved');
    // Remove any stray modal
    const modal = document.getElementById('puzzleModal');
    if (modal) modal.remove();

    // Fade out current 3x3 backs (if present), then reset and re-scatter
    const cards9 = Array.from(document.querySelectorAll('.polaroid')).slice(0, 9);
    cards9.forEach(c => { c.style.transition = 'opacity .45s ease'; c.style.opacity = '0'; });
    setTimeout(() => {
      groups.clear(); groupSeq = 1;
      cards9.forEach(c => {
        c.classList.remove('dragging', 'rotating');
        c.dataset.group = ''; ensureGroup(c);
        c.dataset.flipped = '0'; delete c.dataset.didDrag;
        c.style.setProperty('--ux', '0px'); c.style.setProperty('--uy', '0px'); c.style.setProperty('--rot', '0deg');
        updateFlipper(c); updateRotor(c);
      });
      scatter();
      requestAnimationFrame(() => { cards9.forEach(c => { c.style.opacity = '1'; setTimeout(() => { c.style.transition = ''; }, 500); }); });
    }, 460);
  }
})();

// === Orientation Guard (portrait-only UX on small screens) ===
// Lightweight, avoids screen.orientation.lock (not reliable on iOS Safari)
// Shows the .rotate-lock-overlay when in landscape under ~900px edge.
(function () {
  function initOrientationGuard() {
    const body = document.body;
    if (!body) return;
    body.classList.add('portrait-only');
    const overlay = document.querySelector('.rotate-lock-overlay');
    if (!overlay) return;
    function isLandscape() {
      // dual strategy: media query OR width>height heuristic
      return window.matchMedia('(orientation: landscape)').matches || window.innerWidth > window.innerHeight;
    }
    function update() {
      const withinScope = window.innerWidth <= 900 || window.innerHeight <= 900;
      const show = isLandscape() && withinScope;
      overlay.style.display = show ? 'flex' : 'none';
      overlay.setAttribute('aria-hidden', show ? 'false' : 'true');
      body.classList.toggle('orientation-blocked', show);
      // Lock scrolling behind overlay
      if (show) {
        if (!body.dataset.prevOverflow) body.dataset.prevOverflow = body.style.overflow;
        body.style.overflow = 'hidden';
      } else if (body.dataset.prevOverflow !== undefined) {
        body.style.overflow = body.dataset.prevOverflow;
        delete body.dataset.prevOverflow;
      }
    }
    ['resize', 'orientationchange'].forEach(ev => window.addEventListener(ev, update, { passive: true }));
    setTimeout(update, 0);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOrientationGuard);
  } else {
    initOrientationGuard();
  }
})();