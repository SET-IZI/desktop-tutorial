import { KITCHEN, login, OWNER } from './admin';
import { withDb } from './db';
import { expect, gotoHydrated, test } from './fixtures';
import { emailsTo, readOutbox } from './outbox';

test.describe('Notifications', () => {
  test('commande : email de confirmation, alerte équipe, puis email « prête »', async ({
    page,
    browser,
  }, info) => {
    const email = `client-${info.project.name}-${Date.now().toString(36)}@example.com`;
    let orderId: string | null = null;
    try {
      await gotoHydrated(page, '/s/chez-mimi');
      await page.getByRole('button', { name: 'Ajouter Tiramisu maison au panier' }).click();
      await page.getByRole('button', { name: /Voir le panier/ }).click();
      await expect(page.getByRole('radio', { checked: true, name: /Au plus tôt/ })).toBeVisible();
      await page.getByRole('link', { name: 'Continuer' }).click();
      await page.waitForSelector('html[data-hydrated]');
      await page.getByLabel('Prénom').fill('Lou');
      await page.getByLabel('Email').fill(email);
      await page.getByRole('radio', { name: /Payer sur place/ }).click();
      await page.getByRole('button', { name: 'Confirmer la commande' }).click();
      await expect(page).toHaveURL(/\/commande\/[A-Za-z0-9_-]+$/);
      const token = page.url().split('/').pop()!;
      const { rows } = await withDb((db) =>
        db.query(`select id, number from orders where public_token = $1`, [token]),
      );
      const order = rows[0] as { id: string; number: number };
      orderId = order.id;

      // Email de confirmation au client, avec le lien de suivi.
      await expect.poll(async () => (await emailsTo(email)).length).toBe(1);
      const [placed] = await emailsTo(email);
      expect(placed!.subject).toBe(`🎉 Commande n°${order.number} reçue chez Chez Mimi`);
      expect(placed!.text).toContain(`/s/chez-mimi/commande/${token}`);

      // Alerte à l'équipe (Web Push, simulé).
      const pushes = (await readOutbox()).filter(
        (m) => m.kind === 'push' && m.title === `Nouvelle commande n°${order.number}`,
      );
      expect(pushes).toHaveLength(1);
      expect(pushes[0]!.url).toBe('/app/cuisine');

      // La cuisine accepte puis marque prête : email « C'est prêt ».
      const kitchen = await browser.newPage({ locale: 'fr-FR' });
      await login(kitchen, KITCHEN, '/app');
      await kitchen.goto('/app/cuisine');
      await kitchen.waitForSelector('html[data-hydrated]');
      const card = kitchen.getByRole('article', { name: `Commande n° ${order.number}` });
      await card.getByRole('button', { name: 'Accepter' }).click();
      const cooking = kitchen.getByRole('radio', { name: /^En cuisine/ });
      if (await cooking.isVisible()) await cooking.click();
      await card.getByRole('button', { name: 'Prête', exact: true }).click();
      await expect
        .poll(async () => (await emailsTo(email)).map((m) => m.subject))
        .toContain(`🛍️ C'est prêt : commande n°${order.number} chez Chez Mimi`);
      await kitchen.close();
    } finally {
      if (orderId) await withDb((db) => db.query(`delete from orders where id = $1`, [orderId]));
    }
  });

  test('invitation d’équipe envoyée par email', async ({ page }, info) => {
    const email = `invite-${info.project.name}-${Date.now().toString(36)}@miaamm.test`;
    try {
      await login(page, OWNER, '/app/equipe');
      await page.getByLabel('Email', { exact: true }).fill(email);
      await page.getByRole('button', { name: "Créer l'invitation" }).click();
      await expect(
        page.getByText(`Invitation envoyée par email à ${email}.`, { exact: false }),
      ).toBeVisible();
      const [mail] = await emailsTo(email);
      expect(mail!.subject).toBe("Invitation à rejoindre l'équipe de Chez Mimi");
      expect(mail!.text).toMatch(/\/app\/rejoindre\/[0-9a-f]{64}/);
    } finally {
      await withDb((db) => db.query(`delete from team_invites where email = $1`, [email]));
    }
  });
});
