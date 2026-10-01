-- ─────────────────────────────────────────────────────────────────────────────
-- Miaamm · 010 · Équipe
--   - team_invites : invitations par lien (jeton secret, 7 jours), gérées par l'owner ;
--   - team_members() : membres avec leur email (auth.users n'est pas lisible) ;
--   - invite_details() / accept_team_invite() : page « rejoindre » ; l'invitation
--     n'est acceptée que par le compte dont l'email correspond.
-- Rôles et retraits : users_roles (RLS owner, au moins un owner garanti par trigger).
-- ─────────────────────────────────────────────────────────────────────────────

create table public.team_invites (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  -- Un propriétaire se nomme ensuite depuis la liste de l'équipe.
  role public.member_role not null check (role in ('manager', 'kitchen')),
  -- 2 × 122 bits aléatoires : le lien vaut autorisation, il ne se devine pas.
  token text not null unique
    default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  invited_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null
);
create index team_invites_restaurant_idx on public.team_invites (restaurant_id);
-- Une seule invitation en attente par email et par restaurant.
create unique index team_invites_pending_email_idx
  on public.team_invites (restaurant_id, lower(email)) where accepted_at is null;

alter table public.team_invites enable row level security;

create policy "team_invites: lecture owner" on public.team_invites
  for select using (public.is_owner(restaurant_id));
create policy "team_invites: création owner" on public.team_invites
  for insert with check (public.is_owner(restaurant_id));
create policy "team_invites: révocation owner" on public.team_invites
  for delete using (public.is_owner(restaurant_id));

revoke all on public.team_invites from anon, authenticated;
grant select, delete on public.team_invites to authenticated;
grant insert (restaurant_id, email, role) on public.team_invites to authenticated;

-- Membres du restaurant (managers et owners), du plus ancien au plus récent.
create or replace function public.team_members(p_restaurant_id uuid)
returns table (user_id uuid, email text, role public.member_role, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_manager(p_restaurant_id) then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  return query
    select ur.user_id, u.email::text, ur.role, ur.created_at
    from public.users_roles ur
    join auth.users u on u.id = ur.user_id
    where ur.restaurant_id = p_restaurant_id
    order by ur.created_at, u.email;
end;
$$;

-- Aperçu d'une invitation pour la page « rejoindre » (le jeton fait office de secret).
create or replace function public.invite_details(p_token text)
returns table (
  restaurant_name text,
  role public.member_role,
  email text,
  expired boolean,
  accepted boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.name, i.role, i.email, i.expires_at < now(), i.accepted_at is not null
  from public.team_invites i
  join public.restaurants r on r.id = i.restaurant_id
  where i.token = p_token;
$$;

-- Accepte une invitation : renvoie l'identifiant du restaurant rejoint.
create or replace function public.accept_team_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_invite public.team_invites%rowtype;
  v_email text;
begin
  if v_user is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'login_required' using errcode = 'insufficient_privilege';
  end if;

  select * into v_invite from public.team_invites where token = p_token for update;
  if not found then
    raise exception 'invite_not_found' using errcode = 'no_data_found';
  end if;
  if v_invite.accepted_at is not null then
    raise exception 'invite_used' using errcode = 'check_violation';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'invite_expired' using errcode = 'check_violation';
  end if;

  select u.email into v_email from auth.users u where u.id = v_user;
  if lower(coalesce(v_email, '')) <> lower(v_invite.email) then
    raise exception 'email_mismatch' using errcode = 'insufficient_privilege';
  end if;

  -- Déjà membre : on garde son rôle actuel (jamais de rétrogradation par invitation).
  insert into public.users_roles (user_id, restaurant_id, role)
  values (v_user, v_invite.restaurant_id, v_invite.role)
  on conflict (user_id, restaurant_id) do nothing;

  update public.team_invites
  set accepted_at = now(), accepted_by = v_user
  where id = v_invite.id;

  return v_invite.restaurant_id;
end;
$$;

revoke execute on function public.team_members(uuid), public.invite_details(text),
  public.accept_team_invite(text) from public, anon;
grant execute on function public.team_members(uuid), public.invite_details(text),
  public.accept_team_invite(text) to authenticated;
