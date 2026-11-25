-- Eagle Touch, patch 011 : index de compétition.
-- À exécuter une fois dans Supabase > SQL Editor > New query > Run, après le patch 010.
-- Peut être relancé sans risque. Tout est fait en une seule opération : en cas d'erreur, rien ne change.
--
-- Règle unique :
--   - chaque joueur indique et met à jour son index dans son profil quand il veut ;
--   - quand il rejoint une compétition, cet index est figé comme index de départ dans cette compétition ;
--   - ensuite, l'index de la compétition évolue uniquement d'après ses cartes validées dans cette compétition,
--     selon le World Handicap System : moyenne des 8 meilleurs différentiels sur les 20 derniers,
--     double bogey net au maximum par trou, réduction pour score exceptionnel, hausse freinée (+3) et limitée (+5).
--   L'index de départ compte comme un historique de 20 cartes égales à lui : chaque nouvelle carte en remplace une,
--   comme pour un joueur dont l'index est établi.
--   - le handicap de jeu de chaque manche est calculé par la base à partir de cet index ; l'administrateur de la
--     compétition peut corriger un index de départ ou un handicap de jeu.
-- Remplace l'Index Eagle Touch et le choix « index déclaré / Index Eagle Touch » du patch 009.

begin;

-- ---------------------------------------------------------------------
-- 1. Index de chaque joueur dans chaque compétition. Écrit uniquement par la base.
-- ---------------------------------------------------------------------
create table if not exists public.league_index (
  competition_id uuid not null references public.competitions(id) on delete cascade,
  profile_id     uuid not null references public.profiles(id) on delete cascade,
  start_index    numeric(4,1) not null,
  start_at       timestamptz not null default now(),
  value          numeric(4,1) not null,
  rounds         int not null default 0,      -- cartes comptées dans cette compétition
  skipped        int not null default 0,      -- cartes validées non comptées (pas de course rating / slope, carte incomplète)
  details        jsonb not null default '{}'::jsonb,
  updated_at     timestamptz not null default now(),
  primary key (competition_id, profile_id)
);
create index if not exists league_index_profile_idx on public.league_index (profile_id);
alter table public.league_index enable row level security;
drop policy if exists league_index_read on public.league_index;
create policy league_index_read on public.league_index for select to authenticated
  using (private.is_member(competition_id) or profile_id = (select auth.uid()) or private.manages(profile_id));
revoke all on public.league_index from anon;
revoke insert, update, delete, truncate, references, trigger on public.league_index from authenticated;
grant select on public.league_index to authenticated;

-- ---------------------------------------------------------------------
-- 2. Calcul de l'index d'un joueur dans une compétition.
--    (private.round_diff, private.r1, private.played_card et private.hcp_for viennent du patch 009.)
-- ---------------------------------------------------------------------
create or replace function private.league_refresh(p_comp uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare li record; x record; seed numeric; d0 date;
        diffs numeric[]; adjs numeric[]; isreal boolean[]; rids uuid[]; dates date[]; idxv numeric[];
        hist_v numeric[]; hist_d date[]; cur numeric; before numeric; esr numeric; k int; lo int; i int;
        mean numeric; val numeric; low numeric; n_skip int := 0; nreal int := 0; used int[]; det jsonb := '[]';
begin
  select * into li from league_index where competition_id = p_comp and profile_id = p_user;
  if not found then return; end if;
  seed := li.start_index; d0 := li.start_at::date;
  -- Historique de départ : 20 différentiels égaux à l'index de départ.
  diffs := array_fill(seed, array[20]); adjs := array_fill(0::numeric, array[20]); isreal := array_fill(false, array[20]);
  rids := array_fill(null::uuid, array[20]); dates := array_fill(d0, array[20]); idxv := array_fill(null::numeric, array[20]);
  hist_v := array[seed]; hist_d := array[d0]; cur := seed;
  for x in
    select p.round_id, r.play_date, private.round_diff(p.round_id, p.user_id) as diff
    from round_participants p join rounds r on r.id = p.round_id
    where p.competition_id = p_comp and p.user_id = p_user and p.submitted and p.status = 'yes'
    order by r.play_date, p.submitted_at nulls last, r.id
  loop
    if x.diff is null then n_skip := n_skip + 1; continue; end if;
    before := cur;
    diffs := diffs || x.diff; adjs := adjs || 0::numeric; isreal := isreal || true; rids := rids || x.round_id;
    dates := dates || x.play_date; nreal := nreal + 1;
    k := array_length(diffs, 1); lo := k - 19;
    -- Score exceptionnel : 7 sous l'index en vigueur → −1, 10 sous → −2, sur les 20 derniers.
    esr := case when x.diff <= before - 10 then -2 when x.diff <= before - 7 then -1 else 0 end;
    if esr <> 0 then for i in lo..k loop adjs[i] := adjs[i] + esr; end loop; end if;
    select avg(v) into mean from (select diffs[j] + adjs[j] as v from generate_series(lo, k) j order by 1 limit 8) s;
    val := private.r1(mean);
    -- Hausse freinée au-delà de +3 sur l'index le plus bas des 12 derniers mois, limitée à +5.
    select min(hist_v[j]) into low from generate_series(1, array_length(hist_v, 1)) j where hist_d[j] > x.play_date - 365;
    if low is not null and val - low > 3 then
      val := private.r1(low + 3 + (val - low - 3) / 2);
      if val > low + 5 then val := low + 5; end if;
    end if;
    cur := greatest(-10, least(val, 54));
    idxv := idxv || cur; hist_v := hist_v || cur; hist_d := hist_d || x.play_date;
  end loop;

  k := array_length(diffs, 1); lo := k - 19;
  select coalesce(array_agg(j), '{}') into used from (select j from generate_series(lo, k) j order by diffs[j] + adjs[j], j limit 8) s;
  if nreal > 0 then
    select coalesce(jsonb_agg(jsonb_build_object('round', rids[j], 'date', dates[j], 'diff', diffs[j], 'adj', adjs[j],
             'inLast20', j >= lo, 'used', j = any(used), 'index', idxv[j]) order by j), '[]')
      into det from generate_series(21, k) j;
  end if;
  update league_index set value = cur, rounds = nreal, skipped = n_skip,
    details = jsonb_build_object('cards', det, 'seedLeft', greatest(0, 20 - nreal), 'seedUsed', (select count(*) from unnest(used) u where u <= 20)),
    updated_at = now()
  where competition_id = p_comp and profile_id = p_user;
end $$;

-- ---------------------------------------------------------------------
-- 3. Index figé à l'entrée dans une compétition (code, ajout par l'administrateur, création).
-- ---------------------------------------------------------------------
create or replace function private.league_on_member() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    delete from league_index where competition_id = old.competition_id and profile_id = old.user_id;
    return old;
  end if;
  insert into league_index (competition_id, profile_id, start_index, start_at, value)
  select new.competition_id, new.user_id, greatest(-10, least(coalesce(p.handicap, 54), 54)), now(), greatest(-10, least(coalesce(p.handicap, 54), 54))
  from profiles p where p.id = new.user_id
  on conflict (competition_id, profile_id) do nothing;
  return new;
end $$;
drop trigger if exists league_on_member on public.competition_members;
create trigger league_on_member after insert or delete on public.competition_members
  for each row execute function private.league_on_member();

-- ---------------------------------------------------------------------
-- 4. Recalcul automatique : carte validée ou dévalidée, scores corrigés après validation,
--    manche modifiée ou supprimée. Remplace les déclencheurs de l'Index Eagle Touch.
-- ---------------------------------------------------------------------
create or replace function private.et_on_rp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.submitted then perform private.league_refresh(old.competition_id, old.user_id); end if;
    return old;
  end if;
  if new.submitted or (tg_op = 'UPDATE' and old.submitted) then perform private.league_refresh(new.competition_id, new.user_id); end if;
  return new;
end $$;

create or replace function private.et_on_hs() returns trigger
language plpgsql security definer set search_path = public as $$
declare rid uuid := coalesce(new.round_id, old.round_id); uid uuid := coalesce(new.user_id, old.user_id); cid uuid;
begin
  select p.competition_id into cid from round_participants p where p.round_id = rid and p.user_id = uid and p.submitted;
  if cid is not null then perform private.league_refresh(cid, uid); end if;
  return null;
end $$;

create or replace function private.et_on_round() returns trigger
language plpgsql security definer set search_path = public as $$
declare u uuid;
begin
  for u in select user_id from round_participants where round_id = new.id and submitted loop
    perform private.league_refresh(new.competition_id, u);
  end loop;
  return null;
end $$;

-- ---------------------------------------------------------------------
-- 5. Handicap de jeu : toujours calculé par la base à partir de l'index de la compétition,
--    tant que le premier coup n'est pas joué. L'administrateur garde la main (ajustement manuel).
-- ---------------------------------------------------------------------
create or replace function public.rp_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare allow int; snap jsonb; g text; hi numeric; h record;
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
  select c.allowance into allow from competitions c where c.id = new.competition_id;
  select r.course_snapshot into snap from rounds r where r.id = new.round_id;
  select p.gender, coalesce(l.value, p.handicap, 54) into g, hi
    from profiles p left join league_index l on l.profile_id = p.id and l.competition_id = new.competition_id
    where p.id = new.user_id;
  h := private.hcp_for(private.played_card(snap, new.card, g), coalesce(hi, 54), allow);
  new.hcp_index := coalesce(hi, 54); new.course_hcp := h.ch; new.playing_hcp := h.ph;
  return new;
end $$;
revoke all on function public.rp_guard() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. Correction d'un index de départ par l'administrateur de la compétition (erreur de saisie).
-- ---------------------------------------------------------------------
create or replace function private.set_start_index(p_comp uuid, p_user uuid, p_value numeric) returns numeric
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not private.is_admin(p_comp) then raise exception 'not_allowed'; end if;
  if p_value is null or p_value < -10 or p_value > 54 then raise exception 'invalid_index'; end if;
  update league_index set start_index = round(p_value, 1) where competition_id = p_comp and profile_id = p_user;
  if not found then raise exception 'not_member'; end if;
  perform private.league_refresh(p_comp, p_user);
  return (select value from league_index where competition_id = p_comp and profile_id = p_user);
end $$;
drop function if exists public.set_start_index(uuid, uuid, numeric);
create function public.set_start_index(p_comp uuid, p_user uuid, p_value numeric) returns numeric
language sql security invoker set search_path = '' as $$ select private.set_start_index(p_comp, p_user, p_value); $$;
revoke all on function public.set_start_index(uuid, uuid, numeric) from public, anon;
grant execute on function public.set_start_index(uuid, uuid, numeric) to authenticated;

revoke all on all functions in schema private from public, anon;
revoke all on function private.league_refresh(uuid, uuid), private.league_on_member(), private.et_on_rp(), private.et_on_hs(), private.et_on_round() from authenticated;
grant execute on function private.set_start_index(uuid, uuid, numeric) to authenticated;

-- ---------------------------------------------------------------------
-- 7. Membres actuels : index de départ = index utilisé à leur première manche dans la compétition,
--    sinon leur index actuel. Puis calcul avec les cartes déjà validées.
-- ---------------------------------------------------------------------
insert into public.league_index (competition_id, profile_id, start_index, start_at, value)
select m.competition_id, m.user_id, s.v, coalesce(m.joined_at, now()), s.v
from public.competition_members m
join public.profiles p on p.id = m.user_id
cross join lateral (
  select greatest(-10, least(coalesce(
    (select e.hcp_index from public.round_participants e join public.rounds r on r.id = e.round_id
      where e.competition_id = m.competition_id and e.user_id = m.user_id and e.hcp_index is not null
      order by r.play_date, e.created_at limit 1),
    p.handicap, 54), 54)) as v
) s
on conflict (competition_id, profile_id) do nothing;

do $$
declare x record;
begin
  for x in select competition_id, profile_id from public.league_index loop
    perform private.league_refresh(x.competition_id, x.profile_id);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 8. Ancien Index Eagle Touch et ancien choix par compétition : supprimés.
-- ---------------------------------------------------------------------
drop function if exists private.et_refresh(uuid);
drop table if exists public.et_index;
alter table public.competitions drop constraint if exists competitions_hcp_source_chk;
alter table public.competitions drop column if exists hcp_source;

commit;
