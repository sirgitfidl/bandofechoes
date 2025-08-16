import { type Locator, type Page, expect, test } from '@playwright/test';

// POM for theseAreNotTheTracksYoureLookingFor.html (the mixer)
export class MixerPage {
    readonly page: Page;
    readonly wrap: Locator;
    readonly title: Locator;
    readonly groups: {
        instruments: Locator;
        vocals: Locator;
    };
    readonly transport: {
        rew: Locator;
        play: Locator;
        progress: Locator;
        time: Locator;
        close: Locator;
    };
    readonly strips: {
        guitar: ChannelStrip;
        cello: ChannelStrip;
        eric: ChannelStrip;
        kathryn: ChannelStrip;
        master: ChannelStrip;
    };
    readonly loadingOverlay: Locator;
    readonly unsoloAll: Locator;

    constructor(page: Page) {
        this.page = page;
        this.wrap = page.getByTestId('mixer-wrap');
        this.title = page.getByTestId('mixer-title');
        this.groups = {
            instruments: page.getByTestId('group-instruments'),
            vocals: page.getByTestId('group-vocals'),
        };
        this.transport = {
            rew: page.getByTestId('btn-rew'),
            play: page.getByTestId('btn-play'),
            progress: page.getByTestId('progress'),
            time: page.getByTestId('time'),
            close: page.getByTestId('btn-close'),
        };
        this.strips = {
            guitar: new ChannelStrip(page, 'guitar'),
            cello: new ChannelStrip(page, 'cello'),
            eric: new ChannelStrip(page, 'eric'),
            kathryn: new ChannelStrip(page, 'kathryn'),
            master: new ChannelStrip(page, 'master'),
        };
        this.loadingOverlay = page.getByTestId('loading-overlay');
        this.unsoloAll = page.getByTestId('unsolo-all');
    }

    async goto() {
        await test.step('goto mixer page', async () => {
            await this.page.goto('theseAreNotTheTracksYoureLookingFor.html');
            await expect(this.wrap).toBeVisible();
        });
    }

    async closeIfInIframeParent() {
        await test.step('close mixer via inline button', async () => {
            // If opened inside a modal iframe, clicking the inline close should signal the parent.
            await this.transport.close.click();
        });
    }

    async unsoloAllClick() {
        await test.step('unsolo all channels', async () => {
            await this.unsoloAll.click();
        });
    }
}

export class ChannelStrip {
    readonly page: Page;
    readonly key: string;
    readonly root: Locator;
    readonly fader: Locator;
    readonly db: Locator;
    readonly solo?: Locator;
    readonly mute: Locator;

    constructor(page: Page, key: 'guitar' | 'cello' | 'eric' | 'kathryn' | 'master') {
        this.page = page;
        this.key = key;
        this.root = page.getByTestId(`strip-${key}`);
        this.fader = page.getByTestId(`fader-${key}`);
        this.db = this.root.locator('.db');
        // master has no solo, others do
        this.solo = key === 'master' ? undefined : page.getByTestId(`solo-${key}`);
        this.mute = page.getByTestId(`mute-${key}`);
    }

    async dblclickToZeroDb() {
        await test.step(`dblclick ${this.key} fader to 0.0 dB`, async () => {
            await this.fader.dblclick();
            await expect(this.db).toHaveText(/0\.0\s*dB/i);
        });
    }

    async setFader(value: number) {
        await test.step(`set ${this.key} fader to ${value}`, async () => {
            await this.fader.fill(String(value));
        });
    }
}

export default MixerPage;
