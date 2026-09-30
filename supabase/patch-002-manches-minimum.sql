-- Eagle Touch, patch 002 : nombre minimum de manches par compétition.
-- À exécuter une fois dans Supabase > SQL Editor > New query > Run.
-- 0 = pas de minimum. À la date de fin de la saison, un joueur ayant joué
-- moins de manches que ce minimum est éliminé du classement général.
alter table public.competitions
  add column if not exists min_rounds int not null default 0 check (min_rounds between 0 and 50);
