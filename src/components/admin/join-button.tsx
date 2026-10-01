'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { acceptInvite } from '@/app/app/rejoindre/[token]/actions';
import { Button } from '@/components/ui/button';

export function JoinButton({ token, label }: { token: string; label: string }) {
  const t = useTranslations('join.errors');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      {error ? (
        <p
          role="alert"
          className="rounded-2xl bg-red/10 px-4 py-3 font-medium text-[#C00011] dark:text-red"
        >
          {t.has(error) ? t(error, { email: '' }) : t('server_error')}
        </p>
      ) : null}
      <Button
        size="lg"
        block
        loading={pending}
        onClick={() =>
          start(async () => {
            // Succès : l'action redirige vers le back-office du restaurant.
            const result = await acceptInvite(token);
            setError(result.error);
          })
        }
      >
        {label}
      </Button>
    </>
  );
}
