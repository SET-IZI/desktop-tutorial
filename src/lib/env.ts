import { z } from 'zod';

/**
 * Variables d'environnement validées par Zod.
 * Validation paresseuse par groupe : chaque service est vérifié au premier usage,
 * pour qu'une phase compile sans les clés des phases suivantes.
 * Toute variable documentée ici doit figurer dans .env.example.
 */

const publicSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url().default('http://localhost:3000'),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const supabaseServerSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

const encryptionSchema = z.object({
  /** 32 octets encodés en base64 : chiffrement des clés API restaurateur (AES-256-GCM). */
  MIAAMM_ENCRYPTION_KEY: z
    .string()
    .refine((v) => Buffer.from(v, 'base64').length === 32, 'Doit faire 32 octets en base64'),
});

export type PublicEnv = z.infer<typeof publicSchema>;

function format(error: z.ZodError): string {
  return error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
}

function assertServer(name: string) {
  if (typeof window !== 'undefined') {
    throw new Error(`${name}() ne doit jamais être appelé côté navigateur.`);
  }
}

export function getPublicEnv(): PublicEnv {
  // Accès explicites : Next.js n'inline que les références statiques à process.env.NEXT_PUBLIC_*.
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  if (!parsed.success) {
    throw new Error(`Variables publiques invalides :\n${format(parsed.error)}`);
  }
  return parsed.data;
}

export function getSupabaseServerEnv() {
  assertServer('getSupabaseServerEnv');
  const parsed = supabaseServerSchema.safeParse(process.env);
  if (!parsed.success)
    throw new Error(`Variables Supabase serveur invalides :\n${format(parsed.error)}`);
  return parsed.data;
}

export function getEncryptionKey(): string {
  assertServer('getEncryptionKey');
  const parsed = encryptionSchema.safeParse(process.env);
  if (!parsed.success) throw new Error(`Clé de chiffrement invalide :\n${format(parsed.error)}`);
  return parsed.data.MIAAMM_ENCRYPTION_KEY;
}

// ═══ Paiements ═══════════════════════════════════════════════════════════════

export type PaymentsEnv =
  | {
      mode: 'stripe';
      secretKey: string;
      webhookSecret: string;
      publishableKey: string;
    }
  | { mode: 'mock' };

const stripeSchema = z.object({
  STRIPE_SECRET_KEY: z
    .string()
    .regex(/^(sk|rk)_(test|live)_/, 'Clé secrète Stripe attendue (sk_… ou rk_…)'),
  /** Secret de l'endpoint webhook « Connect » (événements des comptes connectés). */
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().regex(/^pk_(test|live)_/),
});

/**
 * Mode de paiement :
 *  - `stripe` : vrais PaymentIntents (direct charges sur le compte du restaurateur) ;
 *  - `mock`   : paiement simulé pour le dev et les tests E2E, sans clé Stripe.
 * `MIAAMM_PAYMENTS_MODE` force le mode ; sinon `stripe` dès que STRIPE_SECRET_KEY existe.
 * Le mode mock est interdit en production Vercel.
 */
export function getPaymentsEnv(): PaymentsEnv {
  assertServer('getPaymentsEnv');
  const forced = process.env.MIAAMM_PAYMENTS_MODE;
  const mode =
    forced === 'mock' || forced === 'stripe'
      ? forced
      : process.env.STRIPE_SECRET_KEY
        ? 'stripe'
        : 'mock';

  if (mode === 'mock') {
    if (process.env.VERCEL_ENV === 'production') {
      throw new Error('Paiements simulés interdits en production : configurez Stripe.');
    }
    return { mode: 'mock' };
  }

  const parsed = stripeSchema.safeParse({
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  });
  if (!parsed.success) throw new Error(`Variables Stripe invalides :\n${format(parsed.error)}`);
  return {
    mode: 'stripe',
    secretKey: parsed.data.STRIPE_SECRET_KEY,
    webhookSecret: parsed.data.STRIPE_WEBHOOK_SECRET,
    publishableKey: parsed.data.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  };
}

// ═══ Géocodage ═══════════════════════════════════════════════════════════════

/**
 * `geoplateforme` : Géoplateforme IGN (successeur de l'API Adresse, France, sans clé) ;
 * `mock` : coordonnées fixes pour le dev et les E2E (interdit en production Vercel).
 */
export function getGeocoderMode(): 'geoplateforme' | 'mock' {
  assertServer('getGeocoderMode');
  if (process.env.MIAAMM_GEOCODER === 'mock') {
    if (process.env.VERCEL_ENV === 'production') {
      throw new Error('Géocodage simulé interdit en production.');
    }
    return 'mock';
  }
  return 'geoplateforme';
}

// ═══ Import de carte par IA ══════════════════════════════════════════════════

export type AiImportEnv =
  { mode: 'anthropic'; apiKey: string } | { mode: 'mock' } | { mode: 'off' };

/**
 * Import de carte depuis une photo (API Claude). Désactivé sans ANTHROPIC_API_KEY ;
 * `MIAAMM_AI_IMPORT=mock` renvoie une carte d'exemple (dev, E2E), jamais en production.
 */
export function getAiImportEnv(): AiImportEnv {
  assertServer('getAiImportEnv');
  if (process.env.MIAAMM_AI_IMPORT === 'mock') {
    if (process.env.VERCEL_ENV === 'production') {
      throw new Error('Import IA simulé interdit en production.');
    }
    return { mode: 'mock' };
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  return apiKey ? { mode: 'anthropic', apiKey } : { mode: 'off' };
}
