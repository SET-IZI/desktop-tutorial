'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { assertRole, getUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { getLocale, getTranslations } from 'next-intl/server';
import { getPublicEnv } from '@/lib/env';
import { sendEmail } from '@/lib/notify/email';
import { teamInviteEmail } from '@/lib/notify/templates';

/**
 * Équipe : réservé au propriétaire (la RLS le garantit aussi). Les invitations
 * sont des liens à usage unique (7 jours) ; l'envoi par email arrive avec Resend.
 */

export type TeamResult = { ok: true } | { ok: false; error: string };

async function guard<R extends { ok: boolean }>(
  fn: () => Promise<R>,
): Promise<R | { ok: false; error: string }> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof Error && error.message === 'forbidden') {
      return { ok: false, error: 'forbidden' };
    }
    console.error('[team]', error);
    return { ok: false, error: 'server_error' };
  }
}

const inviteSchema = z.object({
  email: z.email().max(254),
  role: z.enum(['manager', 'kitchen']),
});

export async function inviteMember(
  input: z.input<typeof inviteSchema>,
): Promise<{ ok: true; token: string; emailSent: boolean } | { ok: false; error: string }> {
  return guard(async () => {
    const parsed = inviteSchema.safeParse({ ...input, email: input.email?.trim().toLowerCase() });
    if (!parsed.success) return { ok: false as const, error: 'email_invalid' };
    const { current } = await assertRole(['owner']);
    const supabase = createClient();

    const { data: members, error: membersError } = await supabase.rpc('team_members', {
      p_restaurant_id: current.restaurantId,
    });
    if (membersError) throw new Error(membersError.message);
    if (members.some((m) => m.email.toLowerCase() === parsed.data.email)) {
      return { ok: false as const, error: 'already_member' };
    }

    const { data, error } = await supabase
      .from('team_invites')
      .insert({ restaurant_id: current.restaurantId, ...parsed.data })
      .select('token')
      .single();
    if (error) {
      if (error.code === '23505') return { ok: false as const, error: 'already_invited' };
      throw new Error(error.message);
    }
    // Invitation par email (Resend) ; le lien reste aussi copiable dans la page.
    const locale = (await getLocale()) === 'en' ? 'en' : 'fr';
    const roles = await getTranslations('admin.team.roles');
    const base = getPublicEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
    const emailSent = await sendEmail({
      to: parsed.data.email,
      ...teamInviteEmail({
        locale,
        restaurantName: current.name,
        roleLabel: roles(parsed.data.role),
        url: `${base}/app/rejoindre/${data.token}`,
      }),
      idempotencyKey: `team-invite-${data.token}`,
    });
    revalidatePath('/app/equipe');
    return { ok: true as const, token: data.token, emailSent };
  });
}

export async function revokeInvite(id: string): Promise<TeamResult> {
  return guard(async () => {
    if (!z.uuid().safeParse(id).success) return { ok: false as const, error: 'invalid' };
    await assertRole(['owner']);
    const { error } = await createClient().from('team_invites').delete().eq('id', id);
    if (error) throw new Error(error.message);
    revalidatePath('/app/equipe');
    return { ok: true as const };
  });
}

const roleSchema = z.object({
  userId: z.uuid(),
  role: z.enum(['owner', 'manager', 'kitchen']),
});

export async function changeRole(input: z.input<typeof roleSchema>): Promise<TeamResult> {
  return guard(async () => {
    const parsed = roleSchema.safeParse(input);
    if (!parsed.success) return { ok: false as const, error: 'invalid' };
    const { current } = await assertRole(['owner']);
    const { error } = await createClient()
      .from('users_roles')
      .update({ role: parsed.data.role })
      .eq('restaurant_id', current.restaurantId)
      .eq('user_id', parsed.data.userId);
    if (error) {
      // Trigger keep_one_owner : le restaurant garde toujours un propriétaire.
      if (error.message.includes('propriétaire'))
        return { ok: false as const, error: 'last_owner' };
      throw new Error(error.message);
    }
    revalidatePath('/app', 'layout');
    return { ok: true as const };
  });
}

export async function removeMember(userId: string): Promise<TeamResult> {
  return guard(async () => {
    if (!z.uuid().safeParse(userId).success) return { ok: false as const, error: 'invalid' };
    const { current } = await assertRole(['owner']);
    const me = await getUser();
    if (me?.id === userId) return { ok: false as const, error: 'self' };
    const { error } = await createClient()
      .from('users_roles')
      .delete()
      .eq('restaurant_id', current.restaurantId)
      .eq('user_id', userId);
    if (error) {
      if (error.message.includes('propriétaire'))
        return { ok: false as const, error: 'last_owner' };
      throw new Error(error.message);
    }
    revalidatePath('/app/equipe');
    return { ok: true as const };
  });
}
