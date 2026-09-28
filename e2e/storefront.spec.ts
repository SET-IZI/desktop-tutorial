import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { withDb } from './db';
import { expect, gotoHydrated, test } from './fixtures';

const SHOP = '/s/chez-mimi';
const LOCATION_ID = 'd0000000-0000-4000-8000-000000000001';

// Chaque test part d'un panier vide (localStorage propre par contexte).

async function addClassique(page: Page) {
  await page.getByRole('button', { name: /^Le Classique/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Le Classique' });
  await sheet.getByText('À point', { exact: true }).click();
  await sheet.getByText('Frites maison', { exact: true }).click();
  await sheet.getByText('Bacon', { exact: true }).click();
  await sheet.getByRole('button', { name: /Ajouter · 15,50/ }).click();
  await expect(sheet).toBeHidden();
}

const cartBar = (page: Page) => page.getByRole('button', { name: /Voir le panier/ });

test.describe('Boutique · carte', () => {
  test('affiche le restaurant, les catégories et les plats', async ({ page }) => {
    await gotoHydrated(page, SHOP);
    await expect(page).toHaveTitle('Chez Mimi · Commande en ligne');
    await expect(page.getByRole('heading', { level: 1, name: 'Chez Mimi' })).toBeVisible();
    const nav = page.getByRole('navigation', { name: 'Catégories de la carte' });
    await expect(nav.getByRole('link')).toHaveText([
      /Entrées/,
      /Burgers/,
      /Plats/,
      /Desserts/,
      /Boissons/,
    ]);
    await expect(page.getByRole('button', { name: /^Cookie géant.*Épuisé/ })).toBeVisible();
  });

  test('un restaurant inconnu affiche une page 404 soignée', async ({ page }) => {
    const res = await page.goto('/s/nexiste-pas');
    expect(res?.status()).toBe(404);
    await expect(
      page.getByRole('heading', { name: 'Ce restaurant n’existe pas (encore)'.replace('’', "'") }),
    ).toBeVisible();
  });

  test('la recherche ignore accents et ligatures', async ({ page }) => {
    await gotoHydrated(page, SHOP);
    await page.getByLabel('Rechercher un plat').fill('boeuf');
    const results = page.getByRole('button', { name: /^Le / });
    await expect(results).toHaveCount(2);
    await expect(results.nth(0)).toHaveAccessibleName(/^Le Classique/);
    await expect(results.nth(1)).toHaveAccessibleName(/^Le Piquant/);
    await page.getByLabel('Rechercher un plat').fill('zzz');
    await expect(page.getByText('Rien ne correspond')).toBeVisible();
    await page.getByRole('button', { name: 'Effacer les filtres' }).click();
    await expect(page.getByRole('button', { name: /^Velouté/ })).toBeVisible();
  });

  test('filtres régime et allergènes', async ({ page }) => {
    await gotoHydrated(page, SHOP);
    await page.getByRole('button', { name: 'Vegan' }).click();
    await expect(page.getByRole('button', { name: 'Vegan' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByRole('button', { name: /^Le Classique/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Curry de légumes/ })).toBeVisible();
    await page.getByRole('button', { name: 'Vegan' }).click();

    await page.getByRole('button', { name: 'Allergènes' }).click();
    const sheet = page.getByRole('dialog', { name: 'Allergènes à éviter' });
    await sheet.getByText('Gluten', { exact: true }).click();
    await sheet.getByRole('button', { name: /^Voir \d+ plats$/ }).click();
    await expect(page.getByRole('button', { name: 'Allergènes (1)' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Le Classique/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Risotto/ })).toBeVisible();
  });
});

test.describe('Boutique · navigation et ajout rapide', () => {
  test('la barre de catégories amène sur la bonne section, dans les deux sens', async ({
    page,
  }) => {
    await gotoHydrated(page, SHOP);
    const nav = page.getByRole('navigation', { name: 'Catégories de la carte' });
    for (const name of ['Burgers', 'Desserts', 'Burgers', 'Plats', 'Entrées']) {
      await nav.getByRole('link', { name: new RegExp(name) }).click();
      await expect(nav.getByRole('link', { name: new RegExp(name) })).toHaveAttribute(
        'aria-current',
        'true',
      );
      const heading = page.getByRole('heading', { level: 2, name: new RegExp(name) });
      await expect
        .poll(async () => Math.round((await heading.boundingBox())!.y), { timeout: 4000 })
        .toBeLessThan(160);
    }
  });

  test('le + ajoute directement un plat sans choix obligatoire', async ({ page }) => {
    await gotoHydrated(page, SHOP);
    await page.getByRole('button', { name: 'Ajouter Tiramisu maison au panier' }).click();
    await expect(cartBar(page)).toContainText('6,50');
    await page.getByRole('button', { name: 'Ajouter Tiramisu maison au panier' }).click();
    await expect(cartBar(page)).toContainText('13,00');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('le + ouvre la fiche quand un choix est obligatoire', async ({ page }) => {
    await gotoHydrated(page, SHOP);
    await page.getByRole('button', { name: 'Choisir les options de Le Classique' }).click();
    await expect(page.getByRole('dialog', { name: 'Le Classique' })).toBeVisible();
  });

  test('la recherche affiche le nombre de résultats', async ({ page }) => {
    await gotoHydrated(page, SHOP);
    await page.getByLabel('Rechercher un plat').fill('burger');
    await expect(page.getByRole('status').filter({ hasText: /plats?$/ })).toHaveText('3 plats');
  });
});

test.describe('Boutique · fiche produit et panier', () => {
  test('les options obligatoires sont exigées, le prix suit les suppléments', async ({ page }) => {
    await gotoHydrated(page, SHOP);
    await page.getByRole('button', { name: /^Le Classique/ }).click();
    const sheet = page.getByRole('dialog', { name: 'Le Classique' });
    await sheet.getByRole('button', { name: /Ajouter · 13,50/ }).click();
    await expect(sheet.getByRole('alert').first()).toHaveText('Choisis au moins une option');
    await expect(sheet).toBeVisible();

    await sheet.getByText('À point', { exact: true }).click();
    await sheet.getByText('Frites de patate douce', { exact: true }).click();
    await sheet.getByText('Cheddar', { exact: true }).click();
    await sheet.getByText('Bacon', { exact: true }).click();
    await sheet.getByText('Œuf au plat', { exact: true }).click(); // 3 max : autorisé
    await sheet.getByRole('button', { name: 'Ajouter un' }).click();
    await expect(sheet.getByRole('button', { name: /Ajouter · 38,00/ })).toBeVisible(); // (13,50 + 1 + 1,50 + 2 + 1) × 2
  });

  test('le panier persiste après rechargement', async ({ page }) => {
    await gotoHydrated(page, SHOP);
    await addClassique(page);
    await expect(cartBar(page)).toContainText('15,50');
    await page.reload();
    await page.waitForSelector('html[data-hydrated]');
    await expect(cartBar(page)).toContainText('1');
    await expect(cartBar(page)).toContainText('15,50');
  });

  test('un upsell avec option obligatoire ouvre sa fiche', async ({ page }) => {
    await gotoHydrated(page, SHOP);
    await addClassique(page);
    await cartBar(page).click();
    await page.getByRole('button', { name: 'Ajouter Limonade maison, 4,00 €' }).click();
    const sheet = page.getByRole('dialog', { name: 'Limonade maison' });
    await expect(sheet.getByRole('group', { name: /Taille/ })).toBeVisible();
    await sheet.getByText('50 cl', { exact: true }).click();
    await sheet.getByRole('button', { name: /Ajouter · 5,00/ }).click();
    await expect(cartBar(page)).toContainText('20,50');
  });

  test('un produit épuisé ne peut pas être ajouté', async ({ page }) => {
    await gotoHydrated(page, SHOP);
    await page.getByRole('button', { name: /^Cookie géant/ }).click();
    await expect(
      page.getByRole('dialog', { name: 'Cookie géant' }).getByRole('button', { name: 'Épuisé' }),
    ).toBeDisabled();
  });

  test('quantités, upsell et créneau dans le panier', async ({ page }) => {
    await gotoHydrated(page, SHOP);
    await addClassique(page);
    await cartBar(page).click();
    const cart = page.getByRole('dialog', {
      name: 'Ton panier a l’air délicieux'.replace('’', "'"),
    });

    await expect(cart.getByRole('radio', { name: 'Retrait' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    // Sans option obligatoire : ajout direct depuis le panier.
    await cart.getByRole('button', { name: 'Ajouter Tiramisu maison, 6,50 €' }).click();
    await expect(cart.getByText('Sous-total').locator('..')).toContainText('22,00');

    await cart.getByRole('button', { name: 'Ajouter un' }).first().click();
    await expect(cart.getByText('Sous-total').locator('..')).toContainText('37,50');

    // Un créneau est présélectionné (le plus tôt) → on peut continuer.
    await expect(cart.getByRole('radio', { checked: true, name: /Au plus tôt/ })).toBeVisible();
    await expect(cart.getByRole('link', { name: 'Continuer' })).toBeVisible();

    await cart.getByRole('radio', { name: 'Livraison' }).click();
    await expect(
      cart.getByText('Tu indiqueras ton adresse à l’étape suivante.'.replace('’', "'")),
    ).toBeVisible();
    await expect(cart.getByRole('heading', { name: 'Quand veux-tu être livré ?' })).toBeVisible();
  });

  test('un créneau bloqué ou complet est grisé', async ({ page, request }) => {
    const slots = await (
      await request.get('/api/storefront/chez-mimi/slots?service=pickup')
    ).json();
    const target: { startsAt: string; time: string } = slots.days[0].slots[1];
    await withDb((db) =>
      db.query(
        `insert into time_slots (restaurant_id, location_id, starts_at, is_blocked)
         values ('11111111-1111-4111-8111-111111111111', $1, $2, true)
         on conflict (location_id, starts_at) do update set is_blocked = true`,
        [LOCATION_ID, target.startsAt],
      ),
    );
    try {
      await gotoHydrated(page, SHOP);
      await addClassique(page);
      await cartBar(page).click();
      const slot = page.getByRole('radio', { name: `${target.time}, indisponible` });
      await expect(slot).toBeDisabled();
    } finally {
      await withDb((db) =>
        db.query(`delete from time_slots where location_id = $1 and starts_at = $2`, [
          LOCATION_ID,
          target.startsAt,
        ]),
      );
    }
  });
});

test.describe('Boutique · sous-domaine', () => {
  test('chez-mimi.<domaine> sert la boutique', async ({ request }) => {
    const res = await request.get('/', { headers: { host: 'chez-mimi.localhost:3000' } });
    expect(res.status()).toBe(200);
    expect(await res.text()).toContain('Chez Mimi');
  });
});

test.describe('Boutique · accessibilité', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`carte et fiche produit sans violation WCAG AA (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await gotoHydrated(page, SHOP);
      const menu = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(menu.violations).toEqual([]);

      await page.getByRole('button', { name: /^Le Classique/ }).click();
      await expect(page.getByRole('dialog', { name: 'Le Classique' })).toBeVisible();
      const sheet = await new AxeBuilder({ page })
        .include('[role=dialog]')
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();
      expect(sheet.violations).toEqual([]);
    });
  }
});
