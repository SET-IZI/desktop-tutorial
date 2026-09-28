import { z } from 'zod';

/**
 * Variables d'environnement validées par Zod.
 * Validation paresseuse : chaque groupe est vérifié au premier usage, pour que
 * les phases qui n'utilisent pas encore un service puissent compiler sans ses clés.
 * Toute variable documentée ici doit figurer dans .env.example.
 */

const publicSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url().default('http://localhost:3000'),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  /** 32 octets encodés en base64 : chiffrement des clés API restaurateur (AES-256-GCM). */
  MIAAMM_ENCRYPTION_KEY: z
    .string()
    .refine((v) => Buffer.from(v, 'base64').length === 32, 'Doit faire 32 octets en base64'),
});

export type PublicEnv = z.infer<typeof publicSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

function format(error: z.ZodError): string {
  return error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
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

export function getServerEnv(): ServerEnv {
  if (typeof window !== 'undefined') {
    throw new Error('getServerEnv() ne doit jamais être appelé côté navigateur.');
  }
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Variables serveur invalides :\n${format(parsed.error)}`);
  }
  return parsed.data;
}
