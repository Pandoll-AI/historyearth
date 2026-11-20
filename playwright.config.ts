import { defineConfig } from '@playwright/test';

const PORT = 4391;
export default defineConfig({
  testDir: 'e2e',
  timeout: 180_000,
  expect: { timeout: 30_000 },
  workers: 1,
  retries: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_URL || `http://127.0.0.1:${PORT}`,
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  },
  webServer: process.env.E2E_URL ? undefined : { command: `npx vite preview --host 127.0.0.1 --port ${PORT} --strictPort`, port: PORT, reuseExistingServer: true },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } }, testIgnore: /mobile/ },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 }, testMatch: /mobile/ },
  ],
});
