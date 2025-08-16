import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    timeout: 30 * 1000,
    expect: { timeout: 5000 },
    fullyParallel: true,
    // Increase workers locally; CI will cap to avoid overcommit
    workers: process.env.CI ? 8 : undefined,
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
    webServer: {
        command: 'npm run serve',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 60_000
    }
});
