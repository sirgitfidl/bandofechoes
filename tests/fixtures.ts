import { test as base, expect } from '@playwright/test';
import MainPage from './pages/home.page';
import MixerPage from './pages/mixer.page';

type Pages = {
    mainPage: MainPage;
    mixerPage: MixerPage;
};

export const test = base.extend<Pages>({
    mainPage: async ({ page }, use) => {
        const mp = new MainPage(page);
        await use(mp);
    },
    mixerPage: async ({ page }, use) => {
        const mix = new MixerPage(page);
        await use(mix);
    },
});

export { expect } from '@playwright/test';
