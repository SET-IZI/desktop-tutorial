import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { KITCHEN, login } from './admin';
import { withDb } from './db';
import { expect, test } from './fixtures';

const RESTAURANT = '11111111-1111-4111-8111-111111111111';
const LOCATION = 'd0000000-0000-4000-8000-000000000001';

/** Commande de test insérée directement en base (comme après un paiement confirmé). */
async function createOrder(name: string, opts: { paid?: boolean } = {}) {
  const { rows } = await withDb((db) =>
    db.query(
      `with o as (
         insert into orders (restaurant_id, location_id, customer_name, customer_phone, fulfillment,
           status, scheduled_for, subtotal_cents, total_cents, payment_method, payment_status,
           stripe_payment_intent_id, notes)
         values ($1, $2, $3, '0600000000', 'pickup', 'new', now() + interval '25 minutes',
           1350, 1350, $4, $5, $6, 'Sans oignons, merci')
         returning id, number, restaurant_id
       ), i as (
         insert into order_items (restaurant_id, order_id, name, unit_price_cents, quantity, options, total_cents)
         select restaurant_id, id, 'Le Classique', 1350, 1,
           '[{"group":"Cuisson","name":"Saignant","price_delta_cents":0}]', 1350 from o
       )
       select id, number from o`,
      [
        RESTAURANT,
        LOCATION,
        name,
        opts.paid ? 'card' : 'on_site',
        opts.paid ? 'paid' : 'unpaid',
        opts.paid ? `pi_mock_${Date.now()}` : null,
      ],
    ),
  );
  return rows[0] as { id: string; number: number };
}

const orderRow = (id: string) =>
  withDb((db) =>
    db.query(
      `select status, cancel_reason, payment_status, extra_minutes from orders where id = $1`,
      [id],
    ),
  ).then((r) => r.rows[0]);

/** Sur mobile, une seule colonne à la fois : on choisit l'onglet. */
async function showColumn(page: Page, label: 'Nouvelles' | 'En cuisine' | 'Prêtes') {
  const tab = page.getByRole('radio', { name: new RegExp(`^${label}`) });
  if (await tab.isVisible()) await tab.click();
}

test.describe('Écran cuisine', () => {
  test('une commande arrive en direct, puis Accepter → Prête → Récupérée', async ({
    page,
  }, info) => {
    const name = `Cuisine ${info.project.name} ${Date.now().toString(36)}`;
    let orderId: string | null = null;
    try {
      await login(page, KITCHEN, '/app');
      await page.goto('/app/cuisine');
      await page.waitForSelector('html[data-hydrated]');
      await expect(page.getByRole('status').filter({ hasText: 'En direct' })).toBeVisible();

      // Aucun rechargement : la commande apparaît par le temps réel (filet de sécurité à 30 s).
      const order = await createOrder(name);
      orderId = order.id;
      const card = page.getByRole('article', { name: `Commande n° ${order.number}` });
      await expect(card).toBeVisible({ timeout: 8_000 });
      await expect(card.getByText(name)).toBeVisible();
      await expect(card.getByText('Saignant')).toBeVisible();
      await expect(card.getByText('Sans oignons, merci')).toBeVisible();
      await expect(card.getByText('À encaisser · 13,50 €')).toBeVisible();

      await card.getByRole('button', { name: 'Accepter' }).click();
      await expect.poll(async () => (await orderRow(order.id)).status).toBe('accepted');

      await showColumn(page, 'En cuisine');
      await card
        .getByRole('button', { name: `Ajouter 10 minutes à la commande n° ${order.number}` })
        .click();
      await expect.poll(async () => (await orderRow(order.id)).extra_minutes).toBe(10);
      await expect(card.getByText('+10 min annoncées')).toBeVisible();

      await card.getByRole('button', { name: 'Prête', exact: true }).click();
      await expect.poll(async () => (await orderRow(order.id)).status).toBe('ready');

      await showColumn(page, 'Prêtes');
      await card.getByRole('button', { name: 'Récupérée' }).click();
      await expect.poll(async () => (await orderRow(order.id)).status).toBe('completed');
      await expect(card).toHaveCount(0);
    } finally {
      if (orderId) await withDb((db) => db.query(`delete from orders where id = $1`, [orderId]));
    }
  });

  test('refuser une commande payée par carte la rembourse', async ({ page }, info) => {
    const name = `Refus ${info.project.name} ${Date.now().toString(36)}`;
    const order = await createOrder(name, { paid: true });
    try {
      await login(page, KITCHEN, '/app');
      await page.goto('/app/cuisine');
      await page.waitForSelector('html[data-hydrated]');
      const card = page.getByRole('article', { name: `Commande n° ${order.number}` });
      await expect(card.getByText('Payée', { exact: true })).toBeVisible();
      await card.getByRole('button', { name: 'Refuser' }).click();
      await card.getByRole('radio', { name: 'Trop de commandes' }).click();
      await card.getByRole('button', { name: 'Confirmer le refus' }).click();
      await expect(card).toHaveCount(0);
      expect(await orderRow(order.id)).toMatchObject({
        status: 'rejected',
        cancel_reason: 'too_busy',
        payment_status: 'refunded',
      });
    } finally {
      await withDb((db) => db.query(`delete from orders where id = $1`, [order.id]));
    }
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`écran cuisine sans violation WCAG AA (${scheme})`, async ({ page }, info) => {
      const order = await createOrder(`Axe ${info.project.name} ${scheme}`);
      try {
        await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
        await login(page, KITCHEN, '/app');
        await page.goto('/app/cuisine');
        await page.waitForSelector('html[data-hydrated]');
        await expect(
          page.getByRole('article', { name: `Commande n° ${order.number}` }),
        ).toBeVisible();
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
        expect(results.violations).toEqual([]);
      } finally {
        await withDb((db) => db.query(`delete from orders where id = $1`, [order.id]));
      }
    });
  }
});
