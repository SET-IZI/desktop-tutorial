import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { TeamManager } from '@/components/admin/team-manager';
import { canManage, requireRestaurant } from '@/lib/auth/session';
import { getPublicEnv } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';

export default async function TeamPage() {
  const { current, user } = await requireRestaurant();
  if (!canManage(current.role)) redirect('/app');
  const t = await getTranslations('admin.team');
  const supabase = createClient();
  const isOwner = current.role === 'owner';

  const [{ data: members, error }, invites] = await Promise.all([
    supabase.rpc('team_members', { p_restaurant_id: current.restaurantId }),
    isOwner
      ? supabase
          .from('team_invites')
          .select('id, email, role, token, expires_at')
          .eq('restaurant_id', current.restaurantId)
          .is('accepted_at', null)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);
  if (error) throw new Error(`team_members : ${error.message}`);

  const base = getPublicEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display-sm">{t('title')}</h1>
        <p className="mt-1 text-fg-muted">{t('subtitle')}</p>
      </div>
      <TeamManager
        isOwner={isOwner}
        currentUserId={user.id}
        inviteBase={`${base}/app/rejoindre/`}
        members={members.map((m) => ({ userId: m.user_id, email: m.email, role: m.role }))}
        invites={(invites.data ?? []).map((i) => ({
          id: i.id,
          email: i.email,
          role: i.role,
          token: i.token,
          expiresAt: i.expires_at,
        }))}
      />
    </div>
  );
}
