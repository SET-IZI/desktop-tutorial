'use client';

import { Camera, FileSpreadsheet, Loader2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useId, useRef, useState, useTransition } from 'react';
import { analyzeMenuFile, importMenu, skipMenu } from '@/app/app/onboarding/actions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { useMoney } from '@/hooks/use-money';
import { compressImage } from '@/lib/image/compress';
import { parseMenuCsv, type CsvError } from '@/lib/menu-import/csv';
import { countProducts, type ImportDraft } from '@/lib/menu-import/draft';

const CSV_TEMPLATE = [
  'Catégorie;Nom;Description;Prix',
  'Entrées;Soupe du jour;Selon le marché;6,50',
  'Plats;Burger maison;Bœuf, cheddar affiné, frites;14,00',
  'Desserts;Tiramisu;;6,00',
].join('\r\n');

const MAX_BYTES = 5 * 1024 * 1024;

interface MenuStepProps {
  existingCount: number;
  aiAvailable: boolean;
}

export function MenuStep({ existingCount, aiAvailable }: MenuStepProps) {
  const t = useTranslations('onboarding.menu');
  const to = useTranslations('onboarding');
  const router = useRouter();
  const toast = useToast();
  const { price } = useMoney();
  const photoId = useId();
  const csvId = useId();
  const photoRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<ImportDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [pending, start] = useTransition();

  const next = () => {
    router.push('/app/onboarding');
    router.refresh();
  };

  const csvMessage = (e: CsvError) =>
    e.code === 'price' || e.code === 'name'
      ? t(`errors.${e.code}`, { line: e.line })
      : t(`errors.${e.code}`);

  const onCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    if (file.size > MAX_BYTES) return setError(t('errors.file_size'));
    const result = parseMenuCsv(await file.text());
    if (result.ok) setDraft(result.draft);
    else setError(csvMessage(result.error));
  };

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setAnalyzing(true);
    try {
      // Les photos sont réduites avant l'envoi (plus rapide, et lisible par l'IA).
      const upload = file.type.startsWith('image/') ? await compressImage(file, 2000) : file;
      if (upload.size > MAX_BYTES) {
        setError(t('errors.file_size'));
        return;
      }
      const data = new FormData();
      data.append('file', upload, file.name);
      const result = await analyzeMenuFile(data);
      if (result.ok) setDraft(result.draft);
      else
        setError(
          t.has(`errors.${result.error}`) ? t(`errors.${result.error}`) : t('errors.server_error'),
        );
    } catch {
      setError(t('errors.ai_failed'));
    } finally {
      setAnalyzing(false);
    }
  };

  const removeProduct = (ci: number, pi: number) =>
    setDraft((d) => {
      if (!d) return d;
      const categories = d.categories
        .map((c, i) => (i === ci ? { ...c, products: c.products.filter((_, j) => j !== pi) } : c))
        .filter((c) => c.products.length > 0);
      return categories.length ? { categories } : null;
    });

  const submitImport = () =>
    start(async () => {
      if (!draft) return;
      const result = await importMenu(draft);
      if (!result.ok) {
        toast(t('errors.server_error'), 'error');
        return;
      }
      toast(t('imported', { count: result.count }));
      next();
    });

  const downloadTemplate = () => {
    const blob = new Blob(['﻿' + CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'carte-miaamm.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (draft) {
    const count = countProducts(draft);
    return (
      <Card className="p-5 sm:p-7">
        <h2 className="text-[22px] font-bold tracking-display">{t('review')}</h2>
        <p className="mt-1 text-fg-muted">{t('reviewHint')}</p>
        <div className="mt-5 space-y-5">
          {draft.categories.map((category, ci) => (
            <section key={`${category.name}-${ci}`} aria-labelledby={`cat-${ci}`}>
              <h3 id={`cat-${ci}`} className="text-[18px] font-bold">
                {category.name}
              </h3>
              <ul className="mt-2 divide-y divide-line/[0.06] rounded-2xl bg-fg/[0.03]">
                {category.products.map((product, pi) => (
                  <li
                    key={`${product.name}-${pi}`}
                    className="flex items-center gap-3 py-2 pl-4 pr-1"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{product.name}</p>
                      {product.description ? (
                        <p className="truncate text-[14px] text-fg-muted">{product.description}</p>
                      ) : null}
                    </div>
                    <span className="shrink-0 tabular-nums">{price(product.priceCents)}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t('remove', { name: product.name })}
                      onClick={() => removeProduct(ci, pi)}
                    >
                      <X className="size-5" aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <Button variant="ghost" onClick={() => setDraft(null)}>
            {t('restart')}
          </Button>
          <Button size="lg" onClick={submitImport} loading={pending}>
            {t('import', { count })}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5 sm:p-7">
      <h2 className="text-[22px] font-bold tracking-display">{t('title')}</h2>
      <p className="mt-1 text-fg-muted">{t('hint')}</p>
      {existingCount > 0 ? (
        <p className="mt-3 font-medium">{t('existing', { count: existingCount })}</p>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {aiAvailable ? (
          <div className="flex flex-col rounded-2xl bg-fg/[0.04] p-4">
            <Camera className="size-6 text-blue" aria-hidden />
            <p className="mt-3 font-semibold">{t('photo')}</p>
            <p className="mt-0.5 flex-1 text-[15px] text-fg-muted">{t('photoHint')}</p>
            <input
              ref={photoRef}
              id={photoId}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="sr-only"
              onChange={onPhoto}
              aria-label={t('photo')}
              tabIndex={-1}
            />
            <Button
              variant="secondary"
              className="mt-4"
              onClick={() => photoRef.current?.click()}
              disabled={analyzing}
            >
              {analyzing ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
              {analyzing ? t('analyzing') : t('photoButton')}
            </Button>
          </div>
        ) : null}
        <div className="flex flex-col rounded-2xl bg-fg/[0.04] p-4">
          <FileSpreadsheet className="size-6 text-green" aria-hidden />
          <p className="mt-3 font-semibold">{t('csv')}</p>
          <p className="mt-0.5 flex-1 text-[15px] text-fg-muted">{t('csvHint')}</p>
          <input
            ref={csvRef}
            id={csvId}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={onCsv}
            aria-label={t('csv')}
            tabIndex={-1}
          />
          <Button variant="secondary" className="mt-4" onClick={() => csvRef.current?.click()}>
            {t('csvButton')}
          </Button>
          <button
            type="button"
            onClick={downloadTemplate}
            className="mt-2 min-h-touch text-[15px] font-semibold text-[#0062C4] dark:text-blue"
          >
            {t('csvTemplate')}
          </button>
        </div>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {analyzing ? t('analyzing') : ''}
      </p>
      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-2xl bg-red/10 px-4 py-3 font-medium text-[#C00011] dark:text-red"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex justify-end">
        <Button
          variant={existingCount > 0 ? 'primary' : 'ghost'}
          onClick={() =>
            start(async () => {
              const result = await skipMenu();
              if (result.ok) next();
              else toast(t('errors.server_error'), 'error');
            })
          }
          loading={pending}
        >
          {existingCount > 0 ? to('continue') : t('skip')}
        </Button>
      </div>
    </Card>
  );
}
