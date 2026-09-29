import AxeBuilder from '@axe-core/playwright';
import { KITCHEN, login, OWNER } from './admin';
import { withDb } from './db';
import { expect, gotoHydrated, test } from './fixtures';
import { solidPng } from './png';

test.describe('Éditeur de carte', () => {
  test('créer une catégorie et un plat avec options, visibles sur la boutique', async ({
    page,
  }) => {
    await login(page, OWNER, '/app/carte');
    await page.getByRole('button', { name: 'Nouvelle catégorie' }).click();
    const catSheet = page.getByRole('dialog', { name: 'Nouvelle catégorie' });
    await catSheet.getByLabel('Nom', { exact: true }).fill('Pizzas');
    await catSheet.getByRole('button', { name: '🍕' }).click();
    await catSheet.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByRole('heading', { level: 2, name: /Pizzas/ })).toBeVisible();

    try {
      const pizzas = page
        .getByRole('listitem')
        .filter({ has: page.getByRole('heading', { level: 2, name: /Pizzas/ }) });
      await pizzas.getByRole('button', { name: 'Ajouter un plat' }).click();
      const sheet = page.getByRole('dialog', { name: 'Nouveau plat' });
      await sheet.getByLabel('Nom du plat').fill('Margherita');
      await sheet.getByLabel('Prix').fill('11');
      await sheet.getByRole('button', { name: 'Gluten', exact: true }).click();
      await sheet.getByRole('button', { name: 'Lait', exact: true }).click();
      await sheet.getByRole('button', { name: "Ajouter un groupe d'options" }).click();
      await sheet.getByLabel('Nom du groupe').fill('Taille');
      await sheet.getByLabel('Option', { exact: true }).fill('30 cm');
      await sheet.getByRole('button', { name: 'Ajouter une option' }).click();
      await sheet.getByLabel('Option', { exact: true }).nth(1).fill('40 cm');
      await sheet.getByLabel('Supplément · 40 cm').fill('3,00');
      await sheet.getByRole('button', { name: 'Enregistrer' }).click();
      await expect(page.getByRole('button', { name: 'Modifier Margherita' })).toBeVisible();

      await gotoHydrated(page, '/s/chez-mimi');
      await page.getByRole('button', { name: /^Margherita/ }).click();
      const shopSheet = page.getByRole('dialog', { name: 'Margherita' });
      await expect(shopSheet.getByText('Allergènes : Gluten, Lait')).toBeVisible();
      await shopSheet.getByText('40 cm', { exact: true }).click();
      await expect(shopSheet.getByRole('button', { name: /Ajouter · 14,00/ })).toBeVisible();
    } finally {
      await withDb((db) => db.query(`delete from categories where name = 'Pizzas'`));
    }
  });

  test('le prix est obligatoire et validé', async ({ page }) => {
    await login(page, OWNER, '/app/carte');
    await page.getByRole('button', { name: 'Ajouter un plat' }).first().click();
    const sheet = page.getByRole('dialog', { name: 'Nouveau plat' });
    await sheet.getByLabel('Nom du plat').fill('Test');
    await sheet.getByLabel('Prix').fill('douze');
    await sheet.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(sheet.getByRole('alert')).toHaveText(
      'Indiquez un prix valide, par exemple 13,50.',
    );
  });

  test('rupture et visibilité en un geste, reflétées sur la boutique', async ({ page }) => {
    await login(page, OWNER, '/app/carte');
    try {
      await page.getByRole('button', { name: 'Marquer Le Classique en rupture' }).click();
      await expect(
        page.getByRole('button', { name: 'Remettre Le Classique en vente' }),
      ).toHaveAttribute('aria-pressed', 'true');
      await page
        .getByRole('switch', { name: 'Visible sur la boutique · Burrata crémeuse' })
        .click();
      await expect(
        page.getByRole('switch', { name: 'Visible sur la boutique · Burrata crémeuse' }),
      ).toHaveAttribute('aria-checked', 'false');
      // Laisse l'action serveur se terminer avant de quitter la page.
      await expect
        .poll(
          async () =>
            (
              await withDb((db) =>
                db.query(`select is_active from products where name = 'Burrata crémeuse'`),
              )
            ).rows[0].is_active,
        )
        .toBe(false);

      await gotoHydrated(page, '/s/chez-mimi');
      await expect(page.getByRole('button', { name: /^Le Classique.*Épuisé/ })).toBeVisible();
      await expect(page.getByRole('button', { name: /^Burrata/ })).toHaveCount(0);
    } finally {
      await withDb((db) =>
        db.query(
          `update products set is_sold_out = false where name = 'Le Classique'; update products set is_active = true where name = 'Burrata crémeuse'`,
        ),
      );
    }
  });

  test('réordonner les catégories au clavier', async ({ page }) => {
    await login(page, OWNER, '/app/carte');
    try {
      const handle = page.getByRole('button', { name: 'Déplacer Boissons' });
      await handle.focus();
      // Petites pauses : dnd-kit mesure la mise en page entre deux déplacements.
      await page.keyboard.press('Space');
      await page.waitForTimeout(150);
      for (let i = 0; i < 4; i++) {
        await page.keyboard.press('ArrowUp');
        await page.waitForTimeout(150);
      }
      await page.keyboard.press('Space');
      await expect(page.getByRole('heading', { level: 2 }).first()).toContainText('Boissons');
      await expect
        .poll(
          async () =>
            (
              await withDb((db) =>
                db.query(`select name from categories order by position limit 1`),
              )
            ).rows[0].name,
        )
        .toBe('Boissons');
    } finally {
      await withDb((db) =>
        db.query(
          `update categories c set position = v.p from (values ('Entrées',0),('Burgers',1),('Plats',2),('Desserts',3),('Boissons',4)) v(n,p) where c.name = v.n`,
        ),
      );
    }
  });

  test('ajouter une photo, affichée sur la boutique', async ({ page }) => {
    await login(page, OWNER, '/app/carte');
    try {
      await page.getByRole('button', { name: 'Modifier Tiramisu maison' }).click();
      const sheet = page.getByRole('dialog', { name: 'Modifier le plat' });
      await sheet.locator('input[type=file]').setInputFiles({
        name: 'tiramisu.png',
        mimeType: 'image/png',
        buffer: solidPng(64, 48, [255, 159, 10]),
      });
      await expect(sheet.getByRole('img', { name: 'Tiramisu maison' })).toBeVisible();
      await expect(sheet.getByRole('button', { name: 'Changer la photo' })).toBeVisible();
      await sheet.getByRole('button', { name: 'Enregistrer' }).click();
      await expect(sheet).toBeHidden();

      const [row] = (
        await withDb((db) =>
          db.query(`select image_urls from products where name = 'Tiramisu maison'`),
        )
      ).rows;
      expect(row.image_urls[0]).toMatch(
        /\/storage\/v1\/object\/public\/menu\/11111111-1111-4111-8111-111111111111\/.+\.(webp|jpg)$/,
      );
      const image = await page.request.get(row.image_urls[0]);
      expect(image.status()).toBe(200);

      await gotoHydrated(page, '/s/chez-mimi');
      await page.getByRole('button', { name: /^Tiramisu maison/ }).click();
      await expect(
        page
          .getByRole('dialog', { name: 'Tiramisu maison' })
          .getByRole('img', { name: 'Tiramisu maison' }),
      ).toBeVisible();
    } finally {
      await withDb((db) =>
        db.query(`update products set image_urls = '{}' where name = 'Tiramisu maison'`),
      );
    }
  });

  test('la cuisine consulte la carte sans pouvoir la modifier', async ({ page }) => {
    await login(page, KITCHEN, '/app/carte');
    await expect(page.getByRole('heading', { level: 2, name: /Burgers/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nouvelle catégorie' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Déplacer/ })).toHaveCount(0);
    await expect(page.getByRole('switch')).toHaveCount(0);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`éditeur et fiche plat sans violation WCAG AA (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await login(page, OWNER, '/app/carte');
      const editor = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(editor.violations).toEqual([]);

      await page.getByRole('button', { name: 'Modifier Le Classique' }).click();
      await expect(page.getByRole('dialog', { name: 'Modifier le plat' })).toBeVisible();
      const sheet = await new AxeBuilder({ page })
        .include('[role=dialog]')
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();
      expect(sheet.violations).toEqual([]);
    });
  }
});
