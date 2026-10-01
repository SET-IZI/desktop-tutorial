-- ─────────────────────────────────────────────────────────────────────────────
-- Miaamm · 011 · Notifications push (nouvelles commandes)
--   Un abonnement Web Push par appareil et par membre de l'équipe. Chacun ne
--   voit et ne gère que les siens ; l'envoi se fait côté serveur (service role).
-- ─────────────────────────────────────────────────────────────────────────────

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  created_at timestamptz not null default now(),
  unique (restaurant_id, endpoint)
);
create index push_subscriptions_restaurant_idx on public.push_subscriptions (restaurant_id);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions: les siens (lecture)" on public.push_subscriptions
  for select using (user_id = (select auth.uid()));
create policy "push_subscriptions: les siens, membre de l'équipe (ajout)" on public.push_subscriptions
  for insert with check (user_id = (select auth.uid()) and public.is_staff(restaurant_id));
create policy "push_subscriptions: les siens (suppression)" on public.push_subscriptions
  for delete using (user_id = (select auth.uid()));

revoke all on public.push_subscriptions from anon, authenticated;
grant select, delete on public.push_subscriptions to authenticated;
grant insert (restaurant_id, endpoint, p256dh, auth) on public.push_subscriptions to authenticated;
