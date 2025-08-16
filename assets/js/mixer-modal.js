// Mixer modal module (depends on stopAllSiteAudio if defined)
(function () {
    function stopAllSiteAudio() {
        try { document.querySelectorAll('iframe[src*="youtube.com/embed"], iframe[src*="youtube-nocookie.com/embed"]').forEach(f => { try { f.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: '' }), '*'); } catch (_) { } }); } catch (_) { }
        try { document.querySelectorAll('audio, video').forEach(m => { try { m.pause(); } catch (_) { } }); } catch (_) { }
    }
    function openMixerModal() {
        const existing = document.getElementById('mixerModal'); if (existing) existing.remove();
        try { stopAllSiteAudio(); } catch (_) { }
        const overlay = document.createElement('div');
        overlay.id = 'mixerModal';
        overlay.setAttribute('data-testid', 'mixer-modal');
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', 'Stem Mixer');
        overlay.style.cssText = 'position:fixed;inset:0;display:block;overflow:hidden;background:rgba(0,0,0,.72);backdrop-filter:blur(3px);z-index:2147483647;opacity:1;transition:opacity .25s ease;overscroll-behavior:none';
        // Define close API immediately so iframe can call it as soon as it loads
        try { window.__closeMixerModal = () => dismiss(); } catch (_) { }
        const box = document.createElement('div');
        box.style.cssText = 'position:relative;width:100vw;height:100dvh;max-width:100vw;max-height:100dvh;border:0;border-radius:0;overflow:hidden;background:transparent;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)';
        // Removed floating close button; close will be driven from inside the iframe
        const frame = document.createElement('iframe');
        frame.src = 'theseAreNotTheTracksYoureLookingFor.html';
        frame.title = 'Band of Echoes — Stem Mixer';
        frame.loading = 'eager';
        frame.allow = 'autoplay *; clipboard-read; clipboard-write';
        frame.setAttribute('data-testid', 'mixer-iframe');
        frame.style.cssText = 'position:absolute;inset:0;display:block;width:100%;height:100%;border:0;background:#0b0d12';

        // Always listen for close requests from the iframe (works cross-origin)
        const onMsg = (e) => {
            const data = e.data;
            if (!data || data.__mixerMsg !== true) return;
            if (data.type === 'MIXER_CLOSE') dismiss();
        };
        window.addEventListener('message', onMsg);
        box._msgCleanup = () => { window.removeEventListener('message', onMsg); };
        frame.addEventListener('load', () => {
            try {
                const d = frame.contentDocument || frame.contentWindow?.document; if (!d) return;
                d.documentElement.classList.add('mixer-iframe-style');
                // Directly wire the inner close button to dismiss, as a robust fallback to postMessage
                let __closeRetry = 0, __closeTimer = null;
                const wireInnerClose = () => {
                    try {
                        const dd = frame.contentDocument || frame.contentWindow?.document; if (!dd) return false;
                        const innerBtn = dd.getElementById('closeMixerBtn');
                        if (!innerBtn) return false;
                        const handler = (e) => { try { e.preventDefault(); } catch (_) { } dismiss(); };
                        innerBtn.addEventListener('click', handler);
                        innerBtn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') handler(e); });
                        return true;
                    } catch (_) { return false; }
                };
                if (!wireInnerClose()) {
                    __closeTimer = setInterval(() => { if (wireInnerClose() || ++__closeRetry > 50) { try { clearInterval(__closeTimer); } catch (_) { } __closeTimer = null; } }, 80);
                }
                // Capture any clicks on the close button at the document level as an extra safety net
                try {
                    d.addEventListener('click', (ev) => {
                        const t = ev.target;
                        const m = (t && (t.id === 'closeMixerBtn' || (t.closest && t.closest('#closeMixerBtn'))));
                        if (m) { ev.preventDefault(); dismiss(); }
                    }, true);
                } catch (_) { }
                // Cleanup addendum for retry timer
                const prevCleanup = box._msgCleanup;
                box._msgCleanup = () => { try { prevCleanup && prevCleanup(); } catch (_) { } if (__closeTimer) { try { clearInterval(__closeTimer); } catch (_) { } } };
            } catch (_) { }
        });
        box.appendChild(frame); overlay.appendChild(box); document.body.appendChild(overlay);
        // All positioning logic removed since we no longer render a floating close button
        const cleanupFns = []; const prevOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; cleanupFns.push(() => { document.body.style.overflow = prevOverflow; });
        const preventMultiTouch = e => { if (e.touches && e.touches.length > 1) { e.preventDefault(); } }; document.addEventListener('touchmove', preventMultiTouch, { passive: false }); cleanupFns.push(() => document.removeEventListener('touchmove', preventMultiTouch));
        const preventGesture = e => { e.preventDefault(); }; document.addEventListener('gesturestart', preventGesture, { passive: false }); cleanupFns.push(() => document.removeEventListener('gesturestart', preventGesture));
        const preventCtrlWheel = e => { if (e.ctrlKey) { e.preventDefault(); } }; window.addEventListener('wheel', preventCtrlWheel, { passive: false }); cleanupFns.push(() => window.removeEventListener('wheel', preventCtrlWheel));
        let createdMeta = false; let vp = document.querySelector('meta[name="viewport"]'); const prevMetaContent = vp ? vp.getAttribute('content') : null; if (!vp) { vp = document.createElement('meta'); vp.name = 'viewport'; document.head.appendChild(vp); createdMeta = true; } vp.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no'); cleanupFns.push(() => { if (!vp) return; if (createdMeta) { vp.remove(); } else if (prevMetaContent != null) { vp.setAttribute('content', prevMetaContent); } });
        const preventKeyZoom = e => { if (!e.ctrlKey && !e.metaKey) return; const k = e.key; if (k === '+' || k === '-' || k === '=' || k === '_') { e.preventDefault(); } }; window.addEventListener('keydown', preventKeyZoom, true); cleanupFns.push(() => window.removeEventListener('keydown', preventKeyZoom, true));
        const fitBox = () => { const vv = window.visualViewport; const h = (vv?.height || window.innerHeight); const w = (vv?.width || window.innerWidth); box.style.height = h + 'px'; box.style.width = w + 'px'; }; fitBox(); window.addEventListener('resize', fitBox); try { window.visualViewport && window.visualViewport.addEventListener('resize', fitBox); } catch (_) { }
        // Also close on custom DOM event dispatched by iframe
        const onCustomClose = () => dismiss(); window.addEventListener('MIXER_CLOSE', onCustomClose);
        const prevFocus = document.activeElement; let closing = false; function finishClose() { try { window.removeEventListener('resize', fitBox); } catch (_) { } try { window.visualViewport && window.visualViewport.removeEventListener('resize', fitBox); } catch (_) { } try { box._msgCleanup && box._msgCleanup(); } catch (_) { } try { if (window.__closeMixerModal === dismiss) delete window.__closeMixerModal; } catch (_) { } try { window.removeEventListener('MIXER_CLOSE', onCustomClose); } catch (_) { } overlay.remove(); document.body.style.overflow = ''; (prevFocus || document.body)?.focus?.(); document.removeEventListener('keydown', onKey); cleanupFns.forEach(fn => { try { fn(); } catch (_) { } }); }
        function dismiss() { if (closing) return; closing = true; overlay.style.opacity = '0'; const tid = setTimeout(finishClose, 300); overlay.addEventListener('transitionend', e => { if (e.propertyName === 'opacity') { clearTimeout(tid); finishClose(); } }, { once: true }); }
        try { window.__closeMixerModal = dismiss; } catch (_) { }
        function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); dismiss(); } }
        overlay.addEventListener('click', e => { if (e.target === overlay) dismiss(); }); document.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
    }
    window.openMixerModal = openMixerModal;
    window.stopAllSiteAudio = window.stopAllSiteAudio || stopAllSiteAudio;
})();
