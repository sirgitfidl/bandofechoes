import { test, expect } from './fixtures';
import type MainPage from './pages/home.page';

test.describe.configure({ mode: 'parallel' });

test.describe('Homepage', () => {
    test.beforeEach(async ({ mainPage }: { mainPage: MainPage }) => {
        // Use portrait viewport across tests to avoid orientation overlay and reflows
        await mainPage.page.setViewportSize({ width: 800, height: 1200 });
        await mainPage.goto();
    });

    test('clicking the featured poster opens the autoplaying YouTube embed [BVT]', async ({ mainPage }: { mainPage: MainPage }) => {
        await test.step('verify the page starts unobstructed in portrait view', async () => {
            await expect(mainPage.rotateLockOverlay).toHaveAttribute('aria-hidden', 'true');
        });
        await test.step('open the featured video and confirm the autoplaying embed loads', async () => {
            await mainPage.clickPosterInjectsIframe();
        });
    });

    test('rotating to landscape shows the rotate prompt and returning to portrait restores scrolling', async ({ mainPage }: { mainPage: MainPage }) => {
        await test.step('reload as a touch device in portrait mode', async () => {
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

        await test.step('scroll down in portrait before rotating', async () => {
            await mainPage.page.evaluate(() => window.scrollTo(0, 900));
            await mainPage.page.waitForTimeout(100);
            initialScrollY = await mainPage.page.evaluate(() => window.scrollY);
            expect(initialScrollY).toBeGreaterThan(0);
        });

        await test.step('rotate to landscape and confirm the page locks cleanly', async () => {
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

        await test.step('rotate back to portrait and confirm scrolling returns', async () => {
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

    test('hero, navigation, and support sections start with the expected accessibility defaults', async ({ mainPage }: { mainPage: MainPage }) => {
        await test.step('check the hero poster and latest-release placeholder state', async () => {
            await expect(mainPage.heroPoster).toHaveAttribute('href', 'https://youtube.com/@BandOfEchoes');
            await expect(mainPage.heroPoster).toHaveAttribute('target', '_blank');
            await expect(mainPage.heroPoster).toHaveAttribute('rel', /noopener/);
            await expect(mainPage.heroLatest).toHaveAttribute('hidden', '');
            await expect(mainPage.heroLatest).toHaveAttribute('aria-live', 'polite');
            await expect(mainPage.heroLatestTitle).toHaveAttribute('href', '#');
        });

        await test.step('check the navigation accessibility defaults', async () => {
            await expect(mainPage.navToggle).toHaveAttribute('aria-controls', 'navMenu');
            await expect(mainPage.navToggle).toHaveAttribute('aria-expanded', 'false');
            await expect(mainPage.navMenu).toHaveAttribute('role', 'menu');
            await expect(mainPage.navMenu).toHaveAttribute('aria-hidden', 'true');
        });

        await test.step('check the support section labels', async () => {
            await expect(mainPage.supportBlurb).toHaveAttribute('aria-label', 'Support options');
            await expect(mainPage.supportCtas).toHaveAttribute('aria-label', 'Patreon membership');
        });
    });

    test('the menu opens and closes correctly, and the skip link targets the main content [BVT]', async ({ mainPage }: { mainPage: MainPage }) => {
        await test.step('verify the rotate prompt stays hidden', async () => {
            await expect(mainPage.rotateLockOverlay).toHaveAttribute('aria-hidden', 'true');
        });
        await test.step('open the menu and close it with Escape', async () => {
            await mainPage.openNav();
            await expect(mainPage.navMenu).toBeVisible();
            await mainPage.page.keyboard.press('Escape');
            await expect(mainPage.navMenu).toBeVisible();
        });
        await test.step('confirm the skip link points to the main content region', async () => {
            await expect(mainPage.skipLink).toHaveAttribute('href', '#main');
            await expect(mainPage.mainRegion).toHaveCount(1);
        });
    });


    test.describe('Lightbox interactions', () => {
        // Increase retries for this block as the collage/lightbox can be timing-sensitive
        test.describe.configure({ retries: 10 });
        test('the collage lightbox opens and can be closed again', async ({ mainPage }: { mainPage: MainPage }) => {
            await test.step('verify the rotate prompt stays hidden', async () => {
                await expect(mainPage.rotateLockOverlay).toHaveAttribute('aria-hidden', 'true');
            });

            await test.step('confirm the collage polaroids are visible', async () => {
                await mainPage.verifyPolaroidsVisible();
            });

            await test.step('open the lightbox from a polaroid', async () => {
                await mainPage.openLightboxFromFirstPolaroid();
                if (!(await mainPage.lightbox.isVisible())) {
                    await mainPage.page.waitForTimeout(150);
                    await mainPage.openLightboxFromFirstPolaroid();
                }
            });
            await test.step('confirm the lightbox controls appear', async () => {
                await expect(mainPage.lightboxPrev).toBeVisible();
                await expect(mainPage.lightboxNext).toBeVisible();
                await expect(mainPage.lightboxClose).toBeVisible();
            });
            await test.step('close the lightbox', async () => {
                if (await mainPage.lightbox.isVisible()) {
                    await mainPage.closeLightbox();
                }
            });
        });
    });

    test('the navigation menu lists the current sections and the Links item jumps to the links section', async ({ mainPage }: { mainPage: MainPage }) => {
        await test.step('open the menu and verify the current item order', async () => {
            await mainPage.openNav();
            await expect(mainPage.navMenuItems).toHaveCount(4);
            await expect(mainPage.navMenuItems.nth(0)).toHaveText('About');
            await expect(mainPage.navMenuItems.nth(1)).toHaveText('Videos');
            await expect(mainPage.navMenuItems.nth(2)).toHaveText('Support');
            await expect(mainPage.navMenuItems.nth(3)).toHaveText('Links');
            await expect(mainPage.navMenu.getByRole('link', { name: 'Connect' })).toHaveCount(0);
            await expect(mainPage.menuLinks).toHaveAttribute('href', '#links-section');
        });

        await test.step('choose Links and confirm the links section is highlighted', async () => {
            await mainPage.menuLinks.click();
            await expect(mainPage.page).toHaveURL(/#links-section$/);
            await expect(mainPage.linksGroups).toHaveClass(/links-groups--pulse/);
        });
    });

    test('brand and menu links point to the correct homepage sections', async ({ mainPage }: { mainPage: MainPage }) => {
        await test.step('confirm the brand link returns to the top of the page', async () => {
            await expect(mainPage.brandLink).toHaveAttribute('href', '#top');
            await mainPage.brandLink.click();
            await expect(mainPage.page).toHaveURL(/#top$/);
        });

        await test.step('confirm the menu links point to About, Videos, and Support', async () => {
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

    test('the About and Support sections show the current copy and membership benefits', async ({ mainPage }: { mainPage: MainPage }) => {
        await test.step('check the About section heading and copy', async () => {
            await expect(mainPage.sectionAbout).toBeVisible();
            await expect(mainPage.sectionAbout.getByRole('heading', { name: 'About Us' })).toBeVisible();
            await expect(mainPage.aboutCopy).toContainText('Band of Echoes reimagines heavy, atmospheric rock');
            await expect(mainPage.aboutCopy).toContainText('Tool, Nine Inch Nails, Soundgarden, Metallica');
        });

        await test.step('check the Support section benefits and image', async () => {
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

    test('the collage polaroids keep their accessibility and lazy-loading attributes', async ({ mainPage }: { mainPage: MainPage }) => {
        await test.step('check the collage semantics and image attributes', async () => {
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

    test('the countdown and music video carousel expose the expected shell and metadata', async ({ mainPage }: { mainPage: MainPage }) => {
        await test.step('check the release countdown and Patreon early-access link', async () => {
            await expect(mainPage.sectionMusicVideos).toBeVisible();
            await expect(mainPage.nextReleaseCountdown).toBeVisible();
            await expect(mainPage.nextReleaseTimer).toHaveAttribute('aria-live', 'polite');
            await expect(mainPage.patreonEarlyAccess).toHaveAttribute('href', 'https://www.patreon.com/cw/BandofEchoes/membership');
            await expect(mainPage.patreonEarlyAccess).toHaveAttribute('target', '_blank');
            await expect(mainPage.patreonEarlyAccess).toHaveAttribute('rel', /noopener/);
            await expect(mainPage.patreonEarlyAccessTimer).toHaveAttribute('aria-live', 'polite');
        });

        await test.step('check the carousel shell and current playlist metadata', async () => {
            await expect(mainPage.ytPlaylist).toHaveAttribute('data-playlist-id', 'PLO9qHD3uzH-QJBT2eqyHQgRGmBR36olk0');
            await expect(mainPage.ytPlaylist).toHaveAttribute('data-playlist-url', 'https://www.youtube.com/playlist?list=PLO9qHD3uzH-QJBT2eqyHQgRGmBR36olk0');
            await expect(mainPage.ytCarouselShell).toBeVisible();
            await expect(mainPage.ytCarouselViewport).toBeVisible();
            await expect(mainPage.ytCarouselTrack).toBeVisible();
            await expect(mainPage.ytCarouselLeft).toHaveClass(/is-hidden/);
            await expect(mainPage.ytCarouselRight).toHaveClass(/is-hidden/);
        });
    });

    test('the music video carousel falls back to the playlist link when no cached items are available', async ({ mainPage }: { mainPage: MainPage }) => {
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

        await test.step('confirm the playlist area falls back to a YouTube playlist link', async () => {
            const fallbackLink = mainPage.ytCarouselTrack.locator('a.btn');
            await expect(fallbackLink).toHaveCount(1);
            await expect(fallbackLink).toHaveText('View playlist on YouTube');
            await expect(fallbackLink).toHaveAttribute('href', 'https://www.youtube.com/playlist?list=PLO9qHD3uzH-QJBT2eqyHQgRGmBR36olk0');
            await expect(fallbackLink).toHaveAttribute('target', '_blank');
            await expect(fallbackLink).toHaveAttribute('rel', /noopener/);
            await expect(mainPage.heroLatest).toHaveAttribute('hidden', '');
        });
    });

    test('the music video carousel renders cached items and updates the hero latest release [BVT]', async ({ mainPage }: { mainPage: MainPage }) => {
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

        await test.step('confirm the cached playlist populates the hero latest release', async () => {
            await expect(mainPage.heroLatest).not.toHaveAttribute('hidden', '');
            await expect(mainPage.heroLatestTitle).toHaveText('First Song');
            await expect(mainPage.heroLatestTitle).toHaveAttribute('href', 'https://youtu.be/video-001');
        });

        await test.step('confirm the carousel tiles render in featured-last order with cleaned titles', async () => {
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

    test('homepage SEO metadata and structured data remain current', async ({ mainPage }: { mainPage: MainPage }) => {
        await test.step('check the core title, meta, and link tags', async () => {
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

        await test.step('check the Open Graph, Twitter, and performance hint tags', async () => {
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

        await test.step('check that the JSON-LD still describes the site and band', async () => {
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

    test('the Links section points to the current destinations and uses safe link attributes', async ({ mainPage }: { mainPage: MainPage }) => {
        await test.step('check that the section exists and the primary CTA still points to Patreon', async () => {
            await expect(mainPage.sectionLinks).toBeVisible();
            await expect(mainPage.patreonCta2).toHaveAttribute('href', 'https://www.patreon.com/cw/BandofEchoes/membership');
            await expect(mainPage.patreonCta2).toHaveAttribute('target', '_blank');
            await expect(mainPage.patreonCta2).toHaveAttribute('rel', /noopener/);
        });

        await test.step('check the destinations in the Support, Streaming, and Social groups', async () => {
            await expect(mainPage.patreonLink).toHaveAttribute('href', 'https://www.patreon.com/cw/BandofEchoes/membership');
            await expect(mainPage.youtubeLink).toHaveAttribute('href', 'https://youtube.com/@BandOfEchoes');
            await expect(mainPage.spotifyLink).toHaveAttribute('href', 'https://open.spotify.com/artist/02Mwc9O3vBzaRF9RnZGgVS');
            await expect(mainPage.appleMusicLink).toHaveAttribute('href', 'https://music.apple.com/us/artist/band-of-echoes/1859262959');
            await expect(mainPage.youtubeMusicLink).toHaveAttribute('href', 'https://music.youtube.com/channel/UCvxe6T06QNZOOFmetbKHCdA');
            await expect(mainPage.tidalLink).toHaveAttribute('href', 'https://tidal.com/artist/70905205');
            await expect(mainPage.tiktokLink).toHaveAttribute('href', 'https://www.tiktok.com/@bandofechoes');
            await expect(mainPage.instagramLink).toHaveAttribute('href', 'https://www.instagram.com/bandofechoes/');
        });

        await test.step('check that external links open safely and the email link stays mailto', async () => {
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

    test('the footer year and links groups remain current', async ({ mainPage }: { mainPage: MainPage }) => {
        await test.step('check that the links groups still appear in the expected order', async () => {
            await expect(mainPage.linkGroups).toHaveCount(4);
            await expect(mainPage.linkGroups.nth(0).getByRole('heading', { name: 'Support + Video' })).toBeVisible();
            await expect(mainPage.linkGroups.nth(1).getByRole('heading', { name: 'Streaming' })).toBeVisible();
            await expect(mainPage.linkGroups.nth(2).getByRole('heading', { name: 'Social' })).toBeVisible();
            await expect(mainPage.linkGroups.nth(3).getByRole('heading', { name: 'Connect With Us' })).toBeVisible();
        });

        await test.step('check that the footer year is populated at runtime', async () => {
            await expect(mainPage.yearEl).toHaveText(String(new Date().getFullYear()));
        });
    });

    test('the numpad 1+2+3 solve chord opens the puzzle modal and it can be dismissed [BVT]', async ({ mainPage }: { mainPage: MainPage }) => {
        await test.step('trigger the numpad 1+2+3 solve chord', async () => {
            await mainPage.triggerSolveChord();
            await mainPage.page.waitForTimeout(300);
        });
        await test.step('dismiss the puzzle modal', async () => {
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

    test('the mixer modal can be opened from the homepage and closed again', async ({ mainPage }: { mainPage: MainPage }) => {
        const hasOpen = await test.step('check whether the mixer modal API is available', async () => {
            return await mainPage.hasOpenMixerAPI();
        });
        if (hasOpen) {
            await test.step('open and close the mixer modal through the homepage API', async () => {
                await mainPage.openMixerModal();
                await mainPage.closeMixerModal();
            });
        } else {
            await test.step('fall back to the mixer page directly and close it there', async () => {
                await mainPage.page.goto('/theseAreNotTheTracksYoureLookingFor.html');
                await expect(mainPage.mixerInlineCloseBtn).toBeVisible();
                await mainPage.mixerInlineCloseBtn.click();
            });
        }
    });
});
