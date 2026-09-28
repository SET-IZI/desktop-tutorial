-- ─────────────────────────────────────────────────────────────────────────────
-- Miaamm · 005 · Visibilité boutique
-- Le public ne voit que ce qui est actif (brouillons de carte, établissements
-- désactivés et zones inactives restent réservés à l'équipe).
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  t text;
begin
  foreach t in array array['menus', 'locations', 'categories', 'products', 'options', 'delivery_zones'] loop
    execute format('drop policy "%1$s: lecture publique ou équipe" on public.%1$I', t);
    execute format($f$
      create policy "%1$s: lecture publique (actifs) ou équipe" on public.%1$I
        for select using (
          (is_active and public.is_public_restaurant(restaurant_id))
          or public.is_staff(restaurant_id)
        )
    $f$, t);
  end loop;
end $$;
