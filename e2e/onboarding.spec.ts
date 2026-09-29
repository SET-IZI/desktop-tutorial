import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { withDb } from './db';
import { expect, gotoHydrated, test } from './fixtures';
import { solidPng } from './png';

const CSV = [
  'Catégorie;Nom;Description;Prix',
  'Entrées;Rillettes du Mans;Pain grillé;7,50',
  'Plats;Andouillette;"Frites, moutarde";16,00',
  'Plats;Plat à retirer;;1,00',
].join('\n');

async function signUp(page: Page, email: string) {
  await page.goto('/signup');
  await page.waitForSelector('html[data-hydrated]');
  await page.getByLabel('Email professionnel').fill(email);
  await page.getByLabel('Mot de passe').fill('motdepasse1');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page).toHaveURL(/\/app\/onboarding$/);
  await page.waitForSelector('html[data-hydrated]');
}

async function cleanup(email: string) {
  await withDb(async (db) => {
    await db.query(
      `delete from restaurants r using users_roles ur, auth.users u
       where ur.restaurant_id = r.id and ur.user_id = u.id and u.email = $1`,
      [email],
    );
    await db.query(`delete from auth.users where email = $1`, [email]);
  });
}

async function a11y(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations).toEqual([]);
}

test.describe('Onboarding', () => {
  test('de l’inscription à la boutique en ligne, en 5 étapes', async ({ page }, info) => {
    const id = `${info.project.name}-${Date.now().toString(36)}`;
    const email = `onboarding-${id}@miaamm.test`;
    const name = `Zinc ${id}`;
    await signUp(page, email);
    try {
      // 1 · Restaurant : l'adresse de boutique suit le nom.
      await expect(page.getByText('Étape 1 sur 5')).toBeVisible();
      await page.getByLabel('Nom du restaurant').fill(name);
      const slug = await page.getByLabel('Adresse de la boutique').inputValue();
      expect(slug).toBe(`zinc-${id}`);
      await page.getByLabel('Adresse', { exact: true }).fill('3 rue de la Paix');
      await page.getByLabel('Code postal').fill('750');
      await page.getByLabel('Ville').fill('Paris');
      await a11y(page);
      await page.getByRole('button', { name: 'Créer mon restaurant' }).click();
      await expect(page.getByText('Le code postal doit contenir 5 chiffres.')).toBeVisible();
      await expect(page.getByLabel('Code postal')).toHaveAttribute('aria-invalid', 'true');
      await page.getByLabel('Code postal').fill('75002');
      await page.getByRole('button', { name: 'Créer mon restaurant' }).click();

      // 2 · Horaires : lundi 11:30-14:30 copié sur toute la semaine.
      await expect(page.getByText('Étape 2 sur 5')).toBeVisible();
      await page.getByRole('switch', { name: 'Lundi : Fermé' }).click();
      await page.getByRole('button', { name: 'Appliquer à tous les jours' }).click();
      await expect(page.getByRole('switch', { name: 'Dimanche : Ouvert' })).toBeVisible();
      await page.getByRole('button', { name: 'Enregistrer et continuer' }).click();

      // 3 · Carte : import CSV relu, une ligne retirée.
      await expect(page.getByText('Étape 3 sur 5')).toBeVisible();
      await a11y(page);
      await page.getByLabel('Fichier CSV').setInputFiles({
        name: 'carte.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(CSV, 'utf8'),
      });
      await expect(page.getByRole('heading', { name: "Vérifiez avant d'importer" })).toBeVisible();
      await expect(page.getByText('Frites, moutarde')).toBeVisible();
      await page.getByRole('button', { name: 'Retirer Plat à retirer' }).click();
      await page.getByRole('button', { name: 'Importer 2 plats' }).click();

      // 4 · Paiements (Stripe simulé).
      await expect(page.getByText('Étape 4 sur 5')).toBeVisible();
      await page.getByRole('button', { name: 'Connecter Stripe' }).click();

      // 5 · Lien, QR code et mise en ligne.
      await expect(page.getByText('Étape 5 sur 5')).toBeVisible();
      await expect(page.getByText(`http://${slug}.localhost:3000`)).toBeVisible();
      await expect(page.getByRole('img', { name: 'QR code de votre boutique' })).toBeVisible();
      await expect(page.getByText('2 plats sur la carte')).toBeVisible();
      await a11y(page);
      await page.getByRole('button', { name: 'Mettre ma boutique en ligne' }).click();
      await expect(page).toHaveURL(/\/app\?welcome=1$/);
      await expect(page.getByText('Votre boutique est en ligne.', { exact: false })).toBeVisible();

      await gotoHydrated(page, `/s/${slug}`);
      await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
      await expect(page.getByRole('button', { name: /^Andouillette/ })).toBeVisible();
      await expect(page.getByRole('button', { name: /^Plat à retirer/ })).toHaveCount(0);
    } finally {
      await cleanup(email);
    }
  });

  test('import par photo, puis carte construite plus tard', async ({ page }, info) => {
    const id = `${info.project.name}-${Date.now().toString(36)}`;
    const email = `onboarding-photo-${id}@miaamm.test`;
    await signUp(page, email);
    try {
      await page.getByLabel('Nom du restaurant').fill(`Photo ${id}`);
      await page.getByLabel('Adresse', { exact: true }).fill('3 rue de la Paix');
      await page.getByLabel('Code postal').fill('75002');
      await page.getByLabel('Ville').fill('Paris');
      await page.getByRole('button', { name: 'Créer mon restaurant' }).click();
      await page.getByRole('button', { name: 'Enregistrer et continuer' }).click();

      // Lecture simulée (MIAAMM_AI_IMPORT=mock) : carte d'exemple à relire.
      await page.getByLabel('Photo ou PDF de votre carte').setInputFiles({
        name: 'menu.png',
        mimeType: 'image/png',
        buffer: solidPng(80, 120, [240, 240, 240]),
      });
      await expect(page.getByText('Steak frites')).toBeVisible();
      await page.getByRole('button', { name: 'Choisir un autre fichier' }).click();
      await page.getByRole('button', { name: 'Je crée ma carte plus tard' }).click();

      await expect(page.getByText('Étape 4 sur 5')).toBeVisible();
      await page
        .getByRole('button', { name: "Paiement sur place uniquement pour l'instant" })
        .click();
      await expect(page.getByText('Étape 5 sur 5')).toBeVisible();
      await expect(page.getByText("Carte vide : ajoutez vos plats avant d'ouvrir")).toBeVisible();

      // Retour possible sur une étape franchie.
      await page.getByRole('link', { name: /Horaires/ }).click();
      await expect(page.getByText('Étape 2 sur 5')).toBeVisible();
    } finally {
      await cleanup(email);
    }
  });
});
