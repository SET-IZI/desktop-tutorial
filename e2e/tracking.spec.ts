import type { Page } from '@playwright/test';
import { withDb } from './db';
import { expect, gotoHydrated, test } from './fixtures';

/** Commande invitée payée sur place ; renvoie l'id de la commande. */
async function placeGuestOrder(page: Page, firstName: string) {
  await gotoHydrated(page, '/s/chez-mimi');
  await page.getByRole('button', { name: 'Ajouter Tiramisu maison au panier' }).click();
  await page.getByRole('button', { name: /Voir le panier/ }).click();
  await expect(page.getByRole('radio', { checked: true, name: /Au plus tôt/ })).toBeVisible();
  await page.getByRole('link', { name: 'Continuer' }).click();
  await page.waitForSelector('html[data-hydrated]');
  await page.getByLabel('Prénom').fill(firstName);
  await page.getByLabel('Téléphone').fill('06 12 34 56 78');
  await page.getByRole('radio', { name: /Payer sur place/ }).click();
  await page.getByRole('button', { name: 'Confirmer la commande' }).click();
  await expect(page).toHaveURL(/\/s\/chez-mimi\/commande\/[A-Za-z0-9_-]+$/);
  await page.waitForSelector('html[data-hydrated]');
  const token = page.url().split('/').pop()!;
  const { rows } = await withDb((db) =>
    db.query(`select id, customer_user_id from orders where public_token = $1`, [token]),
  );
  return rows[0] as { id: string; customer_user_id: string | null };
}

const update = (id: string, sql: string) =>
  withDb((db) => db.query(`update orders set ${sql} where id = $1`, [id]));

// Moins que le rafraîchissement de secours (15 s) : c'est bien le temps réel qui agit.
const LIVE = { timeout: 6_000 };

test.describe('Suivi de commande en direct', () => {
  test('le client voit sa commande passer en cuisine, prendre du retard, puis être prête', async ({
    page,
  }) => {
    const order = await placeGuestOrder(page, 'Nina');
    try {
      // Session invitée anonyme : la commande est reliée au navigateur.
      expect(order.customer_user_id).not.toBeNull();
      const heading = page.getByRole('heading', { level: 1 });
      await expect(heading).toHaveText('Commande reçue 🎉');

      await update(order.id, `status = 'accepted'`);
      await expect(heading).toHaveText("C'est en cuisine 👨‍🍳", LIVE);

      await update(order.id, `extra_minutes = 10`);
      await expect(
        page.getByText('Petit retard en cuisine : 10 min de plus, merci de ta patience.'),
      ).toBeVisible(LIVE);

      await update(order.id, `status = 'ready'`);
      await expect(heading).toHaveText("C'est prêt, viens le chercher 🛍️", LIVE);
    } finally {
      await withDb((db) => db.query(`delete from orders where id = $1`, [order.id]));
    }
  });

  test('un refus est expliqué au client', async ({ page }) => {
    const order = await placeGuestOrder(page, 'Théo');
    try {
      await update(order.id, `status = 'rejected', cancel_reason = 'too_busy'`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Commande annulée', LIVE);
      await expect(
        page.getByText('La cuisine de Chez Mimi est débordée pour le moment.'),
      ).toBeVisible();
    } finally {
      await withDb((db) => db.query(`delete from orders where id = $1`, [order.id]));
    }
  });
});
