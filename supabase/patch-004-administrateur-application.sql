-- Eagle Touch, patch 004 : administrateurs de l'application.
-- Un administrateur peut corriger ou supprimer n'importe quel parcours partagé.
-- À exécuter une fois dans Supabase > SQL Editor > New query > Run.
-- La liste des administrateurs ne se modifie qu'ici (aucune règle d'écriture depuis l'application).

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
drop policy if exists courses_insert on public.golf_courses;
create policy courses_insert on public.golf_courses for insert to authenticated
  with check (created_by = auth.uid() or public.is_app_admin());
drop policy if exists courses_update on public.golf_courses;
create policy courses_update on public.golf_courses for update to authenticated
  using (created_by = auth.uid() or public.is_app_admin());
drop policy if exists courses_delete on public.golf_courses;
create policy courses_delete on public.golf_courses for delete to authenticated
  using (created_by = auth.uid() or public.is_app_admin());
drop policy if exists holes_write on public.golf_holes;
create policy holes_write on public.golf_holes for all to authenticated
  using (public.is_app_admin() or exists (select 1 from golf_courses c where c.id = course_id and c.created_by = auth.uid()))
  with check (public.is_app_admin() or exists (select 1 from golf_courses c where c.id = course_id and c.created_by = auth.uid()));
drop policy if exists tees_write on public.course_tees;
create policy tees_write on public.course_tees for all to authenticated
  using (public.is_app_admin() or exists (select 1 from golf_courses c where c.id = course_id and c.created_by = auth.uid()))
  with check (public.is_app_admin() or exists (select 1 from golf_courses c where c.id = course_id and c.created_by = auth.uid()));

-- Premier administrateur : remplacez l'adresse ci-dessous par l'e-mail de votre compte Eagle Touch avant d'exécuter.
insert into public.app_admins (user_id)
  select id from auth.users where lower(email) = lower('VOTRE-EMAIL@exemple.com')
  on conflict do nothing;

-- Vérification : doit afficher votre adresse.
select u.email as administrateur from public.app_admins a join auth.users u on u.id = a.user_id;
