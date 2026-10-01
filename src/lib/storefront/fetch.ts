import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { MenuCategory, Storefront, StoreLocation } from './types';

const RESTAURANT_SELECT = `
  id, slug, name, description, logo_url, cover_url, accent_color, currency,
  stripe_account_id, stripe_charges_enabled,
  locations (
    id, name, address_line, postal_code, city, lat, lng, phone, timezone, menu_id, created_at,
    pickup_enabled, delivery_enabled, on_site_payment_enabled,
    prep_time_minutes, slot_interval_minutes, slot_capacity, rush_mode, rush_extra_minutes,
    opening_hours ( service, weekday, opens_at, closes_at ),
    location_closures ( starts_on, ends_on )
  )
` as const;

const MENU_SELECT = `
  id, name, description, emoji, tone, position,
  products (
    id, category_id, name, description, price_cents, image_urls, diet_tags, allergens,
    is_sold_out, is_upsell, position,
    option_groups ( id, name, min_select, max_select, position,
      options ( id, name, price_delta_cents, position ) )
  )
` as const;

const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position;

/**
 * Lecture de la boutique, sans cache ni dépendance à Next.js : le client Supabase
 * est fourni par l'appelant (RSC via queries.ts, script d'aperçu, tests).
 */
export async function fetchStorefront(
  supabase: SupabaseClient<Database>,
  slug: string,
): Promise<Storefront | null> {
  // La RLS ne renvoie que les restaurants publiés et les éléments actifs.
  const { data: restaurant, error } = await supabase
    .from('restaurants')
    .select(RESTAURANT_SELECT)
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw new Error(`Boutique ${slug} : ${error.message}`);
  if (!restaurant) return null;

  // Établissements actifs (RLS), du plus ancien au plus récent. La carte est
  // celle du restaurant, partagée par tous ses établissements.
  const sorted = [...restaurant.locations].sort((x, y) => x.created_at.localeCompare(y.created_at));
  const menuId = sorted[0]?.menu_id;
  if (!menuId) return null;

  const { data: categories, error: menuError } = await supabase
    .from('categories')
    .select(MENU_SELECT)
    .eq('menu_id', menuId);
  if (menuError) throw new Error(`Carte ${slug} : ${menuError.message}`);

  const locations: StoreLocation[] = sorted.map((loc) => ({
    id: loc.id,
    name: loc.name,
    addressLine: loc.address_line,
    postalCode: loc.postal_code,
    city: loc.city,
    lat: loc.lat,
    lng: loc.lng,
    phone: loc.phone,
    timezone: loc.timezone,
    pickupEnabled: loc.pickup_enabled,
    deliveryEnabled: loc.delivery_enabled,
    onSitePaymentEnabled: loc.on_site_payment_enabled,
    prepTimeMinutes: loc.prep_time_minutes,
    slotIntervalMinutes: loc.slot_interval_minutes,
    slotCapacity: loc.slot_capacity,
    rushMode: loc.rush_mode,
    rushExtraMinutes: loc.rush_extra_minutes,
    hours: loc.opening_hours.map((h) => ({
      service: h.service,
      weekday: h.weekday,
      opensAt: h.opens_at,
      closesAt: h.closes_at,
    })),
    closures: loc.location_closures.map((c) => ({ startsOn: c.starts_on, endsOn: c.ends_on })),
  }));

  const menu: MenuCategory[] = [...categories]
    .sort(byPosition)
    .map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      emoji: c.emoji,
      tone: c.tone,
      products: [...c.products].sort(byPosition).map((p) => ({
        id: p.id,
        categoryId: p.category_id,
        name: p.name,
        description: p.description,
        priceCents: p.price_cents,
        imageUrls: p.image_urls,
        dietTags: p.diet_tags,
        allergens: p.allergens,
        isSoldOut: p.is_sold_out,
        isUpsell: p.is_upsell,
        optionGroups: [...p.option_groups].sort(byPosition).map((g) => ({
          id: g.id,
          name: g.name,
          minSelect: g.min_select,
          maxSelect: g.max_select,
          options: [...g.options].sort(byPosition).map((o) => ({
            id: o.id,
            name: o.name,
            priceDeltaCents: o.price_delta_cents,
          })),
        })),
      })),
    }))
    // Une catégorie vide n'apporte rien au client.
    .filter((c) => c.products.length > 0);

  return {
    restaurant: {
      id: restaurant.id,
      slug: restaurant.slug,
      name: restaurant.name,
      description: restaurant.description,
      logoUrl: restaurant.logo_url,
      coverUrl: restaurant.cover_url,
      accentColor: restaurant.accent_color,
      currency: restaurant.currency,
      stripeAccountId: restaurant.stripe_account_id,
      stripeChargesEnabled: restaurant.stripe_charges_enabled,
    },
    location: locations[0]!,
    locations,
    categories: menu,
  };
}
