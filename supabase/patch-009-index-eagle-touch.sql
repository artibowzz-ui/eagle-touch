-- Eagle Touch, patch 009 : Index Eagle Touch (calcul inspiré du World Handicap System).
-- À exécuter une fois dans Supabase > SQL Editor > New query > Run, après le patch 008.
-- Peut être relancé sans risque. Tout est fait en une seule opération : en cas d'erreur, rien ne change.
--
-- Chaque carte validée donne un « différentiel » :
--   score ajusté (double bogey net au maximum par trou) − course rating, × 113 / slope.
--   Sur 9 trous, le différentiel des 9 trous joués est complété par un différentiel attendu
--   pour les 9 autres (0,52 × index + 1,2 : approximation, la formule officielle n'est pas publiée).
-- L'index = moyenne des meilleurs différentiels parmi les 20 derniers (table officielle sous 20 cartes,
-- à partir de 3 cartes), avec réduction pour score exceptionnel et plafonds de hausse (+3 freiné, +5 maximum).
-- Le calcul est fait par la base : personne ne peut le modifier depuis l'application.
-- Ce n'est pas un index officiel : seules les cartes jouées dans Eagle Touch comptent.

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
