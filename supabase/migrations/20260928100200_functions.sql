-- ─────────────────────────────────────────────────────────────────────────────
-- Miaamm · 003 · Fonctions métier et triggers
-- Toute fonction SECURITY DEFINER fixe search_path = '' et qualifie ses objets.
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══ Autorisations (utilisées par la RLS) ═══════════════════════════════════

-- SECURITY DEFINER : lit users_roles sans repasser par sa propre RLS (évite la récursion).
create or replace function public.has_role(
  p_restaurant_id uuid,
  p_roles public.member_role[] default '{owner,manager,kitchen}'
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.users_roles ur
    where ur.user_id = auth.uid()
      and ur.restaurant_id = p_restaurant_id
      and ur.role = any (p_roles)
  );
$$;

create or replace function public.is_staff(p_restaurant_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select public.has_role(p_restaurant_id, '{owner,manager,kitchen}'); $$;

create or replace function public.is_manager(p_restaurant_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select public.has_role(p_restaurant_id, '{owner,manager}'); $$;

create or replace function public.is_owner(p_restaurant_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select public.has_role(p_restaurant_id, '{owner}'); $$;

-- Boutique visible du public ?
create or replace function public.is_public_restaurant(p_restaurant_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce((select r.is_published from public.restaurants r where r.id = p_restaurant_id), false); $$;

-- La commande appartient-elle au client connecté (compte ou session anonyme) ?
create or replace function public.owns_order(p_order_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.orders o
    where o.id = p_order_id and o.customer_user_id = auth.uid()
  );
$$;

-- Le livreur connecté est-il affecté à cette course ?
create or replace function public.is_assigned_driver(p_delivery_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.deliveries d
    join public.drivers dr on dr.id = d.driver_id
    where d.id = p_delivery_id and dr.user_id = auth.uid() and dr.is_active
  );
$$;

-- ═══ Commandes : numérotation et cycle de vie ═══════════════════════════════

create or replace function public.assign_order_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.restaurants
     set order_seq = order_seq + 1
   where id = new.restaurant_id
  returning order_seq into new.number;
  return new;
end;
$$;

create trigger assign_order_number
  before insert on public.orders
  for each row execute function public.assign_order_number();

-- Transitions autorisées. Toute autre transition est refusée, quel que soit l'appelant.
create or replace function public.order_transition_allowed(
  p_from public.order_status,
  p_to public.order_status
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_from = p_to or (p_from, p_to) in (
    ('pending_payment', 'new'), ('pending_payment', 'cancelled'),
    ('new', 'accepted'), ('new', 'rejected'), ('new', 'cancelled'),
    ('accepted', 'preparing'), ('accepted', 'ready'), ('accepted', 'cancelled'),
    ('preparing', 'ready'), ('preparing', 'cancelled'),
    ('ready', 'in_delivery'), ('ready', 'completed'), ('ready', 'cancelled'),
    ('in_delivery', 'completed'), ('in_delivery', 'cancelled')
  )::boolean;
$$;

create or replace function public.orders_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'new' then
      new.placed_at := coalesce(new.placed_at, now());
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    if not public.order_transition_allowed(old.status, new.status) then
      raise exception 'Transition de commande interdite : % → %', old.status, new.status
        using errcode = 'check_violation';
    end if;
    -- Seul le serveur (webhook de paiement) sort une commande de pending_payment.
    if old.status = 'pending_payment' and current_user in ('anon', 'authenticated') then
      raise exception 'Paiement non confirmé' using errcode = 'insufficient_privilege';
    end if;

    case new.status
      when 'new' then new.placed_at := coalesce(new.placed_at, now());
      when 'accepted' then new.accepted_at := coalesce(new.accepted_at, now());
      when 'ready' then new.ready_at := coalesce(new.ready_at, now());
      when 'completed' then
        new.completed_at := coalesce(new.completed_at, now());
        -- Le lien de suivi public expire à la livraison / au retrait.
        new.tracking_expires_at := now();
      when 'cancelled', 'rejected' then
        new.cancelled_at := coalesce(new.cancelled_at, now());
        new.tracking_expires_at := now();
      else null;
    end case;
  end if;
  return new;
end;
$$;

create trigger orders_lifecycle
  before insert or update on public.orders
  for each row execute function public.orders_lifecycle();

-- ═══ Créneaux : charge réelle de la cuisine ═════════════════════════════════

-- Nombre de commandes actives par créneau, sans exposer les commandes elles-mêmes.
-- Les paniers en attente de paiement réservent leur créneau 15 minutes.
create or replace function public.slot_load(
  p_location_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (slot_start timestamptz, orders_count integer)
language sql
stable
security definer
set search_path = ''
as $$
  select o.scheduled_for, count(*)::integer
  from public.orders o
  where o.location_id = p_location_id
    and o.scheduled_for >= p_from
    and o.scheduled_for < p_to
    and (
      o.status in ('new', 'accepted', 'preparing', 'ready', 'in_delivery')
      or (o.status = 'pending_payment' and o.created_at > now() - interval '15 minutes')
    )
  group by o.scheduled_for;
$$;

-- ═══ Onboarding ═════════════════════════════════════════════════════════════

-- Crée un restaurant, son menu et son premier établissement, et nomme
-- l'appelant propriétaire. Refusé aux sessions anonymes.
create or replace function public.create_restaurant(
  p_name text,
  p_slug text,
  p_location jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_restaurant uuid;
  v_menu uuid;
begin
  if v_user is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Connexion requise' using errcode = 'insufficient_privilege';
  end if;

  insert into public.restaurants (name, slug) values (p_name, p_slug) returning id into v_restaurant;
  insert into public.users_roles (user_id, restaurant_id, role) values (v_user, v_restaurant, 'owner');
  insert into public.menus (restaurant_id) values (v_restaurant) returning id into v_menu;
  insert into public.locations (restaurant_id, menu_id, name, address_line, postal_code, city, lat, lng, phone)
  values (
    v_restaurant, v_menu,
    coalesce(p_location ->> 'name', p_name),
    p_location ->> 'address_line',
    p_location ->> 'postal_code',
    p_location ->> 'city',
    (p_location ->> 'lat')::double precision,
    (p_location ->> 'lng')::double precision,
    p_location ->> 'phone'
  );
  return v_restaurant;
end;
$$;

-- Un restaurant doit toujours garder au moins un propriétaire.
create or replace function public.keep_one_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner')
     and exists (select 1 from public.restaurants r where r.id = old.restaurant_id)
     and not exists (
       select 1 from public.users_roles ur
       where ur.restaurant_id = old.restaurant_id and ur.role = 'owner' and ur.id <> old.id
     ) then
    raise exception 'Le restaurant doit garder au moins un propriétaire' using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger keep_one_owner
  before update or delete on public.users_roles
  for each row execute function public.keep_one_owner();

-- ═══ Livreurs ═══════════════════════════════════════════════════════════════

-- Rattache le compte connecté à la fiche livreur correspondant au code.
create or replace function public.redeem_driver_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_driver uuid;
begin
  if auth.uid() is null then
    raise exception 'Connexion requise' using errcode = 'insufficient_privilege';
  end if;

  update public.drivers
     set user_id = auth.uid(), invite_code = null, invite_expires_at = null
   where invite_code = p_code
     and user_id is null
     and is_active
     and (invite_expires_at is null or invite_expires_at > now())
  returning id into v_driver;

  if v_driver is null then
    raise exception 'Code d''invitation invalide ou expiré' using errcode = 'no_data_found';
  end if;
  return v_driver;
end;
$$;

-- ═══ RGPD : purge des positions GPS ═════════════════════════════════════════

-- Appelée par un cron (Vercel Cron ou pg_cron). Renvoie le nombre de points supprimés.
create or replace function public.purge_delivery_tracks(p_older_than interval default interval '24 hours')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from public.delivery_tracks where recorded_at < now() - p_older_than;
  get diagnostics v_count = row_count;

  update public.deliveries
     set last_lat = null, last_lng = null, last_heading = null
   where last_position_at < now() - p_older_than
     and last_lat is not null;

  return v_count;
end;
$$;
