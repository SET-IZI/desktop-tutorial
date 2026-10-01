'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { LOCATION_COOKIE } from '@/lib/admin/location';
import { RESTAURANT_COOKIE } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

const CODES = ['invite_not_found', 'invite_used', 'invite_expired', 'email_mismatch'] as const;

export async function acceptInvite(token: string): Promise<{ ok: false; error: string }> {
  if (
    !z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .safeParse(token).success
  ) {
    return { ok: false, error: 'not_found' };
  }
  const { data: restaurantId, error } = await createClient().rpc('accept_team_invite', {
    p_token: token,
  });
  if (error) {
    const code = CODES.find((c) => error.message.includes(c));
    if (!code) console.error('[join]', error);
    return { ok: false, error: code ? code.replace('invite_', '') : 'server_error' };
  }
  cookies().set(RESTAURANT_COOKIE, restaurantId, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365,
  });
  cookies().delete(LOCATION_COOKIE);
  revalidatePath('/app', 'layout');
  redirect('/app');
}
