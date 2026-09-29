import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://127.0.0.1:${PORT}`;

// Environnements où Chromium est préinstallé (ex. Claude Code on the web) :
// on l'utilise au lieu de télécharger la version épinglée par Playwright.
const preinstalled = process.env.PW_CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';
const executablePath = !process.env.CI && existsSync(preinstalled) ? preinstalled : undefined;

export default defineConfig({
  testDir: './e2e',
  // Base de démo partagée et modifiée par certains tests (rush, horaires) : exécution
  // séquentielle pour des résultats déterministes.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    locale: 'fr-FR',
    launchOptions: { executablePath },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  // Prérequis : `pnpm db:reset` (données de démo) et `pnpm build`.
  webServer: [
    {
      // API Supabase locale (PostgREST) sur la base de démo.
      command: 'node scripts/dev/supabase-lite.mjs',
      url: 'http://127.0.0.1:54321/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      // Binaire next direct : via pnpm, le serveur survit parfois au teardown de Playwright.
      command: `node node_modules/next/dist/bin/next start --port ${PORT}`,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
