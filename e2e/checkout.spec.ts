import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { withDb } from './db';
import { expect, gotoHydrated, test } from './fixtures';

const SHOP = '/s/chez-mimi';
const LOCATION_ID = 'd0000000-0000-4000-8000-000000000001';

async function goToCheckout(page: Page) {
  await gotoHydrated(page, SHOP);
  await page.getByRole('button', { name: 'Ajouter Tiramisu maison au panier' }).click();
  await page.getByRole('button', { name: /Voir le panier/ }).click();
  // Le premier créneau libre est présélectionné.
  await expect(page.getByRole('radio', { checked: true, name: /Au plus tôt/ })).toBeVisible();
  await page.getByRole('link', { name: 'Continuer' }).click();
  await expect(page.getByRole('heading', { name: 'Finaliser ma commande' })).toBeVisible();
  await page.waitForSelector('html[data-hydrated]');
}

test.describe('Checkout invité', () => {
  test('paiement sur place : commande créée en une étape', async ({ page }) => {
    await goToCheckout(page);
    await page.getByLabel('Prénom').fill('Inès');
    await page.getByLabel('Téléphone').fill('06 12 34 56 78');
    await page.getByRole('radio', { name: /Payer sur place/ }).click();
    await page.getByRole('button', { name: 'Confirmer la commande' }).click();

    await expect(page).toHaveURL(/\/s\/chez-mimi\/commande\/[A-Za-z0-9_-]+$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Commande reçue 🎉');
    await expect(page.getByText(/^Commande n°\d+$/)).toBeVisible();
    await expect(page.getByText('À régler sur place')).toBeVisible();
    await expect(page.getByText('1 × Tiramisu maison')).toBeVisible();

    // Le panier est vidé après la commande.
    await page.getByRole('link', { name: 'Retour à la carte' }).last().click();
    await page.waitForSelector('html[data-hydrated]');
    await expect(page.getByRole('button', { name: /Voir le panier/ })).toHaveCount(0);
  });

  test('paiement par carte (simulé) : deux étapes puis confirmation', async ({ page }) => {
    await goToCheckout(page);
    await page.getByLabel('Prénom').fill('Hugo');
    await page.getByLabel('Email').fill('hugo@example.com');
    await expect(page.getByRole('radio', { name: /Payer maintenant/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await page.getByRole('button', { name: 'Continuer vers le paiement' }).click();

    await expect(page.getByText('Mode test')).toBeVisible();
    await page.getByRole('button', { name: /Payer 6,50/ }).click();

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Commande reçue 🎉');
    await expect(page.getByText('Payée en ligne')).toBeVisible();

    const token = page.url().split('/').pop()!;
    const [order] = await withDb(
      async (db) =>
        (
          await db.query(
            `select status, payment_status, payment_method, total_cents from orders where public_token = $1`,
            [token],
          )
        ).rows,
    );
    expect(order).toEqual({
      status: 'new',
      payment_status: 'paid',
      payment_method: 'card',
      total_cents: 650,
    });
  });

  test('les champs obligatoires sont signalés sous chaque champ', async ({ page }) => {
    await goToCheckout(page);
    await page.getByRole('button', { name: 'Continuer vers le paiement' }).click();
    await expect(page.getByText('Indique ton prénom.')).toBeVisible();
    await expect(page.getByText('Indique un téléphone ou un email.')).toBeVisible();
    await page.getByLabel('Prénom').fill('Léo');
    await page.getByLabel('Téléphone').fill('12');
    await page.getByRole('button', { name: 'Continuer vers le paiement' }).click();
    await expect(page.getByText("Ce numéro de téléphone n'est pas valide.")).toBeVisible();
  });

  test('un créneau devenu complet entre-temps est refusé proprement', async ({ page }) => {
    await goToCheckout(page);
    const slot = await page.evaluate(() => {
      const raw = localStorage.getItem('miaamm:cart:chez-mimi');
      return raw ? (JSON.parse(raw).state.slot as string) : null;
    });
    expect(slot).toBeTruthy();
    await withDb((db) =>
      db.query(
        `insert into time_slots (restaurant_id, location_id, starts_at, capacity)
         values ('11111111-1111-4111-8111-111111111111', $1, $2, 0)
         on conflict (location_id, starts_at) do update set capacity = 0`,
        [LOCATION_ID, slot],
      ),
    );
    try {
      await page.getByLabel('Prénom').fill('Sam');
      await page.getByLabel('Téléphone').fill('0600000000');
      await page.getByRole('radio', { name: /Payer sur place/ }).click();
      await page.getByRole('button', { name: 'Confirmer la commande' }).click();
      await expect(page.getByRole('alert').filter({ hasText: 'créneau' })).toHaveText(
        "Ce créneau vient d'être complet. Choisis-en un autre.",
      );
      await expect(page).toHaveURL(/\/checkout$/);
    } finally {
      await withDb((db) =>
        db.query(`delete from time_slots where location_id = $1 and starts_at = $2`, [
          LOCATION_ID,
          slot,
        ]),
      );
    }
  });

  test('un lien de commande inconnu renvoie une 404', async ({ page }) => {
    const res = await page.goto(`${SHOP}/commande/jeton-inexistant-0000000000`);
    expect(res?.status()).toBe(404);
  });
});

test.describe('Checkout · accessibilité', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`checkout et confirmation sans violation WCAG AA (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await goToCheckout(page);
      const checkout = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(checkout.violations).toEqual([]);

      await page.getByLabel('Prénom').fill('Alex');
      await page.getByLabel('Téléphone').fill('0600000001');
      await page.getByRole('radio', { name: /Payer sur place/ }).click();
      await page.getByRole('button', { name: 'Confirmer la commande' }).click();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Commande reçue 🎉');
      const confirmation = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(confirmation.violations).toEqual([]);
    });
  }
});
