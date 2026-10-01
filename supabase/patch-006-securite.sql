-- Eagle Touch, patch 006 : renforcement de la sécurité (audit).
-- À exécuter une fois dans Supabase > SQL Editor > New query > Run.
-- Peut être relancé sans risque.

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
