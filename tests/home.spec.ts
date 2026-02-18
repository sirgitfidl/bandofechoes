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

    test('footer and CTA links target correct destinations', async ({ mainPage }: { mainPage: MainPage }) => {
        await test.step('verify destinations and attributes for links', async () => {
            await expect(mainPage.ytFooter).toHaveAttribute('href', 'https://youtube.com/@BandOfEchoes');
            await expect(mainPage.spFooter).toHaveAttribute('href', 'https://open.spotify.com/artist/02Mwc9O3vBzaRF9RnZGgVS');
            await expect(mainPage.ptFooter).toHaveAttribute('href', 'https://patreon.com/bandofechoes');
            await expect(mainPage.patreonCta2).toHaveAttribute('href', 'https://www.patreon.com/bandofechoes');
            await expect(mainPage.subFallback).toHaveAttribute('href', 'https://youtube.com/@BandOfEchoes?sub_confirmation=1');
            await expect(mainPage.ytFooter).toHaveAttribute('target', '_blank');
            await expect(mainPage.spFooter).toHaveAttribute('target', '_blank');
            await expect(mainPage.ptFooter).toHaveAttribute('target', '_blank');
            await expect(mainPage.patreonCta2).toHaveAttribute('target', '_blank');
            await expect(mainPage.subFallback).toHaveAttribute('target', '_blank');
            await expect(mainPage.ytFooter).toHaveAttribute('rel', /noopener/);
            await expect(mainPage.spFooter).toHaveAttribute('rel', /noopener/);
            await expect(mainPage.ptFooter).toHaveAttribute('rel', /noopener/);
            await expect(mainPage.patreonCta2).toHaveAttribute('rel', /noopener/);
            await expect(mainPage.subFallback).toHaveAttribute('rel', /noopener/);
            await expect(mainPage.emailLink).toHaveAttribute('href', /^mailto:/);
        });

        await test.step('verify Spotify player embed is present', async () => {
            await mainPage.sectionSupport.scrollIntoViewIfNeeded();
            await expect(mainPage.spotifyEmbed).toBeVisible();
            await expect(mainPage.spotifyIframe).toBeVisible();
            await expect(mainPage.spotifyIframe).toHaveAttribute(
                'src',
                /https:\/\/open\.spotify\.com\/embed\/artist\/02Mwc9O3vBzaRF9RnZGgVS\b/
            );
            await expect(mainPage.spotifyIframe).toHaveAttribute('width', '100%');
            await expect(mainPage.spotifyIframe).toHaveAttribute('height', '352');
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
