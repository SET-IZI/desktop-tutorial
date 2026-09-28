-- ─────────────────────────────────────────────────────────────────────────────
-- Miaamm · Seed de démo : « Chez Mimi », bistrot à Paris 11e
-- Retrait + livraison (livreurs du restaurant), paiement sur place activé.
--
-- Comptes (mot de passe commun : miaamm-demo) :
--   mimi@miaamm.test     propriétaire
--   cuisine@miaamm.test  cuisine
--   karim@miaamm.test    livreur
--   lea@miaamm.test      cliente
--
-- Identifiants fixes et lisibles pour les tests : préfixe = type d'objet.
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══ Comptes Supabase Auth ══════════════════════════════════════════════════

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token,
  email_change_token_new, email_change, created_at, updated_at
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('miaamm-demo', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', jsonb_build_object('first_name', u.first_name),
  '', '', '', '', now(), now()
from (values
  ('00000000-0000-4000-8000-000000000001'::uuid, 'mimi@miaamm.test', 'Mimi'),
  ('00000000-0000-4000-8000-000000000002'::uuid, 'cuisine@miaamm.test', 'Hugo'),
  ('00000000-0000-4000-8000-000000000003'::uuid, 'karim@miaamm.test', 'Karim'),
  ('00000000-0000-4000-8000-000000000004'::uuid, 'lea@miaamm.test', 'Léa')
) as u (id, email, first_name);

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select u.id::text, u.id, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), 'email', now(), now(), now()
from auth.users u
where u.email like '%@miaamm.test';

-- ═══ Restaurant, équipe, établissement ══════════════════════════════════════

insert into public.restaurants (
  id, slug, name, description, accent_color, is_published, onboarding_step,
  loyalty_enabled, loyalty_kind, loyalty_goal, loyalty_reward_cents
) values (
  '11111111-1111-4111-8111-111111111111', 'chez-mimi', 'Chez Mimi',
  'Bistrot de quartier, cuisine maison et produits de saison.',
  '#FF9F0A', true, 5, true, 'stamps', 10, 800
);

insert into public.users_roles (user_id, restaurant_id, role) values
  ('00000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'owner'),
  ('00000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'kitchen');

insert into public.menus (id, restaurant_id, name) values
  ('22222222-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Carte');

insert into public.locations (
  id, restaurant_id, menu_id, name, address_line, postal_code, city, lat, lng, phone,
  pickup_enabled, delivery_enabled, on_site_payment_enabled,
  prep_time_minutes, slot_interval_minutes, slot_capacity, delivery_provider, delivery_assignment
) values (
  'd0000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
  '22222222-0000-4000-8000-000000000001', 'Chez Mimi Oberkampf',
  '12 rue Oberkampf', '75011', 'Paris', 48.8645, 2.3713, '+33100000000',
  true, true, true, 15, 15, 6, 'internal', 'manual'
);

-- Ouvert du mardi (2) au dimanche (7), fermé le lundi.
insert into public.opening_hours (restaurant_id, location_id, service, weekday, opens_at, closes_at)
select '11111111-1111-4111-8111-111111111111', 'd0000000-0000-4000-8000-000000000001', s.service, d.weekday, s.opens, s.closes
from generate_series(2, 7) as d (weekday)
cross join (values
  ('pickup'::public.fulfillment_type, '11:30'::time, '14:30'::time),
  ('pickup', '18:30', '22:30'),
  ('delivery', '12:00', '14:00'),
  ('delivery', '19:00', '22:00')
) as s (service, opens, closes);

insert into public.location_closures (restaurant_id, location_id, starts_on, ends_on, reason) values
  ('11111111-1111-4111-8111-111111111111', 'd0000000-0000-4000-8000-000000000001', '2026-12-24', '2026-12-26', 'Fêtes de fin d''année');

-- ═══ Carte ══════════════════════════════════════════════════════════════════

insert into public.categories (id, restaurant_id, menu_id, name, emoji, tone, position) values
  ('a0000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '22222222-0000-4000-8000-000000000001', 'Entrées', '🥗', 'green', 0),
  ('a0000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', '22222222-0000-4000-8000-000000000001', 'Burgers', '🍔', 'orange', 1),
  ('a0000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', '22222222-0000-4000-8000-000000000001', 'Plats', '🍲', 'violet', 2),
  ('a0000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', '22222222-0000-4000-8000-000000000001', 'Desserts', '🍰', 'pink', 3),
  ('a0000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', '22222222-0000-4000-8000-000000000001', 'Boissons', '🥤', 'blue', 4);

insert into public.products (
  id, restaurant_id, category_id, name, description, price_cents, diet_tags, allergens,
  is_sold_out, is_upsell, position
) values
  -- Entrées
  ('b0000000-0000-4000-8000-000000000101', '11111111-1111-4111-8111-111111111111', 'a0000000-0000-4000-8000-000000000001',
   'Velouté de potimarron', 'Crème fraîche, graines torréfiées.', 750, '{vegetarian,gluten_free}', '{milk,celery}', false, false, 0),
  ('b0000000-0000-4000-8000-000000000102', '11111111-1111-4111-8111-111111111111', 'a0000000-0000-4000-8000-000000000001',
   'Burrata crémeuse', 'Tomates anciennes, basilic, huile d''olive.', 1100, '{vegetarian,gluten_free}', '{milk}', false, false, 1),
  ('b0000000-0000-4000-8000-000000000103', '11111111-1111-4111-8111-111111111111', 'a0000000-0000-4000-8000-000000000001',
   'Nems croustillants', 'Quatre pièces, sauce nuoc-mâm.', 800, '{}', '{gluten,soy,eggs,fish}', false, false, 2),
  -- Burgers
  ('b0000000-0000-4000-8000-000000000201', '11111111-1111-4111-8111-111111111111', 'a0000000-0000-4000-8000-000000000002',
   'Le Classique', 'Bœuf français, cheddar affiné, oignons confits, sauce maison.', 1350, '{}', '{gluten,milk,eggs,mustard,sesame}', false, false, 0),
  ('b0000000-0000-4000-8000-000000000202', '11111111-1111-4111-8111-111111111111', 'a0000000-0000-4000-8000-000000000002',
   'Le Végé', 'Galette de pois chiches, avocat, pickles.', 1300, '{vegetarian}', '{gluten,milk,sesame}', false, false, 1),
  ('b0000000-0000-4000-8000-000000000203', '11111111-1111-4111-8111-111111111111', 'a0000000-0000-4000-8000-000000000002',
   'Le Piquant', 'Bœuf, jalapeños, pepper jack, sauce chipotle.', 1450, '{spicy,new}', '{gluten,milk,eggs,sesame}', false, false, 2),
  -- Plats
  ('b0000000-0000-4000-8000-000000000301', '11111111-1111-4111-8111-111111111111', 'a0000000-0000-4000-8000-000000000003',
   'Risotto aux cèpes', 'Parmesan 24 mois, huile de truffe.', 1650, '{vegetarian,gluten_free}', '{milk,celery,sulphites}', false, false, 0),
  ('b0000000-0000-4000-8000-000000000302', '11111111-1111-4111-8111-111111111111', 'a0000000-0000-4000-8000-000000000003',
   'Poulet rôti, jus corsé', 'Poulet fermier, purée maison.', 1700, '{gluten_free}', '{milk,celery}', false, false, 1),
  ('b0000000-0000-4000-8000-000000000303', '11111111-1111-4111-8111-111111111111', 'a0000000-0000-4000-8000-000000000003',
   'Curry de légumes', 'Lait de coco, riz basmati.', 1400, '{vegan,gluten_free,spicy}', '{}', false, false, 2),
  -- Desserts
  ('b0000000-0000-4000-8000-000000000401', '11111111-1111-4111-8111-111111111111', 'a0000000-0000-4000-8000-000000000004',
   'Tiramisu maison', 'Mascarpone, café serré.', 650, '{vegetarian}', '{gluten,eggs,milk}', false, true, 0),
  ('b0000000-0000-4000-8000-000000000402', '11111111-1111-4111-8111-111111111111', 'a0000000-0000-4000-8000-000000000004',
   'Cookie géant', 'Chocolat noir et noisettes.', 350, '{vegetarian}', '{gluten,eggs,milk,nuts}', true, true, 1),
  ('b0000000-0000-4000-8000-000000000403', '11111111-1111-4111-8111-111111111111', 'a0000000-0000-4000-8000-000000000004',
   'Salade de fruits frais', 'Fruits de saison, menthe.', 500, '{vegan,gluten_free}', '{}', false, false, 2),
  -- Boissons
  ('b0000000-0000-4000-8000-000000000501', '11111111-1111-4111-8111-111111111111', 'a0000000-0000-4000-8000-000000000005',
   'Limonade maison', 'Citron pressé, sucre de canne.', 400, '{vegan,gluten_free}', '{}', false, true, 0),
  ('b0000000-0000-4000-8000-000000000502', '11111111-1111-4111-8111-111111111111', 'a0000000-0000-4000-8000-000000000005',
   'Thé glacé pêche', 'Infusé à froid.', 400, '{vegan,gluten_free}', '{}', false, false, 1),
  ('b0000000-0000-4000-8000-000000000503', '11111111-1111-4111-8111-111111111111', 'a0000000-0000-4000-8000-000000000005',
   'Eau pétillante 50 cl', null, 300, '{vegan,gluten_free}', '{}', false, false, 2);

-- Options : cuisson (obligatoire), accompagnement (obligatoire), suppléments (facultatifs, 3 max)
insert into public.option_groups (id, restaurant_id, product_id, name, min_select, max_select, position)
select g.id, '11111111-1111-4111-8111-111111111111', g.product_id, g.name, g.min_select, g.max_select, g.position
from (values
  ('c0000000-0000-4000-8000-000000000201'::uuid, 'b0000000-0000-4000-8000-000000000201'::uuid, 'Cuisson', 1, 1, 0),
  ('c0000000-0000-4000-8000-000000000202'::uuid, 'b0000000-0000-4000-8000-000000000201'::uuid, 'Accompagnement', 1, 1, 1),
  ('c0000000-0000-4000-8000-000000000203'::uuid, 'b0000000-0000-4000-8000-000000000201'::uuid, 'Suppléments', 0, 3, 2),
  ('c0000000-0000-4000-8000-000000000204'::uuid, 'b0000000-0000-4000-8000-000000000202'::uuid, 'Accompagnement', 1, 1, 0),
  ('c0000000-0000-4000-8000-000000000205'::uuid, 'b0000000-0000-4000-8000-000000000203'::uuid, 'Cuisson', 1, 1, 0),
  ('c0000000-0000-4000-8000-000000000206'::uuid, 'b0000000-0000-4000-8000-000000000203'::uuid, 'Accompagnement', 1, 1, 1),
  ('c0000000-0000-4000-8000-000000000501'::uuid, 'b0000000-0000-4000-8000-000000000501'::uuid, 'Taille', 1, 1, 0)
) as g (id, product_id, name, min_select, max_select, position);

insert into public.options (restaurant_id, group_id, name, price_delta_cents, position)
select '11111111-1111-4111-8111-111111111111', o.group_id, o.name, o.price, o.position
from (values
  ('c0000000-0000-4000-8000-000000000201'::uuid, 'Saignant', 0, 0),
  ('c0000000-0000-4000-8000-000000000201'::uuid, 'À point', 0, 1),
  ('c0000000-0000-4000-8000-000000000201'::uuid, 'Bien cuit', 0, 2),
  ('c0000000-0000-4000-8000-000000000202'::uuid, 'Frites maison', 0, 0),
  ('c0000000-0000-4000-8000-000000000202'::uuid, 'Salade verte', 0, 1),
  ('c0000000-0000-4000-8000-000000000202'::uuid, 'Frites de patate douce', 100, 2),
  ('c0000000-0000-4000-8000-000000000203'::uuid, 'Cheddar', 150, 0),
  ('c0000000-0000-4000-8000-000000000203'::uuid, 'Bacon', 200, 1),
  ('c0000000-0000-4000-8000-000000000203'::uuid, 'Œuf au plat', 100, 2),
  ('c0000000-0000-4000-8000-000000000204'::uuid, 'Frites maison', 0, 0),
  ('c0000000-0000-4000-8000-000000000204'::uuid, 'Salade verte', 0, 1),
  ('c0000000-0000-4000-8000-000000000205'::uuid, 'Saignant', 0, 0),
  ('c0000000-0000-4000-8000-000000000205'::uuid, 'À point', 0, 1),
  ('c0000000-0000-4000-8000-000000000206'::uuid, 'Frites maison', 0, 0),
  ('c0000000-0000-4000-8000-000000000206'::uuid, 'Frites de patate douce', 100, 1),
  ('c0000000-0000-4000-8000-000000000501'::uuid, '33 cl', 0, 0),
  ('c0000000-0000-4000-8000-000000000501'::uuid, '50 cl', 100, 1)
) as o (group_id, name, price, position);

-- ═══ Livraison ══════════════════════════════════════════════════════════════

insert into public.delivery_zones (
  id, restaurant_id, location_id, name, kind, radius_m, polygon,
  fee_cents, min_order_cents, free_above_cents, eta_minutes, tone, position
) values
  ('e0000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'd0000000-0000-4000-8000-000000000001',
   'Quartier', 'radius', 1500, null, 250, 1500, null, 25, 'green', 0),
  ('e0000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'd0000000-0000-4000-8000-000000000001',
   'Paris Est', 'radius', 3500, null, 450, 2000, 5000, 35, 'orange', 1),
  ('e0000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'd0000000-0000-4000-8000-000000000001',
   'Montreuil', 'polygon', null,
   '{"type":"Polygon","coordinates":[[[2.4180,48.8520],[2.4620,48.8520],[2.4620,48.8720],[2.4180,48.8720],[2.4180,48.8520]]]}',
   600, 2500, null, 45, 'violet', 2);

insert into public.drivers (id, restaurant_id, user_id, display_name, phone, vehicle, invite_code, invite_expires_at, gps_consent_at) values
  ('80000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   '00000000-0000-4000-8000-000000000003', 'Karim', '+33600000003', 'scooter', null, null, now());
-- Invitation en attente (code utilisable dans l'app livreur de démo)
insert into public.drivers (id, restaurant_id, display_name, vehicle, invite_code) values
  ('80000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Nadia', 'ebike', 'DEMO-NADIA');

-- ═══ Clients, fidélité, promo ═══════════════════════════════════════════════

insert into public.customers (id, restaurant_id, user_id, first_name, email, phone, marketing_opt_in, orders_count, total_spent_cents, last_order_at) values
  ('70000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   '00000000-0000-4000-8000-000000000004', 'Léa', 'lea@miaamm.test', '+33600000004', true, 3, 6150, now() - interval '1 day');

insert into public.loyalty_accounts (restaurant_id, customer_id, balance, lifetime) values
  ('11111111-1111-4111-8111-111111111111', '70000000-0000-4000-8000-000000000001', 3, 3);

insert into public.promo_codes (restaurant_id, code, kind, value, min_order_cents) values
  ('11111111-1111-4111-8111-111111111111', 'BIENVENUE', 'percent', 10, 1500),
  ('11111111-1111-4111-8111-111111111111', 'LIVRAISONOFFERTE', 'free_delivery', 0, 2500);

-- ═══ Commandes d'exemple ════════════════════════════════════════════════════

-- 1. Retrait terminé hier (Léa)
insert into public.orders (
  id, restaurant_id, location_id, customer_id, customer_user_id, customer_name, customer_phone, customer_email,
  fulfillment, status, scheduled_for, subtotal_cents, total_cents, payment_method, payment_status,
  placed_at, accepted_at, ready_at, completed_at, tracking_expires_at, created_at
) values (
  'f0000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'd0000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000004', 'Léa', '+33600000004', 'lea@miaamm.test',
  'pickup', 'completed', date_trunc('hour', now()) - interval '1 day', 2000, 2000, 'on_site', 'paid',
  now() - interval '1 day 30 minutes', now() - interval '1 day 28 minutes', now() - interval '1 day 10 minutes',
  now() - interval '1 day', now() - interval '1 day', now() - interval '1 day 30 minutes'
);
insert into public.order_items (restaurant_id, order_id, product_id, name, unit_price_cents, quantity, options, total_cents) values
  ('11111111-1111-4111-8111-111111111111', 'f0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000201',
   'Le Classique', 1350, 1, '[{"group":"Cuisson","name":"À point","price_delta_cents":0},{"group":"Accompagnement","name":"Frites maison","price_delta_cents":0}]', 1350),
  ('11111111-1111-4111-8111-111111111111', 'f0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000401',
   'Tiramisu maison', 650, 1, '[]', 650);

-- 2. Retrait à accepter (invitée, paiement sur place)
insert into public.orders (
  id, restaurant_id, location_id, customer_name, customer_phone,
  fulfillment, status, scheduled_for, subtotal_cents, total_cents, payment_method, payment_status, notes
) values (
  'f0000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'd0000000-0000-4000-8000-000000000001',
  'Sam', '+33600000010', 'pickup', 'new', date_trunc('hour', now()) + interval '1 hour',
  2100, 2100, 'on_site', 'unpaid', 'Sans oignons, merci !'
);
insert into public.order_items (restaurant_id, order_id, product_id, name, unit_price_cents, quantity, options, total_cents) values
  ('11111111-1111-4111-8111-111111111111', 'f0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000202',
   'Le Végé', 1300, 1, '[{"group":"Accompagnement","name":"Salade verte","price_delta_cents":0}]', 1300),
  ('11111111-1111-4111-8111-111111111111', 'f0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000501',
   'Limonade maison', 500, 1, '[{"group":"Taille","name":"50 cl","price_delta_cents":100}]', 500),
  ('11111111-1111-4111-8111-111111111111', 'f0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000503',
   'Eau pétillante 50 cl', 300, 1, '[]', 300);

-- 3. Livraison en cours (Léa), course interne avec Karim
insert into public.orders (
  id, restaurant_id, location_id, customer_id, customer_user_id, customer_name, customer_phone, customer_email,
  fulfillment, status, delivery_address, delivery_lat, delivery_lng, delivery_zone_id,
  subtotal_cents, delivery_fee_cents, tip_cents, total_cents, payment_method, payment_status,
  placed_at, accepted_at, ready_at, estimated_ready_at
) values (
  'f0000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'd0000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000004', 'Léa', '+33600000004', 'lea@miaamm.test',
  'delivery', 'in_delivery',
  '{"line":"40 boulevard Voltaire","postal_code":"75011","city":"Paris","instructions":"Code 4B21, 3e étage"}',
  48.8631, 2.3703, 'e0000000-0000-4000-8000-000000000001',
  3050, 250, 200, 3500, 'on_site', 'unpaid',
  now() - interval '25 minutes', now() - interval '24 minutes', now() - interval '6 minutes', now() - interval '6 minutes'
);
insert into public.order_items (restaurant_id, order_id, product_id, name, unit_price_cents, quantity, options, total_cents) values
  ('11111111-1111-4111-8111-111111111111', 'f0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000301',
   'Risotto aux cèpes', 1650, 1, '[]', 1650),
  ('11111111-1111-4111-8111-111111111111', 'f0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000303',
   'Curry de légumes', 1400, 1, '[]', 1400);

insert into public.deliveries (
  id, restaurant_id, order_id, provider, status, idempotency_key, driver_id,
  courier_name, courier_vehicle, dropoff_eta, handoff_code,
  last_lat, last_lng, last_heading, last_position_at, picked_up_at
) values (
  '90000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'f0000000-0000-4000-8000-000000000003',
  'internal', 'en_route_to_dropoff', 'internal:f0000000-0000-4000-8000-000000000003',
  '80000000-0000-4000-8000-000000000001', 'Karim', 'scooter', now() + interval '4 minutes', '4821',
  48.8639, 2.3709, 200, now(), now() - interval '5 minutes'
);

insert into public.delivery_events (restaurant_id, delivery_id, status, occurred_at) values
  ('11111111-1111-4111-8111-111111111111', '90000000-0000-4000-8000-000000000001', 'assigned', now() - interval '10 minutes'),
  ('11111111-1111-4111-8111-111111111111', '90000000-0000-4000-8000-000000000001', 'picked_up', now() - interval '5 minutes'),
  ('11111111-1111-4111-8111-111111111111', '90000000-0000-4000-8000-000000000001', 'en_route_to_dropoff', now() - interval '5 minutes');

insert into public.delivery_tracks (restaurant_id, delivery_id, lat, lng, heading, recorded_at)
select '11111111-1111-4111-8111-111111111111', '90000000-0000-4000-8000-000000000001',
       48.8645 - i * 0.00012, 2.3713 - i * 0.00008, 200, now() - (5 - i) * interval '1 minute'
from generate_series(0, 5) as i;
