// Collage + Puzzle module extracted from app.js
(function () {
    // Detect coarse touch devices (mobile/tablet) to persist controls after tap
    const IS_COARSE_TOUCH = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    let __lastTouchControlsEl = null;
    function setTouchControlsTarget(el) {
        if (!IS_COARSE_TOUCH) return;
        if (el === __lastTouchControlsEl) return;
        if (__lastTouchControlsEl) __lastTouchControlsEl.classList.remove('touch-show-controls');
        if (el) el.classList.add('touch-show-controls');
        __lastTouchControlsEl = el || null;
    }
    const ROT_DIST = { uprightBias: 0.78, uprightSpread: 55, invertedSpread: 26 };
    const GROUP_ROTOR_OFFSET = 12; // px inward from the top-right corner
    const wrap180full = a => ((a + 180) % 360 + 360) % 360 - 180;
    function biasedRotation() { const tri = () => (Math.random() + Math.random()) / 2; if (Math.random() < ROT_DIST.uprightBias) { const centered = (tri() * 2 - 1); return wrap180full(centered * ROT_DIST.uprightSpread); } else { const sign = Math.random() < 0.5 ? 1 : -1; const offset = (tri() * 2 - 1) * ROT_DIST.invertedSpread; return wrap180full(sign * 180 + offset); } }
    function preSeedRotations() { const touched = []; document.querySelectorAll('.polaroid').forEach(el => { if (el.dataset.seededRot) return; const prev = el.style.transition; el.style.transition = 'none'; const r = biasedRotation(); el.style.setProperty('--rot', r + 'deg'); el.dataset.seededRot = '1'; el.dataset._baseRot = r; touched.push([el, prev]); }); if (touched.length) { void document.body.offsetHeight; } touched.forEach(([el, prev]) => { el.style.transition = prev; }); }

    // Interaction guards
    const root = document.querySelector('.collage'); if (root) { root.addEventListener('contextmenu', e => { e.preventDefault(); }, { capture: true }); root.addEventListener('selectstart', e => { e.preventDefault(); }, { capture: true }); root.addEventListener('gesturestart', e => { e.preventDefault(); }); }
    document.querySelectorAll('.collage img').forEach(img => img.setAttribute('draggable', 'false'));

    const collage = document.querySelector('.collage'); let zCounter = 10000;
    function scatter() {
        if (!collage) return; const items = collage.querySelectorAll('.polaroid'); const vw = window.innerWidth || document.documentElement.clientWidth; const mobileMode = vw <= 560; let repW = 0, repH = 0; if (mobileMode) { const first = items[0]; if (first) { repW = first.offsetWidth || 200; repH = repW * 1.22; const targetH = Math.round(repH * 2.15); collage.style.position = 'relative'; collage.style.height = targetH + 'px'; } } else { if (collage.style.height) { collage.style.height = ''; collage.style.position = ''; } }
        items.forEach((el, i) => { const w = el.offsetWidth || repW || 300; const randomRot = biasedRotation; if (mobileMode) { if (el.style.position !== 'absolute') { el.style.position = 'absolute'; el.style.top = '0'; el.style.left = '0'; } const h = repH || (w * 1.22); const containerW = collage.clientWidth || (w * 3); const containerH = parseFloat(collage.style.height) || (h * 2.1); const cx = containerW / 2; const cy = containerH / 2; const spreadX = w * 1.15; const spreadY = h * 0.55; const tri = () => (Math.random() + Math.random() - 1); const rxLocal = tri() * spreadX; const ryLocal = tri() * spreadY; const rx = cx - w / 2 + rxLocal; const ry = cy - h / 2 + ryLocal; if (!el.dataset.seededRot) { const rot = randomRot(); el.style.setProperty('--rot', rot + 'deg'); el.dataset.seededRot = '1'; el.dataset._baseRot = rot; } el.style.setProperty('--tx', rx + 'px'); el.style.setProperty('--ty', ry + 'px'); } else { const maxX = Math.max(40, Math.min(220, w * 0.55)); const maxY = Math.max(14, Math.min(80, w * 0.20)); let rx = (Math.random() * 2 - 1) * maxX; if ((i % 5) === 4 && rx > 0) rx = Math.min(rx, maxX * 0.4); if (i >= 5) rx = Math.max(-maxX * 1.1, Math.min(maxX * 1.1, rx * 1.1)); const ry = Math.pow(Math.random(), 1.2) * maxY; if (!el.dataset.seededRot) { const rot = randomRot(); el.style.setProperty('--rot', rot + 'deg'); el.dataset.seededRot = '1'; el.dataset._baseRot = rot; } el.style.setProperty('--tx', rx + 'px'); el.style.setProperty('--ty', ry + 'px'); if (el.style.position === 'absolute' && !mobileMode) { el.style.position = ''; el.style.top = ''; el.style.left = ''; } } if (!el.style.zIndex) el.style.zIndex = String(10 + i); });
    }

    // Grouping & snapping + puzzle state
    let groupSeq = 1; const groups = new Map(); const newGroupId = () => 'g' + (groupSeq++);
    // Group-level rotors to rotate coupled groups around their dynamic center
    const groupRotors = new Map(); // gid -> { btn }
    let activeGroupRotation = null; // gid while a group-rotation gesture is active
    function groupBounds(gset) {
        let minL = Infinity, minT = Infinity, maxR = -Infinity, maxB = -Infinity;
        gset.forEach(n => { const r = n.getBoundingClientRect(); minL = Math.min(minL, r.left); minT = Math.min(minT, r.top); maxR = Math.max(maxR, r.right); maxB = Math.max(maxB, r.bottom); });
        return { minL, minT, maxR, maxB, cx: (minL + maxR) / 2, cy: (minT + maxB) / 2 };
    }
    function removeGroupRotor(gid) { const rec = groupRotors.get(gid); if (rec) { try { rec.cleanup?.(); } catch (_) { } rec.btn?.remove?.(); groupRotors.delete(gid); } }
    // Group rotation disabled: remove any rotor and do nothing else
    function placeGroupRotor(gid) { removeGroupRotor(gid); }
    function ensureGroupRotor(gid) { removeGroupRotor(gid); }
    function elevateGroup(gid) { const set = groups.get(gid); if (!set) return; set.forEach(n => { zCounter++; n.style.zIndex = String(zCounter); }); }
    function createGroupRotor(gid) { return { btn: null, cleanup() { } }; }
    function clearAllGroupRotors() { groupRotors.forEach((_, gid) => removeGroupRotor(gid)); }
    function placeAllGroupRotors() { /* group rotation disabled */ }
    // Side occupancy registry: prevent multiple snaps per side
    const sideLinks = new WeakMap();
    // Store links as { node: HTMLElement, side: 'left'|'right'|'top'|'bottom' }
    function getSides(el) {
        let s = sideLinks.get(el);
        if (!s) { s = { left: null, right: null, top: null, bottom: null }; sideLinks.set(el, s); }
        return s;
    }
    function opposite(side) { return side === 'left' ? 'right' : side === 'right' ? 'left' : side === 'top' ? 'bottom' : 'top'; }
    function linkSides(a, sideA, b, sideB) {
        const sa = getSides(a), sb = getSides(b);
        const bSide = sideB || opposite(sideA);
        sa[sideA] = { node: b, side: bSide };
        sb[bSide] = { node: a, side: sideA };
    }
    function resetSides(el) {
        // Force-clear any cached side state
        sideLinks.set(el, { left: null, right: null, top: null, bottom: null });
    }
    function unlinkAll(el) {
        const s = getSides(el);
        ['left', 'right', 'top', 'bottom'].forEach(dir => {
            const link = s[dir];
            if (link && link.node) {
                const ns = getSides(link.node);
                if (ns[link.side] && ns[link.side].node === el) ns[link.side] = null;
                s[dir] = null;
            }
        });
    }
    // After a change, split a group's members into edge-connected components using side links
    function splitDisconnectedGroup(gid) {
        const set = groups.get(gid);
        if (!set || set.size <= 1) return [gid];
        const nodes = Array.from(set);
        const inSet = new Set(nodes);
        const seen = new Set();
        const comps = [];
        function neighbors(node) {
            const s = getSides(node);
            const out = [];
            const dirs = ['left', 'right', 'top', 'bottom'];
            for (const d of dirs) {
                const ln = s[d];
                if (ln && ln.node && inSet.has(ln.node)) out.push(ln.node);
            }
            return out;
        }
        for (const n of nodes) {
            if (seen.has(n)) continue;
            const comp = new Set();
            const stack = [n];
            seen.add(n);
            while (stack.length) {
                const cur = stack.pop();
                comp.add(cur);
                for (const nb of neighbors(cur)) {
                    if (!seen.has(nb)) { seen.add(nb); stack.push(nb); }
                }
            }
            comps.push(comp);
        }
        if (comps.length <= 1) return [gid];
        // Assign components to groups: keep original gid for the largest component
        comps.sort((a, b) => b.size - a.size);
        const kept = comps[0];
        const newIds = [gid];
        // Update original group's members and set
        groups.set(gid, kept);
        kept.forEach(n => { n.dataset.group = gid; });
        // Create new groups for remaining components
        for (let i = 1; i < comps.length; i++) {
            const nid = newGroupId();
            newIds.push(nid);
            groups.set(nid, comps[i]);
            comps[i].forEach(n => { n.dataset.group = nid; updateFlipper(n); updateRotor(n); });
            ensureGroupRotor(nid);
        }
        // Refresh UI for kept component
        kept.forEach(n => { updateFlipper(n); updateRotor(n); });
        ensureGroupRotor(gid);
        return newIds;
    }
    // Rotate an entire group by a given angle around the group's center
    function rotateGroupBy(gset, dAng) {
        if (!gset || gset.size <= 0) return;
        const { cx, cy } = groupBounds(gset);
        const rad = dAng * Math.PI / 180; const cosA = Math.cos(rad), sinA = Math.sin(rad);
        withoutAnim(gset, () => {
            gset.forEach(n => {
                const r = n.getBoundingClientRect();
                const ncx = r.left + r.width / 2, ncy = r.top + r.height / 2;
                const rx = cx + ((ncx - cx) * cosA - (ncy - cy) * sinA);
                const ry = cy + ((ncx - cx) * sinA + (ncy - cy) * cosA);
                const deltaX = rx - ncx, deltaY = ry - ncy;
                const ux = getStyleNum(n, '--ux'), uy = getStyleNum(n, '--uy'), rot = getStyleNum(n, '--rot');
                n.style.setProperty('--ux', (ux + deltaX) + 'px');
                n.style.setProperty('--uy', (uy + deltaY) + 'px');
                n.style.setProperty('--rot', (rot + dAng) + 'deg');
            });
        });
    }
    function autoRotateGroupToNearest90(gid) {
        const gset = groups.get(gid); if (!gset || gset.size <= 1) return;
        const first = gset.values().next().value; if (!first) return;
        const curr = getStyleNum(first, '--rot');
        const norm = ((curr % 360) + 360) % 360;
        let nearest = Math.round(norm / 90) * 90; nearest = ((nearest % 360) + 360) % 360;
        let d = nearest - norm; if (d > 180) d -= 360; if (d < -180) d += 360;
        if (Math.abs(d) < 0.5) return; // already close enough
        rotateGroupBy(gset, d);
    }
    function ensureGroup(el) { if (!el.dataset.group) { const id = newGroupId(); el.dataset.group = id; groups.set(id, new Set([el])); } return el.dataset.group; }
    function membersOf(el) { const id = ensureGroup(el); return groups.get(id) || new Set([el]); }
    function mergeGroups(a, b) { const ia = ensureGroup(a), ib = ensureGroup(b); if (ia === ib) return ia; const A = groups.get(ia), B = groups.get(ib); B.forEach(n => { n.dataset.group = ia; A.add(n); }); groups.delete(ib); removeGroupRotor(ib); A.forEach(n => { updateFlipper(n); updateRotor(n); }); ensureGroupRotor(ia); return ia; }
    function unsnap(el) {
        const id = ensureGroup(el);
        const set = groups.get(id);
        if (!set || set.size <= 1) return;
        // Sever any side links connected to this tile and fully reset its side state
        unlinkAll(el);
        resetSides(el);
        set.delete(el);
        const nid = newGroupId();
        el.dataset.group = nid;
        groups.set(nid, new Set([el]));
    // Keep controls visible on the tile we acted on (touch-only)
    setTouchControlsTarget(el);
        updateFlipper(el); updateRotor(el);
        // Split the remaining original group into edge-connected components
        splitDisconnectedGroup(id);
        // Refresh UI for whatever remains in the original group (handles the 2-piece -> 1-piece case)
        const rem = groups.get(id);
        if (rem) rem.forEach(n => { updateFlipper(n); updateRotor(n); });
        // Update group rotors for the changed groups (group rotation is disabled; these are no-ops)
        ensureGroupRotor(id);
        removeGroupRotor(nid);
    }
    function getStyleNum(el, name) { const v = getComputedStyle(el).getPropertyValue(name); const n = parseFloat(v); return isNaN(n) ? 0 : n; }
    function withoutAnim(nodes, fn) { const list = []; nodes.forEach(n => { list.push([n, n.style.transition]); n.style.transition = 'none'; }); try { fn(); } finally { list.forEach(([n, t]) => { n.style.transition = t; }); } }
    function updateFlipper(el) {
        let btn = el.querySelector('.flipper'); if (!btn) return; const grouped = membersOf(el).size > 1; const isBack = el.dataset.flipped === '1';
        // Icon + accessibility
        btn.classList.toggle('is-cut', grouped);
        if (grouped) { btn.textContent = '✂'; btn.title = 'De-snap'; btn.setAttribute('aria-label', 'De-snap'); }
        else { btn.textContent = '⇄'; btn.title = isBack ? 'Flip to front' : 'Flip to back'; btn.setAttribute('aria-label', btn.title); }
        // Clear old handlers
        btn.onclick = null; btn.onpointerdown = null; btn.onpointerup = null; btn.onpointercancel = null; btn.onpointerleave = null; btn.onmousedown = null;
        // Start dragging immediately on press; click behavior is handled by makeDraggable's pointerup when no movement
        btn.onpointerdown = (ev) => { ev.preventDefault(); ev.stopPropagation(); if (typeof el.__dragDown === 'function') { el.__dragDown(ev); } };
        btn.onmousedown = (ev) => { ev.preventDefault(); ev.stopPropagation(); };
    }
    function updateRotor(el) {
        const knob = el.querySelector('.rotor'); if (!knob) return;
        const grouped = membersOf(el).size > 1;
        // Rely on CSS hover for visibility/pointer-events; just toggle disabled state
        if (grouped) {
            knob.setAttribute('disabled', '');
            knob.setAttribute('aria-hidden', 'true');
            knob.title = 'Rotate (disabled while snapped)';
        } else {
            knob.removeAttribute('disabled');
            knob.removeAttribute('aria-hidden');
            knob.title = 'Rotate';
        }
    }
    function addRotor(el) {
        let knob = el.querySelector('.rotor'); if (!knob) { knob = document.createElement('button'); knob.type = 'button'; knob.className = 'rotor'; knob.textContent = '⟲'; knob.title = 'Rotate'; knob.setAttribute('aria-label', 'Rotate photo'); el.appendChild(knob); }
        updateRotor(el); let id = null, prev = 0, baseRot = 0, acc = 0, raf = null; const angleAt = (e, pivot) => Math.atan2(e.clientY - pivot.y, e.clientX - pivot.x) * 180 / Math.PI;
        function down(e) {
            if (membersOf(el).size > 1) { e.preventDefault(); e.stopPropagation(); return; }
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            e.preventDefault(); e.stopPropagation();
            if (e.pointerType === 'touch') setTouchControlsTarget(el);
            id = e.pointerId; acc = 0; baseRot = getStyleNum(el, '--rot');
            // Respect existing CSS transform-origin (50% 60%) to avoid visual jump; compute pivot accordingly
            const r = el.getBoundingClientRect();
            const pivot = { x: r.left + r.width / 2, y: r.top + r.height * 0.60 };
            prev = angleAt(e, pivot);
            el.classList.add('rotating');
            el.dataset.didDrag = '1'; setTimeout(() => { delete el.dataset.didDrag; }, 120);
            knob.__pivot = pivot;
            knob.setPointerCapture?.(id);
        }
        function move(e) {
            if (id === null || e.pointerId !== id) return;
            const pivot = knob.__pivot || { x: 0, y: 0 };
            let d = angleAt(e, pivot) - prev;
            if (d > 180) d -= 360; else if (d < -180) d += 360;
            prev += d; acc += d;
            if (!raf) {
                raf = requestAnimationFrame(() => { el.style.setProperty('--rot', (baseRot + acc) + 'deg'); raf = null; });
            }
        }
        function up(e) {
            if (id === null || e.pointerId !== id) return;
            knob.releasePointerCapture?.(id);
            id = null; el.classList.remove('rotating');
            try { trySnap(el); } catch (_) { }
            triggerSolveDoubleCheck();
            // Re-run rotor state in case grouping or snapping changed availability
            updateRotor(el);
        }
        knob.addEventListener('pointerdown', down); window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up); knob.addEventListener('click', ev => { ev.preventDefault(); ev.stopPropagation(); });
        // Touch UX: tapping the card should persist controls visibility for this card
        if (IS_COARSE_TOUCH && !el.__touchPersist) {
            el.__touchPersist = true;
            el.addEventListener('touchstart', () => { setTouchControlsTarget(el); }, { passive: true });
        }
    }
    function addFlipper(el) {
        let b = el.querySelector('.flipper'); if (!b) { b = document.createElement('button'); b.type = 'button'; b.className = 'flipper'; el.appendChild(b); }
        // Ensure scissors stays clickable over overlaps
        b.addEventListener('mouseenter', () => { const gid = el.dataset.group; if (gid) { const s = groups.get(gid); if (s) s.forEach(n => { zCounter++; n.style.zIndex = String(zCounter); }); } else { zCounter++; el.style.zIndex = String(zCounter); } });
        updateFlipper(el);
    }
    function makeDraggable(el) {
        let id = null, sx = 0, sy = 0, moved = false, raf = null, lastDX = 0, lastDY = 0, startOnFlipper = false, startGrouped = false, startIsBack = false;
        const num = v => parseFloat(String(v).replace('px', '')) || 0; let baseMap = null;
    function down(e) { if (e.pointerType === 'mouse' && e.button !== 0) return; id = e.pointerId; sx = e.clientX; sy = e.clientY; moved = false; startOnFlipper = !!(e.target && e.target.closest && e.target.closest('.flipper')); startGrouped = membersOf(el).size > 1; startIsBack = el.dataset.flipped === '1'; if (e.pointerType === 'touch') setTouchControlsTarget(el); const group = membersOf(el); baseMap = new Map(); group.forEach(n => { const cs = getComputedStyle(n); baseMap.set(n, { ux: num(cs.getPropertyValue('--ux')), uy: num(cs.getPropertyValue('--uy')) }); zCounter += 1; n.style.zIndex = String(zCounter); n.classList.add('dragging'); }); el.setPointerCapture?.(id); }
        function move(e) { if (id === null || e.pointerId !== id) return; if (e.pointerType === 'mouse' && e.buttons === 0) return; lastDX = e.clientX - sx; lastDY = e.clientY - sy; if (!moved && (Math.abs(lastDX) > 3 || Math.abs(lastDY) > 3)) moved = true; if (!raf) { raf = requestAnimationFrame(() => { if (!baseMap) { raf = null; return; } baseMap.forEach((b, n) => { n.style.setProperty('--ux', (b.ux + lastDX) + 'px'); n.style.setProperty('--uy', (b.uy + lastDY) + 'px'); }); raf = null; }); } }
        function up(e) { if (id === null || e.pointerId !== id) return; if (baseMap) { baseMap.forEach((_, n) => { n.classList.remove('dragging'); if (moved) { n.dataset.didDrag = '1'; setTimeout(() => { delete n.dataset.didDrag; }, 120); } }); } el.releasePointerCapture?.(id); if (!moved && startOnFlipper) { if (startGrouped) { unsnap(el); setTimeout(() => { delete el.dataset.didDrag; }, 0); checkSolvedSoon(); updateFlipper(el); updateRotor(el); } else { el.dataset.flipped = startIsBack ? '0' : '1'; el.dataset.didDrag = '1'; setTimeout(() => { delete el.dataset.didDrag; }, 120); updateFlipper(el); updateRotor(el); checkSolvedSoon(); } id = null; baseMap = null; moved = false; startOnFlipper = false; return; } id = null; baseMap = null; try { trySnap(el); } catch (_) { } triggerSolveDoubleCheck(); }
        // Expose a method so children (e.g., flipper) can begin dragging on long-press
        el.__dragDown = (origEvent) => { try { down(origEvent); } catch (_) { } };
        el.addEventListener('pointerdown', down); document.addEventListener('pointermove', move); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
        // While dragging, keep any group rotor aligned
        const moveWrapper = () => {
            // Avoid fighting the rotor while a group rotation gesture is active
            if (activeGroupRotation) return;
            const gid = el.dataset.group; if (gid) placeGroupRotor(gid);
        };
        document.addEventListener('pointermove', moveWrapper);
        document.addEventListener('pointerup', moveWrapper);
    }

    // snapping
    const SNAP = { ang: 8, frac: 0.12, gap: 0 };
    function trySnap(anchor) {
        if (anchor.dataset.flipped !== '1') return;
        let snapped = false;
        const groupA = membersOf(anchor);
        const others = [...document.querySelectorAll('.polaroid')]
            .filter(o => o !== anchor && o.dataset.flipped === '1' && ensureGroup(o) !== ensureGroup(anchor));
        // Consider any member of the dragged group as the contact anchor
        for (const a of groupA) {
            const ra = getStyleNum(a, '--rot');
            const ar = a.getBoundingClientRect();
            const ax = ar.left + ar.width / 2, ay = ar.top + ar.height / 2;
            const aw0 = a.offsetWidth, ah0 = a.offsetHeight;
            const ca = Math.cos(ra * Math.PI / 180), sa = Math.sin(ra * Math.PI / 180);
            for (const o of others) {
                const rb = getStyleNum(o, '--rot');
                let dAng = ((rb - ra + 90) % 180 + 180) % 180 - 90;
                if (Math.abs(dAng) > SNAP.ang) continue;
                const diff360 = ((rb - ra) % 360 + 360) % 360;
                const near180 = Math.abs(diff360 - 180) <= SNAP.ang;
                const br = o.getBoundingClientRect();
                const bx = br.left + br.width / 2, by = br.top + br.height / 2;
                const bw0 = o.offsetWidth, bh0 = o.offsetHeight;
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
                const setB = membersOf(o);
                const both = new Set([...groupA, ...setB]);
                // Determine which sides would connect; enforce single-use per side
                let sideA, sideB;
                if (horizontal) { if (dx > 0) { sideA = 'right'; sideB = 'left'; } else { sideA = 'left'; sideB = 'right'; } }
                else { if (dy > 0) { sideA = 'bottom'; sideB = 'top'; } else { sideA = 'top'; sideB = 'bottom'; } }
                // If the tiles are 180° apart, the facing sides on both tiles have the same name
                if (near180) { sideB = sideA; }
                const sA = getSides(a), sB = getSides(o);
                if ((sA[sideA] && sA[sideA].node !== o) || (sB[sideB] && sB[sideB].node !== a)) continue;
                withoutAnim(both, () => {
                    const targetX = ax + (idealDX * ca - idealDY * sa);
                    const targetY = ay + (idealDX * sa + idealDY * ca);
                    const dAng2 = ((ra - rb + 90) % 180 + 180) % 180 - 90;
                    const rad = dAng2 * Math.PI / 180;
                    const cosA = Math.cos(rad), sinA = Math.sin(rad);
                    let minL = Infinity, minT = Infinity, maxR = -Infinity, maxB = -Infinity;
                    setB.forEach(n => { const r = n.getBoundingClientRect(); minL = Math.min(minL, r.left); minT = Math.min(minT, r.top); maxR = Math.max(maxR, r.right); maxB = Math.max(maxB, r.bottom); });
                    const pivotX = (minL + maxR) / 2, pivotY = (minT + maxB) / 2;
                    const obr = o.getBoundingClientRect();
                    const ocx = obr.left + obr.width / 2, ocy = obr.top + obr.height / 2;
                    const orx = pivotX + ((ocx - pivotX) * cosA - (ocy - pivotY) * sinA);
                    const ory = pivotY + ((ocx - pivotX) * sinA + (ocy - pivotY) * cosA);
                    const tX = Math.round(targetX - orx);
                    const tY = Math.round(targetY - ory);
                    setB.forEach(n => {
                        const r = n.getBoundingClientRect();
                        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
                        const rx = pivotX + ((cx - pivotX) * cosA - (cy - pivotY) * sinA);
                        const ry = pivotY + ((cx - pivotX) * sinA + (cy - pivotY) * cosA);
                        const deltaX = (rx + tX) - cx;
                        const deltaY = (ry + tY) - cy;
                        const ux = getStyleNum(n, '--ux'), uy = getStyleNum(n, '--uy'), rot = getStyleNum(n, '--rot');
                        n.style.setProperty('--ux', (ux + deltaX) + 'px');
                        n.style.setProperty('--uy', (uy + deltaY) + 'px');
                        n.style.setProperty('--rot', (rot + dAng2) + 'deg');
                    });
                });
                const mgid = mergeGroups(a, o);
                snapped = true;
                linkSides(a, sideA, o, sideB);
                ensureGroupRotor(mgid);
                elevateGroup(mgid);
                autoRotateGroupToNearest90(mgid);
                break;
            }
            if (snapped) break;
        }
        if (snapped) {
            membersOf(anchor).forEach(n => { updateFlipper(n); updateRotor(n); });
            // Try additional attachments in the same drop (e.g., middle tile connects to both neighbors)
            try { trySnap(anchor); } catch (_) { }
        }
    }

    // puzzle image slices
    function shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0;[arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
    function assignPuzzleBacks(imgPath = 'assets/images/hidden_messages/hiddenMessage_1.png') { const cards = Array.from(document.querySelectorAll('.polaroid')).slice(0, 9); if (cards.length < 9) return; const coords = shuffle(Array.from({ length: 9 }, (_, k) => ({ r: Math.floor(k / 3), c: k % 3 }))); cards.forEach((card, i) => { const backFace = card.querySelector('.face.back'); if (!backFace) return; const old = backFace.querySelector('img'); if (old) old.style.display = 'none'; let ink = backFace.querySelector('.ink'); if (!ink) { ink = document.createElement('div'); ink.className = 'ink'; backFace.appendChild(ink); } Object.assign(ink.style, { position: 'absolute', inset: '0', backgroundImage: `url('${imgPath}')`, backgroundRepeat: 'no-repeat', backgroundSize: '300% 300%', transformOrigin: '50% 50%' }); const { r, c } = coords[i]; ink.style.backgroundPosition = `${c * 50}% ${r * 50}%`; ink.style.transform = 'rotate(0deg)'; backFace.dataset.gridR = String(r); backFace.dataset.gridC = String(c); card.dataset.gridR = String(r); card.dataset.gridC = String(c); }); }
    assignPuzzleBacks();

    // lightbox
    const lb = document.getElementById('lightbox'), lbImg = document.getElementById('lightboxImg'); const lbClose = document.querySelector('.lightbox-close'), lbPrev = document.querySelector('.lightbox-arrow.prev'), lbNext = document.querySelector('.lightbox-arrow.next'); const cards = [...document.querySelectorAll('.polaroid')]; const gallery = [...document.querySelectorAll('.polaroid .face.front img')]; let current = -1, lastFocus = null; function openAt(i) { current = (i + gallery.length) % gallery.length; if (!lb || !lbImg) return; lbImg.src = gallery[current]?.src || ''; lb.classList.add('open'); lastFocus = document.activeElement; document.body.style.overflow = 'hidden'; (lbClose || lbImg)?.focus?.(); } function close() { if (!lb || !lbImg) return; lb.classList.remove('open'); lbImg.src = ''; document.body.style.overflow = ''; (lastFocus || document.body)?.focus?.(); } function next(n) { if (!gallery.length) return; current = (current + n + gallery.length) % gallery.length; if (lbImg) lbImg.src = gallery[current]?.src || ''; }
    cards.forEach((card, i) => { card.addEventListener('click', ev => { if (ev.target.closest('.flipper, .rotor')) return; if (card.dataset.flipped === '1') return; if (card.dataset.didDrag) return; if (card.classList.contains('dragging') || card.classList.contains('rotating')) return; openAt(i); }); card.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && card.dataset.flipped !== '1') { e.preventDefault(); openAt(i); } }); }); lb && lb.addEventListener('click', e => { if (e.target === lb) close(); }); lbClose && lbClose.addEventListener('click', close); lbPrev && lbPrev.addEventListener('click', () => next(-1)); lbNext && lbNext.addEventListener('click', () => next(1));

    // solver
    const TOL = { rotDeg: 12, rms: 0.20, scale: 0.14, minSpacing: 22, okCount: 8, windowFrac: 0.40 }; let solved = false, checking = false; function mean(a) { return a.reduce((s, v) => s + v, 0) / a.length; } function axialMeanDeg(deg) { let sx = 0, sy = 0; for (const d of deg) { const r = (d * 2) * Math.PI / 180; sx += Math.cos(r); sy += Math.sin(r); } return 0.5 * Math.atan2(sy, sx) * 180 / Math.PI; }
    function checkSolved() { const DBG = !!window.PUZZLE_DEBUG; const fail = (reason, extra) => { window.PUZZLE_LAST_FAIL = { ts: Date.now(), reason, ...(extra || {}) }; if (DBG) { console.debug('[puzzle][fail]', reason, extra || ''); if (extra && extra.badTiles) { extra.badTiles.forEach(t => { t.style.outline = '2px solid #d22'; setTimeout(() => { t.style.outline = ''; }, 1200); }); } } return false; }; const nine = [...document.querySelectorAll('.polaroid')].slice(0, 9); if (nine.length !== 9) return fail('not-enough-tiles', { count: nine.length }); if (!nine.every(n => n.dataset.flipped === '1')) { setSolved(false); return fail('not-all-flipped', { flipped: nine.map(n => n.dataset.flipped) }); } const gid = nine[0].dataset.group; const gset = gid ? groups.get(gid) : null; if (!gid || !gset || !nine.every(n => n.dataset.group === gid) || gset.size < 9) { setSolved(false); return fail('not-single-group', { gid, gsetSize: gset ? gset.size : 0, perGroup: nine.map(n => n.dataset.group) }); } const rots = nine.map(n => parseFloat(getComputedStyle(n).getPropertyValue('--rot')) || 0); const rAvg = axialMeanDeg(rots); const pts = nine.map(n => { const r = n.getBoundingClientRect(); return { n, cx: r.left + r.width / 2, cy: r.top + r.height / 2, rI: +(n.dataset.gridR || 0), cI: +(n.dataset.gridC || 0) }; }); const mx = mean(pts.map(p => p.cx)), my = mean(pts.map(p => p.cy)); const ang = -rAvg * Math.PI / 180, ca = Math.cos(ang), sa = Math.sin(ang); pts.forEach(p => { const dx = p.cx - mx, dy = p.cy - my; p.xn = dx * ca - dy * sa; p.yn = dx * sa + dy * ca; }); const cluster = (vals, eps) => { const s = [...vals].sort((a, b) => a - b); const reps = [], cnt = []; for (const v of s) { if (!reps.length || Math.abs(v - reps[reps.length - 1]) > eps) { reps.push(v); cnt.push(1); } else { const i = reps.length - 1; reps[i] = (reps[i] * cnt[i] + v) / (cnt[i] + 1); cnt[i]++; } } return reps; }; const nearestIndex = (v, reps, eps) => { let best = -1, bd = Infinity; for (let i = 0; i < reps.length; i++) { const d = Math.abs(v - reps[i]); if (d < bd) { bd = d; best = i; } } return (bd <= eps) ? best : -1; }; function medianSpacing(sortedVals) { const diffs = []; for (let i = 1; i < sortedVals.length; i++) { const d = sortedVals[i] - sortedVals[i - 1]; if (d > 4) diffs.push(d); } diffs.sort((a, b) => a - b); const m = Math.floor(diffs.length / 2); return diffs.length ? diffs[m] : 0; } const xsRaw = pts.map(p => p.xn), ysRaw = pts.map(p => p.yn); const xsSorted = [...xsRaw].sort((a, b) => a - b), ysSorted = [...ysRaw].sort((a, b) => a - b); const dxMed = medianSpacing(xsSorted) || (xsSorted[xsSorted.length - 1] - xsSorted[0]) / 2 || 100; const dyMed = medianSpacing(ysSorted) || (ysSorted[ysSorted.length - 1] - ysSorted[0]) / 2 || 100; const epsX = Math.min(Math.max(dxMed * 0.22, 6), 48); const epsY = Math.min(Math.max(dyMed * 0.22, 6), 48); let colReps = cluster(xsRaw, epsX); let rowReps = cluster(ysRaw, epsY); function reduceToThree(reps) { reps = [...reps].sort((a, b) => a - b); while (reps.length > 3) { let bi = 0, bg = Infinity; for (let i = 1; i < reps.length; i++) { const g = reps[i] - reps[i - 1]; if (g < bg) { bg = g; bi = i; } } const merged = (reps[bi] + reps[bi - 1]) / 2; reps.splice(bi - 1, 2, merged); } return reps; } if (colReps.length > 3) colReps = reduceToThree(colReps); if (rowReps.length > 3) rowReps = reduceToThree(rowReps); if (rowReps.length !== 3 || colReps.length !== 3) { setSolved(false); return fail('cluster-mismatch', { rowReps, colReps, epsX, epsY, dxMed, dyMed }); } let bad = []; for (const p of pts) { const rr = nearestIndex(p.yn, rowReps, epsY); const cc = nearestIndex(p.xn, colReps, epsX); if (rr < 0 || cc < 0) { bad.push(p.n); continue; } if (p.rI !== rr || p.cI !== cc) { bad.push(p.n); } } if (bad.length) { setSolved(false); return fail('tile-mismatch', { badTiles: bad, tiles: pts.map(p => ({ id: p.n.id, rI: p.rI, cI: p.cI, xn: Math.round(p.xn), yn: Math.round(p.yn) })) }); } const norm = d => { d = ((d % 360) + 360) % 360; if (d > 180) d -= 360; return d; }; const raw = rots.map(norm); let sx = 0, sy = 0; raw.forEach(r => { const rad = r * Math.PI / 180; sx += Math.cos(rad); sy += Math.sin(rad); }); const meanDir = Math.atan2(sy, sx) * 180 / Math.PI; const diff = (a, b) => { let d = a - b; while (d > 180) d -= 360; while (d < -180) d += 360; return d; }; let inverted = false; for (const r of raw) { const delta = Math.abs(diff(r, meanDir)); if (delta > 120) { inverted = true; break; } } if (inverted) { setSolved(false); return fail('orientation-inverted', { meanDir: Math.round(meanDir * 10) / 10, rots: raw.map(r => Math.round(r * 10) / 10) }); } if (DBG) { console.debug('[puzzle][solved]', { rotations: raw.map(r => Math.round(r * 10) / 10) }); } window.PUZZLE_LAST_FAIL = null; setSolved(true); return true; }
    function setSolved(v) {
        if (v === solved) return; solved = v; document.body.classList.toggle('puzzle-solved', v); if (!window.__solveTimers) window.__solveTimers = []; window.__solveTimers.forEach(t => clearTimeout(t)); window.__solveTimers = []; if (!v) return; const cards9 = Array.from(document.querySelectorAll('.polaroid')).slice(0, 9); const applyGlow = on => { cards9.forEach(c => { if (on) { if (!c.dataset._prevShadow) c.dataset._prevShadow = c.style.boxShadow || ''; if (!c.dataset._prevFilter) c.dataset._prevFilter = c.style.filter || ''; c.style.boxShadow = '0 14px 36px rgba(0,0,0,.45), 0 0 0 3px rgba(212,175,55,.9), 0 0 36px rgba(212,175,55,.55)'; c.style.filter = 'brightness(1.06)'; } else { c.style.boxShadow = c.dataset._prevShadow || ''; c.style.filter = c.dataset._prevFilter || ''; delete c.dataset._prevShadow; delete c.dataset._prevFilter; } }); };
        const phraseList = window.PUZZLE_SOLVE_PHRASES; const solvePhrase = phraseList[Math.floor(Math.random() * phraseList.length)] || 'You found something'; const buildModal = () => { const old = document.getElementById('puzzleModal'); if (old) old.remove(); const overlay = document.createElement('div'); overlay.id = 'puzzleModal'; overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;z-index:2147483647;opacity:0;transition:opacity 1.5s ease;'; const box = document.createElement('div'); box.style.cssText = 'position:relative;background:#0f0f0f;border:1px solid #333;color:#fff;padding:22px;border-radius:14px;box-shadow:0 20px 80px rgba(0,0,0,.7);width:min(480px,calc(100vw - 32px));text-align:center;'; box.innerHTML = `<button id="pmClose" aria-label="Close" style="position:absolute;top:8px;right:8px;background:transparent;border:0;color:#bbb;font-size:22px;line-height:1;cursor:pointer">×</button><h3 id="pmPhrase" style="margin:0 0 12px;font:600 20px/1.3 system-ui"></h3><div style="display:flex;gap:18px;margin-top:10px;flex-wrap:wrap;justify-content:center;align-items:center"><a id="pmCMND" href="https://youtube.com/shorts/hkYhlXNTsJQ?feature=share" target="_blank" rel="noopener" style="text-decoration:none;padding:10px 14px;border-radius:10px;background:#e7e7e7;color:#111;font-weight:700">WITNESS</a><a id="pmCNTRL" href="theseAreNotTheTracksYoureLookingFor.html" style="text-decoration:none;padding:10px 14px;border-radius:10px;background:#1b1b1b;color:#e7e7e7;font-weight:700;border:1px solid #333">REJECT</a></div>`; const phraseEl = box.querySelector('#pmPhrase'); if (phraseEl) phraseEl.textContent = solvePhrase; overlay.appendChild(box); document.body.appendChild(overlay); const dismiss = () => { overlay.remove(); window.__doSolveResetOnce?.(); }; box.querySelector('#pmClose').addEventListener('click', dismiss); overlay.addEventListener('click', e => { if (e.target === overlay) dismiss(); }); const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); dismiss(); document.removeEventListener('keydown', onKey); } }; document.addEventListener('keydown', onKey); const linkCMND = box.querySelector('#pmCMND'); const linkCNTRL = box.querySelector('#pmCNTRL'); if (linkCMND) { linkCMND.setAttribute('target', '_blank'); linkCMND.setAttribute('rel', 'noopener'); linkCMND.addEventListener('click', () => { try { stopAllSiteAudio(); } catch (_) { } overlay.remove(); window.__doSolveResetOnce?.(); }); } if (linkCNTRL) { linkCNTRL.removeAttribute('target'); linkCNTRL.removeAttribute('rel'); linkCNTRL.addEventListener('click', ev => { ev.preventDefault(); try { stopAllSiteAudio(); } catch (_) { } overlay.remove(); window.__doSolveResetOnce?.(); openMixerModal(); }); } overlay.style.opacity = '0'; void overlay.offsetWidth; requestAnimationFrame(() => { requestAnimationFrame(() => { overlay.style.opacity = '1'; }); }); };
    window.__didAutoReset = false; function doResetOnce() { if (window.__didAutoReset) return; window.__didAutoReset = true; if (window.__solveTimers) { window.__solveTimers.forEach(t => clearTimeout(t)); window.__solveTimers = []; } clearAllGroupRotors(); groups.clear(); groupSeq = 1; if (__lastTouchControlsEl) { __lastTouchControlsEl.classList.remove('touch-show-controls'); __lastTouchControlsEl = null; } cards9.forEach(c => { unlinkAll(c); c.classList.remove('dragging', 'rotating'); c.dataset.group = ''; ensureGroup(c); c.dataset.flipped = '0'; delete c.dataset.didDrag; c.style.setProperty('--ux', '0px'); c.style.setProperty('--uy', '0px'); c.style.setProperty('--rot', '0deg'); delete c.dataset.seededRot; delete c.dataset._baseRot; c.style.transition = ''; c.style.opacity = '0'; updateFlipper(c); updateRotor(c); }); preSeedRotations(); scatter(); requestAnimationFrame(() => { cards9.forEach(c => { c.style.transition = 'opacity .45s ease'; c.style.opacity = '1'; setTimeout(() => { c.style.transition = ''; }, 500); }); }); }
        window.__doSolveResetOnce = doResetOnce; applyGlow(true); const t1 = setTimeout(() => { applyGlow(false); }, 1000); const t3 = setTimeout(() => { cards9.forEach(c => { c.style.transition = 'opacity 5s ease'; c.style.opacity = '0'; }); const t4 = setTimeout(() => { doResetOnce(); }, 5000); window.__solveTimers.push(t4); }, 1000); const t2 = setTimeout(() => { buildModal(); }, 1200); window.__solveTimers.push(t1, t2, t3);
    }
    function resetAfterSolveWithFade() { document.body.classList.remove('puzzle-solved'); const modal = document.getElementById('puzzleModal'); if (modal) modal.remove(); const cards9 = Array.from(document.querySelectorAll('.polaroid')).slice(0, 9); cards9.forEach(c => { c.style.transition = 'opacity .45s ease'; c.style.opacity = '0'; }); setTimeout(() => { clearAllGroupRotors(); groups.clear(); groupSeq = 1; cards9.forEach(c => { unlinkAll(c); c.classList.remove('dragging', 'rotating'); c.dataset.group = ''; ensureGroup(c); c.dataset.flipped = '0'; delete c.dataset.didDrag; c.style.setProperty('--ux', '0px'); c.style.setProperty('--uy', '0px'); c.style.setProperty('--rot', '0deg'); delete c.dataset.seededRot; delete c.dataset._baseRot; updateFlipper(c); updateRotor(c); }); preSeedRotations(); scatter(); requestAnimationFrame(() => { cards9.forEach(c => { c.style.opacity = '1'; setTimeout(() => { c.style.transition = ''; }, 500); }); }); }, 460); }
    function checkSolvedSoon() { if (checking) return; const t0 = Date.now(); checking = true; setTimeout(() => { checking = false; const ok = checkSolved(); (window.PUZZLE_LAST_CHECKS || (window.PUZZLE_LAST_CHECKS = [])).push({ t: t0, ran: Date.now(), ok }); if (window.PUZZLE_DEBUG) console.debug('[puzzle][autoCheck]', { ok, queuedAt: t0 }); }, 80); }
    function triggerSolveDoubleCheck() { checkSolvedSoon(); setTimeout(() => { const ok = checkSolved(); (window.PUZZLE_LAST_CHECKS || (window.PUZZLE_LAST_CHECKS = [])).push({ t: Date.now(), ran: Date.now(), ok, forced: true }); if (window.PUZZLE_DEBUG) console.debug('[puzzle][doubleCheck]', { ok }); }, 170); }
    if (!window.dumpPuzzleState) { window.dumpPuzzleState = () => { const nine = [...document.querySelectorAll('.polaroid')].slice(0, 9); const data = nine.map(n => { const cs = getComputedStyle(n); return { id: n.id || null, flipped: n.dataset.flipped, group: n.dataset.group, rot: parseFloat(cs.getPropertyValue('--rot')) || 0, ux: cs.getPropertyValue('--ux'), uy: cs.getPropertyValue('--uy'), gridR: n.dataset.gridR, gridC: n.dataset.gridC }; }); console.table(data); return data; }; }
    if (!window.forcePuzzleCheck) { window.forcePuzzleCheck = () => { const ok = checkSolved(); console.debug('[puzzle][forceCheck]', { ok, lastFail: window.PUZZLE_LAST_FAIL }); return ok; }; }

    document.querySelectorAll('.polaroid').forEach(addRotor); document.querySelectorAll('.polaroid').forEach(addFlipper); document.querySelectorAll('.polaroid').forEach(makeDraggable);
    // Global touch handler for control persistence
    if (IS_COARSE_TOUCH) {
        document.addEventListener('touchstart', (e) => {
            const t = e.target;
            if (!(t && t.closest && t.closest('.polaroid'))) {
                // Tapped outside any card: clear persisted controls
                setTouchControlsTarget(null);
            }
        }, { passive: true, capture: true });
    }
    // Hover elevate: bring hovered tile's entire group to front and ensure hovered member is topmost
    document.querySelectorAll('.polaroid').forEach(el => {
        el.addEventListener('mouseenter', () => {
            const group = membersOf(el);
            // Elevate all members first
            group.forEach(n => { zCounter++; n.style.zIndex = String(zCounter); });
            // Then elevate hovered element again so it sits above its siblings
            zCounter++; el.style.zIndex = String(zCounter);
        });
    });
    preSeedRotations(); scatter(); let __lastScatterMode = (window.innerWidth || document.documentElement.clientWidth) <= 560 ? 'mobile' : 'desktop'; function responsiveRescatter() { const mode = (window.innerWidth || document.documentElement.clientWidth) <= 560 ? 'mobile' : 'desktop'; if (mode === __lastScatterMode) return; document.querySelectorAll('.polaroid').forEach(el => { el.style.setProperty('--ux', '0px'); el.style.setProperty('--uy', '0px'); }); scatter(); __lastScatterMode = mode; }
    let __rszTimer = null; window.addEventListener('resize', () => { if (__rszTimer) clearTimeout(__rszTimer); __rszTimer = setTimeout(() => { responsiveRescatter(); placeAllGroupRotors(); }, 140); });

    // expose bits needed across modules
    window.openMixerModal = window.openMixerModal; // ensure present
})();
