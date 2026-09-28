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
  holes_count int  not null check (holes_count in (9,18)),
  par         int  not null,
  source      text,                                          -- référence annuaire
  created_by  uuid not null references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.golf_holes (
  course_id    uuid not null references public.golf_courses(id) on delete cascade,
  number       int  not null check (number between 1 and 18),
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
  hole_distances int[]
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
begin
  insert into profiles (id, first_name, last_name, email, handicap)
  values (new.id, coalesce(new.raw_user_meta_data->>'first_name', ''), coalesce(new.raw_user_meta_data->>'last_name', ''), coalesce(new.email, ''), h)
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
  using (public.is_member(competition_id));
create policy members_insert on public.competition_members for insert to authenticated
  with check (
    public.is_admin(competition_id)
    or (user_id = auth.uid() and role = 'admin'
        and exists (select 1 from competitions c where c.id = competition_id and c.created_by = auth.uid())));
create policy members_delete on public.competition_members for delete to authenticated
  using (public.is_admin(competition_id));

-- Parcours : partagés entre tous les utilisateurs, modifiables par leur créateur.
create policy courses_read on public.golf_courses for select to authenticated using (true);
create policy courses_insert on public.golf_courses for insert to authenticated with check (created_by = auth.uid());
create policy courses_update on public.golf_courses for update to authenticated using (created_by = auth.uid());
create policy courses_delete on public.golf_courses for delete to authenticated using (created_by = auth.uid());

create policy holes_read on public.golf_holes for select to authenticated using (true);
create policy holes_write on public.golf_holes for all to authenticated
  using (exists (select 1 from golf_courses c where c.id = course_id and c.created_by = auth.uid()))
  with check (exists (select 1 from golf_courses c where c.id = course_id and c.created_by = auth.uid()));
create policy tees_read on public.course_tees for select to authenticated using (true);
create policy tees_write on public.course_tees for all to authenticated
  using (exists (select 1 from golf_courses c where c.id = course_id and c.created_by = auth.uid()))
  with check (exists (select 1 from golf_courses c where c.id = course_id and c.created_by = auth.uid()));

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
