# Eagle Touch

Site vitrine (`/`) et application de compétitions de golf (`/app`) dans un seul projet Next.js,
avec une base de données Supabase (PostgreSQL, comptes e-mail et mot de passe, temps réel).

## Mise en ligne (une seule fois)

### 1. Supabase : la base de données et les comptes
1. Sur supabase.com, ouvrez votre projet.
2. **SQL Editor > New query**, collez tout le contenu de `supabase/schema.sql`, cliquez **Run**.
   Vous devez voir « Success. No rows returned ».
3. **Project Settings > API** : notez la **Project URL** et la clé **anon public**.
4. **Authentication > URL Configuration** (à faire après l'étape 3, quand vous connaissez l'adresse Vercel) :
   - **Site URL** : `https://votre-site.vercel.app/app`
   - **Redirect URLs** : ajoutez `https://votre-site.vercel.app/app` et `https://votre-site.vercel.app/app#nouveau-mdp`
5. Facultatif : **Authentication > Emails** pour traduire en français les e-mails de confirmation
   et de réinitialisation du mot de passe.

### 2. GitHub : le code
Envoyez ce dossier dans votre dépôt `eagle-touch` (ou laissez Claude le pousser pour vous).

### 3. Vercel : l'hébergement
1. Sur vercel.com : **Add New > Project**, choisissez le dépôt `eagle-touch`, **Import**.
2. **Environment Variables** :
   - `NEXT_PUBLIC_SUPABASE_URL` = la Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = la clé anon public
3. **Deploy**. Le site est en ligne en 1 à 2 minutes.
4. Revenez à l'étape 1.4 avec l'adresse obtenue.

Chaque modification envoyée sur GitHub redéploie le site automatiquement.

## Développement local
```bash
npm install
cp .env.example .env.local   # puis remplir les deux valeurs Supabase
npm run dev                  # http://localhost:3000 et http://localhost:3000/app
```

## Structure
- `app/(site)/` : site vitrine (`/`), composants dans `components/`
- `app/(app)/app/` : application (`/app`), qui démarre `lib/eagle/eagle-app.js`
- `lib/eagle/eagle-app.js` : l'application (écrans, calcul Stableford, défis, annuaire, accès aux données)
- `lib/eagle/eagle.css` : styles de l'application, même système visuel que le site
- `lib/eagle/dir.json` : annuaire des golfs de Belgique et de France (OpenStreetMap, ODbL)
- `supabase/schema.sql` : tables, règles de sécurité, fonction « rejoindre avec un code », profil créé à l'inscription

## Mises à jour de la base
Après la première installation, exécutez aussi (une fois chacun, dans SQL Editor) :
- `supabase/patch-001-creer-competition.sql`
- `supabase/patch-002-manches-minimum.sql` (nombre minimum de manches par compétition)

## Base de données
Tables : `profiles`, `handicap_history`, `competitions`, `competition_members`, `golf_courses`,
`golf_holes`, `course_tees`, `rounds`, `round_participants`, `hole_scores`.

- L'index et le handicap de jeu utilisés sont figés dans `round_participants` ; le parcours est figé
  dans `rounds.course_snapshot`. Modifier son index ou un parcours ne change jamais un résultat passé.
- Les points Stableford, classements de manche, moyennes et défis sont recalculés à partir des coups.
- Règles d'accès : chacun voit les compétitions dont il est membre ; seul l'administrateur modifie la
  compétition et les manches ; chacun saisit sa carte, un participant peut tenir celle de ses partenaires,
  l'administrateur peut tout corriger.

## Photos du site vitrine
Les photos utilisent Picsum (aléatoire) en attendant de vraies images :
`components/Hero.tsx`, `components/PhotoBand.tsx`, `components/Challenges.tsx`.
