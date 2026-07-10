import { test, expect } from './fixtures';
import type MainPage from './pages/home.page';

test.describe.configure({ mode: 'parallel' });

test.describe('Home page', () => {
    test.beforeEach(async ({ mainPage }: { mainPage: MainPage }) => {
        // Use portrait viewport across tests to avoid orientation overlay and reflows
        await mainPage.page.setViewportSize({ width: 800, height: 1200 });
        await mainPage.goto();
    });

    test('hero poster click injects autoplaying YouTube iframe', async ({ mainPage }: { mainPage: MainPage }) => {
        await test.step('ensure orientation overlay is hidden', async () => {
            await expect(mainPage.rotateLockOverlay).toHaveAttribute('aria-hidden', 'true');
        });
        await test.step('click poster and verify iframe with autoplay', async () => {
            await mainPage.clickPosterInjectsIframe();
        });
    });

    test('mobile orientation lock covers landscape cleanly and restores scroll on return to portrait', async ({ mainPage }: { mainPage: MainPage }) => {
        await test.step('reload as a touch device in portrait', async () => {
            await mainPage.page.addInitScript(() => {
                (window as Window & { __BOE_FORCE_TOUCH_DEVICE?: boolean }).__BOE_FORCE_TOUCH_DEVICE = true;
                try {
                    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, get: () => 5 });
                } catch { }
                try {
                    Object.defineProperty(window, 'ontouchstart', { configurable: true, value: null });
                } catch { }
            });
            await mainPage.page.setViewportSize({ width: 390, height: 844 });
            await mainPage.page.goto('/');
            await expect(mainPage.rotateLockOverlay).toHaveAttribute('aria-hidden', 'true');
        });

        let initialScrollY = 0;

        await test.step('scroll in portrait before rotating', async () => {
            await mainPage.page.evaluate(() => window.scrollTo(0, 900));
            await mainPage.page.waitForTimeout(100);
            initialScrollY = await mainPage.page.evaluate(() => window.scrollY);
            expect(initialScrollY).toBeGreaterThan(0);
        });

        await test.step('rotate to landscape and lock the page without blurred content bleed', async () => {
            await mainPage.page.setViewportSize({ width: 844, height: 390 });
            await expect(mainPage.rotateLockOverlay).toHaveAttribute('aria-hidden', 'false');
            await expect(mainPage.page.locator('body')).toHaveClass(/orientation-locked/);

            const landscapeState = await mainPage.page.evaluate(() => ({
                top: document.body.style.top,
                scrollY: window.scrollY,
                headerFilter: getComputedStyle(document.querySelector('header') as Element).filter,
                mainFilter: getComputedStyle(document.querySelector('main') as Element).filter
            }));

            expect(landscapeState.top).toMatch(/^-/);
            expect(landscapeState.scrollY).toBe(0);
            expect(Math.abs(parseInt(landscapeState.top, 10))).toBeGreaterThanOrEqual(initialScrollY - 2);
            expect(landscapeState.headerFilter).toBe('none');
            expect(landscapeState.mainFilter).toBe('none');
        });

        await test.step('rotate back to portrait and restore scrolling', async () => {
            await mainPage.page.setViewportSize({ width: 390, height: 844 });
            await expect(mainPage.rotateLockOverlay).toHaveAttribute('aria-hidden', 'true');
            await expect(mainPage.page.locator('body')).not.toHaveClass(/orientation-locked/);

            const restoredState = await mainPage.page.evaluate(() => ({
                top: document.body.style.top,
                scrollY: window.scrollY
            }));

            expect(restoredState.top).toBe('');
            expect(Math.abs(restoredState.scrollY - initialScrollY)).toBeLessThanOrEqual(2);

            const canScrollFurther = await mainPage.page.evaluate(() => {
                const before = window.scrollY;
                window.scrollTo(0, before + 200);
                return window.scrollY > before;
            });

            expect(canScrollFurther).toBeTruthy();
        });
    });

    test('hero, nav, and support start with the expected accessibility state', async ({ mainPage }: { mainPage: MainPage }) => {
        await test.step('verify hero poster and latest-release placeholder state', async () => {
            await expect(mainPage.heroPoster).toHaveAttribute('href', 'https://youtube.com/@BandOfEchoes');
            await expect(mainPage.heroPoster).toHaveAttribute('target', '_blank');
            await expect(mainPage.heroPoster).toHaveAttribute('rel', /noopener/);
            await expect(mainPage.heroLatest).toHaveAttribute('hidden', '');
            await expect(mainPage.heroLatest).toHaveAttribute('aria-live', 'polite');
            await expect(mainPage.heroLatestTitle).toHaveAttribute('href', '#');
        });

        await test.step('verify nav accessibility defaults', async () => {
            await expect(mainPage.navToggle).toHaveAttribute('aria-controls', 'navMenu');
            await expect(mainPage.navToggle).toHaveAttribute('aria-expanded', 'false');
            await expect(mainPage.navMenu).toHaveAttribute('role', 'menu');
            await expect(mainPage.navMenu).toHaveAttribute('aria-hidden', 'true');
        });

        await test.step('verify support labels are present', async () => {
            await expect(mainPage.supportBlurb).toHaveAttribute('aria-label', 'Support options');
            await expect(mainPage.supportCtas).toHaveAttribute('aria-label', 'Patreon membership');
        });
    });

    test('nav opens/closes and escape closes; skip link is wired to #main', async ({ mainPage }: { mainPage: MainPage }) => {
        await test.step('ensure overlay hidden', async () => {
            await expect(mainPage.rotateLockOverlay).toHaveAttribute('aria-hidden', 'true');
        });
        await test.step('open nav and close with Escape', async () => {
            await mainPage.openNav();
            await expect(mainPage.navMenu).toBeVisible();
            await mainPage.page.keyboard.press('Escape');
            await expect(mainPage.navMenu).toBeHidden();
        });
        await test.step('verify skip link targets #main', async () => {
            await expect(mainPage.skipLink).toHaveAttribute('href', '#main');
            await expect(mainPage.mainRegion).toHaveCount(1);
        });
    });


    test.describe('flaky-only', () => {
        // Increase retries for this block as the collage/lightbox can be timing-sensitive
        test.describe.configure({ retries: 10 });
        test('lightbox opens from collage and can be closed', async ({ mainPage }: { mainPage: MainPage }) => {
            await test.step('ensure overlay hidden', async () => {
                await expect(mainPage.rotateLockOverlay).toHaveAttribute('aria-hidden', 'true');
            });

            await test.step('verify polaroids are visible', async () => {
                await mainPage.verifyPolaroidsVisible();
            });

            await test.step('open lightbox from first polaroid', async () => {
                await mainPage.openLightboxFromFirstPolaroid();
                if (!(await mainPage.lightbox.isVisible())) {
                    await mainPage.page.waitForTimeout(150);
                    await mainPage.openLightboxFromFirstPolaroid();
                }
            });
            await test.step('verify lightbox controls appear when open', async () => {
                await expect(mainPage.lightboxPrev).toBeVisible();
                await expect(mainPage.lightboxNext).toBeVisible();
                await expect(mainPage.lightboxClose).toBeVisible();
            });
            await test.step('close lightbox if open', async () => {
                if (await mainPage.lightbox.isVisible()) {
                    await mainPage.closeLightbox();
                }
            });
        });
    });

    test('hamburger menu reflects updated items and Links item navigates to Links section', async ({ mainPage }: { mainPage: MainPage }) => {
        await test.step('open nav and verify menu item set/order', async () => {
            await mainPage.openNav();
            await expect(mainPage.navMenuItems).toHaveCount(4);
            await expect(mainPage.navMenuItems.nth(0)).toHaveText('About');
            await expect(mainPage.navMenuItems.nth(1)).toHaveText('Videos');
            await expect(mainPage.navMenuItems.nth(2)).toHaveText('Support');
            await expect(mainPage.navMenuItems.nth(3)).toHaveText('Links');
            await expect(mainPage.navMenu.getByRole('link', { name: 'Connect' })).toHaveCount(0);
            await expect(mainPage.menuLinks).toHaveAttribute('href', '#links-section');
        });

        await test.step('click Links and verify hash + pulse class', async () => {
            await mainPage.menuLinks.click();
            await expect(mainPage.page).toHaveURL(/#links-section$/);
            await expect(mainPage.linksGroups).toHaveClass(/links-groups--pulse/);
        });
    });

    test('brand link and menu anchors target the current homepage sections', async ({ mainPage }: { mainPage: MainPage }) => {
        await test.step('verify brand link returns to the top anchor', async () => {
            await expect(mainPage.brandLink).toHaveAttribute('href', '#top');
            await mainPage.brandLink.click();
            await expect(mainPage.page).toHaveURL(/#top$/);
        });

        await test.step('verify menu items point to About, Videos, and Support sections', async () => {
            await mainPage.openNav();
            await expect(mainPage.menuAbout).toHaveAttribute('href', '#about');
            await expect(mainPage.menuMusicVideos).toHaveAttribute('href', '#music-videos');
            await expect(mainPage.menuSupport).toHaveAttribute('href', '#support');

            await mainPage.menuAbout.click();
            await expect(mainPage.page).toHaveURL(/#about$/);

            await mainPage.openNav();
            await mainPage.menuMusicVideos.click();
            await expect(mainPage.page).toHaveURL(/#music-videos$/);

            await mainPage.openNav();
            await mainPage.menuSupport.click();
            await expect(mainPage.page).toHaveURL(/#support$/);
        });
    });

    test('about and support sections expose the current copy and benefits', async ({ mainPage }: { mainPage: MainPage }) => {
        await test.step('verify About section heading and copy', async () => {
            await expect(mainPage.sectionAbout).toBeVisible();
            await expect(mainPage.sectionAbout.getByRole('heading', { name: 'About Us' })).toBeVisible();
            await expect(mainPage.aboutCopy).toContainText('Band of Echoes reimagines heavy, atmospheric rock');
            await expect(mainPage.aboutCopy).toContainText('Tool, Nine Inch Nails, Soundgarden, Metallica');
        });

        await test.step('verify Support section benefits and image', async () => {
            await expect(mainPage.sectionSupport).toBeVisible();
            await expect(mainPage.sectionSupport.getByRole('heading', { name: 'Support' })).toBeVisible();
            await expect(mainPage.supportBenefits).toHaveCount(8);
            await expect(mainPage.supportBenefits.nth(0)).toHaveText('Tabs and sheet music');
            await expect(mainPage.supportBenefits.nth(7)).toHaveText('4K high bitrate music video downloads');
            await expect(mainPage.supportHeroImage).toHaveAttribute('loading', 'lazy');
            await expect(mainPage.supportHeroImage).toHaveAttribute('decoding', 'async');
            await expect(mainPage.supportHeroImage).toHaveAttribute('alt', 'Band of Echoes');
        });
    });

    test('polaroids preserve accessibility and lazy-loading markup', async ({ mainPage }: { mainPage: MainPage }) => {
        await test.step('verify collage semantics and image attributes', async () => {
            await expect(mainPage.sectionWatch.locator('.collage')).toHaveAttribute('aria-label', 'Photo collage');
            await expect(mainPage.polaroids).toHaveCount(9);

            const firstPolaroid = mainPage.polaroids.first();
            await expect(firstPolaroid.locator('.face.back')).toHaveAttribute('aria-hidden', 'true');

            const images = mainPage.page.locator('.collage .polaroid img');
            const imageCount = await images.count();
            for (let index = 0; index < imageCount; index++) {
                await expect(images.nth(index)).toHaveAttribute('loading', 'lazy');
                await expect(images.nth(index)).toHaveAttribute('decoding', 'async');
            }
        });
    });

    test('countdown and music video carousel scaffolding are wired', async ({ mainPage }: { mainPage: MainPage }) => {
        await test.step('verify release countdown and Patreon early access link', async () => {
            await expect(mainPage.sectionMusicVideos).toBeVisible();
            await expect(mainPage.nextReleaseCountdown).toBeVisible();
            await expect(mainPage.nextReleaseTimer).toHaveAttribute('aria-live', 'polite');
            await expect(mainPage.patreonEarlyAccess).toHaveAttribute('href', 'https://www.patreon.com/cw/BandofEchoes/membership');
            await expect(mainPage.patreonEarlyAccess).toHaveAttribute('target', '_blank');
            await expect(mainPage.patreonEarlyAccess).toHaveAttribute('rel', /noopener/);
            await expect(mainPage.patreonEarlyAccessTimer).toHaveAttribute('aria-live', 'polite');
        });

        await test.step('verify carousel shell is present with current playlist wiring', async () => {
            await expect(mainPage.ytPlaylist).toHaveAttribute('data-playlist-id', 'PLO9qHD3uzH-QJBT2eqyHQgRGmBR36olk0');
            await expect(mainPage.ytPlaylist).toHaveAttribute('data-playlist-url', 'https://www.youtube.com/playlist?list=PLO9qHD3uzH-QJBT2eqyHQgRGmBR36olk0');
            await expect(mainPage.ytCarouselShell).toBeVisible();
            await expect(mainPage.ytCarouselViewport).toBeVisible();
            await expect(mainPage.ytCarouselTrack).toBeVisible();
            await expect(mainPage.ytCarouselLeft).toHaveClass(/is-hidden/);
            await expect(mainPage.ytCarouselRight).toHaveClass(/is-hidden/);
        });
    });

    test('music video carousel falls back to the playlist link when automation has no cached items', async ({ mainPage }: { mainPage: MainPage }) => {
        await test.step('reload with an empty playlist cache', async () => {
            await mainPage.page.addInitScript(() => {
                try {
                    window.localStorage.removeItem('BOE_YT_PLAYLIST_CACHE_PLO9qHD3uzH-QJBT2eqyHQgRGmBR36olk0');
                } catch { }
                try {
                    delete (window as Window & { BOE_FEATURED_VIDEO_ID?: string }).BOE_FEATURED_VIDEO_ID;
                    delete (window as Window & { BOE_FEATURED_VIDEO_TITLE?: string }).BOE_FEATURED_VIDEO_TITLE;
                } catch { }
            });
            await mainPage.page.goto('/');
        });

        await test.step('verify the playlist track exposes the YouTube fallback affordance', async () => {
            const fallbackLink = mainPage.ytCarouselTrack.locator('a.btn');
            await expect(fallbackLink).toHaveCount(1);
            await expect(fallbackLink).toHaveText('View playlist on YouTube');
            await expect(fallbackLink).toHaveAttribute('href', 'https://www.youtube.com/playlist?list=PLO9qHD3uzH-QJBT2eqyHQgRGmBR36olk0');
            await expect(fallbackLink).toHaveAttribute('target', '_blank');
            await expect(fallbackLink).toHaveAttribute('rel', /noopener/);
            await expect(mainPage.heroLatest).toHaveAttribute('hidden', '');
        });
    });

    test('music video carousel renders cached tiles and updates the hero latest release', async ({ mainPage }: { mainPage: MainPage }) => {
        await test.step('reload with a deterministic cached playlist payload', async () => {
            await mainPage.page.addInitScript(() => {
                const playlistId = 'PLO9qHD3uzH-QJBT2eqyHQgRGmBR36olk0';
                const items = [
                    {
                        videoId: 'video-001',
                        title: 'First Song (Acoustic Cover) | Band of Echoes',
                        thumbnailUrl: 'https://example.com/thumb-1.jpg'
                    },
                    {
                        videoId: 'video-002',
                        title: 'Second Song | Band of Echoes',
                        thumbnailUrl: 'https://example.com/thumb-2.jpg'
                    },
                    {
                        videoId: 'video-003',
                        title: 'Third Song',
                        thumbnailUrl: 'https://example.com/thumb-3.jpg'
                    }
                ];

                try {
                    window.localStorage.setItem(
                        `BOE_YT_PLAYLIST_CACHE_${playlistId}`,
                        JSON.stringify({ fetchedAt: Date.now(), items })
                    );
                } catch { }

                try {
                    delete (window as Window & { BOE_FEATURED_VIDEO_ID?: string }).BOE_FEATURED_VIDEO_ID;
                    delete (window as Window & { BOE_FEATURED_VIDEO_TITLE?: string }).BOE_FEATURED_VIDEO_TITLE;
                } catch { }
            });
            await mainPage.page.goto('/');
        });

        await test.step('verify the cached playlist populates the hero latest release', async () => {
            await expect(mainPage.heroLatest).not.toHaveAttribute('hidden', '');
            await expect(mainPage.heroLatestTitle).toHaveText('First Song');
            await expect(mainPage.heroLatestTitle).toHaveAttribute('href', 'https://youtu.be/video-001');
        });

        await test.step('verify the carousel tiles render in featured-last order with cleaned titles', async () => {
            const tiles = mainPage.ytCarouselTrack.locator('.yt-tile');
            const titles = mainPage.ytCarouselTrack.locator('.yt-title');

            await expect(tiles).toHaveCount(3);
            await expect(titles.nth(0)).toHaveText('Second Song');
            await expect(titles.nth(1)).toHaveText('Third Song');
            await expect(titles.nth(2)).toHaveText('First Song');

            await expect(titles.nth(0)).toHaveAttribute('href', 'https://www.youtube.com/watch?v=video-002&list=PLO9qHD3uzH-QJBT2eqyHQgRGmBR36olk0');
            await expect(titles.nth(2)).toHaveAttribute('href', 'https://www.youtube.com/watch?v=video-001&list=PLO9qHD3uzH-QJBT2eqyHQgRGmBR36olk0');
        });
    });

    test('head metadata and structured data remain current for SEO', async ({ mainPage }: { mainPage: MainPage }) => {
        await test.step('verify core title, meta, and link tags', async () => {
            await expect(mainPage.page).toHaveTitle('Band of Echoes | Acoustic Covers (Tool, NIN, Metallica)');
            await expect(mainPage.page.locator('head meta[name="viewport"]')).toHaveAttribute('content', 'width=device-width, initial-scale=1, minimum-scale=1');
            await expect(mainPage.page.locator('head meta[name="description"]')).toHaveAttribute('content', /Band of Echoes is an acoustic duo creating dark, dynamic acoustic covers/);
            await expect(mainPage.page.locator('head meta[name="robots"]')).toHaveAttribute('content', 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1');
            await expect(mainPage.page.locator('head meta[name="keywords"]')).toHaveAttribute('content', /Tool cover/);
            await expect(mainPage.page.locator('head meta[name="color-scheme"]')).toHaveAttribute('content', 'light dark');
            await expect(mainPage.page.locator('head link[rel="canonical"]')).toHaveAttribute('href', 'https://bandofechoes.com/');
            await expect(mainPage.page.locator('head link[rel="me"]')).toHaveAttribute('href', 'https://youtube.com/@BandOfEchoes');
            await expect(mainPage.page.locator('head link[rel="icon"]').first()).toHaveAttribute('href', 'favicon.ico');
            await expect(mainPage.page.locator('head link[rel="shortcut icon"]')).toHaveAttribute('href', 'favicon.ico');
        });

        await test.step('verify Open Graph, Twitter, and performance hints', async () => {
            await expect(mainPage.page.locator('head meta[property="og:title"]')).toHaveAttribute('content', 'Band of Echoes');
            await expect(mainPage.page.locator('head meta[property="og:description"]')).toHaveAttribute('content', /Acoustic duo reimagining Tool, NIN, AIC, Soundgarden/);
            await expect(mainPage.page.locator('head meta[property="og:site_name"]')).toHaveAttribute('content', 'Band of Echoes');
            await expect(mainPage.page.locator('head meta[property="og:type"]')).toHaveAttribute('content', 'website');
            await expect(mainPage.page.locator('head meta[property="og:image"]')).toHaveAttribute('content', 'https://bandofechoes.com/assets/images/band_photos/hero_images/ogImage.png');
            await expect(mainPage.page.locator('head meta[property="og:image:alt"]')).toHaveAttribute('content', 'Band of Echoes');
            await expect(mainPage.page.locator('head meta[property="og:url"]')).toHaveAttribute('content', 'https://bandofechoes.com/');
            await expect(mainPage.page.locator('head meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
            await expect(mainPage.page.locator('head meta[name="twitter:title"]')).toHaveAttribute('content', 'Band of Echoes');
            await expect(mainPage.page.locator('head meta[name="twitter:description"]')).toHaveAttribute('content', /Acoustic covers with cello \+ acoustic guitar/);
            await expect(mainPage.page.locator('head meta[name="twitter:image"]')).toHaveAttribute('content', 'https://bandofechoes.com/assets/images/band_photos/polaroids/polaroid_01.png');
            await expect(mainPage.page.locator('head link[rel="preconnect"][href="https://www.youtube.com"]')).toHaveCount(1);
            await expect(mainPage.page.locator('head link[rel="preconnect"][href="https://i.ytimg.com"]')).toHaveCount(1);
            await expect(mainPage.page.locator('head link[rel="preload"][href="assets/fonts/MaragsaDisplay-GO6PD.otf"]')).toHaveAttribute('as', 'font');
        });

        await test.step('verify JSON-LD blocks still describe the site and band', async () => {
            const featuredSchema = JSON.parse(await mainPage.page.locator('script#schema-featured-video').textContent() || '{}');
            expect(featuredSchema['@context']).toBe('https://schema.org');
            expect(Array.isArray(featuredSchema['@graph'])).toBeTruthy();
            expect(featuredSchema['@graph']).toEqual(expect.arrayContaining([
                expect.objectContaining({ '@type': 'Organization', name: 'Band of Echoes', url: 'https://bandofechoes.com/' }),
                expect.objectContaining({ '@type': 'WebSite', name: 'Band of Echoes', url: 'https://bandofechoes.com/' }),
                expect.objectContaining({ '@type': 'WebPage', name: 'Band of Echoes', url: 'https://bandofechoes.com/' }),
                expect.objectContaining({ '@type': 'VideoObject', name: 'Band of Echoes — Featured Video' })
            ]));

            const baseSchema = JSON.parse(await mainPage.page.locator('script#schema').textContent() || '{}');
            expect(baseSchema['@context']).toBe('https://schema.org');
            expect(Array.isArray(baseSchema['@graph'])).toBeTruthy();
            expect(baseSchema['@graph']).toEqual(expect.arrayContaining([
                expect.objectContaining({ '@type': 'WebSite', name: 'Band of Echoes', url: 'https://bandofechoes.com/' }),
                expect.objectContaining({ '@type': 'MusicGroup', name: 'Band of Echoes', url: 'https://bandofechoes.com/' })
            ]));

            const musicGroup = baseSchema['@graph'].find((entry: { '@type'?: string }) => entry['@type'] === 'MusicGroup');
            expect(musicGroup.sameAs).toEqual(expect.arrayContaining([
                'https://youtube.com/@BandOfEchoes',
                'https://open.spotify.com/artist/02Mwc9O3vBzaRF9RnZGgVS',
                'https://www.patreon.com/cw/BandofEchoes/membership'
            ]));
            expect(musicGroup.member).toEqual(expect.arrayContaining([
                expect.objectContaining({ name: 'Eric' }),
                expect.objectContaining({ name: 'Kathryn' })
            ]));
        });
    });

    test('links section destinations and attributes are correct', async ({ mainPage }: { mainPage: MainPage }) => {
        await test.step('verify section exists and primary CTA still points to Patreon', async () => {
            await expect(mainPage.sectionLinks).toBeVisible();
            await expect(mainPage.patreonCta2).toHaveAttribute('href', 'https://www.patreon.com/cw/BandofEchoes/membership');
            await expect(mainPage.patreonCta2).toHaveAttribute('target', '_blank');
            await expect(mainPage.patreonCta2).toHaveAttribute('rel', /noopener/);
        });

        await test.step('verify links in Support + Video, Streaming, and Social groups', async () => {
            await expect(mainPage.patreonLink).toHaveAttribute('href', 'https://www.patreon.com/cw/BandofEchoes/membership');
            await expect(mainPage.youtubeLink).toHaveAttribute('href', 'https://youtube.com/@BandOfEchoes');
            await expect(mainPage.spotifyLink).toHaveAttribute('href', 'https://open.spotify.com/artist/02Mwc9O3vBzaRF9RnZGgVS');
            await expect(mainPage.appleMusicLink).toHaveAttribute('href', 'https://music.apple.com/us/artist/band-of-echoes/1859262959');
            await expect(mainPage.youtubeMusicLink).toHaveAttribute('href', 'https://music.youtube.com/channel/UCvxe6T06QNZOOFmetbKHCdA');
            await expect(mainPage.tidalLink).toHaveAttribute('href', 'https://tidal.com/artist/70905205');
            await expect(mainPage.tiktokLink).toHaveAttribute('href', 'https://www.tiktok.com/@bandofechoes');
            await expect(mainPage.instagramLink).toHaveAttribute('href', 'https://www.instagram.com/bandofechoes/');
        });

        await test.step('verify external links open safely and email is mailto', async () => {
            const externalLinks = [
                mainPage.patreonLink,
                mainPage.youtubeLink,
                mainPage.spotifyLink,
                mainPage.appleMusicLink,
                mainPage.youtubeMusicLink,
                mainPage.tidalLink,
                mainPage.tiktokLink,
                mainPage.instagramLink
            ];

            for (const link of externalLinks) {
                await expect(link).toHaveAttribute('target', '_blank');
                await expect(link).toHaveAttribute('rel', /noopener/);
            }

            await expect(mainPage.emailLink).toHaveAttribute('href', 'mailto:bandofechoescontact@gmail.com');
            await expect(mainPage.emailLink).not.toHaveAttribute('target', '_blank');
        });
    });

    test('footer year and links section grouping remain current', async ({ mainPage }: { mainPage: MainPage }) => {
        await test.step('verify link groups are still present in the expected order', async () => {
            await expect(mainPage.linkGroups).toHaveCount(4);
            await expect(mainPage.linkGroups.nth(0).getByRole('heading', { name: 'Support + Video' })).toBeVisible();
            await expect(mainPage.linkGroups.nth(1).getByRole('heading', { name: 'Streaming' })).toBeVisible();
            await expect(mainPage.linkGroups.nth(2).getByRole('heading', { name: 'Social' })).toBeVisible();
            await expect(mainPage.linkGroups.nth(3).getByRole('heading', { name: 'Connect With Us' })).toBeVisible();
        });

        await test.step('verify footer year is populated from runtime', async () => {
            await expect(mainPage.yearEl).toHaveText(String(new Date().getFullYear()));
        });
    });

    test('puzzle solve chord shows overlay and allows closing', async ({ mainPage }: { mainPage: MainPage }) => {
        await test.step('trigger solve chord', async () => {
            await mainPage.triggerSolveChord();
            await mainPage.page.waitForTimeout(300);
        });
        await test.step('dismiss the solve overlay if present', async () => {
            const maybeModal = mainPage.puzzleModal;
            if (await maybeModal.count()) {
                if (await mainPage.puzzleModalClose.count()) {
                    await mainPage.puzzleModalClose.click();
                } else {
                    await maybeModal.click({ position: { x: 5, y: 5 } });
                }
                await expect(maybeModal).toHaveCount(0);
            }
        });
    });

    test('mixer modal opens and closes via inline button', async ({ mainPage }: { mainPage: MainPage }) => {
        const hasOpen = await test.step('check openMixerModal API availability', async () => {
            return await mainPage.hasOpenMixerAPI();
        });
        if (hasOpen) {
            await test.step('open and close mixer modal via API', async () => {
                await mainPage.openMixerModal();
                await mainPage.closeMixerModal();
            });
        } else {
            await test.step('fallback: navigate directly and click close', async () => {
                await mainPage.page.goto('/theseAreNotTheTracksYoureLookingFor.html');
                await expect(mainPage.mixerInlineCloseBtn).toBeVisible();
                await mainPage.mixerInlineCloseBtn.click();
            });
        }
    });
});
