-- Eagle Touch, patch 003 : clubs de plus de 18 trous (27, 36, 45 ou 54 trous),
-- découpés en 9 trous et combinés en plusieurs parcours.
-- À exécuter une fois dans Supabase > SQL Editor > New query > Run.
alter table public.golf_courses drop constraint if exists golf_courses_holes_count_check;
alter table public.golf_courses add constraint golf_courses_holes_count_check check (holes_count in (9,18,27,36,45,54));
alter table public.golf_holes drop constraint if exists golf_holes_number_check;
alter table public.golf_holes add constraint golf_holes_number_check check (number between 1 and 54);
-- { "nines": ["Les Pins", "Le Lac", ...], "layouts": [{ "name": "Championship", "nines": [0, 1] }, ...] }
alter table public.golf_courses add column if not exists sections jsonb;
