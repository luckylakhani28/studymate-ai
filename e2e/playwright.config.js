import { defineConfig } from '@playwright/test';
import { SERVER_ENV } from './env.js';

export default defineConfig({
  testDir: '.',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  globalSetup: './global-setup.js',
  use: { baseURL: 'http://localhost:5173', trace: 'retain-on-failure' },
  webServer: [
    {
      command: 'npm run start -w server',
      url: 'http://localhost:5050/api/health',
      env: SERVER_ENV,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run dev -w client',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
    },
  ],
});
