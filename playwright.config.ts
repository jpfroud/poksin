import { defineConfig, devices } from '@playwright/test';

const port = 4183;
const baseURL = `http://127.0.0.1:${port}`;
const channel = process.env.POKSIN_E2E_CHANNEL;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], ...(channel && { channel }) } },
  ],
  webServer: [
    {
      command: 'node dist/server/main.js',
      url: `${baseURL}/healthz`,
      reuseExistingServer: false,
      env: {
        HOST: '127.0.0.1',
        PORT: String(port),
        POKSIN_DB: ':memory:',
        POKSIN_SECURE_COOKIES: '0',
        POKSIN_PUBLIC_URL: 'http://127.0.0.1:4184/poksin',
      },
    },
    {
      command: 'node tests/e2e/prefix-proxy.ts',
      url: 'http://127.0.0.1:4184/poksin/healthz',
      reuseExistingServer: false,
    },
  ],
});
