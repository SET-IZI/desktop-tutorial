import AxeBuilder from '@axe-core/playwright';
import { expect, gotoHydrated, test } from './fixtures';

test.describe('Phase 0 · socle', () => {
  test('la page d’accueil s’affiche en FR', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Miaamm/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Vos clients commandent. Vous gardez tout.',
    );
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  });

  test('la page d’accueil passe en EN via Accept-Language', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'en-US' });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await context.close();
  });

  test('le bottom-sheet s’ouvre et se ferme', async ({ page }) => {
    await gotoHydrated(page, '/dev/ui');
    await page.getByRole('button', { name: 'Ouvrir la fiche produit' }).click();
    const dialog = page.getByRole('dialog', { name: 'Burger du chef' });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  for (const path of ['/', '/dev/ui']) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`aucune violation WCAG AA sur ${path} (${scheme})`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
        await gotoHydrated(page, path);
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
        expect(results.violations).toEqual([]);
      });
    }
  }
});
