import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  timeout: 30_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    timezoneId: 'Asia/Dhaka',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium', channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
  webServer: {
    command: 'npm run build && node tests/serve-production.mjs',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
  },
});
