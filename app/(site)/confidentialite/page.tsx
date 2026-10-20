import type { Metadata } from "next";
import { LEGAL } from "@/lib/legal";
import { LegalPage, Section, ContactMail } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Confidentialité et mentions légales · Eagle Touch",
  description: "Quelles données Eagle Touch enregistre, pourquoi, qui les voit, et comment exercer vos droits.",
};

export default function Confidentialite() {
  const mail = <ContactMail />;
  return (
    <LegalPage
      title="Confidentialité et mentions légales"
      updated={LEGAL.miseAJour}
      intro={
        <p>
          Eagle Touch sert à organiser des compétitions de golf entre amis. Cette page explique quelles données sont
          enregistrées, pourquoi, qui peut les voir, et comment les consulter ou les supprimer. L&apos;utilisation du
          service est encadrée par les <a className="underline underline-offset-4" href="/conditions">conditions d&apos;utilisation</a>.
        </p>
      }
    >
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
                trou, résultats des défis, handicap de jeu utilisé à chaque manche, et l&apos;Index Eagle Touch
                calculé à partir de vos cartes validées (visible par les membres de vos compétitions).
              </li>
              <li>
                <strong>Ce que vous créez :</strong> compétitions, manches, et golfs que vous ajoutez à la liste
                partagée.
              </li>
              <li>
                <strong>Données techniques :</strong> comme tout site, les hébergeurs reçoivent votre adresse IP et
                des informations sur votre navigateur pour acheminer les pages et protéger le service. Les essais de
                code d&apos;invitation erronés sont notés avec votre compte pendant au plus un jour, pour bloquer les
                tentatives de deviner un code.
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
            <p>
              Vos données ne sont ni vendues, ni utilisées à des fins publicitaires. L&apos;Index Eagle Touch est
              calculé automatiquement à partir de vos cartes ; il ne sert qu&apos;à fixer les handicaps de jeu dans les
              compétitions dont l&apos;administrateur l&apos;a choisi, et cet administrateur peut toujours ajuster un
              handicap à la main. Aucune autre décision automatisée n&apos;est prise à votre sujet.
            </p>
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
              <li>
                <strong>Brevo</strong> (Sendinblue SAS, France) : envoi des e-mails du service, c&apos;est-à-dire la
                confirmation de votre adresse et le code de changement de mot de passe. Brevo reçoit votre adresse
                e-mail et le contenu de ces messages.
              </li>
            </ul>
            <p>
              Ces prestataires agissent sur instruction du responsable et sont liés par un contrat de
              sous-traitance. Supabase et Vercel sont des sociétés établies aux États-Unis : lorsque des données sont
              traitées hors de l&apos;Espace économique européen, ce transfert est encadré par les clauses
              contractuelles types de la Commission européenne ou par le cadre de protection des données
              UE-États-Unis. Aucune donnée n&apos;est transmise à d&apos;autres tiers, sauf obligation légale.
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
              <li>
                Les journaux techniques des hébergeurs (adresses IP, erreurs) sont conservés pour une durée limitée
                fixée par chaque hébergeur, en général quelques jours à quelques semaines.
              </li>
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
                demander la <strong>limitation</strong> d&apos;un traitement, vous y <strong>opposer</strong>, ou
                exercer tout autre droit prévu par le RGPD, en écrivant à l&apos;adresse de contact ci-dessus.
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

          <Section title="E-mails">
            <p>
              Eagle Touch vous envoie uniquement les e-mails nécessaires au service : confirmation de votre adresse et
              code de changement de mot de passe. Aucune lettre d&apos;information ni aucun e-mail publicitaire ne vous
              est envoyé, et votre adresse n&apos;est jamais transmise à des fins commerciales.
            </p>
          </Section>

          <Section title="Cookies et stockage sur votre appareil">
            <p>
              Eagle Touch n&apos;utilise aucun cookie publicitaire ni de mesure d&apos;audience, c&apos;est pourquoi
              aucun bandeau de consentement ne vous est présenté. L&apos;application enregistre uniquement sur votre
              appareil ce qui est nécessaire à son fonctionnement :
            </p>
            <ul>
              <li>votre session de connexion et l&apos;identifiant de votre compte ;</li>
              <li>une copie de vos compétitions et vos saisies pas encore envoyées, pour jouer sans réseau ;</li>
              <li>les fichiers de l&apos;application, pour qu&apos;elle s&apos;ouvre rapidement et hors ligne ;</li>
              <li>votre choix d&apos;apparence (clair ou sombre) et le brouillon d&apos;une manche en cours de création.</li>
            </ul>
            <p>
              Ces éléments ne demandent pas de consentement. Ils sont effacés quand vous vous déconnectez ou supprimez
              votre compte, ou quand vous effacez les données du site dans votre navigateur.
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
              Base de données : Supabase Inc. Envoi des e-mails : Sendinblue SAS (Brevo).
            </p>
            <p>
              Les composants open source utilisés sont listés sur la page{" "}
              <a className="underline underline-offset-4" href="/licences">licences</a>.
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
    </LegalPage>
  );
}
