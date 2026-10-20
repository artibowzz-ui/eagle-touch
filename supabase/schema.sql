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

-- =====================================================================
-- Vie privée : suppression de compte (identique à patch-007-vie-privee.sql)
-- =====================================================================
-- Un parcours partagé reste disponible après le départ de la personne qui l'a ajouté.
alter table public.golf_courses alter column created_by drop not null;

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c record; heir uuid;
begin
  if me is null then raise exception 'not_authenticated'; end if;

  -- Compétitions créées par ce compte : confiées à un autre joueur inscrit s'il y en a un
  -- (un administrateur en priorité, sinon le plus ancien membre), supprimées sinon.
  for c in select id from competitions where created_by = me loop
    select m.user_id into heir
      from competition_members m join profiles p on p.id = m.user_id
      where m.competition_id = c.id and m.user_id <> me and p.managed_by is null
      order by (m.role = 'admin') desc, m.joined_at
      limit 1;
    if heir is null then
      delete from competitions where id = c.id;
    else
      update competition_members set role = 'admin' where competition_id = c.id and user_id = heir;
      update competitions set created_by = heir where id = c.id;
      -- Les joueurs sans compte de cette compétition sont désormais gérés par le nouvel administrateur.
      update profiles set managed_by = heir
        where managed_by = me and id in (select user_id from competition_members where competition_id = c.id);
    end if;
  end loop;

  -- Parcours partagés : conservés, sans auteur.
  update golf_courses set created_by = null where created_by = me;
  -- Joueurs sans compte qui ne sont plus dans aucune compétition : supprimés.
  delete from profiles p where p.managed_by = me
    and not exists (select 1 from competition_members m where m.user_id = p.id);
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'join_attempts') then
    delete from join_attempts where user_id = me;
  end if;

  -- Profil, inscriptions, cartes de score, historique d'index (suppression en cascade), puis le compte.
  delete from profiles where id = me;
  delete from auth.users where id = me;
end $$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;


-- =====================================================================
-- Patch 008 inclus : avertissements du Security Advisor de Supabase.
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- 0. Prérequis des patchs précédents (sans effet s'ils ont déjà été exécutés).
-- ---------------------------------------------------------------------
create table if not exists public.app_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;
create table if not exists public.join_attempts (
  id      bigint generated always as identity primary key,
  user_id uuid not null,
  at      timestamptz not null default now()
);
alter table public.join_attempts enable row level security;
create index if not exists join_attempts_user_at on public.join_attempts (user_id, at);
alter table public.golf_courses alter column created_by drop not null;

-- ---------------------------------------------------------------------
-- 1. Schéma privé : invisible depuis l'API, il contient les fonctions internes.
-- ---------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_member(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from competition_members where competition_id = cid and user_id = auth.uid());
$$;
create or replace function private.is_admin(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from competition_members where competition_id = cid and user_id = auth.uid() and role = 'admin');
$$;
create or replace function private.shares_competition(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from competition_members a join competition_members b on a.competition_id = b.competition_id
    where a.user_id = auth.uid() and b.user_id = pid);
$$;
create or replace function private.manages(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = pid and managed_by = auth.uid());
$$;
create or replace function private.is_app_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_admins where user_id = auth.uid());
$$;
create or replace function private.can_score(rid uuid, uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from rounds r where r.id = rid and private.is_admin(r.competition_id))
      or (
        exists (select 1 from rounds r where r.id = rid and r.status = 'open')
        and not exists (select 1 from round_participants t where t.round_id = rid and t.user_id = uid and t.submitted)
        and (uid = auth.uid()
             or exists (select 1 from round_participants p where p.round_id = rid and p.user_id = auth.uid() and p.status = 'yes'))
      );
$$;

-- Rejoindre une compétition avec son code (essais limités : 8 codes faux par quart d'heure).
create or replace function private.join_competition(p_code text) returns uuid
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

-- Suppression de son propre compte (droit à l'effacement).
create or replace function private.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c record; heir uuid;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  for c in select id from competitions where created_by = me loop
    select m.user_id into heir
      from competition_members m join profiles p on p.id = m.user_id
      where m.competition_id = c.id and m.user_id <> me and p.managed_by is null
      order by (m.role = 'admin') desc, m.joined_at
      limit 1;
    if heir is null then
      delete from competitions where id = c.id;
    else
      update competition_members set role = 'admin' where competition_id = c.id and user_id = heir;
      update competitions set created_by = heir where id = c.id;
      update profiles set managed_by = heir
        where managed_by = me and id in (select user_id from competition_members where competition_id = c.id);
    end if;
  end loop;
  update golf_courses set created_by = null where created_by = me;
  delete from profiles p where p.managed_by = me
    and not exists (select 1 from competition_members m where m.user_id = p.id);
  delete from join_attempts where user_id = me;
  delete from profiles where id = me;
  delete from auth.users where id = me;
end $$;

revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

-- ---------------------------------------------------------------------
-- 2. Règles d'accès : mêmes droits qu'avant, réécrites.
--    (select auth.uid()) est calculé une fois par requête au lieu d'une fois par ligne.
-- ---------------------------------------------------------------------
do $$
declare p record;
begin
  for p in select schemaname, tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

-- Profils
create policy profiles_read on public.profiles for select to authenticated
  using (id = (select auth.uid()) or managed_by = (select auth.uid()) or private.shares_competition(id));
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = (select auth.uid()) or managed_by = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid()) or managed_by = (select auth.uid()))
  with check ((id = (select auth.uid()) and managed_by is null) or managed_by = (select auth.uid()));

-- Historique d'index
create policy hh_read on public.handicap_history for select to authenticated
  using (profile_id = (select auth.uid()) or private.manages(profile_id) or private.shares_competition(profile_id));
create policy hh_write on public.handicap_history for insert to authenticated
  with check (profile_id = (select auth.uid()) or private.manages(profile_id));

-- Compétitions
create policy comp_read on public.competitions for select to authenticated
  using (private.is_member(id) or created_by = (select auth.uid()));
create policy comp_insert on public.competitions for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy comp_update on public.competitions for update to authenticated
  using (private.is_admin(id));
create policy comp_delete on public.competitions for delete to authenticated
  using (private.is_admin(id));

-- Membres
create policy members_read on public.competition_members for select to authenticated
  using (private.is_member(competition_id) or user_id = (select auth.uid()));
create policy members_insert on public.competition_members for insert to authenticated
  with check (
    (private.is_admin(competition_id) and private.manages(user_id))
    or (user_id = (select auth.uid()) and role = 'admin'
        and exists (select 1 from public.competitions c where c.id = competition_id and c.created_by = (select auth.uid()))));
create policy members_update on public.competition_members for update to authenticated
  using (private.is_admin(competition_id) or user_id = (select auth.uid()))
  with check (
    private.is_admin(competition_id)
    or (user_id = (select auth.uid())
        and exists (select 1 from public.competitions c where c.id = competition_id and c.created_by = (select auth.uid()))));
create policy members_delete on public.competition_members for delete to authenticated
  using (private.is_admin(competition_id));

-- Parcours partagés
create policy courses_read on public.golf_courses for select to authenticated using (true);
create policy courses_insert on public.golf_courses for insert to authenticated
  with check (created_by = (select auth.uid()) or (select private.is_app_admin()));
create policy courses_update on public.golf_courses for update to authenticated
  using (created_by = (select auth.uid()) or (select private.is_app_admin()));
create policy courses_delete on public.golf_courses for delete to authenticated
  using (created_by = (select auth.uid()) or (select private.is_app_admin()));

create policy holes_read on public.golf_holes for select to authenticated using (true);
create policy holes_insert on public.golf_holes for insert to authenticated
  with check ((select private.is_app_admin()) or exists (select 1 from public.golf_courses c where c.id = course_id and c.created_by = (select auth.uid())));
create policy holes_update on public.golf_holes for update to authenticated
  using ((select private.is_app_admin()) or exists (select 1 from public.golf_courses c where c.id = course_id and c.created_by = (select auth.uid())))
  with check ((select private.is_app_admin()) or exists (select 1 from public.golf_courses c where c.id = course_id and c.created_by = (select auth.uid())));
create policy holes_delete on public.golf_holes for delete to authenticated
  using ((select private.is_app_admin()) or exists (select 1 from public.golf_courses c where c.id = course_id and c.created_by = (select auth.uid())));

create policy tees_read on public.course_tees for select to authenticated using (true);
create policy tees_insert on public.course_tees for insert to authenticated
  with check ((select private.is_app_admin()) or exists (select 1 from public.golf_courses c where c.id = course_id and c.created_by = (select auth.uid())));
create policy tees_update on public.course_tees for update to authenticated
  using ((select private.is_app_admin()) or exists (select 1 from public.golf_courses c where c.id = course_id and c.created_by = (select auth.uid())))
  with check ((select private.is_app_admin()) or exists (select 1 from public.golf_courses c where c.id = course_id and c.created_by = (select auth.uid())));
create policy tees_delete on public.course_tees for delete to authenticated
  using ((select private.is_app_admin()) or exists (select 1 from public.golf_courses c where c.id = course_id and c.created_by = (select auth.uid())));

-- Manches
create policy rounds_read on public.rounds for select to authenticated
  using (private.is_member(competition_id));
create policy rounds_insert on public.rounds for insert to authenticated
  with check (private.is_admin(competition_id));
create policy rounds_update on public.rounds for update to authenticated
  using (private.is_admin(competition_id)) with check (private.is_admin(competition_id));
create policy rounds_delete on public.rounds for delete to authenticated
  using (private.is_admin(competition_id));

-- Inscriptions aux manches
create policy rp_read on public.round_participants for select to authenticated
  using (private.is_member(competition_id));
create policy rp_insert on public.round_participants for insert to authenticated
  with check (
    private.is_member(competition_id)
    and exists (select 1 from public.rounds r where r.id = round_id and r.competition_id = round_participants.competition_id)
    and (private.is_admin(competition_id)
         or (user_id = (select auth.uid()) and exists (select 1 from public.rounds r where r.id = round_id and r.status = 'open'))));
create policy rp_update on public.round_participants for update to authenticated
  using (private.is_member(competition_id) and private.can_score(round_id, user_id));
create policy rp_delete on public.round_participants for delete to authenticated
  using (private.is_admin(competition_id));

-- Scores par trou
create policy hs_read on public.hole_scores for select to authenticated
  using (exists (select 1 from public.rounds r where r.id = round_id and private.is_member(r.competition_id)));
create policy hs_insert on public.hole_scores for insert to authenticated
  with check (private.can_score(round_id, user_id));
create policy hs_update on public.hole_scores for update to authenticated
  using (private.can_score(round_id, user_id)) with check (private.can_score(round_id, user_id));
create policy hs_delete on public.hole_scores for delete to authenticated
  using (private.can_score(round_id, user_id));

-- Administrateurs de l'application : chacun ne voit que sa ligne.
create policy app_admins_read on public.app_admins for select to authenticated
  using (user_id = (select auth.uid()));

-- Essais de codes : table interne, aucun accès depuis l'application.
create policy join_attempts_none on public.join_attempts for all to authenticated
  using (false) with check (false);

-- ---------------------------------------------------------------------
-- 3. Déclencheurs : ils restent en place mais ne sont plus appelables directement.
--    (rls_auto_enable est la fonction de Supabase qui protège automatiquement les nouvelles tables.)
-- ---------------------------------------------------------------------
create or replace function public.rp_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or private.is_admin(new.competition_id) then return new; end if;
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

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p
           where p.pronamespace = 'public'::regnamespace
             and p.proname in ('handle_new_user', 'profiles_guard', 'rp_guard', 'competitions_code_guard', 'gen_code', 'rls_auto_enable') loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 4. Anciennes fonctions du schéma public : supprimées. Les deux que l'application appelle
--    (rejoindre une compétition, supprimer son compte) deviennent de simples relais.
-- ---------------------------------------------------------------------
drop function if exists public.can_score(uuid, uuid);
drop function if exists public.is_member(uuid);
drop function if exists public.is_admin(uuid);
drop function if exists public.shares_competition(uuid);
drop function if exists public.manages(uuid);
drop function if exists public.is_app_admin();
drop function if exists public.join_competition(text);
drop function if exists public.delete_my_account();

create function public.join_competition(p_code text) returns uuid
language sql security invoker set search_path = '' as $$ select private.join_competition(p_code); $$;
create function public.delete_my_account() returns void
language sql security invoker set search_path = '' as $$ select private.delete_my_account(); $$;
revoke all on function public.join_competition(text) from public, anon;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.join_competition(text) to authenticated;
grant execute on function public.delete_my_account() to authenticated;

-- ---------------------------------------------------------------------
-- 5. Droits sur les tables : rien pour les visiteurs non connectés ; pour les joueurs connectés,
--    seulement lire et écrire (les règles ci-dessus décident ligne par ligne).
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;
revoke all on public.join_attempts from authenticated;
revoke insert, update, delete on public.app_admins from authenticated;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon;

-- ---------------------------------------------------------------------
-- 6. Index sur les clés étrangères.
-- ---------------------------------------------------------------------
create index if not exists competition_members_added_by_idx on public.competition_members (added_by);
create index if not exists competitions_created_by_idx on public.competitions (created_by);
create index if not exists golf_courses_created_by_idx on public.golf_courses (created_by);
create index if not exists profiles_managed_by_idx on public.profiles (managed_by);
create index if not exists round_participants_updated_by_idx on public.round_participants (updated_by);
create index if not exists round_participants_user_id_idx on public.round_participants (user_id);
create index if not exists rounds_course_id_idx on public.rounds (course_id);

commit;


-- =====================================================================
-- Patch 009 inclus : Index Eagle Touch.
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- 1. Choix par compétition : index déclaré par les joueurs (par défaut) ou Index Eagle Touch.
-- ---------------------------------------------------------------------
alter table public.competitions add column if not exists hcp_source text not null default 'declared';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'competitions_hcp_source_chk') then
    alter table public.competitions add constraint competitions_hcp_source_chk check (hcp_source in ('declared', 'eagle'));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. Résultat du calcul, un par joueur. Écrit uniquement par la base.
-- ---------------------------------------------------------------------
create table if not exists public.et_index (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  value      numeric(4,1),            -- null tant qu'il y a moins de 3 cartes comptées
  rounds     int not null default 0,  -- cartes comptées (différentiel calculable)
  skipped    int not null default 0,  -- cartes validées non comptées (pas de course rating / slope, carte incomplète)
  details    jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.et_index enable row level security;
drop policy if exists et_index_read on public.et_index;
create policy et_index_read on public.et_index for select to authenticated
  using (profile_id = (select auth.uid()) or private.manages(profile_id) or private.shares_competition(profile_id));
revoke all on public.et_index from anon;
revoke insert, update, delete, truncate, references, trigger on public.et_index from authenticated;
grant select on public.et_index to authenticated;

-- ---------------------------------------------------------------------
-- 3. Outils de calcul.
-- ---------------------------------------------------------------------
-- Arrondi au dixième comme l'application (0,05 vers le haut).
create or replace function private.r1(x numeric) returns numeric
language sql immutable set search_path = '' as $$ select floor(x * 10 + 0.5) / 10 $$;

-- Carte jouée par un inscrit : la sienne si elle existe dans la manche, sinon celle de son genre.
create or replace function private.played_card(snap jsonb, card text, gender text) returns jsonb
language sql immutable set search_path = '' as $$
  select case
    when snap ? 'cards' and card is not null and (snap->'cards') ? card then snap->'cards'->card
    when snap ? 'cards' and coalesce(snap->'cardFor'->>coalesce(gender, 'M'), snap->'cardFor'->>'M') is not null
      and (snap->'cards') ? coalesce(snap->'cardFor'->>coalesce(gender, 'M'), snap->'cardFor'->>'M')
      then snap->'cards'->coalesce(snap->'cardFor'->>coalesce(gender, 'M'), snap->'cardFor'->>'M')
    else jsonb_build_object('holes', snap->'holes', 'tee', snap->'tee', 'courseHoles', snap->'courseHoles')
  end
$$;

-- Course handicap et handicap de jeu, exactement comme l'application (Golf.handicaps).
create or replace function private.hcp_for(cd jsonb, idx numeric, allowance int, out ch int, out ph int)
language plpgsql immutable set search_path = '' as $$
declare n int; par int; cr numeric; slope numeric; ch_raw numeric; i2 numeric;
begin
  n := jsonb_array_length(cd->'holes');
  select coalesce(sum((h->>'par')::int), 0) into par from jsonb_array_elements(cd->'holes') h;
  i2 := case when n = 9 then idx / 2 else idx end;
  cr := nullif(cd->'tee'->>'cr', '')::numeric; slope := nullif(cd->'tee'->>'slope', '')::numeric;
  if cr > 0 and slope > 0 then
    if n = 9 and (cd->>'courseHoles')::int = 18 then cr := cr / 2; end if;
    ch_raw := i2 * slope / 113 + (cr - par);
  else
    ch_raw := i2;
  end if;
  ch := floor(ch_raw + 0.5)::int;
  ph := floor(ch_raw * coalesce(allowance, 100) / 100 + 0.5)::int;
end $$;

-- Différentiel d'une carte validée (null si la carte ne peut pas compter).
create or replace function private.round_diff(p_round uuid, p_user uuid) returns numeric
language plpgsql stable security definer set search_path = public as $$
declare rp record; snap jsonb; cd jsonb; n int; cr numeric; slope numeric; ch int; ags int := 0; got int := 0;
        h record; recv int; base int; rem int; ndb int; raw numeric; hi numeric;
begin
  select p.*, pr.gender into rp from round_participants p left join profiles pr on pr.id = p.user_id
    where p.round_id = p_round and p.user_id = p_user;
  if not found or not rp.submitted or rp.status <> 'yes' then return null; end if;
  select course_snapshot into snap from rounds where id = p_round;
  if snap is null then return null; end if;
  cd := private.played_card(snap, rp.card, rp.gender);
  n := jsonb_array_length(cd->'holes');
  if n not in (9, 18) then return null; end if;
  cr := nullif(cd->'tee'->>'cr', '')::numeric; slope := nullif(cd->'tee'->>'slope', '')::numeric;
  if cr is null or slope is null or cr <= 0 or slope <= 0 then return null; end if;
  if n = 9 and (cd->>'courseHoles')::int = 18 then cr := cr / 2; end if;
  hi := coalesce(rp.hcp_index, 54);
  ch := coalesce(rp.course_hcp, (private.hcp_for(cd, hi, 100)).ch);
  base := floor(ch::numeric / n)::int; rem := ch - base * n;
  for h in
    select (e.h->>'par')::int as par, row_number() over (order by (e.h->>'si')::int, e.i) as rk, s.strokes
    from jsonb_array_elements(cd->'holes') with ordinality e(h, i)
    left join hole_scores s on s.round_id = p_round and s.user_id = p_user and s.hole_index = e.i - 1
  loop
    if h.strokes is null then return null; end if;           -- carte incomplète
    recv := base + case when h.rk <= rem then 1 else 0 end;
    ndb := h.par + 2 + recv;
    ags := ags + case when h.strokes = 0 then ndb else least(h.strokes, ndb) end;
    got := got + 1;
  end loop;
  if got <> n then return null; end if;
  raw := 113 / slope * (ags - cr);
  if n = 9 then raw := raw + 0.52 * least(hi, 54) + 1.2; end if;
  return private.r1(raw);
end $$;

-- Calcul complet de l'index d'un joueur, carte après carte, dans l'ordre des dates.
create or replace function private.et_refresh(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare x record; diffs numeric[] := '{}'; adjs numeric[] := '{}'; rids uuid[] := '{}'; dates date[] := '{}';
        idx_hist numeric[] := '{}'; cur numeric := null; before numeric; d numeric; esr numeric; k int; cnt int;
        m int; tadj numeric; mean numeric; low numeric; val numeric; skipped int := 0; det jsonb := '[]'; used int[];
        i int; lo int;
begin
  if p_user is null then return; end if;
  if not exists (select 1 from profiles where id = p_user) then
    delete from et_index where profile_id = p_user; return;
  end if;
  for x in
    select p.round_id, p.hcp_index, r.play_date, private.round_diff(p.round_id, p.user_id) as diff
    from round_participants p join rounds r on r.id = p.round_id
    where p.user_id = p_user and p.submitted and p.status = 'yes'
    order by r.play_date, p.submitted_at nulls last, r.id
  loop
    if x.diff is null then skipped := skipped + 1; continue; end if;
    before := coalesce(cur, x.hcp_index, 54);
    diffs := diffs || x.diff; adjs := adjs || 0::numeric; rids := rids || x.round_id; dates := dates || x.play_date;
    k := array_length(diffs, 1);
    -- Score exceptionnel : 7 sous l'index en vigueur → −1, 10 sous → −2, sur les 20 dernières cartes.
    esr := case when x.diff <= before - 10 then -2 when x.diff <= before - 7 then -1 else 0 end;
    if esr <> 0 then
      for i in greatest(1, k - 19)..k loop adjs[i] := adjs[i] + esr; end loop;
    end if;
    lo := greatest(1, k - 19); cnt := k - lo + 1;
    if cnt < 3 then
      cur := null;
    else
      m := case when cnt <= 5 then 1 when cnt <= 8 then 2 when cnt <= 11 then 3 when cnt <= 14 then 4
                when cnt <= 16 then 5 when cnt <= 18 then 6 when cnt = 19 then 7 else 8 end;
      tadj := case cnt when 3 then -2 when 4 then -1 when 6 then -1 else 0 end;
      select avg(v) into mean from (select diffs[j] + adjs[j] as v from generate_series(lo, k) j order by 1 limit m) s;
      val := private.r1(mean + tadj);
      -- Plafonds : dès 20 cartes, hausse au-delà de +3 sur l'index le plus bas des 12 derniers mois freinée de moitié, +5 au maximum.
      if k >= 20 then
        select min(idx_hist[j]) into low from generate_series(1, k - 1) j
          where idx_hist[j] is not null and dates[j] > x.play_date - 365;
        if low is not null and val - low > 3 then
          val := private.r1(low + 3 + (val - low - 3) / 2);
          if val > low + 5 then val := low + 5; end if;
        end if;
      end if;
      cur := least(val, 54);
    end if;
    idx_hist := idx_hist || cur;
  end loop;

  k := coalesce(array_length(diffs, 1), 0);
  if k > 0 then
    lo := greatest(1, k - 19); cnt := k - lo + 1;
    m := case when cnt < 3 then 0 when cnt <= 5 then 1 when cnt <= 8 then 2 when cnt <= 11 then 3 when cnt <= 14 then 4
              when cnt <= 16 then 5 when cnt <= 18 then 6 when cnt = 19 then 7 else 8 end;
    select coalesce(array_agg(j), '{}') into used from (select j from generate_series(lo, k) j order by diffs[j] + adjs[j], j limit m) s;
    select coalesce(jsonb_agg(jsonb_build_object(
             'round', rids[j], 'date', dates[j], 'diff', diffs[j], 'adj', adjs[j],
             'inLast20', j >= lo, 'used', j = any(used), 'index', idx_hist[j]) order by j), '[]')
      into det from generate_series(1, k) j;
  end if;

  insert into et_index (profile_id, value, rounds, skipped, details, updated_at)
  values (p_user, cur, k, skipped, det, now())
  on conflict (profile_id) do update set value = excluded.value, rounds = excluded.rounds, skipped = excluded.skipped,
    details = excluded.details, updated_at = now();
end $$;

-- ---------------------------------------------------------------------
-- 4. Recalcul automatique : carte validée ou dévalidée, scores corrigés après validation, manche modifiée ou supprimée.
-- ---------------------------------------------------------------------
create or replace function private.et_on_rp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.submitted then perform private.et_refresh(old.user_id); end if;
    return old;
  end if;
  if new.submitted or (tg_op = 'UPDATE' and old.submitted) then perform private.et_refresh(new.user_id); end if;
  return new;
end $$;
drop trigger if exists et_on_rp on public.round_participants;
create trigger et_on_rp after insert or update or delete on public.round_participants
  for each row execute function private.et_on_rp();

create or replace function private.et_on_hs() returns trigger
language plpgsql security definer set search_path = public as $$
declare rid uuid := coalesce(new.round_id, old.round_id); uid uuid := coalesce(new.user_id, old.user_id);
begin
  if exists (select 1 from round_participants where round_id = rid and user_id = uid and submitted) then
    perform private.et_refresh(uid);
  end if;
  return null;
end $$;
drop trigger if exists et_on_hs on public.hole_scores;
create trigger et_on_hs after insert or update or delete on public.hole_scores
  for each row execute function private.et_on_hs();

create or replace function private.et_on_round() returns trigger
language plpgsql security definer set search_path = public as $$
declare u uuid;
begin
  for u in select user_id from round_participants where round_id = new.id and submitted loop
    perform private.et_refresh(u);
  end loop;
  return null;
end $$;
drop trigger if exists et_on_round on public.rounds;
create trigger et_on_round after update of course_snapshot, play_date on public.rounds
  for each row execute function private.et_on_round();

-- ---------------------------------------------------------------------
-- 5. Compétitions « Index Eagle Touch » : le handicap de jeu est fixé par la base,
--    à partir de l'Index Eagle Touch (ou de l'index déclaré tant qu'il n'existe pas).
--    L'administrateur garde la main pour un ajustement manuel.
-- ---------------------------------------------------------------------
create or replace function public.rp_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare src text; allow int; snap jsonb; g text; hi numeric; h record;
begin
  if auth.uid() is null or private.is_admin(new.competition_id) then return new; end if;
  if tg_op = 'INSERT' then
    new.hcp_manual := false; new.submitted := false; new.submitted_at := null; new.ntp_winner := false;
  else
    new.round_id := old.round_id; new.user_id := old.user_id; new.competition_id := old.competition_id;
    new.hcp_manual := old.hcp_manual;
    if auth.uid() <> old.user_id then new.status := old.status; end if;
    if old.hcp_manual or exists (select 1 from hole_scores s where s.round_id = old.round_id and s.user_id = old.user_id and s.strokes is not null) then
      new.hcp_index := old.hcp_index; new.course_hcp := old.course_hcp; new.playing_hcp := old.playing_hcp; new.card := old.card;
      return new;
    end if;
  end if;
  select c.hcp_source, c.allowance into src, allow from competitions c where c.id = new.competition_id;
  if src = 'eagle' then
    select r.course_snapshot into snap from rounds r where r.id = new.round_id;
    select p.gender, coalesce(e.value, p.handicap, 54) into g, hi
      from profiles p left join et_index e on e.profile_id = p.id where p.id = new.user_id;
    h := private.hcp_for(private.played_card(snap, new.card, g), coalesce(hi, 54), allow);
    new.hcp_index := coalesce(hi, 54); new.course_hcp := h.ch; new.playing_hcp := h.ph;
  end if;
  return new;
end $$;
revoke all on function public.rp_guard() from public, anon, authenticated;

revoke all on all functions in schema private from public, anon;
revoke all on function private.round_diff(uuid, uuid), private.et_refresh(uuid), private.et_on_rp(), private.et_on_hs(), private.et_on_round() from authenticated;
grant execute on function private.r1(numeric), private.played_card(jsonb, text, text), private.hcp_for(jsonb, numeric, int) to authenticated;

-- ---------------------------------------------------------------------
-- 6. Premier calcul pour tous les joueurs qui ont déjà des cartes validées.
-- ---------------------------------------------------------------------
do $$
declare u uuid;
begin
  for u in select distinct user_id from round_participants where submitted loop
    perform private.et_refresh(u);
  end loop;
end $$;

commit;


-- =====================================================================
-- Patch 010 inclus : contrôle strict des photos de profil.
-- =====================================================================
begin;

create or replace function private.photo_ok(p text) returns boolean
language plpgsql immutable set search_path = '' as $$
declare b bytea; n int; pos int := 2; mk int; seg int; w int := null; h int := null; guard int := 0; txt text;
begin
  if p is null then return true; end if;
  if length(p) > 120000 or p !~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$' then return false; end if;
  begin
    b := decode(substr(p, 24), 'base64');
  exception when others then return false;
  end;
  n := length(b);
  if n < 125 then return false; end if;
  -- Début (FF D8 FF) et fin (FF D9) d'un JPEG.
  if get_byte(b, 0) <> 255 or get_byte(b, 1) <> 216 or get_byte(b, 2) <> 255 then return false; end if;
  if get_byte(b, n - 2) <> 255 or get_byte(b, n - 1) <> 217 then return false; end if;
  -- Lecture des segments jusqu'au début de l'image pour trouver ses dimensions.
  while pos + 4 <= n and guard < 64 loop
    guard := guard + 1;
    if get_byte(b, pos) <> 255 then return false; end if;
    mk := get_byte(b, pos + 1);
    if mk = 255 then pos := pos + 1; continue; end if;           -- octets de remplissage
    if mk = 218 then exit; end if;                                -- SOS : début des données de l'image
    seg := get_byte(b, pos + 2) * 256 + get_byte(b, pos + 3);
    if seg < 2 or pos + 2 + seg > n then return false; end if;
    if mk between 192 and 207 and mk not in (196, 200, 204) and seg >= 7 then
      h := get_byte(b, pos + 5) * 256 + get_byte(b, pos + 6);
      w := get_byte(b, pos + 7) * 256 + get_byte(b, pos + 8);
    end if;
    pos := pos + 2 + seg;
  end loop;
  if w is null or h is null or w < 1 or h < 1 or w > 1024 or h > 1024 then return false; end if;
  -- Aucun morceau de page web ou de script caché dans les octets.
  txt := lower(encode(b, 'escape'));
  if txt ~ '<\s*(script|svg|html|iframe|object|embed|body|img|a\s)|<\?php|javascript:' then return false; end if;
  return true;
end $$;

create or replace function public.profiles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.email := '';
  if new.photo is not null and not private.photo_ok(new.photo) then
    raise exception 'invalid_photo' using errcode = '22023', hint = 'Photo de profil refusée : JPEG valide de 1024 pixels au maximum.';
  end if;
  return new;
end $$;
revoke all on function public.profiles_guard() from public, anon, authenticated;
revoke all on function private.photo_ok(text) from public, anon, authenticated;

-- Photos déjà enregistrées qui ne respectent pas ces règles : retirées (le profil est conservé).
alter table public.profiles disable trigger profiles_guard;
update public.profiles set photo = null where photo is not null and not private.photo_ok(photo);
alter table public.profiles enable trigger profiles_guard;

commit;
