-- ─────────────────────────────────────────────────────────────────────────────
-- Miaamm · 007 · Back-office : remplacement atomique des horaires
-- SECURITY INVOKER : la RLS s'applique (seul un manager/owner du restaurant
-- peut modifier ses horaires). Tout ou rien, dans une seule transaction.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.replace_opening_hours(
  p_location_id uuid,
  p_service public.fulfillment_type,
  p_ranges jsonb -- [{ weekday, opens_at: "HH:MM", closes_at: "HH:MM" }]
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_restaurant uuid;
  v_count integer;
begin
  select l.restaurant_id into v_restaurant from public.locations l where l.id = p_location_id;
  if v_restaurant is null or not public.is_manager(v_restaurant) then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  delete from public.opening_hours where location_id = p_location_id and service = p_service;

  insert into public.opening_hours (restaurant_id, location_id, service, weekday, opens_at, closes_at)
  select v_restaurant, p_location_id, p_service, (r ->> 'weekday')::smallint, (r ->> 'opens_at')::time, (r ->> 'closes_at')::time
    from jsonb_array_elements(coalesce(p_ranges, '[]'::jsonb)) as r;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.replace_opening_hours(uuid, public.fulfillment_type, jsonb) from public, anon;
grant execute on function public.replace_opening_hours(uuid, public.fulfillment_type, jsonb) to authenticated, service_role;
