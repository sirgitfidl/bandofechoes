import { expect, Locator, Page, FrameLocator } from '@playwright/test';

/**
 * Page Object Model for the site home page (index.html)
 */
export class MainPage {
    readonly page: Page;

    // Header / nav
    readonly brandTitle: Locator;
    readonly navToggle: Locator;
    readonly navMenu: Locator;
    readonly navMenuItems: Locator;

    // Hero
    readonly heroPlayer: Locator;
    readonly heroPoster: Locator;

    // Sections
    readonly sectionWatch: Locator;
    readonly sectionAbout: Locator;
    readonly sectionSupport: Locator;
    readonly sectionContact: Locator;

    // Lightbox
    readonly lightbox: Locator;
    readonly lightboxClose: Locator;
    readonly polaroids: Locator;
    readonly rotateLockOverlay: Locator;
    readonly mainRegion: Locator;
    readonly mixerInlineCloseBtn: Locator;
    readonly puzzleModalClose: Locator;
    readonly puzzleWitnessLink: Locator;
    readonly puzzleRejectLink: Locator;

    // Mixer modal
    readonly mixerModal: Locator;
    readonly mixerIframe: FrameLocator;

    // Footer and CTAs
    readonly ytFooter: Locator;
    readonly ptFooter: Locator;
    readonly patreonCta2: Locator;
    readonly subFallback: Locator;
    readonly emailLink: Locator;
    readonly yearEl: Locator;
    readonly skipLink: Locator;
    readonly puzzleModal: Locator;

    constructor(page: Page) {
        this.page = page;

        // Header / nav
        this.brandTitle = page.getByTestId('brand-title');
        this.navToggle = page.getByTestId('nav-toggle');
        this.navMenu = page.getByTestId('nav-menu');
        this.navMenuItems = this.navMenu.locator('a[role="menuitem"]');

        // Hero
        this.heroPlayer = page.getByTestId('hero-player');
        this.heroPoster = page.getByTestId('hero-poster');

        // Sections (ids in index.html)
        this.sectionWatch = page.getByTestId('section-watch');
        this.sectionAbout = page.getByTestId('section-about');
        this.sectionSupport = page.getByTestId('section-support');
        this.sectionContact = page.getByTestId('section-contact');

        // Lightbox
        this.lightbox = page.getByTestId('lightbox');
        this.lightboxClose = page.getByTestId('lightbox-close');
        this.polaroids = page.getByTestId('polaroid');
        this.rotateLockOverlay = page.getByTestId('rotate-lock-overlay');
        this.mainRegion = page.getByTestId('main');
        this.mixerInlineCloseBtn = page.getByTestId('close-mixer-btn');
        this.puzzleModalClose = page.getByTestId('puzzle-modal-close');
        this.puzzleWitnessLink = page.getByTestId('puzzle-witness');
        this.puzzleRejectLink = page.getByTestId('puzzle-reject');

        // Mixer modal (appears after openMixerModal())
        this.mixerModal = page.getByTestId('mixer-modal');
        this.mixerIframe = page.frameLocator('[data-testid="mixer-iframe"]');

        // Footer and CTAs
        this.ytFooter = page.getByTestId('footer-youtube');
        this.ptFooter = page.getByTestId('footer-patreon');
        this.patreonCta2 = page.getByTestId('cta-patreon');
        this.subFallback = page.getByTestId('cta-subscribe');
        this.emailLink = page.getByTestId('email-link');
        this.yearEl = page.getByTestId('year');
        this.skipLink = page.getByTestId('skip-link');
        this.puzzleModal = page.getByTestId('puzzle-modal');
    }

    async goto() {
        await this.page.goto('/');
        await expect(this.brandTitle).toHaveText(/Band of Echoes/i);
    }

    // --- Nav helpers ---
    async openNav() {
        const expanded = await this.navToggle.getAttribute('aria-expanded');
        if (expanded !== 'true') {
            await this.navToggle.click();
            await expect(this.navMenu).toBeVisible();
        }
    }

    async closeNav() {
        const expanded = await this.navToggle.getAttribute('aria-expanded');
        if (expanded === 'true') {
            await this.navToggle.click();
            await expect(this.navMenu).toBeHidden();
        }
    }

    async clickMenu(label: 'Watch' | 'About' | 'Support' | 'Contact') {
        await this.openNav();
        await this.navMenu.getByRole('link', { name: label }).click();
    }

    // --- Hero helpers ---
    async clickPosterInjectsIframe() {
        await this.heroPoster.click();
        const frame = this.page.locator('#playerWrap iframe');
        await expect(frame).toBeVisible();
        const src = await frame.getAttribute('src');
        expect(src).toBeTruthy();
        expect(src!).toContain('https://www.youtube.com/embed/');
        expect(src!).toContain('autoplay=1');
    }

    // --- Mixer modal helpers ---
    async hasOpenMixerAPI(): Promise<boolean> {
        return await this.page.evaluate(() => typeof (window as any).openMixerModal === 'function');
    }

    async openMixerModal() {
        const hasApi = await this.hasOpenMixerAPI();
        if (!hasApi) throw new Error('openMixerModal() is not available on window');
        await this.page.evaluate(() => (window as any).openMixerModal());
        await expect(this.mixerModal).toBeVisible();
        await expect(this.mixerIframe.locator('body')).toBeVisible();
    }

    async closeMixerModal() {
        // Prefer the inline close button in the iframe header
        const closeBtn = this.mixerIframe.locator('#closeMixerBtn');
        const closeBtnCount = await closeBtn.count();
        if (closeBtnCount > 0) {
            await closeBtn.click();
            await expect(this.mixerModal).toBeHidden();
            return;
        }
        // Fallbacks
        await this.page.keyboard.press('Escape');
        if (await this.mixerModal.isVisible()) {
            await this.page.click('#mixerModal', { position: { x: 5, y: 5 } });
        }
        await expect(this.mixerModal).toBeHidden();
    }

    // --- Lightbox helpers (optional) ---
    async verifyPolaroidsVisible(expected = 9) {
        await expect(this.polaroids).toHaveCount(expected, { timeout: 4000 });
        const count = await this.polaroids.count();
        for (let i = 0; i < count; i++) {
            const fig = this.polaroids.nth(i);
            await fig.scrollIntoViewIfNeeded();
            await expect(fig).toBeVisible();
            const visibleImg = fig.locator('img:visible').first();
            await expect(visibleImg).toBeVisible();
        }
    }
    async openLightboxFromFirstPolaroid() {
        // Wait for puzzle script and at least one card with an image to appear
        await this.page.waitForFunction(() => !!(window as any).dumpPuzzleState, null, { timeout: 2000 }).catch(() => { });
        const cards = this.page.locator('.collage figure.polaroid');
        await cards.first().waitFor({ state: 'visible', timeout: 4000 });
        await cards.first().scrollIntoViewIfNeeded();

        // Wait for any polaroid image to be fully loaded
        await this.page.waitForFunction(() => {
            const imgs = Array.from(document.querySelectorAll('.collage figure.polaroid img')) as HTMLImageElement[];
            return imgs.some(img => img.complete && img.naturalWidth > 0 && img.naturalHeight > 0);
        }, null, { timeout: 4000 }).catch(() => { });

        // Helper to determine if lightbox is open
        const isLightboxOpen = async () => {
            if (this.page.isClosed()) return false;
            return await this.page.evaluate(() => {
                const el = document.getElementById('lightbox');
                if (!el) return false;
                const visible = getComputedStyle(el).display !== 'none';
                return visible || el.classList.contains('open');
            });
        };

        const tryOpen = async (fig: Locator, img: Locator) => {
            if (this.page.isClosed()) return false;
            await fig.scrollIntoViewIfNeeded();
            try {
                await fig.waitFor({ state: 'visible', timeout: 1500 });
                const fh = await fig.elementHandle();
                if (fh) {
                    try { await fh.waitForElementState('stable', { timeout: 1000 }); } catch { }
                }
            } catch { return false; }
            const clickCenter = async (target: Locator) => {
                const box = await target.boundingBox();
                if (box) {
                    const x = Math.floor(box.width / 2);
                    const y = Math.floor(box.height / 2);
                    await target.click({ position: { x, y } });
                } else {
                    await target.click();
                }
            };
            try {
                if (!this.page.isClosed() && await img.count()) {
                    await img.waitFor({ state: 'visible', timeout: 1500 }).catch(() => { });
                    const ih = await img.elementHandle();
                    if (ih) {
                        try { await ih.waitForElementState('stable', { timeout: 800 }); } catch { }
                    }
                    await img.click({ trial: true }).catch(() => { });
                    await clickCenter(img);
                } else {
                    await clickCenter(fig);
                }
            } catch {
                // Force as last resort if page still open
                if (!this.page.isClosed()) {
                    try {
                        if (await img.count()) {
                            await img.click({ force: true });
                        } else {
                            await fig.click({ force: true });
                        }
                    } catch { }
                }
            }
            // Short wait to observe the open state
            try { await this.lightbox.waitFor({ state: 'visible', timeout: 1800 }); } catch { }
            if (await isLightboxOpen()) return true;
            // Keyboard fallback
            try { await fig.focus(); } catch { }
            await this.page.keyboard.press('Enter');
            await this.page.waitForTimeout(80);
            return await isLightboxOpen();
        };

        // Retry tryOpen up to 20 times, rotating through available cards
        const count = await cards.count();
        const maxAttempts = 20;
        let opened = await isLightboxOpen();
        for (let attempt = 0; !opened && attempt < maxAttempts; attempt++) {
            if (this.page.isClosed()) break;
            const idx = count > 0 ? attempt % count : 0;
            const fig = cards.nth(idx);
            const img = fig.locator('img:visible').first();
            opened = await tryOpen(fig, img);
            if (!opened) await this.page.waitForTimeout(75);
        }
        await this.lightbox.waitFor({ state: 'visible', timeout: 4000 }).catch(() => { });
        await expect(this.lightbox).toBeVisible({ timeout: 4000 });
    }

    async closeLightbox() {
        if (!(await this.lightbox.isVisible())) return;
        // Primary: click the close button
        try {
            await this.lightboxClose.click();
        } catch { }
        // If still visible, click the backdrop (top-left corner targets the overlay element)
        if (await this.lightbox.isVisible()) {
            try { await this.page.locator('#lightbox').click({ position: { x: 4, y: 4 } }); } catch { }
        }
        // Final fallback: Escape
        if (await this.lightbox.isVisible()) {
            await this.page.keyboard.press('Escape');
        }
        await expect(this.lightbox).toBeHidden({ timeout: 5000 });
    }

    // --- Puzzle helpers ---
    async triggerSolveChord() {
        // Control+Shift+Alt+S should work cross‑platform (app listens for ctrlKey||metaKey)
        await this.page.keyboard.press('Control+Shift+Alt+S');
    }

    async openSolveModal() {
        await this.triggerSolveChord();
        // Modal builds ~1200ms after solved; allow generous window
        await this.page.waitForTimeout(200);
        await this.puzzleModal.waitFor({ state: 'visible', timeout: 4000 });
        await expect(this.puzzleModal).toBeVisible();
    }

    async clickWitnessExpectPopup() {
        // Read the expected URL from the page runtime (selected at load)
        const expectedUrl = await this.page.evaluate(() => (window as any).__WITNESS_URL || 'https://www.youtube.com/shorts/hkYhlXNTsJQ');
        // Clicking WITNESS opens a new tab and closes the modal
        const [popup] = await Promise.all([
            this.page.waitForEvent('popup'),
            this.puzzleWitnessLink.click()
        ]);
        // Wait for the popup to navigate to the exact URL set on the anchor
        await popup.waitForURL(expectedUrl, { timeout: 7000 }).catch(() => { });
        await expect(this.puzzleModal).toHaveCount(0);
        const finalUrl = popup.url();
        expect(finalUrl).toBe(expectedUrl);
        // Close popup to keep test runner tidy
        await popup.close();
    }

    async clickRejectExpectMixerModal() {
        // Clicking REJECT opens mixer modal (no navigation) and closes puzzle modal
        await this.puzzleRejectLink.click();
        await expect(this.puzzleModal).toHaveCount(0);
        await expect(this.mixerModal).toBeVisible();
        await expect(this.mixerIframe.locator('body')).toBeVisible();
    }
}

export default MainPage;

