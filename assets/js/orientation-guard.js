// Orientation Guard (portrait-only UX on phones/tablets; never blocks desktop)
(function () {
    function isTouchDevice() {
        try {
            if (navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0) return true;
            if ('ontouchstart' in window) return true;
            if (window.matchMedia) {
                if (window.matchMedia('(any-pointer: coarse)').matches) return true;
                if (window.matchMedia('(any-hover: none)').matches) return true;
            }
        } catch (_) { }
        return false;
    }

    function initOrientationGuard() {
        const body = document.body; if (!body) return;
        const overlay = document.querySelector('.rotate-lock-overlay'); if (!overlay) return;

        const touch = isTouchDevice();
        // Only engage the portrait lock on touch devices
        if (!touch) {
            // Ensure overlay is hidden and body scroll is normal on desktop
            overlay.style.display = 'none';
            overlay.setAttribute('aria-hidden', 'true');
            return;
        }

        body.classList.add('portrait-only');

        // Best-effort: try to lock screen orientation to portrait on supported browsers
        let lockAttempts = 0;
        const maxLockAttempts = 4;
        const canLock = !!(screen && screen.orientation && typeof screen.orientation.lock === 'function');
        const docEl = document.documentElement;
        const canFullscreen = !!(docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.msRequestFullscreen);
        function enterFullscreen() {
            try {
                if (docEl.requestFullscreen) return docEl.requestFullscreen();
                if (docEl.webkitRequestFullscreen) return docEl.webkitRequestFullscreen();
                if (docEl.msRequestFullscreen) return docEl.msRequestFullscreen();
            } catch (_) { }
            return Promise.reject(new Error('No fullscreen API'));
        }
        function exitFullscreen() {
            try {
                if (document.exitFullscreen) return document.exitFullscreen();
                if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
                if (document.msExitFullscreen) return document.msExitFullscreen();
            } catch (_) { }
            return Promise.resolve();
        }
        async function tryLockPortrait() {
            if (!canLock) return false;
            try {
                // Some browsers accept 'portrait-primary', others 'portrait'
                try { await screen.orientation.lock('portrait-primary'); }
                catch (_) { await screen.orientation.lock('portrait'); }
                return true;
            } catch (_) { return false; }
        }
        async function attemptLock() {
            if (lockAttempts >= maxLockAttempts) return false;
            lockAttempts++;
            let ok = await tryLockPortrait();
            if (!ok && canLock && canFullscreen) {
                // Some Android browsers require fullscreen to lock
                try {
                    await enterFullscreen();
                    ok = await tryLockPortrait();
                    // If lock worked, keep fullscreen; otherwise, exit
                    if (!ok) { try { await exitFullscreen(); } catch (_) { } }
                } catch (_) { /* fall back to overlay */ }
            }
            return ok;
        }
        // Lock on user gestures (required on many browsers). Keep trying until success or attempts exhausted.
        const gestureEvents = ['pointerdown', 'click', 'touchend', 'keydown'];
        const handlers = [];
        function addGestureHandlers() {
            gestureEvents.forEach((ev) => {
                const handler = async () => {
                    const ok = await attemptLock();
                    if (ok) {
                        // remove all handlers once locked
                        handlers.forEach(({ ev, fn, opts }) => document.removeEventListener(ev, fn, opts));
                        handlers.length = 0;
                    }
                };
                const opts = ev === 'touchend' ? { capture: true, passive: true } : { capture: true };
                handlers.push({ ev, fn: handler, opts });
                document.addEventListener(ev, handler, opts);
            });
        }
        addGestureHandlers();
        // Retry on visibility/orientation changes
        document.addEventListener('visibilitychange', () => { if (!document.hidden) tryLockPortrait(); });
        window.addEventListener('orientationchange', () => { setTimeout(() => { tryLockPortrait(); }, 50); });
        // Re-attempt after fullscreen changes
        ['fullscreenchange', 'webkitfullscreenchange', 'msfullscreenchange'].forEach(ev => {
            document.addEventListener(ev, () => { setTimeout(() => { tryLockPortrait(); }, 50); }, { passive: true });
        });
        if (screen && screen.orientation && typeof screen.orientation.addEventListener === 'function') {
            screen.orientation.addEventListener('change', () => { setTimeout(() => { tryLockPortrait(); }, 50); });
        }

        function isLandscape() {
            return (window.matchMedia && window.matchMedia('(orientation: landscape)').matches) || (window.innerWidth > window.innerHeight);
        }
        function update() {
            // We're already gated to touch devices above. Show overlay on any touch device in landscape.
            const show = isLandscape();
            overlay.style.display = show ? 'flex' : 'none';
            overlay.setAttribute('aria-hidden', show ? 'false' : 'true');
            if (show) {
                if (!body.dataset.prevOverflow) body.dataset.prevOverflow = body.style.overflow || '';
                body.style.overflow = 'hidden';
            } else if (body.dataset.prevOverflow !== undefined) {
                body.style.overflow = body.dataset.prevOverflow;
                delete body.dataset.prevOverflow;
            }
        }
        ['resize', 'orientationchange'].forEach(ev => window.addEventListener(ev, update, { passive: true }));
        setTimeout(update, 0);
    }
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initOrientationGuard); }
    else { initOrientationGuard(); }
})();
