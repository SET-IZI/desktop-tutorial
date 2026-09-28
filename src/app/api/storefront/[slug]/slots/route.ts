import { NextResponse } from 'next/server';
import { z } from 'zod';
import { computeSlots } from '@/lib/slots/compute';
import { getSlotInputs, getStorefront } from '@/lib/storefront/queries';

export const dynamic = 'force-dynamic';

const DAYS = 3;
/** Délai de trajet par défaut tant que l'adresse (donc la zone) n'est pas connue. */
const DEFAULT_DELIVERY_LEAD_MINUTES = 30;

const querySchema = z.object({
  service: z.enum(['pickup', 'delivery']).default('pickup'),
  lead: z.coerce.number().int().min(0).max(180).optional(),
});

export async function GET(request: Request, { params }: { params: { slug: string } }) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
  }
  const { service, lead } = parsed.data;

  const storefront = await getStorefront(params.slug);
  if (!storefront) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const { location } = storefront;

  const enabled = service === 'pickup' ? location.pickupEnabled : location.deliveryEnabled;
  if (!enabled) return NextResponse.json({ error: 'service_disabled' }, { status: 409 });

  const now = new Date();
  const to = new Date(now.getTime() + (DAYS + 1) * 24 * 3600_000);
  const { load, overrides } = await getSlotInputs(location.id, now, to);

  const result = computeSlots({
    now,
    days: DAYS,
    load,
    overrides,
    leadMinutes: service === 'delivery' ? (lead ?? DEFAULT_DELIVERY_LEAD_MINUTES) : 0,
    config: {
      timezone: location.timezone,
      prepTimeMinutes: location.prepTimeMinutes,
      slotIntervalMinutes: location.slotIntervalMinutes,
      slotCapacity: location.slotCapacity,
      rushMode: location.rushMode,
      rushExtraMinutes: location.rushExtraMinutes,
      hours: location.hours.filter((h) => h.service === service),
      closures: location.closures,
    },
  });

  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
}
