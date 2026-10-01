-- Eagle Touch, patch 007 : droit à l'effacement (RGPD, article 17).
-- À exécuter une fois dans Supabase > SQL Editor > New query > Run.
-- Ajoute la fonction « supprimer mon compte », appelée depuis le profil.

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
