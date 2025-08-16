import { defineConfig, devices } from '@playwright/test';

const hasExternalBase = !!process.env.PLAYWRIGHT_BASE_URL;
const isCI = !!process.env.CI;

export default defineConfig({
    testDir: './tests',
    timeout: 30 * 1000,
    expect: { timeout: 5000 },
    fullyParallel: true,
    // Keep CI conservative to improve stability
    workers: isCI ? 4 : undefined,
    reporter: [['list']],
    use: {
        baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
        trace: 'retain-on-failure',
        video: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
        { name: 'webkit', use: { ...devices['Desktop Safari'] } },
        { name: 'Mobile Safari', use: { ...devices['Mobile Safari'] } },
        { name: 'iPad', use: { ...devices['iPad'] } },
        { name: 'iPhone', use: { ...devices['iPhone'] } },
    ],
    // Only start the built-in static server when an external baseURL is not supplied
    webServer: hasExternalBase
        ? undefined
        : {
            command: 'npm run serve',
            url: 'http://localhost:3000',
            reuseExistingServer: !isCI,
            timeout: 60_000,
        },
});
