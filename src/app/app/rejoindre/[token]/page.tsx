import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { signOut } from '@/app/(auth)/actions';
import { JoinButton } from '@/components/admin/join-button';
import { Card } from '@/components/ui/card';
import { MeshGradient } from '@/components/ui/mesh-gradient';
import { Wordmark } from '@/components/ui/wordmark';
import { getUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Invitation', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function JoinPage({ params }: { params: { token: string } }) {
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/app/rejoindre/${params.token}`)}`);
  const t = await getTranslations('join');
  const tr = await getTranslations('admin.team.roles');

  const { data } = /^[0-9a-f]{64}$/.test(params.token)
    ? await createClient().rpc('invite_details', { p_token: params.token })
    : { data: [] };
  const invite = data?.[0];
  const problem = !invite
    ? t('errors.not_found')
    : invite.accepted
      ? t('errors.used')
      : invite.expired
        ? t('errors.expired')
        : invite.email.toLowerCase() !== (user.email ?? '').toLowerCase()
          ? t('errors.email_mismatch', { email: invite.email })
          : null;

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-12">
      <MeshGradient colors={['blue', 'violet', 'pink']} />
      <Wordmark className="relative mb-8 text-[30px]" />
      <Card className="relative w-full max-w-md p-6 sm:p-8">
        <h1 className="text-display-sm">
          {invite ? t('title', { restaurant: invite.restaurant_name }) : t('errors.not_found')}
        </h1>
        {invite ? (
          <p className="mt-2 text-fg-muted">{t('subtitle', { role: tr(invite.role) })}</p>
        ) : null}
        <p className="mt-4 text-[15px] text-fg-muted">{t('as', { email: user.email ?? '' })}</p>
        {problem && invite ? (
          <p
            role="alert"
            className="mt-4 rounded-2xl bg-red/10 px-4 py-3 font-medium text-[#C00011] dark:text-red"
          >
            {problem}
          </p>
        ) : null}
        <div className="mt-6 space-y-3">
          {!problem ? <JoinButton token={params.token} label={t('accept')} /> : null}
          <form action={signOut}>
            <button
              type="submit"
              className="min-h-touch w-full rounded-full font-semibold text-[#0062C4] dark:text-blue"
            >
              {t('switch')}
            </button>
          </form>
        </div>
      </Card>
    </div>
  );
}
