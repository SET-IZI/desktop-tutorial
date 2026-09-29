-- ─────────────────────────────────────────────────────────────────────────────
-- Miaamm · 006 · Checkout
--   - place_order() : création atomique d'une commande (verrou sur l'établissement
--     pour ne jamais dépasser la capacité d'un créneau), fiche client, lignes ;
--   - mark_order_paid() : confirmation idempotente d'un paiement Stripe ;
--   - stripe_events : déduplication des webhooks ;
--   - statistiques client tenues à jour par trigger.
-- Les prix sont calculés côté serveur (TypeScript) avant l'appel : la base
-- revérifie la cohérence des montants (contrainte sur orders) et la capacité.
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══ Déduplication des webhooks Stripe ══════════════════════════════════════

create table public.stripe_events (
  id text primary key, -- evt_…
  type text not null,
  account text, -- compte connecté émetteur
  received_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;
-- Aucune policy : service_role uniquement.
revoke all on public.stripe_events from anon, authenticated;

-- ═══ Création de commande ═══════════════════════════════════════════════════

-- Paramètre p (jsonb) :
--   restaurant_id, location_id, fulfillment, scheduled_for, status ('pending_payment'|'new'),
--   payment_method, payment_status, customer_name, customer_phone?, customer_email?,
--   customer_user_id?, notes?, locale, subtotal_cents, discount_cents, delivery_fee_cents,
--   tip_cents, total_cents, marketing_opt_in?,
--   items: [{ product_id, name, unit_price_cents, quantity, options, notes, total_cents }]
create or replace function public.place_order(p jsonb)
returns table (order_id uuid, order_number integer, order_token text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_location public.locations%rowtype;
  v_slot timestamptz := (p ->> 'scheduled_for')::timestamptz;
  v_capacity integer;
  v_blocked boolean;
  v_count integer;
  v_customer uuid;
  v_order public.orders%rowtype;
  v_email text := nullif(lower(trim(p ->> 'customer_email')), '');
  v_phone text := nullif(trim(p ->> 'customer_phone'), '');
  v_item jsonb;
begin
  -- Verrou : deux commandes simultanées sur le même établissement sont sérialisées,
  -- le comptage de capacité ci-dessous est donc fiable.
  select * into v_location
    from public.locations l
   where l.id = (p ->> 'location_id')::uuid
     and l.restaurant_id = (p ->> 'restaurant_id')::uuid
     and l.is_active
   for update;
  if not found then
    raise exception 'location_not_found' using errcode = 'P0002';
  end if;

  if v_slot is null then
    raise exception 'slot_required' using errcode = 'P0001';
  end if;

  select ts.capacity, ts.is_blocked into v_capacity, v_blocked
    from public.time_slots ts
   where ts.location_id = v_location.id and ts.starts_at = v_slot;
  if coalesce(v_blocked, false) then
    raise exception 'slot_unavailable' using errcode = 'P0001';
  end if;

  select count(*) into v_count
    from public.orders o
   where o.location_id = v_location.id
     and o.scheduled_for = v_slot
     and (
       o.status in ('new', 'accepted', 'preparing', 'ready', 'in_delivery')
       or (o.status = 'pending_payment' and o.created_at > now() - interval '15 minutes')
     );
  if v_count >= coalesce(v_capacity, v_location.slot_capacity) then
    raise exception 'slot_full' using errcode = 'P0001';
  end if;

  -- Fiche client du restaurant (retrouvée par email ou téléphone).
  select c.id into v_customer
    from public.customers c
   where c.restaurant_id = v_location.restaurant_id
     and ((v_email is not null and lower(c.email) = v_email) or (v_phone is not null and c.phone = v_phone))
   order by c.created_at
   limit 1;

  if v_customer is null then
    insert into public.customers (restaurant_id, user_id, first_name, email, phone, marketing_opt_in)
    values (
      v_location.restaurant_id,
      (p ->> 'customer_user_id')::uuid,
      p ->> 'customer_name',
      v_email,
      v_phone,
      coalesce((p ->> 'marketing_opt_in')::boolean, false)
    )
    returning id into v_customer;
  else
    update public.customers c
       set first_name = p ->> 'customer_name',
           email = coalesce(c.email, v_email),
           phone = coalesce(c.phone, v_phone),
           user_id = coalesce(c.user_id, (p ->> 'customer_user_id')::uuid)
     where c.id = v_customer;
  end if;

  insert into public.orders (
    restaurant_id, location_id, customer_id, customer_user_id, customer_name, customer_phone,
    customer_email, locale, fulfillment, status, scheduled_for, estimated_ready_at,
    subtotal_cents, discount_cents, delivery_fee_cents, tip_cents, total_cents,
    payment_method, payment_status, notes
  ) values (
    v_location.restaurant_id,
    v_location.id,
    v_customer,
    (p ->> 'customer_user_id')::uuid,
    p ->> 'customer_name',
    v_phone,
    v_email,
    coalesce(p ->> 'locale', 'fr'),
    (p ->> 'fulfillment')::public.fulfillment_type,
    (p ->> 'status')::public.order_status,
    v_slot,
    v_slot,
    (p ->> 'subtotal_cents')::integer,
    coalesce((p ->> 'discount_cents')::integer, 0),
    coalesce((p ->> 'delivery_fee_cents')::integer, 0),
    coalesce((p ->> 'tip_cents')::integer, 0),
    (p ->> 'total_cents')::integer,
    (p ->> 'payment_method')::public.payment_method,
    (p ->> 'payment_status')::public.payment_status,
    nullif(trim(p ->> 'notes'), '')
  )
  returning * into v_order;

  if jsonb_array_length(coalesce(p -> 'items', '[]'::jsonb)) = 0 then
    raise exception 'empty_order' using errcode = 'P0001';
  end if;

  for v_item in select * from jsonb_array_elements(p -> 'items') loop
    insert into public.order_items (
      restaurant_id, order_id, product_id, name, unit_price_cents, quantity, options, notes, total_cents
    ) values (
      v_location.restaurant_id,
      v_order.id,
      (v_item ->> 'product_id')::uuid,
      v_item ->> 'name',
      (v_item ->> 'unit_price_cents')::integer,
      (v_item ->> 'quantity')::smallint,
      coalesce(v_item -> 'options', '[]'::jsonb),
      nullif(trim(v_item ->> 'notes'), ''),
      (v_item ->> 'total_cents')::integer
    );
  end loop;

  -- Garde-fou : la somme des lignes doit égaler le sous-total annoncé.
  if (select sum(oi.total_cents) from public.order_items oi where oi.order_id = v_order.id) <> v_order.subtotal_cents then
    raise exception 'subtotal_mismatch' using errcode = 'P0001';
  end if;

  return query select v_order.id, v_order.number, v_order.public_token;
end;
$$;

-- ═══ Confirmation de paiement (webhook) ═════════════════════════════════════

-- Idempotent : ne fait rien si la commande n'est plus en attente de paiement.
-- Refuse un montant qui ne correspond pas au total de la commande.
create or replace function public.mark_order_paid(p_payment_intent text, p_amount_cents integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders o where o.stripe_payment_intent_id = p_payment_intent for update;
  if not found then
    return null;
  end if;
  if v_order.total_cents <> p_amount_cents then
    raise exception 'amount_mismatch' using errcode = 'P0001';
  end if;
  if v_order.status <> 'pending_payment' then
    return null; -- déjà traité (webhook rejoué) ou annulé entre-temps
  end if;
  update public.orders set status = 'new', payment_status = 'paid' where id = v_order.id;
  return v_order.id;
end;
$$;

-- ═══ Statistiques client ════════════════════════════════════════════════════

-- Une commande compte pour le client quand elle est « passée » : insérée en 'new'
-- (paiement sur place) ou sortie de 'pending_payment' (paiement confirmé).
create or replace function public.orders_customer_stats()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.customer_id is not null
     and new.status = 'new'
     and (tg_op = 'INSERT' or old.status = 'pending_payment') then
    update public.customers
       set orders_count = orders_count + 1,
           total_spent_cents = total_spent_cents + new.total_cents,
           last_order_at = now()
     where id = new.customer_id;
  end if;
  return null;
end;
$$;

create trigger orders_customer_stats
  after insert or update of status on public.orders
  for each row execute function public.orders_customer_stats();

-- ═══ Droits ═════════════════════════════════════════════════════════════════

revoke execute on function public.place_order(jsonb) from public, anon, authenticated;
revoke execute on function public.mark_order_paid(text, integer) from public, anon, authenticated;
revoke execute on function public.orders_customer_stats() from public, anon, authenticated;
grant execute on function public.place_order(jsonb), public.mark_order_paid(text, integer) to service_role;
