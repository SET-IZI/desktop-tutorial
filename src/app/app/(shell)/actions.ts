'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { getCurrentLocation } from '@/lib/admin/location';
import { validateSchedule, WEEKDAYS } from '@/lib/admin/schedule';
import { isOwnImageUrl } from '@/lib/admin/storage-url';
import { assertRole } from '@/lib/auth/session';
import { storefrontTag } from '@/lib/storefront/queries';
import { createClient } from '@/lib/supabase/server';

/**
 * Actions du back-office. Toujours via le client de l'utilisateur : la RLS (rôle
 * manager/owner) et les privilèges par colonne font foi ; assertRole donne un
 * message clair avant d'atteindre la base.
 */

export type ActionResult = { ok: true } | { ok: false; error: string; detail?: string };

async function context() {
  const ctx = await assertRole(['owner', 'manager']);
  const location = await getCurrentLocation(ctx.current.restaurantId);
  if (!location) throw new Error('no_location');
  return { ...ctx, location, supabase: createClient() };
}

function refresh(slug: string) {
  revalidateTag(storefrontTag(slug));
  revalidatePath('/app', 'layout');
}

async function guard(fn: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof Error && error.message === 'forbidden')
      return { ok: false, error: 'forbidden' };
    console.error('[admin]', error);
    return { ok: false, error: 'server_error' };
  }
}

// ═══ Mode rush ═══════════════════════════════════════════════════════════════

const rushSchema = z.object({
  mode: z.enum(['off', 'extended', 'paused']),
  extraMinutes: z.number().int().min(5).max(120).optional(),
});

export async function setRushMode(input: z.input<typeof rushSchema>): Promise<ActionResult> {
  return guard(async () => {
    const parsed = rushSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: 'invalid' };
    const { supabase, location, current } = await context();
    const { error } = await supabase
      .from('locations')
      .update({
        rush_mode: parsed.data.mode,
        ...(parsed.data.extraMinutes ? { rush_extra_minutes: parsed.data.extraMinutes } : {}),
      })
      .eq('id', location.id);
    if (error) throw new Error(error.message);
    refresh(current.slug);
    return { ok: true };
  });
}

// ═══ Réglages ════════════════════════════════════════════════════════════════

const restaurantSchema = z.object({
  name: z.string().trim().min(1, 'name_required').max(80),
  description: z.string().trim().max(500),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  logoUrl: z.url().max(500).nullable().optional(),
  coverUrl: z.url().max(500).nullable().optional(),
});

export async function updateRestaurant(
  input: z.input<typeof restaurantSchema>,
): Promise<ActionResult> {
  return guard(async () => {
    const parsed = restaurantSchema.safeParse(input);
    if (!parsed.success)
      return {
        ok: false,
        error: parsed.error.issues[0]?.message === 'name_required' ? 'name_required' : 'invalid',
      };
    const { supabase, current } = await context();
    const { logoUrl, coverUrl } = parsed.data;
    // Logo et bannière : uniquement des images du dossier Storage du restaurant.
    if ([logoUrl, coverUrl].some((u) => u && !isOwnImageUrl(u, current.restaurantId))) {
      return { ok: false, error: 'invalid' };
    }
    const { error } = await supabase
      .from('restaurants')
      .update({
        name: parsed.data.name,
        description: parsed.data.description || null,
        accent_color: parsed.data.accentColor.toUpperCase(),
        ...(logoUrl !== undefined ? { logo_url: logoUrl } : {}),
        ...(coverUrl !== undefined ? { cover_url: coverUrl } : {}),
      })
      .eq('id', current.restaurantId);
    if (error) throw new Error(error.message);
    refresh(current.slug);
    return { ok: true };
  });
}

/** Durées de créneau autorisées (contrainte SQL identique). */
const SLOT_INTERVALS = [5, 10, 15, 20, 30, 60];

const locationSchema = z.object({
  name: z.string().trim().min(1).max(80),
  phone: z.string().trim().max(30),
  pickupEnabled: z.boolean(),
  onSitePaymentEnabled: z.boolean(),
  prepTimeMinutes: z.number().int().min(1).max(240),
  slotIntervalMinutes: z
    .number()
    .int()
    .refine((v) => SLOT_INTERVALS.includes(v)),
  slotCapacity: z.number().int().min(1).max(500),
  rushExtraMinutes: z.number().int().min(5).max(120),
});

export async function updateLocation(input: z.input<typeof locationSchema>): Promise<ActionResult> {
  return guard(async () => {
    const parsed = locationSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: 'invalid' };
    const { supabase, location, current } = await context();
    const d = parsed.data;
    const { error } = await supabase
      .from('locations')
      .update({
        name: d.name,
        phone: d.phone || null,
        pickup_enabled: d.pickupEnabled,
        on_site_payment_enabled: d.onSitePaymentEnabled,
        prep_time_minutes: d.prepTimeMinutes,
        slot_interval_minutes: d.slotIntervalMinutes,
        slot_capacity: d.slotCapacity,
        rush_extra_minutes: d.rushExtraMinutes,
      })
      .eq('id', location.id);
    if (error) throw new Error(error.message);
    refresh(current.slug);
    return { ok: true };
  });
}

export async function setPublished(published: boolean): Promise<ActionResult> {
  return guard(async () => {
    const { supabase, current } = await context();
    const { error } = await supabase
      .from('restaurants')
      .update({ is_published: published })
      .eq('id', current.restaurantId);
    if (error) throw new Error(error.message);
    refresh(current.slug);
    return { ok: true };
  });
}

// ═══ Horaires ════════════════════════════════════════════════════════════════

const rangeSchema = z.object({ opensAt: z.string(), closesAt: z.string() });
const hoursSchema = z.object({
  service: z.enum(['pickup', 'delivery']),
  schedule: z.record(z.string(), z.array(rangeSchema)),
});

export async function saveHours(input: z.input<typeof hoursSchema>): Promise<ActionResult> {
  return guard(async () => {
    const parsed = hoursSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: 'invalid' };
    const schedule = Object.fromEntries(
      Object.entries(parsed.data.schedule).map(([d, r]) => [Number(d), r]),
    );
    const errors = validateSchedule(schedule);
    if (errors.length > 0)
      return { ok: false, error: errors[0]!.code, detail: String(errors[0]!.weekday) };

    const { supabase, location, current } = await context();
    const ranges = WEEKDAYS.flatMap((weekday) =>
      (schedule[weekday] ?? []).map((r) => ({
        weekday,
        opens_at: r.opensAt,
        closes_at: r.closesAt,
      })),
    );
    const { error } = await supabase.rpc('replace_opening_hours', {
      p_location_id: location.id,
      p_service: parsed.data.service,
      p_ranges: ranges,
    });
    if (error) throw new Error(error.message);
    refresh(current.slug);
    return { ok: true };
  });
}

const closureSchema = z
  .object({ startsOn: z.iso.date(), endsOn: z.iso.date(), reason: z.string().trim().max(120) })
  .refine((c) => c.endsOn >= c.startsOn, { message: 'dates' });

export async function addClosure(input: z.input<typeof closureSchema>): Promise<ActionResult> {
  return guard(async () => {
    const parsed = closureSchema.safeParse(input);
    if (!parsed.success)
      return {
        ok: false,
        error: parsed.error.issues[0]?.message === 'dates' ? 'dates' : 'invalid',
      };
    const { supabase, location, current } = await context();
    const { error } = await supabase.from('location_closures').insert({
      restaurant_id: current.restaurantId,
      location_id: location.id,
      starts_on: parsed.data.startsOn,
      ends_on: parsed.data.endsOn,
      reason: parsed.data.reason || null,
    });
    if (error) throw new Error(error.message);
    refresh(current.slug);
    return { ok: true };
  });
}

export async function deleteClosure(id: string): Promise<ActionResult> {
  return guard(async () => {
    if (!z.uuid().safeParse(id).success) return { ok: false, error: 'invalid' };
    const { supabase, current } = await context();
    const { error } = await supabase.from('location_closures').delete().eq('id', id);
    if (error) throw new Error(error.message);
    refresh(current.slug);
    return { ok: true };
  });
}
