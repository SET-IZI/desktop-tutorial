'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { createRestaurant } from '@/app/app/onboarding/actions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { slugify } from '@/lib/onboarding/slug';
import { cn } from '@/lib/utils';
import { Field, inputClass } from './field';

type FieldName = 'name' | 'slug' | 'address' | 'postalCode' | 'city' | 'phone';

export function ProfileStep({ domain }: { domain: string }) {
  const t = useTranslations('onboarding.profile');
  const router = useRouter();
  const [values, setValues] = useState({
    name: '',
    slug: '',
    addressLine: '',
    postalCode: '',
    city: '',
    phone: '',
  });
  // Le slug suit le nom tant que le restaurateur ne l'a pas modifié lui-même.
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState<{ code: string; field?: string } | null>(null);
  const [pending, start] = useTransition();

  const set = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  const onName = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setValues((v) => ({ ...v, name, slug: slugEdited ? v.slug : name ? slugify(name) : '' }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const result = await createRestaurant(values);
      if (result.ok) {
        router.push('/app/onboarding');
        router.refresh();
        return;
      }
      setError(
        result.error === 'invalid' && result.field
          ? { code: result.field, field: result.field }
          : { code: result.error, field: result.field },
      );
    });
  };

  const errorFor = (field: FieldName) => (error?.field === field ? error.code : null);
  const message = error
    ? t.has(`errors.${error.code}`)
      ? t(`errors.${error.code}`)
      : t('errors.server_error')
    : null;

  return (
    <Card className="p-5 sm:p-7">
      <h2 className="text-[22px] font-bold tracking-display">{t('title')}</h2>
      <p className="mt-1 text-fg-muted">{t('hint')}</p>
      <form onSubmit={submit} noValidate className="mt-6 space-y-5">
        <Field id="o-name" label={t('name')} error={errorFor('name') ? message : null}>
          <input
            id="o-name"
            value={values.name}
            onChange={onName}
            placeholder={t('namePlaceholder')}
            maxLength={80}
            autoComplete="organization"
            required
            className={inputClass}
          />
        </Field>
        <Field
          id="o-slug"
          label={t('slug')}
          hint={t('slugHint')}
          error={errorFor('slug') ? message : null}
        >
          <div className="flex items-center rounded-2xl bg-fg/[0.06] pr-4 focus-within:ring-2 focus-within:ring-blue/50">
            <input
              id="o-slug"
              value={values.slug}
              onChange={(e) => {
                setSlugEdited(true);
                setValues((v) => ({ ...v, slug: e.target.value.toLowerCase() }));
              }}
              maxLength={40}
              spellCheck={false}
              autoCapitalize="none"
              required
              className={cn(inputClass, 'min-w-0 flex-1 bg-transparent focus-visible:ring-0')}
            />
            <span className="shrink-0 text-fg-muted" aria-hidden>
              .{domain}
            </span>
          </div>
        </Field>
        <Field id="o-address" label={t('address')} error={errorFor('address') ? message : null}>
          <input
            id="o-address"
            value={values.addressLine}
            onChange={set('addressLine')}
            placeholder={t('addressPlaceholder')}
            autoComplete="address-line1"
            maxLength={120}
            required
            className={inputClass}
          />
        </Field>
        <div className="grid grid-cols-[8rem_1fr] gap-3">
          <Field
            id="o-postal"
            label={t('postalCode')}
            error={errorFor('postalCode') ? message : null}
          >
            <input
              id="o-postal"
              value={values.postalCode}
              onChange={set('postalCode')}
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={5}
              required
              className={inputClass}
            />
          </Field>
          <Field id="o-city" label={t('city')} error={errorFor('city') ? message : null}>
            <input
              id="o-city"
              value={values.city}
              onChange={set('city')}
              autoComplete="address-level2"
              maxLength={80}
              required
              className={inputClass}
            />
          </Field>
        </div>
        <Field id="o-phone" label={t('phone')} error={errorFor('phone') ? message : null}>
          <input
            id="o-phone"
            type="tel"
            value={values.phone}
            onChange={set('phone')}
            autoComplete="tel"
            maxLength={20}
            className={inputClass}
          />
        </Field>
        {message && !error?.field ? (
          <p
            role="alert"
            className="rounded-2xl bg-red/10 px-4 py-3 font-medium text-[#C00011] dark:text-red"
          >
            {message}
          </p>
        ) : null}
        <Button type="submit" size="lg" block loading={pending}>
          {t('submit')}
        </Button>
      </form>
    </Card>
  );
}
