import { defineConfig, devices } from '@playwright/test';

const workers = Number(process.env.PW_WORKERS || 4);

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },

  fullyParallel: true,
  workers,

  retries: 0,

  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: process.env.RBAC_FRONTEND_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    ...devices['Desktop Chrome'],
  },
});