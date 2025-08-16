import { defineConfig, devices } from '@playwright/test';

const hasExternalBase = !!process.env.PLAYWRIGHT_BASE_URL;
const isCI = !!process.env.CI;

export default defineConfig({
    testDir: './tests',
    // Give CI a much larger per-test timeout; keep local fast
    timeout: isCI ? 180 * 1000 : 30 * 1000,
    expect: { timeout: isCI ? 15_000 : 5_000 },
    fullyParallel: true,
    // Keep CI conservative to improve stability
    workers: isCI ? 4 : undefined,
    reporter: [['list']],
    use: {
        baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
        // So individual actions/navigations have more time in CI
        actionTimeout: isCI ? 15_000 : undefined,
        navigationTimeout: isCI ? 45_000 : undefined,
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
              // Allow longer boot in CI
              timeout: isCI ? 120_000 : 60_000,
        },
});
