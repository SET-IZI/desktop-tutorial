-- ─────────────────────────────────────────────────────────────────────────────
-- Miaamm · 008 · Éditeur de carte
--   - save_product() : produit + groupes d'options + options en une transaction,
--     en conservant les identifiants existants (les paniers en cours restent valides) ;
--   - reorder_categories() / reorder_products() : glisser-déposer ;
--   - bucket Storage « menu » (photos), uniquement si Supabase Storage est présent.
-- Toutes les fonctions sont SECURITY INVOKER : la RLS (manager/owner) s'applique.
-- ─────────────────────────────────────────────────────────────────────────────

-- p (jsonb) : { id?, category_id, name, description, price_cents, image_urls, diet_tags,
--   allergens, is_active, is_sold_out, is_upsell, prep_time_minutes,
--   groups: [{ id?, name, min_select, max_select, options: [{ id?, name, price_delta_cents, is_active }] }] }
create or replace function public.save_product(p jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_category public.categories%rowtype;
  v_product uuid := nullif(p ->> 'id', '')::uuid;
  v_group jsonb;
  v_group_id uuid;
  v_option jsonb;
  v_option_id uuid;
  v_group_ids uuid[] := '{}';
  v_option_ids uuid[];
  v_gpos integer := 0;
  v_opos integer;
begin
  select * into v_category from public.categories c where c.id = (p ->> 'category_id')::uuid;
  if not found or not public.is_manager(v_category.restaurant_id) then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  if v_product is null then
    insert into public.products (
      restaurant_id, category_id, name, description, price_cents, image_urls, diet_tags, allergens,
      is_active, is_sold_out, is_upsell, prep_time_minutes, position
    ) values (
      v_category.restaurant_id,
      v_category.id,
      p ->> 'name',
      nullif(trim(p ->> 'description'), ''),
      (p ->> 'price_cents')::integer,
      coalesce((select array_agg(x) from jsonb_array_elements_text(p -> 'image_urls') x), '{}'),
      coalesce((select array_agg(x::public.diet_tag) from jsonb_array_elements_text(p -> 'diet_tags') x), '{}'),
      coalesce((select array_agg(x::public.allergen) from jsonb_array_elements_text(p -> 'allergens') x), '{}'),
      coalesce((p ->> 'is_active')::boolean, true),
      coalesce((p ->> 'is_sold_out')::boolean, false),
      coalesce((p ->> 'is_upsell')::boolean, false),
      (p ->> 'prep_time_minutes')::smallint,
      coalesce((select max(pr.position) + 1 from public.products pr where pr.category_id = v_category.id), 0)
    )
    returning id into v_product;
  else
    update public.products set
      category_id = v_category.id,
      name = p ->> 'name',
      description = nullif(trim(p ->> 'description'), ''),
      price_cents = (p ->> 'price_cents')::integer,
      image_urls = coalesce((select array_agg(x) from jsonb_array_elements_text(p -> 'image_urls') x), '{}'),
      diet_tags = coalesce((select array_agg(x::public.diet_tag) from jsonb_array_elements_text(p -> 'diet_tags') x), '{}'),
      allergens = coalesce((select array_agg(x::public.allergen) from jsonb_array_elements_text(p -> 'allergens') x), '{}'),
      is_active = coalesce((p ->> 'is_active')::boolean, true),
      is_sold_out = coalesce((p ->> 'is_sold_out')::boolean, false),
      is_upsell = coalesce((p ->> 'is_upsell')::boolean, false),
      prep_time_minutes = (p ->> 'prep_time_minutes')::smallint
    where id = v_product and restaurant_id = v_category.restaurant_id;
    if not found then
      raise exception 'product_not_found' using errcode = 'P0002';
    end if;
  end if;

  -- Groupes d'options : mise à jour (id connu) ou création, suppression des absents.
  for v_group in select * from jsonb_array_elements(coalesce(p -> 'groups', '[]'::jsonb)) loop
    v_group_id := nullif(v_group ->> 'id', '')::uuid;
    if v_group_id is not null then
      update public.option_groups set
        name = v_group ->> 'name',
        min_select = (v_group ->> 'min_select')::smallint,
        max_select = (v_group ->> 'max_select')::smallint,
        position = v_gpos
      where id = v_group_id and product_id = v_product;
      if not found then v_group_id := null; end if;
    end if;
    if v_group_id is null then
      insert into public.option_groups (restaurant_id, product_id, name, min_select, max_select, position)
      values (
        v_category.restaurant_id, v_product, v_group ->> 'name',
        (v_group ->> 'min_select')::smallint, (v_group ->> 'max_select')::smallint, v_gpos
      )
      returning id into v_group_id;
    end if;
    v_group_ids := v_group_ids || v_group_id;
    v_gpos := v_gpos + 1;

    v_option_ids := '{}';
    v_opos := 0;
    for v_option in select * from jsonb_array_elements(coalesce(v_group -> 'options', '[]'::jsonb)) loop
      v_option_id := nullif(v_option ->> 'id', '')::uuid;
      if v_option_id is not null then
        update public.options set
          name = v_option ->> 'name',
          price_delta_cents = coalesce((v_option ->> 'price_delta_cents')::integer, 0),
          is_active = coalesce((v_option ->> 'is_active')::boolean, true),
          position = v_opos
        where id = v_option_id and group_id = v_group_id;
        if not found then v_option_id := null; end if;
      end if;
      if v_option_id is null then
        insert into public.options (restaurant_id, group_id, name, price_delta_cents, is_active, position)
        values (
          v_category.restaurant_id, v_group_id, v_option ->> 'name',
          coalesce((v_option ->> 'price_delta_cents')::integer, 0),
          coalesce((v_option ->> 'is_active')::boolean, true), v_opos
        )
        returning id into v_option_id;
      end if;
      v_option_ids := v_option_ids || v_option_id;
      v_opos := v_opos + 1;
    end loop;
    delete from public.options o where o.group_id = v_group_id and not (o.id = any (v_option_ids));
  end loop;
  delete from public.option_groups g where g.product_id = v_product and not (g.id = any (v_group_ids));

  return v_product;
end;
$$;

-- Réordonne selon l'ordre du tableau (0, 1, 2…). Les identifiants hors restaurant
-- sont ignorés par la RLS (aucune ligne visible à mettre à jour).
create or replace function public.reorder_categories(p_ids uuid[])
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.categories c
     set position = t.ord - 1
    from unnest(p_ids) with ordinality as t (id, ord)
   where c.id = t.id;
$$;

create or replace function public.reorder_products(p_ids uuid[])
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.products pr
     set position = t.ord - 1
    from unnest(p_ids) with ordinality as t (id, ord)
   where pr.id = t.id;
$$;

revoke execute on function public.save_product(jsonb), public.reorder_categories(uuid[]), public.reorder_products(uuid[])
  from public, anon;
grant execute on function public.save_product(jsonb), public.reorder_categories(uuid[]), public.reorder_products(uuid[])
  to authenticated, service_role;

-- ═══ Photos (Supabase Storage) ══════════════════════════════════════════════
-- Chemin des fichiers : <restaurant_id>/<fichier>. Lecture publique, écriture manager.
-- Ignoré sur un Postgres sans Storage (tests locaux) : supabase-lite l'émule.

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage')
     and exists (select 1 from pg_tables where schemaname = 'storage' and tablename = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('menu', 'menu', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do nothing;

    execute $p$
      create policy "menu: écriture manager (insert)" on storage.objects for insert to authenticated
        with check (bucket_id = 'menu' and public.is_manager(((storage.foldername(name))[1])::uuid))
    $p$;
    execute $p$
      create policy "menu: écriture manager (update)" on storage.objects for update to authenticated
        using (bucket_id = 'menu' and public.is_manager(((storage.foldername(name))[1])::uuid))
    $p$;
    execute $p$
      create policy "menu: écriture manager (delete)" on storage.objects for delete to authenticated
        using (bucket_id = 'menu' and public.is_manager(((storage.foldername(name))[1])::uuid))
    $p$;
  end if;
end $$;
