'use client';

import { Check, Copy, Download, ExternalLink, Minus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { publishRestaurant } from '@/app/app/onboarding/actions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

interface PublishStepProps {
  url: string;
  previewHref: string;
  /** SVG généré côté serveur à partir de notre propre URL. */
  qrSvg: string;
  slug: string;
  summary: { hours: boolean; products: number; card: boolean; onSite: boolean };
}

export function PublishStep({ url, previewHref, qrSvg, slug, summary }: PublishStepProps) {
  const t = useTranslations('onboarding.publish');
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast(t('copied'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Presse-papiers indisponible : le lien reste sélectionnable.
    }
  };

  const items = [
    { ok: summary.hours, label: t('items.hours') },
    { ok: summary.products > 0, label: t('items.menu', { count: summary.products }) },
    { ok: summary.card, label: t('items.card') },
    { ok: summary.onSite, label: t('items.onSite') },
  ];

  return (
    <Card className="p-5 sm:p-7">
      <h2 className="text-[22px] font-bold tracking-display">{t('title')}</h2>
      <p className="mt-1 text-fg-muted">{t('hint')}</p>

      <div className="mt-6 grid gap-6 sm:grid-cols-[1fr_12rem]">
        <div className="min-w-0 space-y-5">
          <div>
            <p className="font-semibold" id="shop-link-label">
              {t('link')}
            </p>
            <div className="mt-1.5 flex items-center gap-2 rounded-2xl bg-fg/[0.06] py-1 pl-4 pr-1">
              <span
                className="min-w-0 flex-1 select-all truncate font-medium"
                aria-labelledby="shop-link-label"
              >
                {url}
              </span>
              <Button variant="ghost" size="icon" aria-label={t('copy')} onClick={copy}>
                {copied ? (
                  <Check className="size-5 text-green" aria-hidden />
                ) : (
                  <Copy className="size-5" aria-hidden />
                )}
              </Button>
            </div>
            <a
              href={previewHref}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex min-h-touch items-center gap-1.5 font-semibold text-[#0062C4] dark:text-blue"
            >
              <ExternalLink className="size-4" aria-hidden />
              {t('preview')}
            </a>
          </div>

          <div>
            <p className="font-semibold">{t('checklist')}</p>
            <ul className="mt-2 space-y-1.5">
              {items.map((item) => (
                <li key={item.label} className="flex items-center gap-2">
                  {item.ok ? (
                    <Check className="size-5 shrink-0 text-green" aria-hidden />
                  ) : (
                    <Minus className="size-5 shrink-0 text-fg-muted" aria-hidden />
                  )}
                  <span className={cn(!item.ok && 'text-fg-muted')}>{item.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2">
          <div
            role="img"
            aria-label={t('qr')}
            className="w-44 rounded-2xl bg-white p-2 sm:w-full [&_svg]:h-auto [&_svg]:w-full"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <a
            href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}`}
            download={`qr-${slug}.svg`}
            className="inline-flex min-h-touch items-center gap-1.5 text-[15px] font-semibold text-[#0062C4] dark:text-blue"
          >
            <Download className="size-4" aria-hidden />
            {t('download')}
          </a>
        </div>
      </div>

      <Button
        size="lg"
        block
        className="mt-7"
        loading={pending}
        onClick={() =>
          start(async () => {
            // Succès : l'action redirige vers le back-office.
            const result = await publishRestaurant();
            if (!result.ok) toast(t('errors.server_error'), 'error');
          })
        }
      >
        {t('submit')}
      </Button>
    </Card>
  );
}
