import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e', testMatch: '**/*.pw.ts',
  use: { baseURL: 'http://127.0.0.1:5173', channel: 'msedge', headless: true },
  webServer: { command: 'npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort', url: 'http://127.0.0.1:5173', reuseExistingServer: false, env: { VITE_USE_MOCK_API: 'true' } },
  projects: [{ name: 'desktop', use: { viewport: { width: 1280, height: 800 } } }, { name: 'phone', use: { viewport: { width: 390, height: 844 } } }],
})
