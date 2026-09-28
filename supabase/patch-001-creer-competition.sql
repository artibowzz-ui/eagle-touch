-- Correctif 001 : tout le monde peut créer une compétition.
-- Cause : à la création, l'application enregistre le créateur comme administrateur.
-- La règle de lecture des membres exigeait d'être déjà membre, ce qui bloquait ce tout premier enregistrement.
-- À exécuter une fois dans Supabase : SQL Editor > New query > Run.

drop policy if exists members_read on public.competition_members;
create policy members_read on public.competition_members for select to authenticated
  using (public.is_member(competition_id) or user_id = auth.uid());

drop policy if exists members_update on public.competition_members;
create policy members_update on public.competition_members for update to authenticated
  using (public.is_admin(competition_id) or user_id = auth.uid())
  with check (public.is_admin(competition_id)
    or (user_id = auth.uid() and exists (select 1 from public.competitions c where c.id = competition_id and c.created_by = auth.uid())));

-- Répare les compétitions déjà créées sans leur administrateur.
insert into public.competition_members (competition_id, user_id, role)
select c.id, c.created_by, 'admin' from public.competitions c
where not exists (select 1 from public.competition_members m where m.competition_id = c.id and m.user_id = c.created_by)
on conflict (competition_id, user_id) do update set role = 'admin';
