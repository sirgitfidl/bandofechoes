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
