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
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', 'Stem Mixer');
        overlay.style.cssText = 'position:fixed;inset:0;display:block;overflow:hidden;background:rgba(0,0,0,.72);backdrop-filter:blur(3px);z-index:2147483647;opacity:1;transition:opacity .25s ease;overscroll-behavior:none';
        const box = document.createElement('div');
        box.style.cssText = 'position:relative;width:100vw;height:100dvh;max-width:100vw;max-height:100dvh;border:0;border-radius:0;overflow:hidden;background:transparent;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)';
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button'; closeBtn.setAttribute('aria-label', 'Close mixer');
        closeBtn.style.cssText = 'position:absolute;top:calc(env(safe-area-inset-top,0px) + 6px);right:8px;z-index:2;background:rgba(0,0,0,.55);border:1px solid #2a3246;color:#e7eaf3;padding:10px 12px;border-radius:12px;font-size:28px;line-height:1;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.35);transition:transform .12s ease, opacity .12s ease';
        closeBtn.textContent = '×';
        closeBtn.addEventListener('mouseenter', () => { closeBtn.style.transform = 'scale(1.06)'; });
        closeBtn.addEventListener('mouseleave', () => { closeBtn.style.transform = ''; });
        const frame = document.createElement('iframe');
        frame.src = 'theseAreNotTheTracksYoureLookingFor.html';
        frame.title = 'Band of Echoes — Stem Mixer';
        frame.loading = 'eager';
        frame.allow = 'autoplay *; clipboard-read; clipboard-write';
        frame.style.cssText = 'position:absolute;inset:0;display:block;width:100%;height:100%;border:0;background:#0b0d12';
        frame.addEventListener('load', () => { try { const d = frame.contentDocument || frame.contentWindow?.document; if (!d) return; d.documentElement.classList.add('mixer-iframe-style'); } catch (_) { } });
        box.appendChild(closeBtn); box.appendChild(frame); overlay.appendChild(box); document.body.appendChild(overlay);
        const cleanupFns = []; const prevOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; cleanupFns.push(() => { document.body.style.overflow = prevOverflow; });
        const preventMultiTouch = e => { if (e.touches && e.touches.length > 1) { e.preventDefault(); } }; document.addEventListener('touchmove', preventMultiTouch, { passive: false }); cleanupFns.push(() => document.removeEventListener('touchmove', preventMultiTouch));
        const preventGesture = e => { e.preventDefault(); }; document.addEventListener('gesturestart', preventGesture, { passive: false }); cleanupFns.push(() => document.removeEventListener('gesturestart', preventGesture));
        const preventCtrlWheel = e => { if (e.ctrlKey) { e.preventDefault(); } }; window.addEventListener('wheel', preventCtrlWheel, { passive: false }); cleanupFns.push(() => window.removeEventListener('wheel', preventCtrlWheel));
        let createdMeta = false; let vp = document.querySelector('meta[name="viewport"]'); const prevMetaContent = vp ? vp.getAttribute('content') : null; if (!vp) { vp = document.createElement('meta'); vp.name = 'viewport'; document.head.appendChild(vp); createdMeta = true; } vp.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no'); cleanupFns.push(() => { if (!vp) return; if (createdMeta) { vp.remove(); } else if (prevMetaContent != null) { vp.setAttribute('content', prevMetaContent); } });
        const preventKeyZoom = e => { if (!e.ctrlKey && !e.metaKey) return; const k = e.key; if (k === '+' || k === '-' || k === '=' || k === '_') { e.preventDefault(); } }; window.addEventListener('keydown', preventKeyZoom, true); cleanupFns.push(() => window.removeEventListener('keydown', preventKeyZoom, true));
        const fitBox = () => { const vv = window.visualViewport; const h = (vv?.height || window.innerHeight); const w = (vv?.width || window.innerWidth); box.style.height = h + 'px'; box.style.width = w + 'px'; }; fitBox(); window.addEventListener('resize', fitBox); try { window.visualViewport && window.visualViewport.addEventListener('resize', fitBox); } catch (_) { }
        const prevFocus = document.activeElement; let closing = false; function finishClose() { try { window.removeEventListener('resize', fitBox); } catch (_) { } try { window.visualViewport && window.visualViewport.removeEventListener('resize', fitBox); } catch (_) { } overlay.remove(); document.body.style.overflow = ''; (prevFocus || document.body)?.focus?.(); document.removeEventListener('keydown', onKey); cleanupFns.forEach(fn => { try { fn(); } catch (_) { } }); }
        function dismiss() { if (closing) return; closing = true; overlay.style.opacity = '0'; const tid = setTimeout(finishClose, 300); overlay.addEventListener('transitionend', e => { if (e.propertyName === 'opacity') { clearTimeout(tid); finishClose(); } }, { once: true }); }
        function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); dismiss(); } }
        overlay.addEventListener('click', e => { if (e.target === overlay) dismiss(); }); closeBtn.addEventListener('click', dismiss); document.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden'; closeBtn.focus();
    }
    window.openMixerModal = openMixerModal;
    window.stopAllSiteAudio = window.stopAllSiteAudio || stopAllSiteAudio;
})();
