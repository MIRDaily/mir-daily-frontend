/**
 * E2E de humo de Studio con Playwright, contra la web de verdad (hoy, producción) y con la cuenta de
 * prueba test-e2e-web@mirdaily.test. Nunca con la cuenta del dueño. Ver e2e/README.md.
 *
 *   npx playwright test -c e2e
 */
import path from 'node:path'
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.ts$/,
  outputDir: './resultados/artefactos',
  // Una sola cuenta y un solo navegador: en serie, para no pisarse los datos entre pruebas.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  reporter: [['list'], ['html', { outputFolder: './resultados/informe', open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'https://mir-daily-frontend.vercel.app',
    storageState: path.join(__dirname, '.auth', 'web.json'),
    // Chrome instalado (no hace falta descargar navegadores); E2E_CHANNEL='' usa el Chromium de Playwright.
    channel: process.env.E2E_CHANNEL ?? 'chrome',
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    viewport: { width: 1366, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
})
