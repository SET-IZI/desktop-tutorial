import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AuthForm } from '@/components/auth/auth-form';

export const metadata: Metadata = { title: 'Créer un compte' };

export default async function SignupPage() {
  const t = await getTranslations('auth');
  return (
    <>
      <h1 className="text-display-sm">{t('signupTitle')}</h1>
      <p className="mb-6 mt-2 text-fg-muted">{t('signupSubtitle')}</p>
      <AuthForm mode="signup" />
    </>
  );
}
