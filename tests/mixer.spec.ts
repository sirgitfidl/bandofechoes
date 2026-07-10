import { test, expect } from './fixtures';

test.describe.configure({ mode: 'parallel' });

test.describe('Mixer page', () => {
    test.skip(({ browserName }) => browserName === 'firefox', 'No FF yet');

    test.beforeEach(async ({ mixerPage }) => {
        await mixerPage.goto();
    });

    test('loads and shows transport controls', async ({ mixerPage }) => {
        await test.step('verify core controls are visible', async () => {
            await expect(mixerPage.titleHeading).toHaveText('Band of Echoes — “Right In Two”');
            await expect(mixerPage.subtitle).toHaveText('Interactive Stem Mixer');
            await expect(mixerPage.wrap).toHaveAttribute('role', 'application');
            await expect(mixerPage.wrap).toHaveAttribute('aria-label', /Stem Mixer for 'Right In Two'/);
            await expect(mixerPage.transport.rew).toBeVisible();
            await expect(mixerPage.transport.play).toBeVisible();
            await expect(mixerPage.transport.progress).toBeVisible();
            await expect(mixerPage.transport.time).toHaveText('00:00 / 00:00');
            await expect(mixerPage.transport.close).toBeVisible();
            await expect(mixerPage.strips.master.fader).toBeVisible();
        });
    });

    test('exposes current mixer structure and initial defaults', async ({ mixerPage }) => {
        await test.step('verify group banners and audio elements', async () => {
            await expect(mixerPage.groups.instruments).toHaveAttribute('role', 'button');
            await expect(mixerPage.groups.instruments).toHaveAttribute('tabindex', '0');
            await expect(mixerPage.groups.vocals).toHaveAttribute('role', 'button');
            await expect(mixerPage.groups.vocals).toHaveAttribute('tabindex', '0');
            await expect(mixerPage.audioEls).toHaveCount(4);
        });

        await test.step('verify initial strip defaults', async () => {
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

        await test.step('verify loading overlay starts hidden', async () => {
            await expect(mixerPage.loadingOverlay).toBeHidden();
            await expect(mixerPage.loadingOverlay).toHaveAttribute('aria-busy', 'false');
        });
    });

    test('play/pause toggles aria-pressed', async ({ mixerPage }) => {
        const play = mixerPage.transport.play;
        await test.step('start playback and wait for decode', async () => {
            await expect(play).toHaveAttribute('aria-pressed', 'false');
            await play.click();
            await expect(mixerPage.loadingOverlay).toBeHidden({ timeout: 60000 });
            try {
                await expect(play).toHaveAttribute('aria-pressed', 'true', { timeout: 10000 });
            } catch {
                await play.click();
                await expect(play).toHaveAttribute('aria-pressed', 'true', { timeout: 10000 });
            }
        });
        await test.step('pause playback', async () => {
            await play.click();
            await expect(play).toHaveAttribute('aria-pressed', 'false');
        });
    });

    test('double-click faders snap to 0.0 dB (value 70)', async ({ mixerPage }) => {
        await test.step('snap guitar and master to 0.0 dB', async () => {
            await mixerPage.strips.guitar.dblclickToZeroDb();
            await mixerPage.strips.master.dblclickToZeroDb();
        });
    });

    test('solo toggles make only soloed channels audible (db not −∞), unsolo-all clears', async ({ mixerPage }) => {
        await test.step('start playback', async () => {
            await mixerPage.transport.play.click();
            await expect(mixerPage.loadingOverlay).toBeHidden({ timeout: 60000 });
        });

        const { guitar, cello, eric, kathryn } = mixerPage.strips;
        await test.step('verify no solos initially', async () => {
            await expect(guitar.solo!).toHaveAttribute('aria-checked', 'false');
            await expect(cello.solo!).toHaveAttribute('aria-checked', 'false');
        });

        await test.step('solo guitar and verify gating', async () => {
            await guitar.solo!.click();
            await expect(guitar.solo!).toHaveAttribute('aria-checked', 'true');
            await expect(cello.db).toHaveText(/−∞\s*dB/);
            await expect(eric.db).toHaveText(/−∞\s*dB/);
            await expect(kathryn.db).toHaveText(/−∞\s*dB/);
        });

        await test.step('add cello to solos; vocals remain gated', async () => {
            await cello.solo!.click();
            await expect(cello.solo!).toHaveAttribute('aria-checked', 'true');
            await expect(eric.db).toHaveText(/−∞\s*dB/);
            await expect(kathryn.db).toHaveText(/−∞\s*dB/);
        });

        await test.step('clear solos via unsolo-all', async () => {
            await mixerPage.unsoloAllClick();
            await expect(guitar.solo!).toHaveAttribute('aria-checked', 'false');
            await expect(cello.solo!).toHaveAttribute('aria-checked', 'false');
            await expect(eric.db).not.toHaveText(/−∞/);
            await expect(kathryn.db).not.toHaveText(/−∞/);
        });
    });

    test('group banners toggle solos additively and reflect held state', async ({ mixerPage }) => {
        await test.step('start playback', async () => {
            await mixerPage.transport.play.click();
            await expect(mixerPage.loadingOverlay).toBeHidden({ timeout: 60000 });
        });

        await test.step('toggle Instruments banner to solo instruments', async () => {
            await mixerPage.groups.instruments.click();
            await expect(mixerPage.strips.guitar.solo!).toHaveAttribute('aria-checked', 'true');
            await expect(mixerPage.strips.cello.solo!).toHaveAttribute('aria-checked', 'true');
            await expect(mixerPage.groups.instruments).toHaveClass(/held/);
        });

        await test.step('toggle Vocals banner; both held', async () => {
            await mixerPage.groups.vocals.click();
            await expect(mixerPage.strips.eric.solo!).toHaveAttribute('aria-checked', 'true');
            await expect(mixerPage.strips.kathryn.solo!).toHaveAttribute('aria-checked', 'true');
            await expect(mixerPage.groups.vocals).toHaveClass(/held/);
        });

        await test.step('toggle Instruments again; instruments cleared', async () => {
            await mixerPage.groups.instruments.click();
            await expect(mixerPage.strips.guitar.solo!).toHaveAttribute('aria-checked', 'false');
            await expect(mixerPage.strips.cello.solo!).toHaveAttribute('aria-checked', 'false');
            await expect(mixerPage.groups.instruments).not.toHaveClass(/held/);
        });

        await test.step('reset by unsolo-all', async () => {
            await mixerPage.unsoloAllClick();
            await expect(mixerPage.strips.eric.solo!).toHaveAttribute('aria-checked', 'false');
            await expect(mixerPage.strips.kathryn.solo!).toHaveAttribute('aria-checked', 'false');
            await expect(mixerPage.groups.vocals).not.toHaveClass(/held/);
        });
    });

    test('mute per-channel and master mute set db to −∞ dB and aria-checked true', async ({ mixerPage }) => {
        await test.step('start playback', async () => {
            await mixerPage.transport.play.click();
            await expect(mixerPage.loadingOverlay).toBeHidden({ timeout: 60000 });
        });

        const { guitar, master } = mixerPage.strips;
        await test.step('mute/unmute guitar channel', async () => {
            await guitar.mute.click();
            await expect(guitar.mute).toHaveAttribute('aria-checked', 'true');
            await expect(guitar.db).toHaveText(/−∞\s*dB/);

            await guitar.mute.click();
            await expect(guitar.mute).toHaveAttribute('aria-checked', 'false');
            await expect(guitar.db).not.toHaveText(/−∞/);
        });

        await test.step('toggle master mute', async () => {
            await master.mute.click();
            await expect(master.mute).toHaveAttribute('aria-checked', 'true');
            await expect(master.db).toHaveText(/−∞\s*dB/);

            await master.mute.click();
            await expect(master.mute).toHaveAttribute('aria-checked', 'false');
            await expect(master.db).not.toHaveText(/−∞/);
        });
    });
});
