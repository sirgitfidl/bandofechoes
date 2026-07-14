import { test, expect } from './fixtures';

test.describe.configure({ mode: 'parallel' });

test.describe('Puzzle completion modal', () => {
    test.beforeEach(async ({ mainPage }) => {
        await mainPage.page.setViewportSize({ width: 800, height: 1200 });
        await mainPage.goto();
        await expect(mainPage.rotateLockOverlay).toHaveAttribute('aria-hidden', 'true');
        await test.step('open the solved-state modal', async () => {
            await mainPage.openSolveModal();
        });
    });

    test('choosing WITNESS opens YouTube in a new tab and closes the modal', async ({ mainPage }) => {
        await test.step('choose WITNESS and verify a new tab opens', async () => {
            await mainPage.clickWitnessExpectPopup();
        });
    });

    test('choosing REJECT opens the mixer modal and closes the puzzle modal [BVT]', async ({ mainPage }) => {
        await test.step('choose REJECT and verify the mixer modal appears', async () => {
            await mainPage.clickRejectExpectMixerModal();
        });
        await test.step('close the mixer modal', async () => {
            await mainPage.closeMixerModal();
        });
    });
});
