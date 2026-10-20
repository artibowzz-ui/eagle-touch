import type { Metadata } from "next";
import { LEGAL } from "@/lib/legal";
import { LegalPage, Section, ContactMail } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Conditions d'utilisation · Eagle Touch",
  description: "Les règles d'utilisation d'Eagle Touch : compte, contenus, Index Eagle Touch, responsabilité.",
};

export default function Conditions() {
  return (
    <LegalPage
      title="Conditions d'utilisation"
      updated={LEGAL.conditionsMiseAJour}
      intro={
        <p>
          Ces conditions s&apos;appliquent à toute personne qui utilise Eagle Touch, le site et l&apos;application. En
          créant un compte, vous les acceptez. La façon dont vos données sont traitées est expliquée dans la{" "}
          <a className="underline underline-offset-4" href="/confidentialite">politique de confidentialité</a>.
        </p>
      }
    >
      <Section title="Le service">
        <p>
          Eagle Touch permet d&apos;organiser des compétitions de golf entre amis : inscriptions aux manches, saisie
          des scores trou par trou, classements à la moyenne Stableford, défis et Index Eagle Touch. Le service est
          édité par {LEGAL.responsable}, {LEGAL.adresse}, et il est gratuit. Si un jour une partie devenait payante,
          vous en seriez informé à l&apos;avance et rien ne vous serait facturé sans votre accord explicite.
        </p>
      </Section>

      <Section title="Votre compte">
        <ul>
          <li>Vous devez avoir au moins 13 ans, ou l&apos;accord d&apos;un parent ou représentant légal.</li>
          <li>Les informations de votre profil, notamment votre nom et votre index déclaré, doivent être exactes.</li>
          <li>
            Votre mot de passe est personnel. Prévenez-nous à l&apos;adresse de contact si vous pensez que quelqu&apos;un
            d&apos;autre utilise votre compte.
          </li>
          <li>Vous pouvez supprimer votre compte à tout moment depuis l&apos;onglet Profil.</li>
        </ul>
      </Section>

      <Section title="Règles d'utilisation">
        <p>En utilisant Eagle Touch, vous vous engagez à ne pas :</p>
        <ul>
          <li>saisir des scores ou des index que vous savez faux, ou modifier la carte d&apos;un autre joueur sans son accord ;</li>
          <li>publier des contenus illégaux, injurieux ou qui portent atteinte aux droits d&apos;autrui, y compris des photos de personnes sans leur accord ;</li>
          <li>ajouter à une compétition une personne sans compte sans l&apos;en avoir informée ;</li>
          <li>tenter d&apos;accéder aux données d&apos;autres joueurs, de contourner les protections du service ou de le surcharger.</li>
        </ul>
        <p>
          L&apos;administrateur d&apos;une compétition en fixe les règles (minimum de manches, défis, index utilisé) et
          peut corriger les inscriptions et les cartes. Les litiges sportifs entre joueurs se règlent au sein de la
          compétition.
        </p>
      </Section>

      <Section title="Vos contenus">
        <p>
          Vous restez propriétaire de ce que vous ajoutez : photo de profil, descriptions, golfs et cartes de
          parcours. Vous autorisez Eagle Touch à les enregistrer et à les afficher aux personnes concernées, pour le
          seul fonctionnement du service. Les golfs que vous ajoutez à la liste partagée restent disponibles pour les
          autres joueurs, sans votre nom, même après la suppression de votre compte.
        </p>
        <p>
          Un contenu qui ne respecte pas ces conditions peut être retiré, et un compte qui les enfreint gravement ou à
          plusieurs reprises peut être suspendu ou supprimé, après un avertissement sauf en cas d&apos;urgence.
        </p>
      </Section>

      <Section title="Index Eagle Touch et classements">
        <p>
          L&apos;Index Eagle Touch est calculé par l&apos;application à partir des cartes validées dans Eagle Touch,
          d&apos;après les règles du World Handicap System. Ce n&apos;est pas un index officiel : il ne remplace pas
          l&apos;index délivré par votre fédération ou votre club et ne peut pas être utilisé en dehors d&apos;Eagle
          Touch. Les classements et les résultats des défis dépendent des scores saisis par les joueurs.
        </p>
      </Section>

      <Section title="Disponibilité et responsabilité">
        <p>
          Eagle Touch est fourni gratuitement, tel quel. Nous faisons notre possible pour qu&apos;il fonctionne sans
          interruption et que les calculs soient justes, mais nous ne pouvons pas le garantir : le service peut être
          interrompu pour maintenance, évoluer ou s&apos;arrêter. En cas d&apos;arrêt définitif, vous en serez prévenu
          à l&apos;avance pour pouvoir télécharger vos données.
        </p>
        <p>
          Dans les limites permises par la loi, l&apos;éditeur n&apos;est pas responsable des dommages indirects ni
          des conséquences d&apos;une erreur de score ou de classement. Cette limite ne s&apos;applique pas en cas de
          faute intentionnelle ou de faute grave, ni aux droits que la loi vous garantit comme consommateur.
        </p>
      </Section>

      <Section title="Propriété intellectuelle">
        <p>
          Le nom Eagle Touch, le logo, le design et les textes du site et de l&apos;application appartiennent à{" "}
          {LEGAL.responsable}. Vous ne pouvez pas les reproduire ni les utiliser à d&apos;autres fins sans accord écrit.
          Les composants open source et les données de tiers utilisés restent soumis à leurs propres licences,
          listées sur la page <a className="underline underline-offset-4" href="/licences">licences</a>.
        </p>
      </Section>

      <Section title="Modifications">
        <p>
          Ces conditions peuvent évoluer avec le service. En cas de changement important, vous en serez informé dans
          l&apos;application avant qu&apos;il s&apos;applique. Si vous n&apos;êtes pas d&apos;accord, vous pouvez
          supprimer votre compte.
        </p>
      </Section>

      <Section title="Droit applicable et contact">
        <p>
          Ces conditions sont soumises au droit belge. En cas de désaccord, écrivez-nous d&apos;abord : nous
          chercherons une solution à l&apos;amiable. À défaut, les tribunaux compétents sont ceux désignés par la loi
          belge ; si vous êtes consommateur, vous gardez le droit de saisir le tribunal de votre domicile.
        </p>
        <p>
          Contact : <ContactMail />
        </p>
      </Section>
    </LegalPage>
  );
}
