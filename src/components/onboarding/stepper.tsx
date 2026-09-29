import { Check } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { cn } from '@/lib/utils';

/** Progression : étapes franchies cliquables (sauf la création du restaurant). */
export async function Stepper({ current, done }: { current: number; done: number }) {
  const t = await getTranslations('onboarding');
  return (
    <nav aria-label={t('stepsLabel')}>
      <ol className="grid grid-cols-5 gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => {
          const isDone = n <= done;
          const isCurrent = n === current;
          const reachable = n >= 2 && n <= done + 1 && !isCurrent;
          const label = t(`steps.${n}`);
          const content = (
            <>
              <span
                className={cn(
                  'h-1.5 w-full rounded-full',
                  isCurrent ? 'bg-cta' : isDone ? 'bg-green' : 'bg-fg/10',
                )}
                aria-hidden
              />
              <span
                className={cn(
                  // Sur mobile, seules les barres restent visibles (le nom est dans l'en-tête).
                  'items-center gap-1 truncate text-[14px] max-sm:sr-only sm:flex',
                  isCurrent ? 'font-semibold text-fg' : 'text-fg-muted',
                )}
              >
                {isDone && !isCurrent ? (
                  <Check className="size-3.5 shrink-0 text-green" aria-hidden />
                ) : null}
                <span className="truncate">{label}</span>
                {isDone ? <span className="sr-only">({t('done')})</span> : null}
              </span>
            </>
          );
          return (
            <li key={n} aria-current={isCurrent ? 'step' : undefined}>
              {reachable ? (
                <Link
                  href={`/app/onboarding?step=${n}`}
                  className="flex min-h-touch flex-col justify-center gap-1.5 rounded-lg hover:opacity-80"
                >
                  {content}
                </Link>
              ) : (
                <div className="flex min-h-touch flex-col justify-center gap-1.5">{content}</div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
