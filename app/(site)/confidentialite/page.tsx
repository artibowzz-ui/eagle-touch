import type { Metadata } from "next";
import { LEGAL } from "@/lib/legal";
import { APP_URL } from "@/lib/season";

export const metadata: Metadata = {
  title: "Confidentialité et mentions légales · Eagle Touch",
  description: "Quelles données Eagle Touch enregistre, pourquoi, qui les voit, et comment exercer vos droits.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-8">
      <h2 className="text-xl font-semibold tracking-[-0.02em]">{title}</h2>
      <div className="mt-3 space-y-3 text-ink-2 [&_li]:ml-5 [&_li]:list-disc [&_strong]:font-semibold [&_strong]:text-ink [&_ul]:space-y-1.5">
        {children}
      </div>
    </section>
  );
}

export default function Confidentialite() {
  const mail = LEGAL.email.includes("@") ? (
    <a className="underline underline-offset-4" href={`mailto:${LEGAL.email}`}>
      {LEGAL.email}
    </a>
  ) : (
    LEGAL.email
  );
  return (
    <>
      <header className="border-b border-line/70">
        <div className="mx-auto flex h-16 max-w-[820px] items-center justify-between px-4 md:px-8">
          <a href="/" className="text-[17px] font-semibold tracking-[-0.02em]">
            Eagle Touch
          </a>
          <a href={APP_URL} className="text-sm font-medium underline decoration-line decoration-2 underline-offset-[6px]">
            Ouvrir l&apos;application
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-[820px] px-4 pb-20 pt-10 leading-relaxed md:px-8 md:pt-16">
        <h1 className="text-[2rem] leading-[1.08] font-semibold tracking-[-0.035em] md:text-5xl">
          Confidentialité et mentions légales
        </h1>
        <p className="mt-4 max-w-[62ch] text-ink-2">
          Eagle Touch sert à organiser des compétitions de golf entre amis. Cette page explique quelles données
          sont enregistrées, pourquoi, qui peut les voir, et comment les consulter ou les supprimer.
        </p>
        <p className="mt-2 text-sm text-ink-3">Dernière mise à jour : {LEGAL.miseAJour}</p>

        <div className="mt-10">
          <Section title="Qui est responsable de vos données">
            <p>
              Le responsable du traitement, au sens du Règlement général sur la protection des données (RGPD), est :
            </p>
            <p>
              <strong>{LEGAL.responsable}</strong>
              <br />
              {LEGAL.adresse}
              {LEGAL.numeroEntreprise ? (
                <>
                  <br />
                  Numéro d&apos;entreprise : {LEGAL.numeroEntreprise}
                </>
              ) : null}
              <br />
              Contact : {mail}
            </p>
          </Section>

          <Section title="Les données enregistrées">
            <ul>
              <li>
                <strong>Votre compte :</strong> adresse e-mail et mot de passe. Le mot de passe est conservé sous
                forme hachée : personne ne peut le lire, pas même le responsable du site.
              </li>
              <li>
                <strong>Votre profil de joueur :</strong> prénom, nom, index et historique de votre index, cartes de
                score utilisées (hommes ou dames), et une photo si vous en ajoutez une.
              </li>
              <li>
                <strong>Votre activité de jeu :</strong> compétitions rejointes, réponses aux manches, coups par
                trou, résultats des défis, handicap de jeu utilisé à chaque manche.
              </li>
              <li>
                <strong>Ce que vous créez :</strong> compétitions, manches, et golfs que vous ajoutez à la liste
                partagée.
              </li>
              <li>
                <strong>Données techniques :</strong> comme tout site, l&apos;hébergeur reçoit votre adresse IP et
                des informations sur votre navigateur pour acheminer les pages et protéger le service.
              </li>
            </ul>
            <p>
              Eagle Touch n&apos;enregistre ni votre position, ni vos contacts, ni aucune donnée de paiement, et ne
              contient ni publicité ni outil de suivi publicitaire.
            </p>
          </Section>

          <Section title="Pourquoi, et sur quelle base">
            <ul>
              <li>
                <strong>Fournir le service que vous demandez</strong> (créer un compte, participer à une
                compétition, calculer les classements) : exécution du contrat, article 6.1.b du RGPD.
              </li>
              <li>
                <strong>Protéger le service</strong> (prévention des abus, sécurité des comptes) : intérêt légitime,
                article 6.1.f du RGPD.
              </li>
            </ul>
            <p>Vos données ne sont ni vendues, ni utilisées à des fins publicitaires, ni soumises à une décision automatisée.</p>
          </Section>

          <Section title="Qui voit quoi">
            <ul>
              <li>
                <strong>Les joueurs de vos compétitions</strong> voient votre prénom, votre nom, votre photo, votre
                index et vos résultats dans ces compétitions.
              </li>
              <li>
                <strong>Votre adresse e-mail</strong> n&apos;est visible par aucun autre joueur.
              </li>
              <li>
                <strong>Les golfs que vous ajoutez</strong> sont visibles par tous les utilisateurs, avec votre nom
                uniquement pour les joueurs de vos compétitions.
              </li>
              <li>
                <strong>L&apos;administrateur d&apos;une compétition</strong> peut corriger les inscriptions et les
                cartes de cette compétition.
              </li>
              <li>
                <strong>Le responsable du site</strong> a un accès technique à la base de données pour la faire
                fonctionner et la dépanner.
              </li>
            </ul>
          </Section>

          <Section title="Hébergement et sous-traitants">
            <ul>
              <li>
                <strong>Supabase</strong> : base de données et gestion des comptes. Région du projet :{" "}
                {LEGAL.regionBase}.
              </li>
              <li>
                <strong>Vercel</strong> : hébergement du site et de l&apos;application, y compris les photos
                d&apos;illustration, qui vous sont servies par ce site.
              </li>
            </ul>
            <p>
              Ces prestataires agissent sur instruction du responsable et sont liés par un contrat de
              sous-traitance. Ce sont des sociétés établies aux États-Unis : lorsque des données sont traitées hors
              de l&apos;Espace économique européen, ce transfert est encadré par les clauses contractuelles types de
              la Commission européenne ou par le cadre de protection des données UE-États-Unis.
            </p>
          </Section>

          <Section title="Combien de temps">
            <ul>
              <li>Vos données sont conservées tant que votre compte existe.</li>
              <li>
                Quand vous supprimez votre compte, votre profil, votre historique d&apos;index, vos inscriptions et
                vos cartes de score sont effacés immédiatement. Les sauvegardes techniques de l&apos;hébergeur
                disparaissent ensuite selon son cycle habituel.
              </li>
              <li>Les golfs que vous avez partagés restent disponibles, sans votre nom.</li>
            </ul>
          </Section>

          <Section title="Vos droits">
            <p>Vous pouvez à tout moment :</p>
            <ul>
              <li>
                <strong>consulter et corriger</strong> vos données dans l&apos;onglet Profil ;
              </li>
              <li>
                <strong>en obtenir une copie</strong> : Profil, puis « Télécharger mes données » ;
              </li>
              <li>
                <strong>supprimer votre compte</strong> et vos données : Profil, puis « Supprimer mon compte » ;
              </li>
              <li>
                demander la <strong>limitation</strong> d&apos;un traitement ou vous y <strong>opposer</strong>, en
                écrivant à l&apos;adresse de contact ci-dessus.
              </li>
            </ul>
            <p>Une réponse vous est donnée dans un délai d&apos;un mois.</p>
            <p>
              Si vous estimez que vos droits ne sont pas respectés, vous pouvez introduire une réclamation auprès de
              l&apos;<strong>Autorité de protection des données</strong>, rue de la Presse 35, 1000 Bruxelles,{" "}
              <a className="underline underline-offset-4" href="https://www.autoriteprotectiondonnees.be" rel="noopener">
                www.autoriteprotectiondonnees.be
              </a>
              .
            </p>
          </Section>

          <Section title="Cookies et stockage sur votre appareil">
            <p>
              Eagle Touch n&apos;utilise aucun cookie publicitaire ni de mesure d&apos;audience. L&apos;application
              enregistre uniquement sur votre appareil ce qui est strictement nécessaire à son fonctionnement : votre
              session de connexion, votre choix d&apos;apparence (clair ou sombre) et le brouillon d&apos;une manche en
              cours de création. Ces éléments ne demandent pas de consentement et disparaissent quand vous vous
              déconnectez ou effacez les données du site dans votre navigateur.
            </p>
          </Section>

          <Section title="Joueurs sans compte">
            <p>
              L&apos;administrateur d&apos;une compétition peut ajouter un joueur qui n&apos;a pas de compte, avec
              son prénom, son nom et son index. C&apos;est à cet administrateur d&apos;en informer la personne
              concernée, qui peut demander la correction ou la suppression de ces données à l&apos;administrateur ou
              à l&apos;adresse de contact ci-dessus.
            </p>
          </Section>

          <Section title="Mineurs">
            <p>
              Eagle Touch s&apos;adresse aux personnes de 13 ans et plus. En dessous de 13 ans, un compte ne peut
              être créé qu&apos;avec l&apos;accord d&apos;un parent ou du représentant légal (article 7 de la loi
              belge du 30 juillet 2018).
            </p>
          </Section>

          <Section title="Sécurité">
            <p>
              Les échanges sont chiffrés (HTTPS). La base de données applique des règles d&apos;accès par
              utilisateur : chacun ne peut lire que les compétitions dont il est membre. En cas de violation de
              données présentant un risque pour vous, vous en serez informé et l&apos;Autorité de protection des
              données sera prévenue dans les délais légaux.
            </p>
          </Section>

          <Section title="Mentions légales">
            <p>
              Site édité par {LEGAL.responsable}, {LEGAL.adresse}. Contact : {mail}. Hébergement : Vercel Inc.
              Base de données : Supabase Inc.
            </p>
            <p>
              Les données de l&apos;annuaire des golfs proviennent d&apos;OpenStreetMap (© contributeurs
              OpenStreetMap, licence ODbL).
            </p>
          </Section>

          <Section title="Modifications">
            <p>
              Cette page peut évoluer avec l&apos;application. La date en haut de page indique la dernière mise à
              jour.
            </p>
          </Section>
        </div>
      </main>
      <footer className="mx-auto flex max-w-[820px] items-center justify-between px-4 py-10 text-sm text-ink-3 md:px-8">
        <a href="/" className="font-semibold tracking-[-0.02em] text-ink">
          Eagle Touch
        </a>
        <p>© 2026 Eagle Touch</p>
      </footer>
    </>
  );
}
