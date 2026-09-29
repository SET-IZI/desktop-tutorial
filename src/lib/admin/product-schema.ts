import { z } from 'zod';

/** Validation d'un plat (formulaire et action serveur). Prix en centimes. */

export const DIET_TAGS = ['vegetarian', 'vegan', 'gluten_free', 'spicy', 'new'] as const;
export const ALLERGENS = [
  'gluten',
  'crustaceans',
  'eggs',
  'fish',
  'peanuts',
  'soy',
  'milk',
  'nuts',
  'celery',
  'mustard',
  'sesame',
  'sulphites',
  'lupin',
  'molluscs',
] as const;
export const TONES = ['blue', 'violet', 'pink', 'orange', 'green'] as const;

export const optionSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, 'optionName').max(60),
  priceDeltaCents: z.number().int().min(0, 'optionPrice').max(100_000),
  isActive: z.boolean().default(true),
});

export const optionGroupSchema = z
  .object({
    id: z.uuid().optional(),
    name: z.string().trim().min(1, 'groupName').max(60),
    minSelect: z.number().int().min(0).max(20),
    maxSelect: z.number().int().min(1).max(20),
    options: z.array(optionSchema).min(1, 'groupOptions').max(30),
  })
  .refine((g) => g.maxSelect >= g.minSelect, { message: 'groupOptions' });

export const productSchema = z.object({
  id: z.uuid().optional(),
  categoryId: z.uuid(),
  name: z.string().trim().min(1, 'name').max(80),
  description: z.string().trim().max(600).default(''),
  priceCents: z.number({ message: 'price' }).int('price').min(0, 'price').max(1_000_000, 'price'),
  imageUrls: z.array(z.url()).max(4).default([]),
  dietTags: z.array(z.enum(DIET_TAGS)).default([]),
  allergens: z.array(z.enum(ALLERGENS)).default([]),
  isActive: z.boolean().default(true),
  isSoldOut: z.boolean().default(false),
  isUpsell: z.boolean().default(false),
  optionGroups: z.array(optionGroupSchema).max(10).default([]),
});

export type ProductInput = z.input<typeof productSchema>;

export const categorySchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, 'name').max(60),
  description: z.string().trim().max(300).default(''),
  emoji: z.string().trim().max(16).default(''),
  tone: z.enum(TONES).default('blue'),
  isActive: z.boolean().default(true),
});

export type CategoryInput = z.input<typeof categorySchema>;
