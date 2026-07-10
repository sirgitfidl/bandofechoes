// Orientation Guard (portrait-only UX on phones/tablets; never blocks desktop)
(function () {
    function isTouchDevice() {
        try {
            if (window.__BOE_FORCE_TOUCH_DEVICE === true) return true;
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
        let restoreScrollY = null;
        let rafId = 0;

        const touch = isTouchDevice();
        // Only engage the portrait lock on touch devices
        if (!touch) {
            // Ensure overlay is hidden and body scroll is normal on desktop
            body.classList.remove('orientation-locked');
            body.style.top = '';
            overlay.style.display = 'none';
            overlay.setAttribute('aria-hidden', 'true');
            return;
        }

        body.classList.add('portrait-only');

        function lockScroll() {
            if (body.classList.contains('orientation-locked')) return;
            restoreScrollY = window.scrollY || window.pageYOffset || 0;
            body.style.top = `-${restoreScrollY}px`;
            body.classList.add('orientation-locked');
        }

        function unlockScroll() {
            if (!body.classList.contains('orientation-locked')) return;
            const fallbackScrollY = Math.abs(parseInt(body.style.top || '0', 10)) || 0;
            const scrollY = restoreScrollY ?? fallbackScrollY;
            body.classList.remove('orientation-locked');
            body.style.top = '';
            restoreScrollY = null;
            window.scrollTo(0, scrollY);
        }

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
                lockScroll();
            } else {
                unlockScroll();
            }
        }

        function scheduleUpdate() {
            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                rafId = 0;
                update();
            });
        }

        ['resize', 'orientationchange', 'pageshow'].forEach(ev => window.addEventListener(ev, scheduleUpdate, { passive: true }));
        try {
            if (window.visualViewport) window.visualViewport.addEventListener('resize', scheduleUpdate, { passive: true });
        } catch (_) { }
        setTimeout(update, 0);
    }
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initOrientationGuard); }
    else { initOrientationGuard(); }
})();
