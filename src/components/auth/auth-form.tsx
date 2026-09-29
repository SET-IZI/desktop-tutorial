'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useFormState, useFormStatus } from 'react-dom';
import { signIn, signUp, type AuthState } from '@/app/(auth)/actions';
import { Button } from '@/components/ui/button';

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" block size="lg" loading={pending}>
      {label}
    </Button>
  );
}

const inputClass =
  'h-12 w-full rounded-2xl bg-fg/[0.06] px-4 text-body outline-none placeholder:text-fg-muted focus-visible:ring-2 focus-visible:ring-blue/50';

export function AuthForm({ mode, next }: { mode: 'login' | 'signup'; next?: string }) {
  const t = useTranslations('auth');
  const [state, action] = useFormState<AuthState, FormData>(
    mode === 'login' ? signIn : signUp,
    null,
  );

  return (
    <form action={action} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <div className="space-y-1.5">
        <label htmlFor="email" className="text-[15px] font-semibold">
          {t('email')}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={inputClass}
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="password" className="text-[15px] font-semibold">
          {t('password')}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          minLength={mode === 'signup' ? 8 : undefined}
          required
          aria-describedby={mode === 'signup' ? 'password-hint' : undefined}
          className={inputClass}
        />
        {mode === 'signup' ? (
          <p id="password-hint" className="text-[14px] text-fg-muted">
            {t('passwordHint')}
          </p>
        ) : null}
      </div>
      {state?.error ? (
        <p
          role="alert"
          className="rounded-2xl bg-red/10 px-4 py-3 text-[15px] font-medium text-[#C00011] dark:text-red"
        >
          {t(`errors.${state.error}`)}
        </p>
      ) : null}
      <Submit label={mode === 'login' ? t('login') : t('signup')} />
      <p className="text-center text-[15px] text-fg-muted">
        {mode === 'login' ? t('noAccount') : t('hasAccount')}{' '}
        <Link
          href={mode === 'login' ? '/signup' : '/login'}
          className="font-semibold text-[#0062C4] dark:text-blue"
        >
          {mode === 'login' ? t('createOne') : t('signIn')}
        </Link>
      </p>
    </form>
  );
}
