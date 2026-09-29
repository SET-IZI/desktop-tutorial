import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AuthForm } from '@/components/auth/auth-form';

export const metadata: Metadata = { title: 'Connexion', robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  const t = await getTranslations('auth');
  return (
    <>
      <h1 className="text-display-sm">{t('loginTitle')}</h1>
      <p className="mb-6 mt-2 text-fg-muted">{t('loginSubtitle')}</p>
      <AuthForm mode="login" next={searchParams.next} />
    </>
  );
}
