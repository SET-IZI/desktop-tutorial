import type { Page } from '@playwright/test';
import { expect } from './fixtures';

export const OWNER = { email: 'mimi@miaamm.test', password: 'miaamm-demo' };
export const KITCHEN = { email: 'cuisine@miaamm.test', password: 'miaamm-demo' };

export async function login(page: Page, who = OWNER, next?: string) {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : '/login');
  await page.waitForSelector('html[data-hydrated]');
  await page.getByLabel('Email professionnel').fill(who.email);
  await page.getByLabel('Mot de passe').fill(who.password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(next ? new RegExp(`${next}$`) : /\/app$/);
  await page.waitForSelector('html[data-hydrated]');
}
