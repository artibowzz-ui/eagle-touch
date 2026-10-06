-- Eagle Touch, patch 008 : traite les avertissements du « Security Advisor » de Supabase.
-- À exécuter une fois dans Supabase > SQL Editor > New query > Run, après les patchs 001 à 007.
-- Peut être relancé sans risque. Tout est fait en une seule opération : en cas d'erreur, rien ne change.
--
-- Ce patch ne change aucune règle du jeu ni aucun droit des joueurs. Il change la façon dont
-- les règles sont écrites :
--   1. les fonctions internes quittent le schéma public (elles n'étaient pas dangereuses, mais
--      n'importe qui pouvait les appeler directement par l'adresse /rest/v1/rpc/...) ;
--   2. les visiteurs non connectés n'ont plus aucun droit sur les tables ;
--   3. les règles d'accès sont réécrites pour être évaluées une fois par requête et non par ligne ;
--   4. une seule règle de lecture par table ;
--   5. des index sur les clés étrangères ;
--   6. l'interface GraphQL, que l'application n'utilise pas, est désactivée.

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
             and p.proname in ('handle_new_user', 'profiles_guard', 'rp_guard', 'competitions_code_guard', 'gen_code') loop
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

-- ---------------------------------------------------------------------
-- 7. GraphQL : l'application ne l'utilise pas. Le désactiver retire les avertissements
--    « table exposée via GraphQL ». Sans effet si l'extension n'est pas installée.
-- ---------------------------------------------------------------------
do $$ begin
  drop extension if exists pg_graphql;
exception when others then
  raise notice 'pg_graphql non désactivé (%). Désactivez-le dans Database > Extensions.', sqlerrm;
end $$;
