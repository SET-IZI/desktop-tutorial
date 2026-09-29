-- ─────────────────────────────────────────────────────────────────────────────
-- Miaamm · 009 · Onboarding
--   - import_menu() : ajoute une carte relue (CSV ou photo analysée) en une
--     transaction, à la suite des catégories existantes.
-- SECURITY INVOKER : la RLS (manager/owner) s'applique.
-- ─────────────────────────────────────────────────────────────────────────────

-- p (jsonb) : { categories: [{ name, products: [{ name, description, price_cents }] }] }
-- Renvoie le nombre de plats importés.
create or replace function public.import_menu(p_menu_id uuid, p jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_restaurant uuid;
  v_category jsonb;
  v_category_id uuid;
  v_product jsonb;
  v_cpos integer;
  v_ppos integer;
  v_count integer := 0;
begin
  select m.restaurant_id into v_restaurant from public.menus m where m.id = p_menu_id;
  if v_restaurant is null or not public.is_manager(v_restaurant) then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  select coalesce(max(c.position) + 1, 0) into v_cpos
  from public.categories c where c.menu_id = p_menu_id;

  for v_category in select * from jsonb_array_elements(p -> 'categories') loop
    insert into public.categories (restaurant_id, menu_id, name, position)
    values (v_restaurant, p_menu_id, trim(v_category ->> 'name'), v_cpos)
    returning id into v_category_id;
    v_cpos := v_cpos + 1;
    v_ppos := 0;

    for v_product in select * from jsonb_array_elements(v_category -> 'products') loop
      insert into public.products (restaurant_id, category_id, name, description, price_cents, position)
      values (
        v_restaurant,
        v_category_id,
        trim(v_product ->> 'name'),
        nullif(trim(v_product ->> 'description'), ''),
        (v_product ->> 'price_cents')::integer,
        v_ppos
      );
      v_ppos := v_ppos + 1;
      v_count := v_count + 1;
    end loop;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.import_menu(uuid, jsonb) from public, anon;
grant execute on function public.import_menu(uuid, jsonb) to authenticated;
