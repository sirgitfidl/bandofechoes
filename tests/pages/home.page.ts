import { Locator, Page, FrameLocator } from '@playwright/test';

type MenuLabel = 'About' | 'Videos' | 'Support' | 'Links';

export class MainPage {
    readonly page: Page;

    // Header / nav
    readonly brandTitle: Locator;
    readonly brandLink: Locator;
    readonly navToggle: Locator;
    readonly navMenu: Locator;
    readonly navMenuItems: Locator;

    // Hero
    readonly heroPlayer: Locator;
    readonly heroPoster: Locator;
    readonly heroLatest: Locator;
    readonly heroLatestTitle: Locator;

    // Sections
    readonly sectionWatch: Locator;
    readonly sectionAbout: Locator;
    readonly sectionMusicVideos: Locator;
    readonly sectionSupport: Locator;
    readonly sectionLinks: Locator;

    // Lightbox
    readonly lightbox: Locator;
    readonly lightboxClose: Locator;
    readonly lightboxPrev: Locator;
    readonly lightboxNext: Locator;
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

    // Links and CTAs
    readonly linksGroups: Locator;
    readonly linkGroups: Locator;
    readonly menuLinks: Locator;
    readonly menuAbout: Locator;
    readonly menuMusicVideos: Locator;
    readonly menuSupport: Locator;
    readonly patreonLink: Locator;
    readonly youtubeLink: Locator;
    readonly spotifyLink: Locator;
    readonly appleMusicLink: Locator;
    readonly youtubeMusicLink: Locator;
    readonly tidalLink: Locator;
    readonly tiktokLink: Locator;
    readonly instagramLink: Locator;
    readonly patreonCta2: Locator;
    readonly emailLink: Locator;
    readonly yearEl: Locator;
    readonly skipLink: Locator;
    readonly puzzleModal: Locator;
    readonly aboutCopy: Locator;
    readonly supportBenefits: Locator;
    readonly supportBlurb: Locator;
    readonly supportCtas: Locator;
    readonly supportHeroImage: Locator;
    readonly nextReleaseCountdown: Locator;
    readonly nextReleaseTimer: Locator;
    readonly patreonEarlyAccess: Locator;
    readonly patreonEarlyAccessTimer: Locator;
    readonly ytPlaylist: Locator;
    readonly ytCarouselShell: Locator;
    readonly ytCarouselViewport: Locator;
    readonly ytCarouselTrack: Locator;
    readonly ytCarouselLeft: Locator;
    readonly ytCarouselRight: Locator;

    constructor(page: Page) {
        this.page = page;

        // Header / nav
        this.brandTitle = page.getByTestId('brand-title');
        this.brandLink = page.getByTestId('brand-link');
        this.navToggle = page.getByTestId('nav-toggle');
        this.navMenu = page.getByTestId('nav-menu');
        this.navMenuItems = this.navMenu.locator('[data-menu-item="true"]');

        // Hero
        this.heroPlayer = page.getByTestId('hero-player');
        this.heroPoster = page.getByTestId('hero-poster');
        this.heroLatest = page.getByTestId('hero-latest');
        this.heroLatestTitle = page.getByTestId('hero-latest-title');

        // Sections (ids in index.html)
        this.sectionWatch = page.getByTestId('section-watch');
        this.sectionAbout = page.getByTestId('section-about');
        this.sectionMusicVideos = page.getByTestId('section-music-videos');
        this.sectionSupport = page.getByTestId('section-support');
        this.sectionLinks = page.getByTestId('section-links');

        // Lightbox
        this.lightbox = page.getByTestId('lightbox');
        this.lightboxClose = page.getByTestId('lightbox-close');
        this.lightboxPrev = page.getByTestId('lightbox-prev');
        this.lightboxNext = page.getByTestId('lightbox-next');
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

        // Links and CTAs
        this.linksGroups = page.getByTestId('links-groups');
        this.linkGroups = page.getByTestId('links-group');
        this.menuLinks = page.getByTestId('menu-links');
        this.menuAbout = page.getByTestId('menu-about');
        this.menuMusicVideos = page.getByTestId('menu-music-videos');
        this.menuSupport = page.getByTestId('menu-support');
        this.patreonLink = page.getByTestId('links-patreon');
        this.youtubeLink = page.getByTestId('links-youtube');
        this.spotifyLink = page.getByTestId('links-spotify');
        this.appleMusicLink = page.getByTestId('links-apple-music');
        this.youtubeMusicLink = page.getByTestId('links-youtube-music');
        this.tidalLink = page.getByTestId('links-tidal');
        this.tiktokLink = page.getByTestId('links-tiktok');
        this.instagramLink = page.getByTestId('links-instagram');
        this.patreonCta2 = page.getByTestId('cta-patreon');
        this.emailLink = page.getByTestId('email-link');
        this.yearEl = page.getByTestId('year');
        this.skipLink = page.getByTestId('skip-link');
        this.puzzleModal = page.getByTestId('puzzle-modal');
        this.aboutCopy = page.getByTestId('about-copy');
        this.supportBenefits = page.getByTestId('support-benefit');
        this.supportBlurb = page.getByTestId('support-blurb');
        this.supportCtas = page.getByTestId('support-ctas');
        this.supportHeroImage = page.getByTestId('support-hero-image');
        this.nextReleaseCountdown = page.getByTestId('next-release-countdown');
        this.nextReleaseTimer = page.getByTestId('countdown-timer');
        this.patreonEarlyAccess = page.getByTestId('patreon-early-access');
        this.patreonEarlyAccessTimer = page.getByTestId('countdown-timer-patreon');
        this.ytPlaylist = page.getByTestId('yt-playlist');
        this.ytCarouselShell = page.getByTestId('yt-carousel-shell');
        this.ytCarouselViewport = page.getByTestId('yt-carousel-viewport');
        this.ytCarouselTrack = page.getByTestId('yt-carousel-track');
        this.ytCarouselLeft = page.getByTestId('yt-carousel-left');
        this.ytCarouselRight = page.getByTestId('yt-carousel-right');
    }

    async goto() {
        await this.page.goto('/');
    }

    // --- Nav helpers ---
    async openNav() {
        const expanded = await this.navToggle.getAttribute('aria-expanded');
        if (expanded !== 'true') {
            await this.navToggle.click();
        }
    }

    async closeNav() {
        const expanded = await this.navToggle.getAttribute('aria-expanded');
        if (expanded === 'true') {
            await this.navToggle.click();
        }
    }

    async clickMenu(label: MenuLabel) {
        await this.openNav();
        const menuByLabel: Record<MenuLabel, Locator> = {
            About: this.menuAbout,
            Videos: this.menuMusicVideos,
            Support: this.menuSupport,
            Links: this.menuLinks,
        };
        await menuByLabel[label].click();
    }

    // --- Hero helpers ---
    async clickFeaturedPoster() {
        await this.heroPoster.click();
    }

    // --- Mixer modal helpers ---
    async hasOpenMixerAPI(): Promise<boolean> {
        return await this.page.evaluate(() => typeof (window as any).openMixerModal === 'function');
    }

    async openMixerModal() {
        const hasApi = await this.hasOpenMixerAPI();
        if (!hasApi) throw new Error('openMixerModal() is not available on window');
        await this.page.evaluate(() => (window as any).openMixerModal());
    }

    async closeMixerModal() {
        // Prefer the inline close button in the iframe header
        const closeBtn = this.mixerIframe.locator('#closeMixerBtn');
        const closeBtnCount = await closeBtn.count();
        if (closeBtnCount > 0) {
            await closeBtn.click();
            return;
        }
        // Fallbacks
        await this.page.keyboard.press('Escape');
        if (await this.mixerModal.isVisible()) {
            await this.page.click('#mixerModal', { position: { x: 5, y: 5 } });
        }
    }

    // --- Lightbox helpers (optional) ---
    async scrollPolaroidsIntoView() {
        const count = await this.polaroids.count();
        for (let i = 0; i < count; i++) {
            const fig = this.polaroids.nth(i);
            await fig.scrollIntoViewIfNeeded();
        }
    }

    async openLightboxFromFirstPolaroid() {
        const polaroid = this.polaroids.first();
        await polaroid.scrollIntoViewIfNeeded();
        await polaroid.click();
    }

    async closeLightbox() {
        if (!(await this.lightbox.isVisible())) return;
        try {
            await this.lightboxClose.click();
        } catch { }
        if (await this.lightbox.isVisible()) {
            try { await this.lightbox.click({ position: { x: 4, y: 4 } }); } catch { }
        }
        if (await this.lightbox.isVisible()) {
            await this.page.keyboard.press('Escape');
        }
    }

    // --- Puzzle helpers ---
    async triggerSolveChord() {
        await this.page.keyboard.down('Numpad1');
        await this.page.keyboard.down('Numpad2');
        await this.page.keyboard.down('Numpad3');
        await this.page.keyboard.up('Numpad3');
        await this.page.keyboard.up('Numpad2');
        await this.page.keyboard.up('Numpad1');
    }

    async openSolveModal() {
        await this.triggerSolveChord();
        await this.puzzleModal.waitFor({ state: 'visible', timeout: 4000 });
    }

    async clickWitness(): Promise<{ popup: Page; expectedUrl: string }> {
        const expectedUrl = await this.page.evaluate(() => (window as any).__WITNESS_URL || 'https://www.youtube.com/shorts/hkYhlXNTsJQ');
        const [popup] = await Promise.all([
            this.page.waitForEvent('popup'),
            this.puzzleWitnessLink.click()
        ]);
        await popup.waitForURL(expectedUrl, { timeout: 7000 }).catch(() => { });
        return { popup, expectedUrl };
    }

    async clickReject() {
        await this.puzzleRejectLink.click();
    }
}

export default MainPage;

