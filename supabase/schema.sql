-- =====================================================================
-- Eagle Touch, schéma Supabase (PostgreSQL)
-- À exécuter une fois dans Supabase : SQL Editor > New query > Run.
-- Les points Stableford et les moyennes ne sont pas stockés : ils sont
-- recalculés à partir des coups, du parcours figé et du handicap figé.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Joueurs ----------
create table public.profiles (
  id          uuid primary key default gen_random_uuid(),     -- = auth.users.id pour un compte
  first_name  text not null,
  last_name   text not null default '',
  email       text not null default '',
  handicap    numeric(4,1) not null default 54 check (handicap between -10 and 54),
  gender      text check (gender in ('M','F')),                -- cartes hommes (M) ou dames (F)
  photo       text,                                          -- image 192 px en data URL
  managed_by  uuid references public.profiles(id) on delete set null, -- joueur sans compte
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.handicap_history (
  id          bigint generated always as identity primary key,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  value       numeric(4,1) not null,
  recorded_at timestamptz not null default now(),
  unique (profile_id, recorded_at)
);

-- ---------- Compétitions ----------
create table public.competitions (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text not null default '',
  start_date  date not null,
  end_date    date,
  code        text not null unique,
  created_by  uuid not null references public.profiles(id),
  allowance   int  not null default 100 check (allowance between 50 and 100),
  challenges  jsonb not null default '{}'::jsonb,            -- défis activés
  min_rounds  int  not null default 0 check (min_rounds between 0 and 50), -- manches minimum (0 = aucun)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.competition_members (
  competition_id uuid not null references public.competitions(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  role           text not null default 'player' check (role in ('admin','player')),
  joined_at      timestamptz not null default now(),
  added_by       uuid references public.profiles(id) on delete set null,
  primary key (competition_id, user_id)
);

-- ---------- Parcours ----------
create table public.golf_courses (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  location    text not null default '',
  country     text not null default '',
  region      text not null default '',
  holes_count int  not null check (holes_count in (9,18,27,36,45,54)),
  sections    jsonb,                                         -- plus de 18 trous : 9 trous et parcours du club
  par         int  not null,
  source      text,                                          -- référence annuaire
  created_by  uuid not null references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.golf_holes (
  course_id    uuid not null references public.golf_courses(id) on delete cascade,
  number       int  not null check (number between 1 and 54),
  par          int  not null check (par between 3 and 5),
  stroke_index int  not null check (stroke_index between 1 and 18),
  distance_m   int,
  primary key (course_id, number)
);

create table public.course_tees (
  id             uuid primary key default gen_random_uuid(),
  course_id      uuid not null references public.golf_courses(id) on delete cascade,
  position       int  not null default 0,
  name           text not null,
  color          text not null default '#999999',
  course_rating  numeric(4,1),
  slope          int check (slope between 55 and 155),
  total_distance int,
  hole_distances int[],
  gender         text not null default 'M' check (gender in ('M','F')), -- carte hommes ou dames
  layout         text,                                       -- parcours du club (plus de 18 trous)
  pars           int[],                                      -- vide = carte de référence
  stroke_indexes int[]
);

-- ---------- Manches ----------
create table public.rounds (
  id                    uuid primary key default gen_random_uuid(),
  competition_id        uuid not null references public.competitions(id) on delete cascade,
  name                  text not null,
  play_date             date not null,
  tee_time              time,
  registration_deadline date,
  description           text not null default '',
  course_id             uuid references public.golf_courses(id) on delete set null,
  course_snapshot       jsonb not null,  -- parcours figé au moment de la manche (trous, départ, CR, slope)
  ntp_hole              int,             -- index du par 3 « plus près du drapeau »
  status                text not null default 'open' check (status in ('open','closed')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table public.round_participants (
  round_id       uuid not null references public.rounds(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  competition_id uuid not null references public.competitions(id) on delete cascade,
  status         text not null check (status in ('yes','no')),  -- pas de ligne = pas encore répondu
  submitted      boolean not null default false,
  submitted_at   timestamptz,
  hcp_index      numeric(4,1),   -- index figé pour cette manche
  course_hcp     int,
  playing_hcp    int,            -- handicap de jeu final utilisé
  hcp_manual     boolean not null default false,
  ntp_winner     boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  updated_by     uuid references public.profiles(id) on delete set null,
  card           text,           -- carte jouée (départ), figée pour la manche
  primary key (round_id, user_id)
);

create table public.hole_scores (
  round_id   uuid not null,
  user_id    uuid not null,
  hole_index int  not null check (hole_index between 0 and 17),
  strokes    int  check (strokes between 0 and 15),          -- 0 = balle relevée
  nains      int  not null default 0 check (nains between 0 and 9),
  long_drive boolean not null default false,
  croix      boolean not null default false,
  primary key (round_id, user_id, hole_index),
  foreign key (round_id, user_id) references public.round_participants(round_id, user_id) on delete cascade
);

create index on public.competition_members (user_id);
create index on public.rounds (competition_id);
create index on public.round_participants (competition_id);
create index on public.golf_holes (course_id);
create index on public.course_tees (course_id);

-- ---------- Fonctions d'accès (security definer pour éviter la récursion RLS) ----------
create or replace function public.is_member(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from competition_members where competition_id = cid and user_id = auth.uid());
$$;

create or replace function public.is_admin(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from competition_members where competition_id = cid and user_id = auth.uid() and role = 'admin');
$$;

create or replace function public.shares_competition(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from competition_members a join competition_members b on a.competition_id = b.competition_id
    where a.user_id = auth.uid() and b.user_id = pid);
$$;

create or replace function public.manages(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = pid and managed_by = auth.uid());
$$;

-- Marqueur : un participant peut tenir la carte d'un autre participant de la même manche.
create or replace function public.can_score(rid uuid, uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select uid = auth.uid()
      or exists (select 1 from rounds r where r.id = rid and public.is_admin(r.competition_id))
      or exists (select 1 from round_participants p where p.round_id = rid and p.user_id = auth.uid() and p.status = 'yes');
$$;

-- Rejoindre une compétition avec son code.
create or replace function public.join_competition(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select id into cid from competitions where upper(replace(code, '-', '')) = upper(replace(trim(p_code), '-', ''));
  if cid is null then return null; end if;
  insert into competition_members (competition_id, user_id, role) values (cid, auth.uid(), 'player')
  on conflict do nothing;
  return cid;
end $$;
grant execute on function public.join_competition(text) to authenticated;

-- Profil créé automatiquement à l'inscription (prénom, nom, index transmis dans les métadonnées).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare h numeric := coalesce(nullif(new.raw_user_meta_data->>'handicap', '')::numeric, 54);
        g text := nullif(new.raw_user_meta_data->>'gender', '');
begin
  insert into profiles (id, first_name, last_name, email, handicap, gender)
  values (new.id, coalesce(new.raw_user_meta_data->>'first_name', ''), coalesce(new.raw_user_meta_data->>'last_name', ''), coalesce(new.email, ''), h,
          case when g in ('M','F') then g else null end)
  on conflict (id) do nothing;
  insert into handicap_history (profile_id, value) values (new.id, h) on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Sécurité (Row Level Security) ----------
alter table public.profiles            enable row level security;
alter table public.handicap_history    enable row level security;
alter table public.competitions        enable row level security;
alter table public.competition_members enable row level security;
alter table public.golf_courses        enable row level security;
alter table public.golf_holes          enable row level security;
alter table public.course_tees         enable row level security;
alter table public.rounds              enable row level security;
alter table public.round_participants  enable row level security;
alter table public.hole_scores         enable row level security;

-- Joueurs : soi-même, les joueurs sans compte qu'on gère, les joueurs de mes compétitions.
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or managed_by = auth.uid() or public.shares_competition(id));
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = auth.uid() or managed_by = auth.uid());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or managed_by = auth.uid());

create policy hh_read on public.handicap_history for select to authenticated
  using (profile_id = auth.uid() or public.manages(profile_id) or public.shares_competition(profile_id));
create policy hh_write on public.handicap_history for insert to authenticated
  with check (profile_id = auth.uid() or public.manages(profile_id));

-- Compétitions : lecture par les membres, écriture par les administrateurs.
create policy comp_read on public.competitions for select to authenticated
  using (public.is_member(id) or created_by = auth.uid());
create policy comp_insert on public.competitions for insert to authenticated
  with check (created_by = auth.uid());
create policy comp_update on public.competitions for update to authenticated
  using (public.is_admin(id));
create policy comp_delete on public.competitions for delete to authenticated
  using (public.is_admin(id));

create policy members_read on public.competition_members for select to authenticated
  using (public.is_member(competition_id) or user_id = auth.uid());
create policy members_update on public.competition_members for update to authenticated
  using (public.is_admin(competition_id) or user_id = auth.uid())
  with check (public.is_admin(competition_id)
    or (user_id = auth.uid() and exists (select 1 from competitions c where c.id = competition_id and c.created_by = auth.uid())));
create policy members_insert on public.competition_members for insert to authenticated
  with check (
    public.is_admin(competition_id)
    or (user_id = auth.uid() and role = 'admin'
        and exists (select 1 from competitions c where c.id = competition_id and c.created_by = auth.uid())));
create policy members_delete on public.competition_members for delete to authenticated
  using (public.is_admin(competition_id));

-- Parcours : partagés entre tous les utilisateurs, modifiables par leur créateur.
create policy courses_read on public.golf_courses for select to authenticated using (true);
create table if not exists public.app_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;
drop policy if exists app_admins_read on public.app_admins;
create policy app_admins_read on public.app_admins for select to authenticated using (true);

create or replace function public.is_app_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_admins where user_id = auth.uid());
$$;

-- Parcours : le créateur ou un administrateur.
create policy courses_insert on public.golf_courses for insert to authenticated
  with check (created_by = auth.uid() or public.is_app_admin());
create policy courses_update on public.golf_courses for update to authenticated
  using (created_by = auth.uid() or public.is_app_admin());
create policy courses_delete on public.golf_courses for delete to authenticated
  using (created_by = auth.uid() or public.is_app_admin());
create policy holes_read on public.golf_holes for select to authenticated using (true);
create policy holes_write on public.golf_holes for all to authenticated
  using (public.is_app_admin() or exists (select 1 from golf_courses c where c.id = course_id and c.created_by = auth.uid()))
  with check (public.is_app_admin() or exists (select 1 from golf_courses c where c.id = course_id and c.created_by = auth.uid()));
create policy tees_read on public.course_tees for select to authenticated using (true);
create policy tees_write on public.course_tees for all to authenticated
  using (public.is_app_admin() or exists (select 1 from golf_courses c where c.id = course_id and c.created_by = auth.uid()))
  with check (public.is_app_admin() or exists (select 1 from golf_courses c where c.id = course_id and c.created_by = auth.uid()));

-- Manches : lecture par les membres, écriture par les administrateurs.
create policy rounds_read on public.rounds for select to authenticated using (public.is_member(competition_id));
create policy rounds_write on public.rounds for all to authenticated
  using (public.is_admin(competition_id)) with check (public.is_admin(competition_id));

-- Participation et scores : chacun pour soi, l'administrateur pour tous, un marqueur pour sa manche.
create policy rp_read on public.round_participants for select to authenticated using (public.is_member(competition_id));
create policy rp_insert on public.round_participants for insert to authenticated
  with check (public.is_member(competition_id) and (user_id = auth.uid() or public.is_admin(competition_id)));
create policy rp_update on public.round_participants for update to authenticated
  using (public.is_member(competition_id) and public.can_score(round_id, user_id));
create policy rp_delete on public.round_participants for delete to authenticated
  using (public.is_admin(competition_id));

create policy hs_read on public.hole_scores for select to authenticated
  using (exists (select 1 from rounds r where r.id = round_id and public.is_member(r.competition_id)));
create policy hs_write on public.hole_scores for all to authenticated
  using (public.can_score(round_id, user_id)) with check (public.can_score(round_id, user_id));

-- ---------- Temps réel (mise à jour des classements en direct) ----------
alter publication supabase_realtime add table
  public.profiles, public.competitions, public.competition_members, public.golf_courses,
  public.golf_holes, public.course_tees, public.rounds, public.round_participants, public.hole_scores;

-- =====================================================================
-- Renforcement de la sécurité (identique à patch-006-securite.sql)
-- =====================================================================
-- ---------------------------------------------------------------------
-- 1. Membres : un administrateur de compétition ne peut ajouter que les
--    joueurs sans compte qu'il gère. Un vrai compte rejoint avec le code.
--    (Empêche d'ajouter un inconnu à sa compétition pour lire son profil.)
-- ---------------------------------------------------------------------
drop policy if exists members_insert on public.competition_members;
create policy members_insert on public.competition_members for insert to authenticated
  with check (
    (public.is_admin(competition_id) and public.manages(user_id))
    or (user_id = auth.uid() and role = 'admin'
        and exists (select 1 from competitions c where c.id = competition_id and c.created_by = auth.uid())));

-- ---------------------------------------------------------------------
-- 2. Adresses e-mail : elles ne sont plus copiées dans les profils
--    (visibles par les autres membres). L'e-mail reste dans le compte.
-- ---------------------------------------------------------------------
create or replace function public.profiles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.email := '';
  if new.photo is not null and (new.photo !~ '^data:image/(jpeg|png|webp|gif);base64,' or length(new.photo) > 400000) then
    new.photo := null;
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before insert or update on public.profiles
  for each row execute function public.profiles_guard();
update public.profiles set email = '' where email <> '';

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare h numeric; g text := nullif(new.raw_user_meta_data->>'gender', '');
begin
  begin
    h := coalesce(nullif(new.raw_user_meta_data->>'handicap', '')::numeric, 54);
  exception when others then h := 54; end;
  if h < -10 or h > 54 then h := 54; end if;
  insert into profiles (id, first_name, last_name, email, handicap, gender)
  values (new.id, left(coalesce(new.raw_user_meta_data->>'first_name', ''), 80), left(coalesce(new.raw_user_meta_data->>'last_name', ''), 80), '', h,
          case when g in ('M','F') then g else null end)
  on conflict (id) do nothing;
  insert into handicap_history (profile_id, value) values (new.id, h) on conflict do nothing;
  return new;
end $$;

-- Un compte ne peut pas se déclarer « géré » par quelqu'un d'autre.
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or managed_by = auth.uid())
  with check ((id = auth.uid() and managed_by is null) or managed_by = auth.uid());

-- ---------------------------------------------------------------------
-- 3. Codes d'invitation : essais limités (8 codes faux par quart d'heure).
-- ---------------------------------------------------------------------
create table if not exists public.join_attempts (
  id      bigint generated always as identity primary key,
  user_id uuid not null,
  at      timestamptz not null default now()
);
alter table public.join_attempts enable row level security;  -- aucune règle : inaccessible depuis l'application
create index if not exists join_attempts_user_at on public.join_attempts (user_id, at);

create or replace function public.join_competition(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare cid uuid; n int;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select count(*) into n from join_attempts where user_id = auth.uid() and at > now() - interval '15 minutes';
  if n >= 8 then raise exception 'too_many_attempts'; end if;
  select id into cid from competitions where upper(replace(code, '-', '')) = upper(replace(trim(p_code), '-', ''));
  if cid is null then
    delete from join_attempts where at < now() - interval '1 day';
    insert into join_attempts (user_id) values (auth.uid());
    return null;
  end if;
  insert into competition_members (competition_id, user_id, role) values (cid, auth.uid(), 'player')
  on conflict do nothing;
  return cid;
end $$;
revoke execute on function public.join_competition(text) from public, anon;
grant execute on function public.join_competition(text) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Scores : les verrous de l'application sont aussi appliqués par la base.
--    Hors administrateur : plus de modification quand la manche est clôturée
--    ou quand la carte est validée.
-- ---------------------------------------------------------------------
create or replace function public.can_score(rid uuid, uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from rounds r where r.id = rid and public.is_admin(r.competition_id))
      or (
        exists (select 1 from rounds r where r.id = rid and r.status = 'open')
        and not exists (select 1 from round_participants t where t.round_id = rid and t.user_id = uid and t.submitted)
        and (uid = auth.uid()
             or exists (select 1 from round_participants p where p.round_id = rid and p.user_id = auth.uid() and p.status = 'yes'))
      );
$$;

-- Inscription : seulement soi-même, dans une manche ouverte de la bonne compétition.
drop policy if exists rp_insert on public.round_participants;
create policy rp_insert on public.round_participants for insert to authenticated
  with check (
    public.is_member(competition_id)
    and exists (select 1 from rounds r where r.id = round_id and r.competition_id = round_participants.competition_id)
    and (public.is_admin(competition_id)
         or (user_id = auth.uid() and exists (select 1 from rounds r where r.id = round_id and r.status = 'open'))));

-- Champs protégés : seul l'administrateur ajuste un handicap de jeu ou rouvre une carte ;
-- un partenaire qui tient la carte ne change pas l'inscription ; le handicap est figé
-- dès le premier coup saisi. Les valeurs protégées sont conservées sans erreur.
create or replace function public.rp_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin(new.competition_id) then return new; end if;
  if tg_op = 'INSERT' then
    new.hcp_manual := false; new.submitted := false; new.submitted_at := null; new.ntp_winner := false;
    return new;
  end if;
  new.round_id := old.round_id; new.user_id := old.user_id; new.competition_id := old.competition_id;
  new.hcp_manual := old.hcp_manual;
  if auth.uid() <> old.user_id then new.status := old.status; end if;
  if old.hcp_manual or exists (select 1 from hole_scores h where h.round_id = old.round_id and h.user_id = old.user_id and h.strokes is not null) then
    new.hcp_index := old.hcp_index; new.course_hcp := old.course_hcp; new.playing_hcp := old.playing_hcp; new.card := old.card;
  end if;
  return new;
end $$;
drop trigger if exists rp_guard on public.round_participants;
create trigger rp_guard before insert or update on public.round_participants
  for each row execute function public.rp_guard();

-- ---------------------------------------------------------------------
-- 5. Liste des administrateurs de l'application : chacun ne voit que sa ligne.
-- ---------------------------------------------------------------------
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'app_admins') then
    drop policy if exists app_admins_read on public.app_admins;
    create policy app_admins_read on public.app_admins for select to authenticated using (user_id = auth.uid());
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 6. Limites de taille (contre le remplissage abusif de la base).
--    NOT VALID : les lignes existantes ne sont pas revérifiées.
-- ---------------------------------------------------------------------
do $$
declare c record;
begin
  for c in select * from (values
    ('profiles',     'profiles_len',     $x$check (length(first_name) <= 80 and length(last_name) <= 80)$x$),
    ('competitions', 'competitions_len', $x$check (length(name) <= 120 and length(description) <= 4000 and length(code) <= 40)$x$),
    ('rounds',       'rounds_len',       $x$check (length(name) <= 120 and length(description) <= 4000 and length(course_snapshot::text) <= 200000)$x$),
    ('golf_courses', 'golf_courses_len', $x$check (length(name) <= 160 and length(location) <= 160 and length(country) <= 80 and length(region) <= 160)$x$),
    ('course_tees',  'course_tees_len',  $x$check (length(name) <= 40 and color ~ '^#[0-9A-Fa-f]{3,8}$')$x$)
  ) as t(tbl, con, def) loop
    if not exists (select 1 from pg_constraint where conname = c.con) then
      execute format('alter table public.%I add constraint %I %s not valid', c.tbl, c.con, c.def);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 7. Codes d'invitation impossibles à deviner : ET-XXXXX-XXXXX, tirés au hasard.
--    Les anciens codes (ET-année-4 lettres du nom) sont remplacés ; les joueurs
--    déjà inscrits ne sont pas concernés, le nouveau code s'affiche dans l'application.
-- ---------------------------------------------------------------------
create or replace function public.gen_code() returns text
language plpgsql volatile security definer set search_path = public as $$
declare a constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; b bytea; s text; i int;
begin
  loop
    b := uuid_send(gen_random_uuid()) || uuid_send(gen_random_uuid());
    s := 'ET-';
    for i in 0..9 loop
      if i = 5 then s := s || '-'; end if;
      s := s || substr(a, 1 + (get_byte(b, 16 + i) % 32), 1);
    end loop;
    exit when not exists (select 1 from competitions where code = s);
  end loop;
  return s;
end $$;

create or replace function public.competitions_code_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.code is null or length(new.code) < 12 or new.code ~ '^ET-[0-9]{4}-[A-Z]{4}$' then new.code := public.gen_code(); end if;
  return new;
end $$;
drop trigger if exists competitions_code_guard on public.competitions;
create trigger competitions_code_guard before insert or update of code on public.competitions
  for each row execute function public.competitions_code_guard();
update public.competitions set code = code where length(code) < 12 or code ~ '^ET-[0-9]{4}-[A-Z]{4}$';
