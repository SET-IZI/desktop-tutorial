import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Tests SQL (RLS, triggers, fonctions) contre une vraie base Postgres.
// Prérequis : `pnpm db:reset` (ou `supabase db reset`) puis DATABASE_URL.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/db/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
