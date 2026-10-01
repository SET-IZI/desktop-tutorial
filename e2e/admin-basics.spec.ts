import AxeBuilder from '@axe-core/playwright';
import { login, KITCHEN, OWNER } from './admin';
import { withDb } from './db';
import { expect, gotoHydrated, test } from './fixtures';
import { solidPng } from './png';

test.describe('Back-office · accès', () => {
  test('le back-office exige une connexion et y revient après', async ({ page }) => {
    await page.goto('/app/reglages');
    await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Freglages$/);
    await login(page, OWNER, '/app/reglages');
    await expect(page.getByRole('heading', { level: 1, name: 'Réglages' })).toBeVisible();
  });

  test('mauvais mot de passe : message clair', async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('html[data-hydrated]');
    await page.getByLabel('Email professionnel').fill(OWNER.email);
    await page.getByLabel('Mot de passe').fill('mauvais');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page.getByText('Email ou mot de passe incorrect.')).toBeVisible();
  });

  test('aperçu du jour et dernières commandes', async ({ page }) => {
    await login(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Aperçu' })).toBeVisible();
    await expect(
      page.getByText('Boutique en ligne').or(page.getByText(/Votre boutique · En ligne/)),
    ).toBeVisible();
    await expect(page.getByText('Sam')).toBeVisible(); // commande du seed
  });

  test('inscription puis redirection vers l’onboarding', async ({ page }) => {
    await page.goto('/signup');
    await page.waitForSelector('html[data-hydrated]');
    await page.getByLabel('Email professionnel').fill(`resto-${Date.now()}@miaamm.test`);
    await page.getByLabel('Mot de passe').fill('motdepasse1');
    await page.getByRole('button', { name: 'Créer mon compte' }).click();
    await expect(page).toHaveURL(/\/app\/onboarding$/);
  });
});

test.describe('Back-office · réglages', () => {
  test('modifier le restaurant se reflète sur la boutique', async ({ page }) => {
    await login(page, OWNER, '/app/reglages');
    const name = page.getByLabel('Nom du restaurant');
    await name.fill('Chez Mimi & Co');
    await page.getByRole('button', { name: 'Enregistrer' }).first().click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Modifications enregistrées' }),
    ).toBeVisible();
    try {
      await page.goto('/s/chez-mimi');
      await expect(page.getByRole('heading', { level: 1, name: 'Chez Mimi & Co' })).toBeVisible();
    } finally {
      await withDb((db) =>
        db.query(`update restaurants set name = 'Chez Mimi' where slug = 'chez-mimi'`),
      );
    }
  });

  test('logo et bannière, affichés sur la boutique', async ({ page }) => {
    await login(page, OWNER, '/app/reglages');
    try {
      await page.getByLabel('Logo', { exact: true }).setInputFiles({
        name: 'logo.png',
        mimeType: 'image/png',
        buffer: solidPng(400, 400, [255, 159, 10]),
      });
      await expect(page.getByRole('img', { name: 'Logo', exact: true })).toBeVisible();
      await page.getByLabel('Bannière', { exact: true }).setInputFiles({
        name: 'banniere.png',
        mimeType: 'image/png',
        buffer: solidPng(1600, 600, [48, 209, 88]),
      });
      await expect(page.getByRole('img', { name: 'Bannière', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Enregistrer' }).first().click();
      await expect(
        page.getByRole('status').filter({ hasText: 'Modifications enregistrées' }),
      ).toBeVisible();

      const [row] = (
        await withDb((db) =>
          db.query(`select logo_url, cover_url from restaurants where slug = 'chez-mimi'`),
        )
      ).rows;
      expect(row.logo_url).toMatch(/\/storage\/v1\/object\/public\/menu\/11111111-[^/]+\/.+/);
      expect(row.cover_url).toMatch(/\/storage\/v1\/object\/public\/menu\/11111111-[^/]+\/.+/);

      for (const scheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
        await gotoHydrated(page, '/s/chez-mimi');
        await expect(page.locator(`header img[src="${row.cover_url}"]`)).toBeVisible();
        await expect(page.locator(`header img[src="${row.logo_url}"]`)).toBeVisible();
        const results = await new AxeBuilder({ page })
          .include('header')
          .withTags(['wcag2a', 'wcag2aa'])
          .analyze();
        expect(results.violations).toEqual([]);
      }

      // Retirer la bannière : retour au dégradé.
      await gotoHydrated(page, '/app/reglages');
      await page.getByRole('button', { name: 'Retirer la photo · Bannière' }).click();
      await page.getByRole('button', { name: 'Enregistrer' }).first().click();
      await expect
        .poll(
          async () =>
            (
              await withDb((db) =>
                db.query(`select cover_url from restaurants where slug = 'chez-mimi'`),
              )
            ).rows[0].cover_url,
        )
        .toBeNull();
    } finally {
      await withDb((db) =>
        db.query(
          `update restaurants set logo_url = null, cover_url = null where slug = 'chez-mimi'`,
        ),
      );
    }
  });

  test('le nom est obligatoire', async ({ page }) => {
    await login(page, OWNER, '/app/reglages');
    await page.getByLabel('Nom du restaurant').fill('');
    await page.getByRole('button', { name: 'Enregistrer' }).first().click();
    await expect(page.getByText('Indiquez le nom du restaurant.')).toBeVisible();
  });

  test('mode rush « Pause » : la boutique ne propose plus de créneau', async ({ page }) => {
    await login(page);
    await page.getByRole('radio', { name: 'Pause' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Les nouvelles commandes sont suspendues.' }),
    ).toBeVisible();
    try {
      const res = await page.request.get('/api/storefront/chez-mimi/slots?service=pickup');
      expect((await res.json()).paused).toBe(true);
    } finally {
      await page.getByRole('radio', { name: 'Normal' }).click();
      await expect(
        page.getByRole('status').filter({ hasText: 'Les commandes arrivent normalement.' }),
      ).toBeVisible();
    }
  });

  test('la cuisine voit les réglages sans pouvoir les modifier', async ({ page }) => {
    await login(page, KITCHEN, '/app/reglages');
    await expect(page.getByLabel('Nom du restaurant')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Enregistrer' })).toHaveCount(0);
    await expect(page.getByRole('radio', { name: 'Pause' })).toBeDisabled();
  });
});

test.describe('Back-office · horaires', () => {
  test('fermer le lundi et ouvrir le lundi midi, puis annuler', async ({ page }) => {
    await login(page, OWNER, '/app/horaires');
    await page.getByRole('switch', { name: 'Lundi : Fermé' }).click();
    await expect(page.locator('#o-1-0')).toHaveValue('11:30');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Modifications enregistrées' }),
    ).toBeVisible();
    const rows = await withDb(
      async (db) =>
        (await db.query(`select 1 from opening_hours where weekday = 1 and service = 'pickup'`))
          .rowCount,
    );
    expect(rows).toBe(1);

    await page.getByRole('switch', { name: 'Lundi : Ouvert' }).click();
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Modifications enregistrées' }),
    ).toBeVisible();
  });

  test('une plage incohérente bloque l’enregistrement', async ({ page }) => {
    await login(page, OWNER, '/app/horaires');
    await page.locator('#c-2-0').fill('10:00'); // mardi 11:30 → 10:00
    await expect(page.getByText("L'heure de fin doit être après l'heure de début.")).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enregistrer' })).toBeDisabled();
  });

  test('ajouter une fermeture exceptionnelle', async ({ page }) => {
    await login(page, OWNER, '/app/horaires');
    await page.getByLabel('Motif (facultatif)').fill('Inventaire');
    await page.getByRole('button', { name: 'Ajouter la fermeture' }).click();
    await expect(page.getByText('Inventaire')).toBeVisible();
    await withDb((db) => db.query(`delete from location_closures where reason = 'Inventaire'`));
  });
});
