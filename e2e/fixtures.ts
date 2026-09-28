import { test as base, expect, type Page } from '@playwright/test';

/** Navigue puis attend l'hydratation React (sinon les clics précoces sont perdus). */
export async function gotoHydrated(page: Page, url: string) {
  await page.goto(url);
  await expect(page.locator('html[data-hydrated="true"]')).toHaveCount(1, { timeout: 20_000 });
}

export const test = base;
export { expect };
