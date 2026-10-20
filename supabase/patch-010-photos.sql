-- Eagle Touch, patch 010 : contrôle strict des photos de profil.
-- À exécuter une fois dans Supabase > SQL Editor > New query > Run, après le patch 009.
-- Peut être relancé sans risque.
--
-- L'application redessine chaque photo en un petit JPEG de 192 pixels avant de l'envoyer.
-- La base refuse désormais tout le reste, même envoyé sans passer par l'application :
--   - uniquement du JPEG, 120 000 caractères au maximum (environ 90 Ko) ;
--   - contenu réellement décodable, qui commence et finit comme un vrai JPEG ;
--   - dimensions lues dans l'image : 1024 pixels au maximum de chaque côté ;
--   - aucun fragment de page web ou de script caché dans le fichier (fichier « polyglotte »).

begin;

create or replace function private.photo_ok(p text) returns boolean
language plpgsql immutable set search_path = '' as $$
declare b bytea; n int; pos int := 2; mk int; seg int; w int := null; h int := null; guard int := 0; txt text;
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
    if mk between 192 and 207 and mk not in (196, 200, 204) and seg >= 7 then
      h := get_byte(b, pos + 5) * 256 + get_byte(b, pos + 6);
      w := get_byte(b, pos + 7) * 256 + get_byte(b, pos + 8);
    end if;
    pos := pos + 2 + seg;
  end loop;
  if w is null or h is null or w < 1 or h < 1 or w > 1024 or h > 1024 then return false; end if;
  -- Aucun morceau de page web ou de script caché dans les octets.
  txt := lower(encode(b, 'escape'));
  if txt ~ '<\s*(script|svg|html|iframe|object|embed|body|img|a\s)|<\?php|javascript:' then return false; end if;
  return true;
end $$;

create or replace function public.profiles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.email := '';
  if new.photo is not null and not private.photo_ok(new.photo) then
    raise exception 'invalid_photo' using errcode = '22023', hint = 'Photo de profil refusée : JPEG valide de 1024 pixels au maximum.';
  end if;
  return new;
end $$;
revoke all on function public.profiles_guard() from public, anon, authenticated;
revoke all on function private.photo_ok(text) from public, anon, authenticated;

-- Photos déjà enregistrées qui ne respectent pas ces règles : retirées (le profil est conservé).
alter table public.profiles disable trigger profiles_guard;
update public.profiles set photo = null where photo is not null and not private.photo_ok(photo);
alter table public.profiles enable trigger profiles_guard;

commit;
