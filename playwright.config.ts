import { defineConfig } from '@playwright/test';

/**
 * Pruebas de extremo a extremo en navegador (tipo 6): Chrome real contra la
 * app publicada, con Firebase y los servicios reales. Las corre la CLI de
 * `mejor-vejez-pruebas` con `--navegador`; también `npx playwright test`.
 *
 * Sin video ni traza: grabarían la clave del administrador y la contraseña
 * temporal de la cuenta creada. La evidencia son las capturas de cada paso
 * (`e2e/apoyo/evidencia.ts`), con la contraseña temporal tapada.
 */
export default defineConfig({
  testDir: 'e2e',
  outputDir: 'e2e/resultados/salida',
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['junit', { outputFile: process.env['MEJOR_VEJEZ_E2E_JUNIT'] ?? 'e2e/resultados/junit.xml' }]],
  use: {
    baseURL: process.env['MEJOR_VEJEZ_WEB'] ?? 'https://mejor-vejez-app.adndigital.cl',
    channel: 'chrome',
    headless: process.env['MEJOR_VEJEZ_E2E_VISIBLE'] !== '1',
    locale: 'es-CL',
    timezoneId: 'America/Santiago',
    viewport: { width: 1280, height: 860 },
    screenshot: 'off',
    video: 'off',
    trace: 'off',
  },
});
