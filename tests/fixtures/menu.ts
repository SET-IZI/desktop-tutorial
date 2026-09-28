import type { MenuCategory, MenuProduct } from '@/lib/storefront/types';

export function product(
  p: Partial<MenuProduct> & Pick<MenuProduct, 'id' | 'name' | 'categoryId'>,
): MenuProduct {
  return {
    description: null,
    priceCents: 1000,
    imageUrls: [],
    dietTags: [],
    allergens: [],
    isSoldOut: false,
    isUpsell: false,
    optionGroups: [],
    ...p,
  };
}

export const burger = product({
  id: 'burger',
  categoryId: 'burgers',
  name: 'Le Classique',
  description: 'Bœuf français, cheddar affiné',
  priceCents: 1350,
  allergens: ['gluten', 'milk'],
  optionGroups: [
    {
      id: 'cuisson',
      name: 'Cuisson',
      minSelect: 1,
      maxSelect: 1,
      options: [
        { id: 'saignant', name: 'Saignant', priceDeltaCents: 0 },
        { id: 'apoint', name: 'À point', priceDeltaCents: 0 },
      ],
    },
    {
      id: 'supplements',
      name: 'Suppléments',
      minSelect: 0,
      maxSelect: 2,
      options: [
        { id: 'cheddar', name: 'Cheddar', priceDeltaCents: 150 },
        { id: 'bacon', name: 'Bacon', priceDeltaCents: 200 },
        { id: 'oeuf', name: 'Œuf', priceDeltaCents: 100 },
      ],
    },
  ],
});

export const vegeBurger = product({
  id: 'vege',
  categoryId: 'burgers',
  name: 'Le Végé',
  priceCents: 1300,
  dietTags: ['vegetarian'],
  allergens: ['gluten'],
});

export const curry = product({
  id: 'curry',
  categoryId: 'plats',
  name: 'Curry de légumes',
  description: 'Lait de coco',
  priceCents: 1400,
  dietTags: ['vegan', 'gluten_free', 'spicy'],
});

export const tiramisu = product({
  id: 'tiramisu',
  categoryId: 'desserts',
  name: 'Tiramisu maison',
  priceCents: 650,
  isUpsell: true,
  dietTags: ['vegetarian'],
  allergens: ['gluten', 'eggs', 'milk'],
});

export const cookie = product({
  id: 'cookie',
  categoryId: 'desserts',
  name: 'Cookie géant',
  priceCents: 350,
  isUpsell: true,
  isSoldOut: true,
});

export const lemonade = product({
  id: 'limonade',
  categoryId: 'boissons',
  name: 'Limonade maison',
  priceCents: 400,
  isUpsell: true,
  dietTags: ['vegan'],
});

export const menu: MenuCategory[] = [
  {
    id: 'burgers',
    name: 'Burgers',
    description: null,
    emoji: '🍔',
    tone: 'orange',
    products: [burger, vegeBurger],
  },
  { id: 'plats', name: 'Plats', description: null, emoji: '🍲', tone: 'violet', products: [curry] },
  {
    id: 'desserts',
    name: 'Desserts',
    description: null,
    emoji: '🍰',
    tone: 'pink',
    products: [tiramisu, cookie],
  },
  {
    id: 'boissons',
    name: 'Boissons',
    description: null,
    emoji: '🥤',
    tone: 'blue',
    products: [lemonade],
  },
];
