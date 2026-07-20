import { test, expect } from './fixtures';

test.describe.configure({ mode: 'parallel' });

test.describe('Puzzle completion modal', () => {
    async function openSolvedPuzzle(mainPage: import('./pages/home.page').MainPage) {
        await mainPage.page.setViewportSize({ width: 800, height: 1200 });
        await mainPage.goto();
        await expect(mainPage.brandTitle).toHaveText(/BAND\s+OF\s+ECHOES/i);
        await expect(mainPage.rotateLockOverlay).toHaveAttribute('aria-hidden', 'true');
        await test.step('open the solved-state modal', async () => {
            await mainPage.openSolveModal();
            await expect(mainPage.puzzleModal).toBeVisible();
        });
    }

    test('the numpad 1+2+3 solve chord opens the puzzle modal and it can be dismissed [BVT]', async ({ mainPage }) => {
        await mainPage.page.setViewportSize({ width: 800, height: 1200 });
        await mainPage.goto();
        await expect(mainPage.brandTitle).toHaveText(/BAND\s+OF\s+ECHOES/i);
        await expect(mainPage.rotateLockOverlay).toHaveAttribute('aria-hidden', 'true');

        await test.step('trigger the numpad 1+2+3 solve chord', async () => {
            await mainPage.triggerSolveChord();
            await expect(mainPage.puzzleModal).toBeVisible();
        });

        await test.step('dismiss the puzzle modal', async () => {
            if (await mainPage.puzzleModalClose.count()) {
                await mainPage.puzzleModalClose.click();
            } else {
                await mainPage.puzzleModal.click({ position: { x: 5, y: 5 } });
            }
            await expect(mainPage.puzzleModal).toHaveCount(0);
        });
    });

    test('choosing WITNESS opens YouTube in a new tab and closes the modal', async ({ mainPage }) => {
        await openSolvedPuzzle(mainPage);
        await test.step('choose WITNESS and verify a new tab opens', async () => {
            const { popup, expectedUrl } = await mainPage.clickWitness();
            await expect(mainPage.puzzleModal).toHaveCount(0);
            expect(popup.url()).toBe(expectedUrl);
            await popup.close();
        });
    });

    test('choosing REJECT opens the mixer modal and closes the puzzle modal [BVT]', async ({ mainPage }) => {
        await openSolvedPuzzle(mainPage);
        await test.step('choose REJECT and verify the mixer modal appears', async () => {
            await mainPage.clickReject();
            await expect(mainPage.puzzleModal).toHaveCount(0);
            await expect(mainPage.mixerModal).toBeVisible();
            await expect(mainPage.mixerIframe.locator('body')).toBeVisible();
        });
        await test.step('close the mixer modal', async () => {
            await mainPage.closeMixerModal();
            await expect(mainPage.mixerModal).toBeHidden();
        });
    });
});
