// Rotating quotes module
(function initRotatingQuotes() {
    const el = document.getElementById('quote');
    if (!el) return;
    const DEFAULT_QUOTES = [
        '“World‑class musicians. Duo sounds like a band.” — Name, Outlet',
        '“Acoustic intensity. Every arrangement feels like a revelation.” — Listener',
        '“Cello + guitar woven into something hauntingly new.” — Blog',
        '“Raw, dynamic, immersive.” — Early Supporter',
    ];
    const list = (window.BOE_QUOTES && Array.isArray(window.BOE_QUOTES) && window.BOE_QUOTES.length) ? window.BOE_QUOTES : DEFAULT_QUOTES;
    let idx = 0;
    el.textContent = list[0];
    let timer = null;
    function next() {
        idx = (idx + 1) % list.length;
        el.style.transition = 'opacity .5s ease';
        el.style.opacity = '0';
        setTimeout(() => { el.textContent = list[idx]; el.style.opacity = '1'; }, 520);
    }
    function schedule() { timer = setInterval(next, 10000); }
    schedule();
    window.nextQuote = next;
    window.stopQuoteCycle = () => { if (timer) clearInterval(timer); };
})();
