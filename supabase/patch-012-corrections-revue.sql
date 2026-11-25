-- Eagle Touch, patch 012 : corrections issues de la revue de code.
-- À exécuter une fois dans Supabase > SQL Editor > New query > Run, après le patch 011.
-- Peut être relancé sans risque. Tout est fait en une seule opération : en cas d'erreur, rien ne change.
--
--  1. Une inscription à une manche ne peut plus être déplacée vers une autre compétition
--     (un joueur pouvait sortir la carte d'un autre joueur de la compétition).
--  2. Une ligne de membre ne peut plus changer de joueur ni de compétition, et le créateur d'une
--     compétition ne peut plus être remplacé depuis l'application (un administrateur pouvait
--     y faire entrer n'importe quel compte).
--  3. Index de compétition : verrou contre deux recalculs simultanés, recalcul seulement quand
--     un champ utile change, recalcul immédiat quand un joueur revient dans une compétition.
--  4. Photos : le contrôle de contenu caché ne lit plus que les métadonnées de l'image
--     (il refusait par hasard environ une photo valable sur cent).
--  5. Un joueur retiré d'une compétition ne peut plus modifier ses scores.
--  6. Suppression de compte : les joueurs sans compte gérés sont confiés à un administrateur de
--     leur compétition, et une compétition ne reste jamais sans administrateur.
--  7. Code d'invitation : le nombre d'essais est compté même avec des demandes simultanées.

begin;

-- 1 et 3 : recalcul de l'index et garde des inscriptions
create or replace function private.league_refresh(p_comp uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare li record; x record; seed numeric; d0 date;
        diffs numeric[]; adjs numeric[]; isreal boolean[]; rids uuid[]; dates date[]; idxv numeric[];
        hist_v numeric[]; hist_d date[]; cur numeric; before numeric; esr numeric; k int; lo int; i int;
        mean numeric; val numeric; low numeric; n_skip int := 0; nreal int := 0; used int[]; det jsonb := '[]';
begin
  -- Verrou : deux cartes validées en même temps pour le même joueur ne s'écrasent pas.
  select * into li from league_index where competition_id = p_comp and profile_id = p_user for update;
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

create or replace function public.rp_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare allow int; cid uuid; snap jsonb; g text; hi numeric; h record;
begin
  -- La compétition d'une inscription est toujours celle de sa manche, et une inscription ne change
  -- jamais de manche ni de joueur (empêche de déplacer la carte d'un autre joueur ailleurs).
  if tg_op = 'UPDATE' then
    new.round_id := old.round_id; new.user_id := old.user_id;
  end if;
  select r.competition_id into cid from rounds r where r.id = new.round_id;
  if cid is null then raise exception 'unknown_round'; end if;
  new.competition_id := cid;
  if auth.uid() is null or private.is_admin(cid) then return new; end if;
  if tg_op = 'INSERT' then
    new.hcp_manual := false; new.submitted := false; new.submitted_at := null; new.ntp_winner := false;
  else
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

create or replace function private.photo_ok(p text) returns boolean
language plpgsql immutable set search_path = '' as $$
declare b bytea; n int; pos int := 2; mk int; seg int; w int := null; h int := null; guard int := 0; meta text := '';
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
    -- Segments de métadonnées (APP0 à APP15, commentaire) : c'est là qu'un fichier piégé cacherait du texte.
    if (mk between 224 and 239) or mk = 254 then
      meta := meta || lower(encode(substring(b from pos + 5 for seg - 2), 'escape'));
    end if;
    if mk between 192 and 207 and mk not in (196, 200, 204) and seg >= 7 then
      h := get_byte(b, pos + 5) * 256 + get_byte(b, pos + 6);
      w := get_byte(b, pos + 7) * 256 + get_byte(b, pos + 8);
    end if;
    pos := pos + 2 + seg;
  end loop;
  if w is null or h is null or w < 1 or h < 1 or w > 1024 or h > 1024 then return false; end if;
  -- Aucun morceau de page web ou de script caché dans les octets.
  if meta ~ '<\s*(script|svg|html|iframe|object|embed|body|img|a\s)|<\?php|javascript:' then return false; end if;
  return true;
end $$;

drop policy if exists rp_update on public.round_participants;
create policy rp_update on public.round_participants for update to authenticated
  using (private.is_member(competition_id) and private.can_score(round_id, user_id))
  with check (exists (select 1 from public.rounds r where r.id = round_id and r.competition_id = round_participants.competition_id));

create or replace function private.et_on_rp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.submitted then perform private.league_refresh(old.competition_id, old.user_id); end if;
    return old;
  end if;
  if tg_op = 'INSERT' then
    if new.submitted then perform private.league_refresh(new.competition_id, new.user_id); end if;
    return new;
  end if;
  -- Seuls ces champs changent le différentiel d'une carte validée.
  if (new.submitted or old.submitted) and (new.submitted is distinct from old.submitted or new.status is distinct from old.status
      or new.card is distinct from old.card or new.course_hcp is distinct from old.course_hcp or new.hcp_index is distinct from old.hcp_index) then
    perform private.league_refresh(new.competition_id, new.user_id);
  end if;
  return new;
end $$;

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
  -- Retour dans une compétition : ses cartes déjà validées comptent tout de suite.
  perform private.league_refresh(new.competition_id, new.user_id);
  return new;
end $$;

-- 2 : membres et créateur figés pour les requêtes venant de l'application
-- Fonctions « invoker » : current_user vaut 'authenticated' pour une requête de l'application,
-- et le propriétaire de la fonction quand la modification vient d'une fonction interne (suppression de compte).
create or replace function private.members_freeze() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if current_user = 'authenticated' then
    if new.user_id is distinct from old.user_id or new.competition_id is distinct from old.competition_id then
      raise exception 'member_row_frozen';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists members_freeze on public.competition_members;
create trigger members_freeze before update on public.competition_members
  for each row execute function private.members_freeze();

create or replace function private.competitions_freeze() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if current_user = 'authenticated' and new.created_by is distinct from old.created_by then
    new.created_by := old.created_by;
  end if;
  return new;
end $$;
drop trigger if exists competitions_freeze on public.competitions;
create trigger competitions_freeze before update on public.competitions
  for each row execute function private.competitions_freeze();

-- 5 : un joueur retiré de la compétition ne modifie plus ses scores
create or replace function private.can_score(rid uuid, uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from rounds r where r.id = rid and private.is_admin(r.competition_id))
      or (
        exists (select 1 from rounds r where r.id = rid and r.status = 'open' and private.is_member(r.competition_id))
        and not exists (select 1 from round_participants t where t.round_id = rid and t.user_id = uid and t.submitted)
        and (uid = auth.uid()
             or exists (select 1 from round_participants p where p.round_id = rid and p.user_id = auth.uid() and p.status = 'yes'))
      );
$$;

-- 6 : suppression de compte
create or replace function private.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c record; heir uuid; g record;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  -- Compétitions où je suis le dernier administrateur (créées par moi ou non) : un autre joueur avec compte prend le relais.
  for c in
    select distinct m.competition_id as id from competition_members m
    where m.user_id = me and (m.role = 'admin' or exists (select 1 from competitions x where x.id = m.competition_id and x.created_by = me))
  loop
    heir := null;
    if not exists (select 1 from competition_members a join profiles p on p.id = a.user_id
                   where a.competition_id = c.id and a.role = 'admin' and a.user_id <> me and p.managed_by is null) then
      select m.user_id into heir
        from competition_members m join profiles p on p.id = m.user_id
        where m.competition_id = c.id and m.user_id <> me and p.managed_by is null
        order by m.joined_at limit 1;
      if heir is null then
        delete from competitions where id = c.id and created_by = me;
        continue;
      end if;
      update competition_members set role = 'admin' where competition_id = c.id and user_id = heir;
    else
      select a.user_id into heir from competition_members a join profiles p on p.id = a.user_id
        where a.competition_id = c.id and a.role = 'admin' and a.user_id <> me and p.managed_by is null
        order by a.joined_at limit 1;
    end if;
    update competitions set created_by = heir where id = c.id and created_by = me;
  end loop;
  -- Joueurs sans compte que je gérais : confiés à un administrateur de leur compétition, sinon supprimés.
  for g in select id from profiles where managed_by = me loop
    select a.user_id into heir from competition_members m
      join competition_members a on a.competition_id = m.competition_id and a.role = 'admin' and a.user_id <> me
      join profiles ap on ap.id = a.user_id and ap.managed_by is null
      where m.user_id = g.id order by a.joined_at limit 1;
    if heir is null then delete from profiles where id = g.id;
    else update profiles set managed_by = heir where id = g.id; end if;
  end loop;
  update golf_courses set created_by = null where created_by = me;
  delete from join_attempts where user_id = me;
  delete from profiles where id = me;
  delete from auth.users where id = me;
end $$;

-- 7 : essais de code comptés un par un
create or replace function private.join_competition(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare cid uuid; n int;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  perform pg_advisory_xact_lock(hashtext('join:' || auth.uid()::text));
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

revoke all on all functions in schema private from public, anon;
revoke all on function private.league_refresh(uuid, uuid), private.league_on_member(), private.et_on_rp(), private.et_on_hs(), private.et_on_round(),
  private.members_freeze(), private.competitions_freeze(), private.round_diff(uuid, uuid), private.photo_ok(text) from authenticated;
grant execute on function private.is_member(uuid), private.is_admin(uuid), private.shares_competition(uuid), private.manages(uuid),
  private.is_app_admin(), private.can_score(uuid, uuid), private.join_competition(text), private.delete_my_account(),
  private.set_start_index(uuid, uuid, numeric), private.r1(numeric), private.played_card(jsonb, text, text), private.hcp_for(jsonb, numeric, int) to authenticated;
revoke all on function public.rp_guard(), public.profiles_guard() from public, anon, authenticated;

commit;
