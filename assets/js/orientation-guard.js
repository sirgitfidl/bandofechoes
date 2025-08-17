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
        let lockTried = false;
        const canLock = !!(screen && screen.orientation && typeof screen.orientation.lock === 'function');
        async function tryLockPortrait() {
            if (!canLock) return false;
            try {
                // Some browsers accept 'portrait-primary', others 'portrait'
                try { await screen.orientation.lock('portrait-primary'); }
                catch (_) { await screen.orientation.lock('portrait'); }
                return true;
            } catch (_) { return false; }
        }
        async function ensureLockedOnce() {
            if (lockTried) return; lockTried = true;
            const ok = await tryLockPortrait();
            if (!ok) {
                // If denied (common on iOS Safari), we’ll rely on the overlay fallback
            }
        }
        // Lock on first user gesture (required on many browsers)
        const once = (el, ev, fn, opts) => { const h = async (e) => { try { await fn(e); } finally { el.removeEventListener(ev, h, opts); } }; el.addEventListener(ev, h, opts); };
        once(document, 'click', ensureLockedOnce, { capture: true });
        once(document, 'touchend', ensureLockedOnce, { capture: true, passive: true });
        once(document, 'keydown', ensureLockedOnce, { capture: true });
        // Retry on visibility/orientation changes
        document.addEventListener('visibilitychange', () => { if (!document.hidden) tryLockPortrait(); });
        window.addEventListener('orientationchange', () => { setTimeout(() => { tryLockPortrait(); }, 50); });

        function isLandscape() {
            return (window.matchMedia && window.matchMedia('(orientation: landscape)').matches) || (window.innerWidth > window.innerHeight);
        }
        function update() {
            // Scope to small screens (typical phones/tablets). Width check is sufficient; avoid short desktop windows.
            const withinScope = window.innerWidth <= 900; // width-only guard
            const show = isLandscape() && withinScope;
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
