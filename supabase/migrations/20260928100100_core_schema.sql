-- ─────────────────────────────────────────────────────────────────────────────
-- Miaamm · 002 · Schéma principal
-- Conventions :
--   - montants en centimes (integer), devise portée par le restaurant ;
--   - chaque table porte restaurant_id (RLS simple et rapide) ; la cohérence
--     parent/enfant est garantie par des clés étrangères composites
--     (id, restaurant_id), impossible de rattacher un produit à la catégorie
--     d'un autre restaurant ;
--   - géographie en lat/lng (double precision) + GeoJSON en jsonb pour les
--     polygones : pas de dépendance à PostGIS, calculs faits côté app.
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══ Restaurants & équipe ═══════════════════════════════════════════════════

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$'),
  name text not null check (char_length(name) between 1 and 80),
  description text check (char_length(description) <= 500),
  logo_url text,
  cover_url text,
  accent_color text not null default '#0A84FF' check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  locale text not null default 'fr' check (locale in ('fr', 'en')),
  currency char(3) not null default 'EUR',
  -- Stripe Connect (compte Standard du restaurateur, direct charges)
  stripe_account_id text unique,
  stripe_charges_enabled boolean not null default false,
  -- Publication & onboarding
  is_published boolean not null default false,
  onboarding_step smallint not null default 0 check (onboarding_step between 0 and 5),
  plan text not null default 'free' check (plan in ('free', 'pro')),
  -- Fidélité
  loyalty_enabled boolean not null default false,
  loyalty_kind public.loyalty_kind not null default 'stamps',
  loyalty_goal integer not null default 10 check (loyalty_goal > 0),
  loyalty_reward_cents integer not null default 0 check (loyalty_reward_cents >= 0),
  -- Compteur des numéros de commande (voir assign_order_number)
  order_seq integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.users_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  role public.member_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, restaurant_id)
);
create index users_roles_restaurant_idx on public.users_roles (restaurant_id);

-- ═══ Établissements, horaires, capacité ═════════════════════════════════════

create table public.menus (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null default 'Menu',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, restaurant_id)
);
create index menus_restaurant_idx on public.menus (restaurant_id);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  menu_id uuid,
  name text not null,
  address_line text not null,
  postal_code text not null,
  city text not null,
  country char(2) not null default 'FR',
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  phone text,
  timezone text not null default 'Europe/Paris',
  is_active boolean not null default true,
  -- Modes de commande
  pickup_enabled boolean not null default true,
  delivery_enabled boolean not null default false,
  on_site_payment_enabled boolean not null default false,
  -- Capacité cuisine : N commandes max par créneau de X minutes
  prep_time_minutes smallint not null default 15 check (prep_time_minutes between 1 and 240),
  slot_interval_minutes smallint not null default 15 check (slot_interval_minutes in (5, 10, 15, 20, 30, 60)),
  slot_capacity smallint not null default 5 check (slot_capacity between 1 and 500),
  -- Mode rush : allonge les délais ou met les commandes en pause
  rush_mode public.rush_mode not null default 'off',
  rush_extra_minutes smallint not null default 15 check (rush_extra_minutes between 0 and 180),
  -- Livraison
  delivery_provider public.delivery_provider not null default 'internal',
  delivery_assignment public.assignment_mode not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, restaurant_id),
  foreign key (menu_id, restaurant_id) references public.menus (id, restaurant_id) on delete set null (menu_id)
);
create index locations_restaurant_idx on public.locations (restaurant_id);

-- Plages d'ouverture par service. ISO : 1 = lundi … 7 = dimanche.
-- Pas de plage à cheval sur minuit : la couper en deux.
create table public.opening_hours (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  location_id uuid not null,
  service public.fulfillment_type not null,
  weekday smallint not null check (weekday between 1 and 7),
  opens_at time not null,
  closes_at time not null,
  check (closes_at > opens_at),
  foreign key (location_id, restaurant_id) references public.locations (id, restaurant_id) on delete cascade
);
create index opening_hours_location_idx on public.opening_hours (location_id, service, weekday);

create table public.location_closures (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  location_id uuid not null,
  starts_on date not null,
  ends_on date not null,
  reason text,
  check (ends_on >= starts_on),
  foreign key (location_id, restaurant_id) references public.locations (id, restaurant_id) on delete cascade
);
create index location_closures_location_idx on public.location_closures (location_id, starts_on);

-- Surcharges ponctuelles de créneaux (capacité différente ou créneau bloqué).
-- La charge réelle est calculée depuis les commandes (fonction slot_load).
create table public.time_slots (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  location_id uuid not null,
  starts_at timestamptz not null,
  capacity smallint check (capacity between 0 and 500),
  is_blocked boolean not null default false,
  unique (location_id, starts_at),
  foreign key (location_id, restaurant_id) references public.locations (id, restaurant_id) on delete cascade
);

-- ═══ Catalogue ══════════════════════════════════════════════════════════════

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  menu_id uuid not null,
  name text not null check (char_length(name) between 1 and 60),
  description text,
  emoji text check (char_length(emoji) <= 16),
  tone public.accent_tone not null default 'blue',
  position integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, restaurant_id),
  foreign key (menu_id, restaurant_id) references public.menus (id, restaurant_id) on delete cascade
);
create index categories_menu_idx on public.categories (menu_id, position);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  category_id uuid not null,
  name text not null check (char_length(name) between 1 and 80),
  description text check (char_length(description) <= 600),
  price_cents integer not null check (price_cents >= 0),
  image_urls text[] not null default '{}',
  diet_tags public.diet_tag[] not null default '{}',
  allergens public.allergen[] not null default '{}',
  is_active boolean not null default true,  -- visible sur la boutique
  is_sold_out boolean not null default false, -- rupture de stock (visible mais non commandable)
  is_upsell boolean not null default false, -- proposé avant paiement
  prep_time_minutes smallint check (prep_time_minutes between 0 and 240),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, restaurant_id),
  foreign key (category_id, restaurant_id) references public.categories (id, restaurant_id) on delete cascade
);
create index products_category_idx on public.products (category_id, position);
create index products_restaurant_idx on public.products (restaurant_id);

-- Groupe d'options : obligatoire si min_select >= 1.
create table public.option_groups (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  product_id uuid not null,
  name text not null,
  min_select smallint not null default 0 check (min_select >= 0),
  max_select smallint not null default 1 check (max_select >= 1),
  position integer not null default 0,
  check (max_select >= min_select),
  unique (id, restaurant_id),
  foreign key (product_id, restaurant_id) references public.products (id, restaurant_id) on delete cascade
);
create index option_groups_product_idx on public.option_groups (product_id, position);

create table public.options (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  group_id uuid not null,
  name text not null,
  price_delta_cents integer not null default 0 check (price_delta_cents >= 0),
  is_active boolean not null default true,
  position integer not null default 0,
  foreign key (group_id, restaurant_id) references public.option_groups (id, restaurant_id) on delete cascade
);
create index options_group_idx on public.options (group_id, position);

-- ═══ Clients, fidélité, promos, campagnes ═══════════════════════════════════

-- Fiche client par restaurant (CRM). user_id : compte Supabase éventuel
-- (y compris anonyme pour le checkout invité).
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  first_name text not null,
  email text,
  phone text,
  marketing_opt_in boolean not null default false,
  orders_count integer not null default 0,
  total_spent_cents bigint not null default 0,
  last_order_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (email is not null or phone is not null),
  unique (id, restaurant_id)
);
create unique index customers_email_uniq on public.customers (restaurant_id, lower(email)) where email is not null;
create unique index customers_phone_uniq on public.customers (restaurant_id, phone) where phone is not null;
create index customers_user_idx on public.customers (user_id) where user_id is not null;

create table public.loyalty_accounts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  customer_id uuid not null,
  balance integer not null default 0 check (balance >= 0),
  lifetime integer not null default 0 check (lifetime >= 0),
  updated_at timestamptz not null default now(),
  unique (customer_id),
  foreign key (customer_id, restaurant_id) references public.customers (id, restaurant_id) on delete cascade
);

create table public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  code text not null check (code ~ '^[A-Z0-9_-]{3,24}$'),
  kind public.promo_kind not null,
  value integer not null default 0 check (value >= 0),
  min_order_cents integer not null default 0 check (min_order_cents >= 0),
  max_uses integer check (max_uses > 0),
  uses_count integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind <> 'percent' or value between 1 and 100),
  check (ends_at is null or starts_at is null or ends_at > starts_at),
  unique (restaurant_id, code),
  unique (id, restaurant_id)
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  channel public.campaign_channel not null,
  subject text,
  body text not null default '',
  audience jsonb not null default '{}',
  status public.campaign_status not null default 'draft',
  scheduled_at timestamptz,
  sent_at timestamptz,
  stats jsonb not null default '{}',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index campaigns_restaurant_idx on public.campaigns (restaurant_id, created_at desc);

create table public.favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  restaurant_id uuid not null,
  product_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id),
  foreign key (product_id, restaurant_id) references public.products (id, restaurant_id) on delete cascade
);

-- ═══ Livraison : zones et livreurs ══════════════════════════════════════════

-- Paliers de frais = plusieurs zones concentriques ; la zone de plus petite
-- "position" contenant l'adresse s'applique.
create table public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  location_id uuid not null,
  name text not null,
  kind public.zone_kind not null,
  radius_m integer check (radius_m between 100 and 50000),
  polygon jsonb, -- GeoJSON Polygon, coordonnées [lng, lat]
  fee_cents integer not null default 0 check (fee_cents >= 0),
  min_order_cents integer not null default 0 check (min_order_cents >= 0),
  free_above_cents integer check (free_above_cents > 0),
  eta_minutes smallint not null default 30 check (eta_minutes between 5 and 180),
  tone public.accent_tone not null default 'blue',
  position integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (kind = 'radius' and radius_m is not null)
    or (kind = 'polygon' and polygon is not null and polygon ->> 'type' = 'Polygon')
  ),
  unique (id, restaurant_id),
  foreign key (location_id, restaurant_id) references public.locations (id, restaurant_id) on delete cascade
);
create index delivery_zones_location_idx on public.delivery_zones (location_id, position);

create table public.drivers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  display_name text not null,
  phone text,
  photo_url text,
  vehicle public.vehicle_type not null default 'scooter',
  invite_code text unique default public.random_token(9),
  invite_expires_at timestamptz default now() + interval '7 days',
  is_active boolean not null default true,
  gps_consent_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, user_id),
  unique (id, restaurant_id)
);

-- ═══ Commandes ══════════════════════════════════════════════════════════════

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  location_id uuid not null,
  number integer not null, -- attribué par trigger, unique par restaurant
  public_token text not null unique default public.random_token(24),
  tracking_expires_at timestamptz,
  -- Client (instantané au moment de la commande)
  customer_id uuid,
  customer_user_id uuid references auth.users (id) on delete set null,
  customer_name text not null,
  customer_phone text,
  customer_email text,
  locale text not null default 'fr' check (locale in ('fr', 'en')),
  -- Retrait ou livraison
  fulfillment public.fulfillment_type not null,
  status public.order_status not null default 'pending_payment',
  scheduled_for timestamptz, -- début du créneau choisi (null = dès que possible)
  estimated_ready_at timestamptz,
  extra_minutes smallint not null default 0 check (extra_minutes between 0 and 240),
  delivery_address jsonb, -- { line, postal_code, city, instructions }
  delivery_lat double precision,
  delivery_lng double precision,
  delivery_zone_id uuid,
  -- Montants (centimes)
  subtotal_cents integer not null check (subtotal_cents >= 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  delivery_fee_cents integer not null default 0 check (delivery_fee_cents >= 0),
  tip_cents integer not null default 0 check (tip_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  promo_code_id uuid,
  -- Paiement
  payment_method public.payment_method not null,
  payment_status public.payment_status not null default 'pending',
  stripe_payment_intent_id text unique,
  notes text check (char_length(notes) <= 500),
  -- Horodatages du cycle de vie (posés par trigger)
  placed_at timestamptz,
  accepted_at timestamptz,
  ready_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (total_cents = subtotal_cents - discount_cents + delivery_fee_cents + tip_cents),
  check (customer_phone is not null or customer_email is not null),
  check (
    fulfillment = 'pickup'
    or (delivery_address is not null and delivery_lat is not null and delivery_lng is not null)
  ),
  unique (restaurant_id, number),
  unique (id, restaurant_id),
  foreign key (location_id, restaurant_id) references public.locations (id, restaurant_id) on delete restrict,
  foreign key (customer_id, restaurant_id) references public.customers (id, restaurant_id) on delete set null (customer_id),
  foreign key (delivery_zone_id, restaurant_id) references public.delivery_zones (id, restaurant_id) on delete set null (delivery_zone_id),
  foreign key (promo_code_id, restaurant_id) references public.promo_codes (id, restaurant_id) on delete set null (promo_code_id)
);
create index orders_restaurant_created_idx on public.orders (restaurant_id, created_at desc);
create index orders_location_status_idx on public.orders (location_id, status);
create index orders_location_slot_idx on public.orders (location_id, scheduled_for);
create index orders_customer_user_idx on public.orders (customer_user_id) where customer_user_id is not null;
create index orders_customer_idx on public.orders (customer_id) where customer_id is not null;

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  order_id uuid not null,
  product_id uuid references public.products (id) on delete set null,
  name text not null,
  unit_price_cents integer not null check (unit_price_cents >= 0),
  quantity smallint not null check (quantity between 1 and 99),
  -- Instantané des options : [{ group, name, price_delta_cents }]
  options jsonb not null default '[]',
  notes text check (char_length(notes) <= 200),
  total_cents integer not null check (total_cents >= 0),
  foreign key (order_id, restaurant_id) references public.orders (id, restaurant_id) on delete cascade
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);

-- ═══ Courses ════════════════════════════════════════════════════════════════

create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  order_id uuid not null unique,
  provider public.delivery_provider not null,
  status public.delivery_status not null default 'pending',
  -- Idempotence : jamais deux courses pour une même commande chez un provider
  idempotency_key text not null unique,
  external_id text,
  driver_id uuid,
  courier_name text,
  courier_phone text, -- numéro masqué / proxy uniquement
  courier_photo_url text,
  courier_vehicle text,
  tracking_url text,
  pickup_eta timestamptz,
  dropoff_eta timestamptz,
  fee_cents integer check (fee_cents >= 0),
  handoff_code text,
  proof_photo_url text,
  last_lat double precision,
  last_lng double precision,
  last_heading real,
  last_position_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_id),
  unique (id, restaurant_id),
  foreign key (order_id, restaurant_id) references public.orders (id, restaurant_id) on delete cascade,
  foreign key (driver_id, restaurant_id) references public.drivers (id, restaurant_id) on delete set null (driver_id)
);
create index deliveries_restaurant_status_idx on public.deliveries (restaurant_id, status);
create index deliveries_driver_idx on public.deliveries (driver_id) where driver_id is not null;

create table public.delivery_events (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  delivery_id uuid not null,
  status public.delivery_status not null,
  provider_status text, -- statut brut du provider, avant normalisation
  payload jsonb not null default '{}',
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (delivery_id, restaurant_id) references public.deliveries (id, restaurant_id) on delete cascade
);
create index delivery_events_delivery_idx on public.delivery_events (delivery_id, occurred_at);

-- Positions GPS : purgées sous 24 h (purge_delivery_tracks).
create table public.delivery_tracks (
  id bigint generated always as identity primary key,
  restaurant_id uuid not null,
  delivery_id uuid not null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  heading real,
  speed real,
  accuracy real,
  recorded_at timestamptz not null default now(),
  foreign key (delivery_id, restaurant_id) references public.deliveries (id, restaurant_id) on delete cascade
);
create index delivery_tracks_delivery_idx on public.delivery_tracks (delivery_id, recorded_at desc);
create index delivery_tracks_recorded_idx on public.delivery_tracks (recorded_at);

create table public.delivery_provider_logs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  delivery_id uuid references public.deliveries (id) on delete set null,
  provider public.delivery_provider not null,
  direction public.log_direction not null,
  operation text not null, -- createDelivery, webhook:ORDER_ASSIGNED…
  success boolean not null,
  http_status integer,
  duration_ms integer,
  request jsonb, -- expurgé de tout secret
  response jsonb,
  error text,
  created_at timestamptz not null default now()
);
create index delivery_provider_logs_restaurant_idx on public.delivery_provider_logs (restaurant_id, created_at desc);

-- Clés API des restaurateurs, chiffrées côté serveur (AES-256-GCM, src/lib/crypto.ts).
create table public.provider_credentials (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  provider public.delivery_provider not null check (provider <> 'internal'),
  encrypted_secret text not null check (encrypted_secret like 'v1.%'),
  secret_hint text, -- ex. "sk_…a1b2", affichable
  webhook_token text not null unique default public.random_token(24),
  status public.credential_status not null default 'connected',
  last_tested_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, provider)
);

-- ═══ Jobs ═══════════════════════════════════════════════════════════════════

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  payload jsonb not null default '{}',
  status public.job_status not null default 'pending',
  attempts smallint not null default 0,
  max_attempts smallint not null default 8,
  run_at timestamptz not null default now(),
  dedupe_key text unique,
  last_error text,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index jobs_due_idx on public.jobs (run_at) where status = 'pending';

-- ═══ updated_at ═════════════════════════════════════════════════════════════

do $$
declare
  t text;
begin
  foreach t in array array[
    'restaurants', 'menus', 'locations', 'categories', 'products', 'customers',
    'promo_codes', 'campaigns', 'delivery_zones', 'drivers', 'orders',
    'deliveries', 'provider_credentials', 'jobs'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t
    );
  end loop;
end $$;

-- loyalty_accounts : pas de created_at, updated_at seulement
create trigger set_updated_at before update on public.loyalty_accounts
  for each row execute function public.set_updated_at();
