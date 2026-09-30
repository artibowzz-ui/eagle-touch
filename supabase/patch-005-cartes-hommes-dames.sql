-- Eagle Touch, patch 005 : cartes de score hommes / dames (jusqu'à 7 par club).
-- À exécuter une fois dans Supabase > SQL Editor > New query > Run.

-- Genre de jeu du joueur : cartes hommes (M) ou dames (F).
alter table public.profiles add column if not exists gender text check (gender in ('M','F'));

-- Chaque départ devient une carte : genre, parcours du club, par et index propres (vides = carte de référence).
alter table public.course_tees add column if not exists gender text not null default 'M' check (gender in ('M','F'));
alter table public.course_tees add column if not exists layout text;
alter table public.course_tees add column if not exists pars int[];
alter table public.course_tees add column if not exists stroke_indexes int[];

-- Carte jouée par chaque participant, figée pour la manche.
alter table public.round_participants add column if not exists card text;

-- Le genre choisi à l'inscription est enregistré dans le profil.
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
