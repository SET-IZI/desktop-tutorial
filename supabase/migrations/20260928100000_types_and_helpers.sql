-- ─────────────────────────────────────────────────────────────────────────────
-- Miaamm · 001 · Extensions, types énumérés, fonctions utilitaires
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists pgcrypto with schema extensions;

-- Rôles d'équipe (users_roles)
create type public.member_role as enum ('owner', 'manager', 'kitchen');

-- Commandes
create type public.fulfillment_type as enum ('pickup', 'delivery');
create type public.order_status as enum (
  'pending_payment', -- créée, paiement carte en cours
  'new',             -- payée (ou paiement sur place), en attente d'acceptation
  'accepted',
  'preparing',
  'ready',
  'in_delivery',
  'completed',       -- retirée ou livrée
  'cancelled',
  'rejected'
);
create type public.payment_method as enum ('card', 'on_site');
create type public.payment_status as enum ('pending', 'paid', 'unpaid', 'failed', 'refunded', 'partially_refunded');
create type public.rush_mode as enum ('off', 'extended', 'paused');

-- Catalogue
create type public.diet_tag as enum ('vegetarian', 'vegan', 'gluten_free', 'spicy', 'new');
-- Les 14 allergènes à déclaration obligatoire (règlement UE 1169/2011)
create type public.allergen as enum (
  'gluten', 'crustaceans', 'eggs', 'fish', 'peanuts', 'soy', 'milk',
  'nuts', 'celery', 'mustard', 'sesame', 'sulphites', 'lupin', 'molluscs'
);
create type public.accent_tone as enum ('blue', 'violet', 'pink', 'orange', 'green');

-- Livraison
create type public.delivery_provider as enum ('internal', 'uber_direct', 'stuart', 'shipday');
create type public.delivery_status as enum (
  'pending', 'assigned', 'en_route_to_pickup', 'at_pickup', 'picked_up',
  'en_route_to_dropoff', 'arrived', 'delivered', 'cancelled', 'failed'
);
create type public.assignment_mode as enum ('manual', 'auto');
create type public.zone_kind as enum ('radius', 'polygon');
create type public.vehicle_type as enum ('foot', 'bike', 'ebike', 'scooter', 'car');
create type public.log_direction as enum ('outbound', 'inbound');
create type public.credential_status as enum ('connected', 'error', 'disconnected');

-- Croissance
create type public.promo_kind as enum ('percent', 'fixed', 'free_delivery');
create type public.loyalty_kind as enum ('stamps', 'points');
create type public.campaign_channel as enum ('email', 'sms');
create type public.campaign_status as enum ('draft', 'scheduled', 'sending', 'sent', 'cancelled');

-- Jobs asynchrones (Vercel Cron)
create type public.job_status as enum ('pending', 'running', 'succeeded', 'failed');

-- updated_at automatique
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Jeton aléatoire URL-safe (liens de suivi, codes d'invitation, webhooks)
create or replace function public.random_token(p_bytes int default 24)
returns text
language sql
volatile
set search_path = ''
as $$
  select translate(encode(extensions.gen_random_bytes(p_bytes), 'base64'), '+/=', '-_');
$$;
