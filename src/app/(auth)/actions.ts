'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export type AuthState = {
  error:
    | 'invalid_credentials'
    | 'user_already_exists'
    | 'weak_password'
    | 'invalid_input'
    | 'server_error';
} | null;

const credentialsSchema = z.object({
  email: z.email().max(200),
  password: z.string().min(8).max(200),
});

/** Chemin de retour interne uniquement (pas de redirection ouverte vers un autre site). */
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === 'string' ? value : '';
  return next.startsWith('/app') && !next.startsWith('//') ? next : '/app';
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = z
    .object({ email: z.email(), password: z.string().min(1) })
    .safeParse({ email: formData.get('email'), password: formData.get('password') });
  if (!parsed.success) return { error: 'invalid_input' };

  const { error } = await createClient().auth.signInWithPassword(parsed.data);
  if (error) {
    return { error: error.code === 'invalid_credentials' ? 'invalid_credentials' : 'server_error' };
  }
  redirect(safeNext(formData.get('next')));
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    const weak = parsed.error.issues.some((i) => i.path[0] === 'password');
    return { error: weak ? 'weak_password' : 'invalid_input' };
  }
  const { error } = await createClient().auth.signUp(parsed.data);
  if (error) {
    if (error.code === 'user_already_exists') return { error: 'user_already_exists' };
    if (error.code === 'weak_password') return { error: 'weak_password' };
    return { error: 'server_error' };
  }
  redirect('/app/onboarding');
}

export async function signOut() {
  await createClient().auth.signOut();
  redirect('/login');
}
