import { z } from 'zod';

/** Téléphone : chiffres et « + » initial, espaces/points/tirets tolérés à la saisie. */
export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s.()-]/g, ''))
  .pipe(z.string().regex(/^\+?\d{8,15}$/, 'phone_invalid'));

export const checkoutLineSchema = z.object({
  productId: z.uuid(),
  optionIds: z.array(z.uuid()).max(30),
  quantity: z.number().int().min(1).max(99),
  notes: z.string().trim().max(200).default(''),
});

export const checkoutSchema = z.object({
  slug: z.string().min(1).max(40),
  fulfillment: z.enum(['pickup', 'delivery']),
  slot: z.iso.datetime({ offset: true }),
  paymentMethod: z.enum(['card', 'on_site']),
  customer: z
    .object({
      firstName: z.string().trim().min(1, 'first_name_required').max(40),
      phone: z.union([phoneSchema, z.literal('').transform(() => undefined)]).optional(),
      email: z
        .union([z.email('email_invalid'), z.literal('').transform(() => undefined)])
        .optional(),
      marketingOptIn: z.boolean().default(false),
    })
    .refine((c) => c.phone || c.email, { message: 'contact_required', path: ['phone'] }),
  notes: z.string().trim().max(500).optional(),
  locale: z.enum(['fr', 'en']).default('fr'),
  lines: z.array(checkoutLineSchema).min(1).max(50),
});

export type CheckoutInput = z.input<typeof checkoutSchema>;
export type CheckoutData = z.output<typeof checkoutSchema>;

export type CheckoutErrorCode =
  | 'invalid_input'
  | 'not_found'
  | 'delivery_unavailable'
  | 'service_disabled'
  | 'paused'
  | 'slot_unavailable'
  | 'slot_full'
  | 'product_unavailable'
  | 'payment_unavailable'
  | 'amount_too_low'
  | 'server_error';
