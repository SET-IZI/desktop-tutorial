-- ─────────────────────────────────────────────────────────────────────────────
-- Miaamm · 004 · Row Level Security
--
-- Principes :
--   - RLS activée sur TOUTES les tables du schéma public ;
--   - le public (anon + clients) lit le catalogue des restaurants publiés ;
--   - l'équipe (owner, manager, kitchen) ne voit que son restaurant ;
--       owner   : tout, dont l'équipe ;
--       manager : catalogue, réglages, clients, promos, campagnes, livraison ;
--       kitchen : lecture du catalogue, commandes et courses, changement de statut ;
--   - un client ne voit que ses commandes (customer_user_id = auth.uid(), y compris
--     session anonyme du checkout invité) ;
--   - les écritures sensibles (création de commande, paiement, courses, logs,
--     secrets, jobs) passent uniquement par le serveur (service_role).
-- (select auth.uid()) est écrit ainsi pour être évalué une fois par requête.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ═══ Restaurants & équipe ═══════════════════════════════════════════════════

create policy "restaurants: lecture publique ou équipe" on public.restaurants
  for select using (is_published or public.is_staff(id));
create policy "restaurants: modification manager" on public.restaurants
  for update using (public.is_manager(id)) with check (public.is_manager(id));
create policy "restaurants: suppression owner" on public.restaurants
  for delete using (public.is_owner(id));
-- Création uniquement via create_restaurant() (qui nomme l'owner).

-- Les colonnes gérées par le serveur ne sont pas modifiables par l'équipe.
revoke update on public.restaurants from anon, authenticated;
grant update (
  name, description, logo_url, cover_url, accent_color, locale, is_published,
  onboarding_step, loyalty_enabled, loyalty_kind, loyalty_goal, loyalty_reward_cents
) on public.restaurants to authenticated;

create policy "users_roles: soi-même ou manager" on public.users_roles
  for select using (user_id = (select auth.uid()) or public.is_manager(restaurant_id));
create policy "users_roles: gestion owner (insert)" on public.users_roles
  for insert with check (public.is_owner(restaurant_id));
create policy "users_roles: gestion owner (update)" on public.users_roles
  for update using (public.is_owner(restaurant_id)) with check (public.is_owner(restaurant_id));
create policy "users_roles: gestion owner (delete)" on public.users_roles
  for delete using (public.is_owner(restaurant_id));

-- ═══ Catalogue & établissements : lecture publique, écriture manager ═══════

do $$
declare
  t text;
begin
  foreach t in array array[
    'menus', 'locations', 'opening_hours', 'location_closures', 'time_slots',
    'categories', 'products', 'option_groups', 'options', 'delivery_zones'
  ] loop
    execute format($f$
      create policy "%1$s: lecture publique ou équipe" on public.%1$I
        for select using (public.is_public_restaurant(restaurant_id) or public.is_staff(restaurant_id));
      create policy "%1$s: écriture manager (insert)" on public.%1$I
        for insert with check (public.is_manager(restaurant_id));
      create policy "%1$s: écriture manager (update)" on public.%1$I
        for update using (public.is_manager(restaurant_id)) with check (public.is_manager(restaurant_id));
      create policy "%1$s: écriture manager (delete)" on public.%1$I
        for delete using (public.is_manager(restaurant_id));
    $f$, t);
  end loop;
end $$;

-- ═══ Clients, fidélité, promos, campagnes ═══════════════════════════════════

create policy "customers: sa fiche ou manager" on public.customers
  for select using (user_id = (select auth.uid()) or public.is_manager(restaurant_id));
create policy "customers: modification manager" on public.customers
  for update using (public.is_manager(restaurant_id)) with check (public.is_manager(restaurant_id));
create policy "customers: suppression manager" on public.customers
  for delete using (public.is_manager(restaurant_id));
-- Création : serveur, au passage de commande. Le lien vers un compte (user_id) aussi.
revoke update on public.customers from anon, authenticated;
grant update (first_name, email, phone, marketing_opt_in) on public.customers to authenticated;

create policy "loyalty: son compte ou manager" on public.loyalty_accounts
  for select using (
    public.is_manager(restaurant_id)
    or exists (
      select 1 from public.customers c
      where c.id = customer_id and c.user_id = (select auth.uid())
    )
  );
-- Écritures : serveur uniquement (crédit à la commande, ajustements via action serveur).

create policy "promo_codes: manager" on public.promo_codes
  for all using (public.is_manager(restaurant_id)) with check (public.is_manager(restaurant_id));
-- Validation d'un code côté client : serveur uniquement (jamais de listing public).
-- uses_count n'est incrémenté que par le serveur.
revoke update on public.promo_codes from anon, authenticated;
grant update (code, kind, value, min_order_cents, max_uses, starts_at, ends_at, is_active)
  on public.promo_codes to authenticated;

create policy "campaigns: manager" on public.campaigns
  for all using (public.is_manager(restaurant_id)) with check (public.is_manager(restaurant_id));

create policy "favorites: les siens" on public.favorites
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ═══ Commandes ══════════════════════════════════════════════════════════════

create policy "orders: les siennes ou équipe" on public.orders
  for select using (customer_user_id = (select auth.uid()) or public.is_staff(restaurant_id));
create policy "orders: statut par l'équipe" on public.orders
  for update using (public.is_staff(restaurant_id)) with check (public.is_staff(restaurant_id));
-- Pas d'insert/delete client : les prix sont recalculés et la commande créée côté serveur.

-- L'équipe ne peut toucher qu'au cycle de vie, jamais aux montants ni au client.
revoke update on public.orders from anon, authenticated;
grant update (status, extra_minutes, estimated_ready_at, cancel_reason) on public.orders to authenticated;

create policy "order_items: ceux de ses commandes ou équipe" on public.order_items
  for select using (public.is_staff(restaurant_id) or public.owns_order(order_id));

-- ═══ Livraison ══════════════════════════════════════════════════════════════

create policy "drivers: soi-même ou équipe" on public.drivers
  for select using (user_id = (select auth.uid()) or public.is_staff(restaurant_id));
create policy "drivers: gestion manager (insert)" on public.drivers
  for insert with check (public.is_manager(restaurant_id));
create policy "drivers: gestion manager (update)" on public.drivers
  for update using (public.is_manager(restaurant_id)) with check (public.is_manager(restaurant_id));
create policy "drivers: gestion manager (delete)" on public.drivers
  for delete using (public.is_manager(restaurant_id));
-- Le compte d'un livreur ne se lie que via redeem_driver_invite() : pas de user_id arbitraire.
revoke insert, update on public.drivers from anon, authenticated;
grant insert (restaurant_id, display_name, phone, photo_url, vehicle, invite_expires_at, is_active)
  on public.drivers to authenticated;
grant update (display_name, phone, photo_url, vehicle, invite_code, invite_expires_at, is_active)
  on public.drivers to authenticated;

-- Courses : écritures serveur uniquement (cohérence avec les providers).
create policy "deliveries: équipe, client ou livreur affecté" on public.deliveries
  for select using (
    public.is_staff(restaurant_id)
    or public.owns_order(order_id)
    or public.is_assigned_driver(id)
  );

create policy "delivery_events: équipe, client ou livreur" on public.delivery_events
  for select using (
    public.is_staff(restaurant_id)
    or public.is_assigned_driver(delivery_id)
    or exists (
      select 1 from public.deliveries d
      where d.id = delivery_id and public.owns_order(d.order_id)
    )
  );

create policy "delivery_tracks: équipe, client ou livreur" on public.delivery_tracks
  for select using (
    public.is_staff(restaurant_id)
    or public.is_assigned_driver(delivery_id)
    or exists (
      select 1 from public.deliveries d
      where d.id = delivery_id and public.owns_order(d.order_id)
    )
  );
-- Le livreur affecté enregistre ses positions tant que la course est en cours.
create policy "delivery_tracks: insertion par le livreur affecté" on public.delivery_tracks
  for insert with check (
    public.is_assigned_driver(delivery_id)
    and exists (
      select 1 from public.deliveries d
      where d.id = delivery_id
        and d.restaurant_id = delivery_tracks.restaurant_id
        and d.status in ('assigned', 'en_route_to_pickup', 'at_pickup', 'picked_up', 'en_route_to_dropoff', 'arrived')
    )
  );

create policy "delivery_provider_logs: manager" on public.delivery_provider_logs
  for select using (public.is_manager(restaurant_id));

-- Secrets : l'équipe voit l'état de la connexion, jamais la clé chiffrée.
create policy "provider_credentials: manager (état seulement)" on public.provider_credentials
  for select using (public.is_manager(restaurant_id));
revoke all on public.provider_credentials from anon, authenticated;
grant select (
  id, restaurant_id, provider, secret_hint, webhook_token, status,
  last_tested_at, last_error, created_at, updated_at
) on public.provider_credentials to authenticated;

-- jobs : aucune policy, service_role uniquement.
revoke all on public.jobs from anon, authenticated;

-- ═══ Fonctions : droits d'exécution ═════════════════════════════════════════

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.has_role(uuid, public.member_role[]),
  public.is_staff(uuid),
  public.is_manager(uuid),
  public.is_owner(uuid),
  public.is_public_restaurant(uuid),
  public.owns_order(uuid),
  public.is_assigned_driver(uuid),
  public.slot_load(uuid, timestamptz, timestamptz),
  public.order_transition_allowed(public.order_status, public.order_status)
to anon, authenticated;
grant execute on function
  public.create_restaurant(text, text, jsonb),
  public.redeem_driver_invite(text),
  public.random_token(int) -- valeur par défaut de drivers.invite_code
to authenticated;
-- Triggers et purge_delivery_tracks : service_role uniquement.
grant execute on all functions in schema public to service_role;

-- ═══ Realtime ═══════════════════════════════════════════════════════════════
-- Les changements respectent la RLS (Postgres Changes). Les positions GPS
-- passent par des canaux Broadcast privés (phase 7), pas par la réplication.

alter publication supabase_realtime add table public.orders, public.deliveries, public.delivery_events;
