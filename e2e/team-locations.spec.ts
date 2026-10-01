import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { login, OWNER } from './admin';
import { withDb } from './db';
import { expect, gotoHydrated, test } from './fixtures';

async function a11y(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations).toEqual([]);
}

async function signUpFromLogin(page: Page, email: string) {
  // La page de connexion garde le lien d'invitation jusqu'à l'inscription.
  await page.getByRole('link', { name: 'Créer un compte' }).click();
  await expect(page).toHaveURL(/\/signup\?next=/);
  await page.waitForSelector('html[data-hydrated]');
  await page.getByLabel('Email professionnel').fill(email);
  await page.getByLabel('Mot de passe').fill('motdepasse1');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
}

test.describe('Équipe', () => {
  test('inviter, rejoindre par le lien, changer le rôle puis retirer', async ({ page }, info) => {
    const email = `equipe-${info.project.name}-${Date.now().toString(36)}@miaamm.test`;
    try {
      await login(page, OWNER, '/app/equipe');
      await expect(page.getByText('cuisine@miaamm.test')).toBeVisible();
      await a11y(page);

      await page.getByLabel('Email', { exact: true }).fill(email);
      await page.getByRole('radio', { name: 'Cuisine' }).click();
      await page.getByRole('button', { name: "Créer l'invitation" }).click();
      const status = page.getByRole('status').filter({ hasText: 'Invitation créée' });
      await expect(status).toBeVisible();
      const link = (await status.locator('.select-all').textContent())!;
      expect(link).toMatch(/\/app\/rejoindre\/[0-9a-f]{64}$/);
      await expect(page.getByText('Invitations en attente')).toBeVisible();

      // L'invité n'a pas de compte : connexion → inscription → retour sur le lien.
      await page.context().clearCookies();
      await page.goto(new URL(link).pathname);
      await expect(page).toHaveURL(/\/login\?next=/);
      await page.waitForSelector('html[data-hydrated]');
      await signUpFromLogin(page, email);
      await expect(page.getByRole('heading', { name: 'Rejoindre Chez Mimi' })).toBeVisible();
      await expect(page.getByText('en tant que Cuisine')).toBeVisible();
      await page.waitForSelector('html[data-hydrated]');
      await page.getByRole('button', { name: "Rejoindre l'équipe" }).click();
      await expect(page).toHaveURL(/\/app$/);
      await expect(page.getByRole('heading', { level: 1, name: 'Aperçu' })).toBeVisible();
      // Rôle cuisine : pas d'accès à l'équipe.
      await page.goto('/app/equipe');
      await expect(page).toHaveURL(/\/app$/);

      // Le propriétaire le passe manager, puis le retire.
      await page.context().clearCookies();
      await login(page, OWNER, '/app/equipe');
      await page.getByLabel(`Rôle de ${email}`).selectOption('manager');
      await expect(page.getByText('Modifications enregistrées')).toBeVisible();
      await expect
        .poll(async () =>
          (
            await withDb((db) =>
              db.query(
                `select ur.role from users_roles ur join auth.users u on u.id = ur.user_id where u.email = $1`,
                [email],
              ),
            )
          ).rows.map((r) => r.role),
        )
        .toEqual(['manager']);
      await page.getByRole('button', { name: `Retirer ${email}` }).click();
      await page.getByRole('button', { name: `Retirer ${email} de l'équipe ?` }).click();
      await expect(page.getByText(email)).toHaveCount(0);
      // Le dernier propriétaire ne peut pas changer son propre rôle.
      await page.getByLabel('Rôle de mimi@miaamm.test').selectOption('kitchen');
      await expect(
        page.getByText('Le restaurant doit garder au moins un propriétaire.'),
      ).toBeVisible();
    } finally {
      await withDb(async (db) => {
        await db.query(`delete from team_invites where email = $1`, [email]);
        await db.query(`delete from auth.users where email = $1`, [email]);
      });
    }
  });

  test('un lien destiné à un autre email est refusé', async ({ page }, info) => {
    const email = `cible-${info.project.name}-${Date.now().toString(36)}@miaamm.test`;
    const [{ token }] = (
      await withDb((db) =>
        db.query(
          `insert into team_invites (restaurant_id, email, role)
           values ('11111111-1111-4111-8111-111111111111', $1, 'manager') returning token`,
          [email],
        ),
      )
    ).rows as [{ token: string }];
    try {
      await login(page, OWNER, `/app/rejoindre/${token}`);
      await expect(page.getByText(`Cette invitation est destinée à ${email}.`)).toBeVisible();
      await expect(page.getByRole('button', { name: "Rejoindre l'équipe" })).toHaveCount(0);
    } finally {
      await withDb((db) => db.query(`delete from team_invites where email = $1`, [email]));
    }
  });
});

test.describe('Établissements', () => {
  test('créer un second établissement, régler ses horaires, le proposer aux clients', async ({
    page,
  }, info) => {
    const name = `Chez Mimi · Bastille ${info.project.name}`;
    try {
      await login(page, OWNER, '/app/etablissements');
      await a11y(page);
      await page.getByLabel("Nom de l'établissement").fill(name);
      await page.getByLabel('Adresse', { exact: true }).fill('12 rue de la Roquette');
      await page.getByLabel('Code postal').fill('75011');
      await page.getByLabel('Ville').fill('Paris');
      await page.getByRole('button', { name: "Créer l'établissement" }).click();

      // Bascule automatique : on règle les horaires du nouvel établissement.
      await expect(page).toHaveURL(/\/app\/horaires$/);
      const switcher = page.getByRole('combobox', { name: 'Établissement' });
      await expect(switcher.locator('option:checked')).toHaveText(`${name} (masqué)`);
      await page.getByRole('switch', { name: 'Lundi : Fermé' }).click();
      await page.getByRole('button', { name: 'Appliquer à tous les jours' }).click();
      await page.getByRole('button', { name: 'Enregistrer' }).click();
      await expect(page.getByText('Modifications enregistrées')).toBeVisible();

      // Le dernier établissement visible ne peut pas être masqué.
      await gotoHydrated(page, '/app/etablissements');
      await page
        .getByRole('switch', { name: 'Visible sur la boutique · Chez Mimi Oberkampf' })
        .click();
      await expect(
        page.getByText('Gardez au moins un établissement visible sur la boutique.'),
      ).toBeVisible();
      await page.getByRole('switch', { name: `Visible sur la boutique · ${name}` }).click();
      await expect(
        page.getByRole('switch', { name: `Visible sur la boutique · ${name}` }),
      ).toHaveAttribute('aria-checked', 'true');

      // Côté client : choix de l'adresse, créneaux et checkout de cet établissement.
      const [{ id }] = (
        await withDb((db) => db.query(`select id from locations where name = $1`, [name]))
      ).rows as [{ id: string }];
      await gotoHydrated(page, '/s/chez-mimi');
      const nav = page.getByRole('navigation', { name: 'Nos adresses' });
      await nav.getByRole('link', { name }).click();
      await expect(page).toHaveURL(new RegExp(`etablissement=${id}`));
      await expect(page.getByText('12 rue de la Roquette, 75011 Paris')).toBeVisible();
      await expect(nav.getByRole('link', { name })).toHaveAttribute('aria-current', 'true');
      await page.waitForSelector('html[data-hydrated]');
      await page.getByRole('button', { name: 'Ajouter Tiramisu maison au panier' }).click();
      await page.getByRole('button', { name: /Voir le panier/ }).click();
      await expect(page.getByRole('radio', { checked: true, name: /Au plus tôt/ })).toBeVisible();
      await page.getByRole('link', { name: 'Continuer' }).click();
      await expect(page).toHaveURL(new RegExp(`/checkout\\?etablissement=${id}$`));
      await expect(page.getByRole('heading', { name: 'Finaliser ma commande' })).toBeVisible();
    } finally {
      await withDb((db) => db.query(`delete from locations where name = $1`, [name]));
    }
  });
});
