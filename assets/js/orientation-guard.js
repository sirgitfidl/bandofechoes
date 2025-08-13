// Orientation Guard (portrait-only UX on small screens)
(function () {
    function initOrientationGuard() {
        const body = document.body; if (!body) return; body.classList.add('portrait-only');
        const overlay = document.querySelector('.rotate-lock-overlay'); if (!overlay) return;
        function isLandscape() { return window.matchMedia('(orientation: landscape)').matches || window.innerWidth > window.innerHeight; }
        function update() {
            const withinScope = window.innerWidth <= 900 || window.innerHeight <= 900;
            const show = isLandscape() && withinScope;
            overlay.style.display = show ? 'flex' : 'none';
            overlay.setAttribute('aria-hidden', show ? 'false' : 'true');
            body.classList.toggle('orientation-blocked', show);
            if (show) { if (!body.dataset.prevOverflow) body.dataset.prevOverflow = body.style.overflow; body.style.overflow = 'hidden'; }
            else if (body.dataset.prevOverflow !== undefined) { body.style.overflow = body.dataset.prevOverflow; delete body.dataset.prevOverflow; }
        }
        ['resize', 'orientationchange'].forEach(ev => window.addEventListener(ev, update, { passive: true }));
        setTimeout(update, 0);
    }
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initOrientationGuard); }
    else { initOrientationGuard(); }
})();
