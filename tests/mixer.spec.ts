import { test, expect } from './fixtures';

test.describe.configure({ mode: 'parallel' });

test.describe('Mixer', () => {
    test.skip(({ browserName }) => browserName === 'firefox', 'No FF yet');

    test.beforeEach(async ({ mixerPage }) => {
        await mixerPage.goto();
        await expect(mixerPage.wrap).toBeVisible();
    });

    test('the mixer loads with its core transport controls visible [BVT]', async ({ mixerPage }) => {
        await test.step('check that the core transport controls are visible', async () => {
            await expect(mixerPage.titleHeading).toHaveText('Band of Echoes — “Right In Two”');
            await expect(mixerPage.subtitle).toHaveText('Interactive Stem Mixer');
            await expect(mixerPage.wrap).toHaveAttribute('aria-label', /Stem Mixer for 'Right In Two'/);
            await expect(mixerPage.transport.rewind).toBeVisible();
            await expect(mixerPage.transport.play).toBeVisible();
            await expect(mixerPage.transport.progress).toBeVisible();
            await expect(mixerPage.transport.time).toHaveText('00:00 / 00:00');
            await expect(mixerPage.transport.close).toBeVisible();
            await expect(mixerPage.strips.master.fader).toBeVisible();
        });
    });

    test('the mixer starts with the expected structure and default channel settings', async ({ mixerPage }) => {
        await test.step('check the group banners and audio elements', async () => {
            await expect(mixerPage.groups.instruments).toHaveAttribute('role', 'button');
            await expect(mixerPage.groups.instruments).toHaveAttribute('tabindex', '0');
            await expect(mixerPage.groups.vocals).toHaveAttribute('role', 'button');
            await expect(mixerPage.groups.vocals).toHaveAttribute('tabindex', '0');
            await expect(mixerPage.audioEls).toHaveCount(4);
        });

        await test.step('check the initial strip labels and defaults', async () => {
            await expect(mixerPage.strips.guitar.name).toHaveText('Guitar');
            await expect(mixerPage.strips.cello.name).toHaveText('Cello');
            await expect(mixerPage.strips.eric.name).toHaveText('Eric Vocals');
            await expect(mixerPage.strips.kathryn.name).toHaveText('Kathryn Vocals');
            await expect(mixerPage.strips.master.name).toHaveText('Master');

            for (const strip of Object.values(mixerPage.strips)) {
                await expect(strip.fader).toHaveValue('70');
                await expect(strip.db).toHaveText(/0\.0\s*dB/);
                await expect(strip.mute).toHaveAttribute('aria-checked', 'false');
            }

            await expect(mixerPage.strips.guitar.solo!).toHaveAttribute('aria-checked', 'false');
            await expect(mixerPage.strips.cello.solo!).toHaveAttribute('aria-checked', 'false');
            await expect(mixerPage.strips.eric.solo!).toHaveAttribute('aria-checked', 'false');
            await expect(mixerPage.strips.kathryn.solo!).toHaveAttribute('aria-checked', 'false');
            expect(mixerPage.strips.master.solo).toBeUndefined();
            await expect(mixerPage.unsoloAll).toHaveAttribute('role', 'button');
        });

        await test.step('check that the loading overlay starts hidden', async () => {
            await expect(mixerPage.loadingOverlay).toBeHidden();
            await expect(mixerPage.loadingOverlay).toHaveAttribute('aria-busy', 'false');
        });
    });

    test('the play button reflects the current playback state', async ({ mixerPage }) => {
        const play = mixerPage.transport.play;
        await test.step('start playback and wait for the stems to decode', async () => {
            await expect(play).toHaveAttribute('aria-pressed', 'false');
            await play.click();
            await expect(play).toHaveAttribute('aria-pressed', 'true', { timeout: 60000 }); // timeout for audio loading
        });
        await test.step('pause playback again', async () => {
            await play.click();
            await expect(play).toHaveAttribute('aria-pressed', 'false');
        });
    });

    test('double-clicking a fader resets it to 0.0 dB', async ({ mixerPage }) => {
        await test.step('reset the guitar and master faders to 0.0 dB', async () => {
            await mixerPage.strips.guitar.dblclickToZeroDb();
            await expect(mixerPage.strips.guitar.db).toHaveText(/0\.0\s*dB/i);
            await mixerPage.strips.master.dblclickToZeroDb();
            await expect(mixerPage.strips.master.db).toHaveText(/0\.0\s*dB/i);
        });
    });

    test('soloing channels mutes the others until Un-solo All is used', async ({ mixerPage }) => {
        await test.step('start playback', async () => {
            await mixerPage.transport.play.click();
            await expect(mixerPage.loadingOverlay).toBeHidden({ timeout: 60000 });
        });

        const { guitar, cello, eric, kathryn } = mixerPage.strips;
        await test.step('confirm no channels are soloed at the start', async () => {
            await expect(guitar.solo!).toHaveAttribute('aria-checked', 'false');
            await expect(cello.solo!).toHaveAttribute('aria-checked', 'false');
        });

        await test.step('solo Guitar and confirm the other channels mute', async () => {
            await guitar.solo!.click();
            await expect(guitar.solo!).toHaveAttribute('aria-checked', 'true');
            await expect(cello.db).toHaveText(/−∞\s*dB/);
            await expect(eric.db).toHaveText(/−∞\s*dB/);
            await expect(kathryn.db).toHaveText(/−∞\s*dB/);
        });

        await test.step('add Cello to the solo mix and keep vocals muted', async () => {
            await cello.solo!.click();
            await expect(cello.solo!).toHaveAttribute('aria-checked', 'true');
            await expect(eric.db).toHaveText(/−∞\s*dB/);
            await expect(kathryn.db).toHaveText(/−∞\s*dB/);
        });

        await test.step('clear the solo state with Un-solo All', async () => {
            await mixerPage.unsoloAllClick();
            await expect(guitar.solo!).toHaveAttribute('aria-checked', 'false');
            await expect(cello.solo!).toHaveAttribute('aria-checked', 'false');
            await expect(eric.db).not.toHaveText(/−∞/);
            await expect(kathryn.db).not.toHaveText(/−∞/);
        });
    });

    test('the Instruments and Vocals banners apply multiple solo states', async ({ mixerPage }) => {
        await test.step('start playback', async () => {
            await mixerPage.transport.play.click();
            await expect(mixerPage.loadingOverlay).toBeHidden({ timeout: 60000 });
        });

        await test.step('use the Instruments banner to solo the instrument tracks', async () => {
            await mixerPage.groups.instruments.click();
            await expect(mixerPage.strips.guitar.solo!).toHaveAttribute('aria-checked', 'true');
            await expect(mixerPage.strips.cello.solo!).toHaveAttribute('aria-checked', 'true');
            await expect(mixerPage.groups.instruments).toHaveClass(/held/);
        });

        await test.step('use the Vocals banner and confirm both banners stay active', async () => {
            await mixerPage.groups.vocals.click();
            await expect(mixerPage.strips.eric.solo!).toHaveAttribute('aria-checked', 'true');
            await expect(mixerPage.strips.kathryn.solo!).toHaveAttribute('aria-checked', 'true');
            await expect(mixerPage.groups.vocals).toHaveClass(/held/);
        });

        await test.step('toggle Instruments again and confirm the instrument solos clear', async () => {
            await mixerPage.groups.instruments.click();
            await expect(mixerPage.strips.guitar.solo!).toHaveAttribute('aria-checked', 'false');
            await expect(mixerPage.strips.cello.solo!).toHaveAttribute('aria-checked', 'false');
            await expect(mixerPage.groups.instruments).not.toHaveClass(/held/);
        });

        await test.step('reset the remaining solo state with Un-solo All', async () => {
            await mixerPage.unsoloAllClick();
            await expect(mixerPage.strips.eric.solo!).toHaveAttribute('aria-checked', 'false');
            await expect(mixerPage.strips.kathryn.solo!).toHaveAttribute('aria-checked', 'false');
            await expect(mixerPage.groups.vocals).not.toHaveClass(/held/);
        });
    });

    test('channel mute and master mute silence audio and update state', async ({ mixerPage }) => {
        await test.step('start playback', async () => {
            await mixerPage.transport.play.click();
            await expect(mixerPage.transport.play).toHaveAttribute('aria-pressed', 'true', { timeout: 60000 });
        });

        const { guitar, cello, eric, kathryn, master } = mixerPage.strips;
        await test.step('mute Guitar without silencing the other channels', async () => {
            await guitar.mute.click();
            await expect(guitar.mute).toHaveAttribute('aria-checked', 'true');
            await expect(guitar.db).toHaveText(/−∞\s*dB/);
            await expect(cello.db).not.toHaveText(/−∞/);
            await expect(eric.db).not.toHaveText(/−∞/);
            await expect(kathryn.db).not.toHaveText(/−∞/);

            await guitar.mute.click();
            await expect(guitar.mute).toHaveAttribute('aria-checked', 'false');
            await expect(guitar.db).not.toHaveText(/−∞/);
        });

        await test.step('mute the master output without changing channel mute states', async () => {
            await master.mute.click();
            await expect(master.mute).toHaveAttribute('aria-checked', 'true');
            await expect(master.db).toHaveText(/−∞\s*dB/);
            await expect(guitar.mute).toHaveAttribute('aria-checked', 'false');
            await expect(cello.mute).toHaveAttribute('aria-checked', 'false');
            await expect(eric.mute).toHaveAttribute('aria-checked', 'false');
            await expect(kathryn.mute).toHaveAttribute('aria-checked', 'false');
            await expect(guitar.db).not.toHaveText(/−∞/);
            await expect(cello.db).not.toHaveText(/−∞/);
            await expect(eric.db).not.toHaveText(/−∞/);
            await expect(kathryn.db).not.toHaveText(/−∞/);

            await master.mute.click();
            await expect(master.mute).toHaveAttribute('aria-checked', 'false');
            await expect(master.db).not.toHaveText(/−∞/);
        });
    });
});
