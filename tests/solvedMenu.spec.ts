import { test, expect } from './fixtures';

test.describe.configure({ mode: 'parallel' });

test.describe('Puzzle solved modal', () => {
    test.beforeEach(async ({ mainPage }) => {
        await mainPage.page.setViewportSize({ width: 800, height: 1200 });
        await mainPage.goto();
        await expect(mainPage.rotateLockOverlay).toHaveAttribute('aria-hidden', 'true');
        await test.step('trigger solved and wait for modal', async () => {
            await mainPage.openSolveModal();
        });
    });

    test('WITNESS opens YouTube in new tab and closes modal', async ({ mainPage }) => {
        await test.step('click WITNESS and assert popup opens', async () => {
            await mainPage.clickWitnessExpectPopup();
        });
    });

    test('REJECT opens the mixer modal and closes puzzle modal', async ({ mainPage }) => {
        await test.step('click REJECT and assert mixer modal appears', async () => {
            await mainPage.clickRejectExpectMixerModal();
        });
        await test.step('close mixer modal', async () => {
            await mainPage.closeMixerModal();
        });
    });
});
