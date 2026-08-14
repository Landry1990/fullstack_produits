import { defineConfig, devices } from '@playwright/test'

/**
 * Configuration Playwright pour tests E2E Zenith Pharma.
 *
 * Les tests ciblent l'application Docker locale (frontend + backend).
 * Lancez d'abord l'environnement Docker, puis :
 *   npx playwright test          # tous les tests
 *   npx playwright test --headed # avec fenêtre visible
 *   npx playwright install       # installer les navigateurs (1ère fois)
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'html',
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:8080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'fr-FR',
    timezone: 'Africa/Douala',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
