import { defineConfig } from '@playwright/test'

// Opt-in, read-only checks against the deployed backend. No MSW or write requests.
export default defineConfig({
  testDir: './integration', testMatch: '**/*.live.ts', workers: 1,
  timeout: 90000,
  use: { baseURL: 'http://localhost:5173', channel: 'msedge', headless: true },
  webServer: {
    command: 'npm.cmd run dev -- --host localhost --port 5173 --strictPort',
    url: 'http://localhost:5173', reuseExistingServer: true,
    env: { VITE_USE_MOCK_API: 'false', VITE_API_BASE_URL: 'https://api.solit.my.id/api/v1' },
  },
})
