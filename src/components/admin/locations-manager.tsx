'use client';

import { MapPin, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { switchLocation } from '@/app/app/context-actions';
import { createLocation, setLocationActive } from '@/app/app/(shell)/etablissements/actions';
import { Field, inputClass } from '@/components/onboarding/field';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/toast';

interface LocationsManagerProps {
  restaurantId: string;
  currentId: string | null;
  locations: { id: string; name: string; address: string; isActive: boolean }[];
}

const EMPTY = { name: '', addressLine: '', postalCode: '', city: '', phone: '' };

export function LocationsManager({ restaurantId, currentId, locations }: LocationsManagerProps) {
  const t = useTranslations('admin.locations');
  const ta = useTranslations('admin');
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [values, setValues] = useState(EMPTY);
  const [error, setError] = useState<{ code: string; field?: string } | null>(null);

  const message = (code: string) =>
    t.has(`errors.${code}`)
      ? t(`errors.${code}`)
      : code === 'forbidden'
        ? ta('forbidden')
        : ta('saveError');

  const set = (key: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const result = await createLocation(values);
      if (!result.ok) {
        if (result.field) setError({ code: result.error, field: result.field });
        else toast(message(result.error), 'error');
        return;
      }
      setValues(EMPTY);
      toast(t('created'));
      router.push('/app/horaires');
    });
  };

  const fieldError = (field: string) => (error?.field === field ? message(error.code) : null);

  return (
    <div className="space-y-6">
      <Card className="p-2 sm:p-3">
        <ul className="divide-y divide-line/[0.06]">
          {locations.map((l) => {
            const current = l.id === currentId;
            return (
              <li key={l.id} className="flex flex-wrap items-center gap-3 px-3 py-3">
                <MapPin className="size-5 shrink-0 text-fg-muted" aria-hidden />
                <div className="min-w-[12rem] flex-1">
                  <p className="truncate font-semibold">
                    {l.name}
                    {!l.isActive ? (
                      <span className="ml-2 rounded-full bg-fg/[0.06] px-2 py-0.5 text-[13px]">
                        {t('hidden')}
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-[14px] text-fg-muted">{l.address}</p>
                </div>
                {current ? (
                  <span className="rounded-full bg-blue/10 px-3 py-1 text-[14px] font-semibold">
                    {t('current')}
                  </span>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label={t('manage', { name: l.name })}
                    onClick={() =>
                      start(async () => {
                        await switchLocation(restaurantId, l.id);
                        router.refresh();
                      })
                    }
                  >
                    {t('manageShort')}
                  </Button>
                )}
                <Switch
                  label={t('visible', { name: l.name })}
                  checked={l.isActive}
                  disabled={pending}
                  onChange={(active) =>
                    start(async () => {
                      const result = await setLocationActive(l.id, active);
                      if (result.ok) {
                        toast(ta('saved'));
                        router.refresh();
                      } else toast(message(result.error), 'error');
                    })
                  }
                />
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-[20px] font-bold tracking-display">
          <Plus className="size-5 text-blue" aria-hidden />
          {t('add')}
        </h2>
        <p className="mt-1 text-fg-muted">{t('addHint')}</p>
        <form onSubmit={submit} noValidate className="mt-5 space-y-4">
          <Field id="loc-name" label={t('name')} error={fieldError('name')}>
            <input
              id="loc-name"
              value={values.name}
              onChange={set('name')}
              placeholder={t('namePlaceholder')}
              maxLength={80}
              required
              className={inputClass}
            />
          </Field>
          <Field id="loc-address" label={t('address')} error={fieldError('address')}>
            <input
              id="loc-address"
              value={values.addressLine}
              onChange={set('addressLine')}
              autoComplete="address-line1"
              maxLength={120}
              required
              className={inputClass}
            />
          </Field>
          <div className="grid grid-cols-[8rem_1fr] gap-3">
            <Field id="loc-postal" label={t('postalCode')} error={fieldError('postalCode')}>
              <input
                id="loc-postal"
                value={values.postalCode}
                onChange={set('postalCode')}
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={5}
                required
                className={inputClass}
              />
            </Field>
            <Field id="loc-city" label={t('city')} error={fieldError('city')}>
              <input
                id="loc-city"
                value={values.city}
                onChange={set('city')}
                autoComplete="address-level2"
                maxLength={80}
                required
                className={inputClass}
              />
            </Field>
          </div>
          <Field id="loc-phone" label={t('phone')} error={fieldError('phone')}>
            <input
              id="loc-phone"
              type="tel"
              value={values.phone}
              onChange={set('phone')}
              autoComplete="tel"
              maxLength={20}
              className={inputClass}
            />
          </Field>
          <Button type="submit" loading={pending}>
            {t('create')}
          </Button>
        </form>
      </Card>
    </div>
  );
}
