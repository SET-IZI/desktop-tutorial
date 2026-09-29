import type { Enums } from '@/types/database';

/** Modèle « boutique » : ce que le front client consomme, découplé des lignes SQL. */

export type DietTag = Enums<'diet_tag'>;
export type Allergen = Enums<'allergen'>;
export type Tone = Enums<'accent_tone'>;
export type Fulfillment = Enums<'fulfillment_type'>;
export type RushMode = Enums<'rush_mode'>;

export interface MenuOption {
  id: string;
  name: string;
  priceDeltaCents: number;
}

export interface MenuOptionGroup {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  options: MenuOption[];
}

export interface MenuProduct {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  priceCents: number;
  imageUrls: string[];
  dietTags: DietTag[];
  allergens: Allergen[];
  isSoldOut: boolean;
  isUpsell: boolean;
  optionGroups: MenuOptionGroup[];
}

export interface MenuCategory {
  id: string;
  name: string;
  description: string | null;
  emoji: string | null;
  tone: Tone;
  products: MenuProduct[];
}

export interface OpeningRange {
  service: Fulfillment;
  /** ISO : 1 = lundi … 7 = dimanche */
  weekday: number;
  /** "HH:MM" ou "HH:MM:SS" (format Postgres time) */
  opensAt: string;
  closesAt: string;
}

export interface Closure {
  startsOn: string; // YYYY-MM-DD
  endsOn: string;
}

export interface StoreLocation {
  id: string;
  name: string;
  addressLine: string;
  postalCode: string;
  city: string;
  lat: number;
  lng: number;
  phone: string | null;
  timezone: string;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  onSitePaymentEnabled: boolean;
  prepTimeMinutes: number;
  slotIntervalMinutes: number;
  slotCapacity: number;
  rushMode: RushMode;
  rushExtraMinutes: number;
  hours: OpeningRange[];
  closures: Closure[];
}

export interface StoreRestaurant {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  accentColor: string;
  currency: string;
  /** Compte Stripe connecté (acct_…) : public, utilisé par Stripe.js côté client. */
  stripeAccountId: string | null;
  stripeChargesEnabled: boolean;
}

export interface Storefront {
  restaurant: StoreRestaurant;
  location: StoreLocation;
  categories: MenuCategory[];
}
