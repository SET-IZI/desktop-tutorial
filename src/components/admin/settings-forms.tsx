'use client';

import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState, useTransition } from 'react';
import {
  setPublished,
  updateLocation,
  updateRestaurant,
  type ActionResult,
} from '@/app/app/(shell)/actions';
import { ImageUpload } from '@/components/admin/menu/image-upload';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/toast';
import { readableTextOn } from '@/lib/color';
import { cn } from '@/lib/utils';

export interface SettingsData {
  restaurant: {
    id: string;
    name: string;
    description: string;
    accentColor: string;
    isPublished: boolean;
    logoUrl: string | null;
    coverUrl: string | null;
  };
  location: {
    name: string;
    phone: string;
    address: string;
    pickupEnabled: boolean;
    onSitePaymentEnabled: boolean;
    prepTimeMinutes: number;
    slotIntervalMinutes: number;
    slotCapacity: number;
    rushExtraMinutes: number;
  };
  canManage: boolean;
}

/** Couleurs proposées (palette système Miaamm) ; la couleur libre reste possible. */
const ACCENTS = [
  '#FF9F0A',
  '#FF375F',
  '#BF5AF2',
  '#0A84FF',
  '#30D158',
  '#1D1D1F',
  '#A2845E',
  '#FF6B35',
];
const INTERVALS = [5, 10, 15, 20, 30, 60];

const input =
  'h-12 w-full rounded-2xl bg-fg/[0.06] px-4 text-body outline-none placeholder:text-fg-muted focus-visible:ring-2 focus-visible:ring-blue/50 disabled:opacity-60';

function useSave() {
  const t = useTranslations('admin');
  const toast = useToast();
  const [pending, start] = useTransition();
  const save = (fn: () => Promise<ActionResult>, onError?: (error: string) => void) =>
    start(async () => {
      const result = await fn();
      if (result.ok) toast(t('saved'));
      else {
        onError?.(result.error);
        toast(result.error === 'forbidden' ? t('forbidden') : t('saveError'), 'error');
      }
    });
  return { pending, save };
}

function Row({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <label htmlFor={htmlFor} className="font-semibold">
          {label}
        </label>
        {hint ? (
          <p id={`${id}-hint`} className="text-[14px] text-fg-muted">
            {hint}
          </p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function SettingsForms({ restaurant, location, canManage }: SettingsData) {
  const t = useTranslations('admin.settings');
  const ta = useTranslations('admin');

  // ── Restaurant
  const [name, setName] = useState(restaurant.name);
  const [description, setDescription] = useState(restaurant.description);
  const [accent, setAccent] = useState(restaurant.accentColor.toUpperCase());
  const [logoUrl, setLogoUrl] = useState(restaurant.logoUrl);
  const [coverUrl, setCoverUrl] = useState(restaurant.coverUrl);
  const [nameError, setNameError] = useState<string | null>(null);
  const restaurantSave = useSave();

  // ── Établissement / commande / cuisine
  const [loc, setLoc] = useState(location);
  const locationSave = useSave();
  const set = <K extends keyof typeof loc>(key: K, value: (typeof loc)[K]) =>
    setLoc((l) => ({ ...l, [key]: value }));

  // ── Publication
  const [published, setPublishedState] = useState(restaurant.isPublished);
  const publishSave = useSave();

  return (
    <div className="space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setNameError(null);
          restaurantSave.save(
            () => updateRestaurant({ name, description, accentColor: accent, logoUrl, coverUrl }),
            (err) => err === 'name_required' && setNameError(t('errors.name_required')),
          );
        }}
      >
        <Card className="space-y-5">
          <h2 className="text-[20px] font-bold tracking-display">{t('restaurant')}</h2>
          <div className="grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)]">
            <ImageUpload
              restaurantId={restaurant.id}
              value={logoUrl}
              onChange={setLogoUrl}
              alt={t('logo')}
              label={t('logo')}
              hint={t('logoHint')}
              maxSide={512}
              shape="square"
              disabled={!canManage}
            />
            <ImageUpload
              restaurantId={restaurant.id}
              value={coverUrl}
              onChange={setCoverUrl}
              alt={t('cover')}
              label={t('cover')}
              hint={t('coverHint')}
              maxSide={2000}
              shape="wide"
              disabled={!canManage}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="r-name" className="font-semibold">
              {t('name')}
            </label>
            <input
              id="r-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              disabled={!canManage}
              className={cn(input, nameError && 'ring-2 ring-red/60')}
              aria-invalid={!!nameError}
              aria-describedby={nameError ? 'r-name-error' : undefined}
            />
            {nameError ? (
              <p
                id="r-name-error"
                role="alert"
                className="text-[14px] font-medium text-[#C00011] dark:text-red"
              >
                {nameError}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="r-desc" className="font-semibold">
              {t('description')}
            </label>
            <textarea
              id="r-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={2}
              disabled={!canManage}
              aria-describedby="r-desc-hint"
              className={cn(input, 'h-auto resize-none py-3')}
            />
            <p id="r-desc-hint" className="text-[14px] text-fg-muted">
              {t('descriptionHint')}
            </p>
          </div>
          <fieldset className="space-y-2">
            <legend className="font-semibold">{t('accent')}</legend>
            <div className="flex flex-wrap items-center gap-2">
              {ACCENTS.map((color) => (
                <button
                  key={color}
                  type="button"
                  disabled={!canManage}
                  onClick={() => setAccent(color)}
                  aria-label={color}
                  aria-pressed={accent === color}
                  className="flex size-11 items-center justify-center rounded-full shadow-soft ring-offset-2 ring-offset-surface aria-pressed:ring-2 aria-pressed:ring-fg"
                  style={{ background: color }}
                >
                  {accent === color ? (
                    <Check
                      className="size-5"
                      style={{ color: readableTextOn(color) }}
                      aria-hidden
                    />
                  ) : null}
                </button>
              ))}
              <label className="flex min-h-touch cursor-pointer items-center gap-2 rounded-full bg-fg/[0.06] px-3 text-[14px] font-semibold">
                <input
                  type="color"
                  value={accent}
                  onChange={(e) => setAccent(e.target.value.toUpperCase())}
                  disabled={!canManage}
                  className="size-7 cursor-pointer rounded-full border-0 bg-transparent"
                />
                {t('accentCustom')}
              </label>
            </div>
          </fieldset>
          {canManage ? (
            <Button type="submit" loading={restaurantSave.pending}>
              {ta('save')}
            </Button>
          ) : null}
        </Card>
      </form>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          locationSave.save(() =>
            updateLocation({
              name: loc.name,
              phone: loc.phone,
              pickupEnabled: loc.pickupEnabled,
              onSitePaymentEnabled: loc.onSitePaymentEnabled,
              prepTimeMinutes: loc.prepTimeMinutes,
              slotIntervalMinutes: loc.slotIntervalMinutes,
              slotCapacity: loc.slotCapacity,
              rushExtraMinutes: loc.rushExtraMinutes,
            }),
          );
        }}
        className="space-y-6"
      >
        <Card className="space-y-5">
          <h2 className="text-[20px] font-bold tracking-display">{t('location')}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="l-name" className="font-semibold">
                {t('locationName')}
              </label>
              <input
                id="l-name"
                value={loc.name}
                onChange={(e) => set('name', e.target.value)}
                maxLength={80}
                disabled={!canManage}
                className={input}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="l-phone" className="font-semibold">
                {t('phone')}
              </label>
              <input
                id="l-phone"
                type="tel"
                value={loc.phone}
                onChange={(e) => set('phone', e.target.value)}
                maxLength={30}
                disabled={!canManage}
                className={input}
              />
            </div>
          </div>
          <div>
            <p className="font-semibold">{t('address')}</p>
            <p>{loc.address}</p>
            <p className="text-[14px] text-fg-muted">{t('addressHint')}</p>
          </div>
        </Card>

        <Card className="divide-y divide-line/[0.06] py-3 sm:py-4">
          <h2 className="pb-2 text-[20px] font-bold tracking-display">{t('ordering')}</h2>
          <Row label={t('pickup')} hint={t('pickupHint')}>
            <Switch
              label={t('pickup')}
              checked={loc.pickupEnabled}
              onChange={(v) => set('pickupEnabled', v)}
              disabled={!canManage}
            />
          </Row>
          <Row label={t('delivery')} hint={t('deliveryHint')}>
            <Switch label={t('delivery')} checked={false} onChange={() => {}} disabled />
          </Row>
          <Row label={t('onSite')} hint={t('onSiteHint')}>
            <Switch
              label={t('onSite')}
              checked={loc.onSitePaymentEnabled}
              onChange={(v) => set('onSitePaymentEnabled', v)}
              disabled={!canManage}
            />
          </Row>
        </Card>

        <Card className="space-y-5">
          <h2 className="text-[20px] font-bold tracking-display">{t('kitchen')}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
              id="l-prep"
              label={t('prep')}
              hint={t('prepHint')}
              value={loc.prepTimeMinutes}
              min={1}
              max={240}
              suffix="min"
              onChange={(v) => set('prepTimeMinutes', v)}
              disabled={!canManage}
            />
            <div className="space-y-1.5">
              <label htmlFor="l-interval" className="font-semibold">
                {t('interval')}
              </label>
              <select
                id="l-interval"
                value={loc.slotIntervalMinutes}
                onChange={(e) => set('slotIntervalMinutes', Number(e.target.value))}
                disabled={!canManage}
                className={input}
              >
                {INTERVALS.map((n) => (
                  <option key={n} value={n}>
                    {t('minutes', { count: n })}
                  </option>
                ))}
              </select>
            </div>
            <NumberField
              id="l-capacity"
              label={t('capacity')}
              hint={t('capacityHint')}
              value={loc.slotCapacity}
              min={1}
              max={500}
              onChange={(v) => set('slotCapacity', v)}
              disabled={!canManage}
            />
            <NumberField
              id="l-rush"
              label={t('rushExtra')}
              value={loc.rushExtraMinutes}
              min={5}
              max={120}
              suffix="min"
              onChange={(v) => set('rushExtraMinutes', v)}
              disabled={!canManage}
            />
          </div>
        </Card>
        {canManage ? (
          <Button type="submit" loading={locationSave.pending}>
            {ta('save')}
          </Button>
        ) : null}
      </form>

      <Card>
        <Row label={t('published')} hint={t('publishedHint')}>
          <Switch
            label={t('published')}
            checked={published}
            disabled={!canManage || publishSave.pending}
            onChange={(v) => {
              setPublishedState(v);
              publishSave.save(
                () => setPublished(v),
                () => setPublishedState(!v),
              );
            }}
          />
        </Row>
      </Card>
    </div>
  );
}

function NumberField({
  id,
  label,
  hint,
  value,
  min,
  max,
  suffix,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="font-semibold">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value) || min)))}
          disabled={disabled}
          aria-describedby={hint ? `${id}-hint` : undefined}
          className={cn(input, suffix && 'pr-14')}
        />
        {suffix ? (
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-fg-muted">
            {suffix}
          </span>
        ) : null}
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="text-[14px] text-fg-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
