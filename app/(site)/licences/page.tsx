import type { Metadata } from "next";
import { LEGAL } from "@/lib/legal";
import { LegalPage, Section } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Licences · Eagle Touch",
  description: "Les composants open source et les données de tiers utilisés par Eagle Touch.",
};

const MIT = [
  { name: "Next.js", by: "Vercel, Inc.", url: "https://github.com/vercel/next.js" },
  { name: "React et React DOM", by: "Meta Platforms, Inc. et ses contributeurs", url: "https://github.com/facebook/react" },
  { name: "Supabase JS", by: "Supabase, Inc.", url: "https://github.com/supabase/supabase-js" },
  { name: "Motion", by: "Motion Division Ltd.", url: "https://github.com/motiondivision/motion" },
  { name: "Phosphor Icons", by: "Phosphor Icons", url: "https://github.com/phosphor-icons/react" },
  { name: "Tailwind CSS", by: "Tailwind Labs, Inc.", url: "https://github.com/tailwindlabs/tailwindcss" },
];

export default function Licences() {
  const link = "underline underline-offset-4";
  return (
    <LegalPage
      title="Licences"
      updated={LEGAL.conditionsMiseAJour}
      intro={
        <p>
          Eagle Touch est construit avec des logiciels open source et des données libres. Merci à leurs auteurs. Voici
          ce qui est utilisé et sous quelle licence.
        </p>
      }
    >
      <Section title="Logiciels sous licence MIT">
        <ul>
          {MIT.map((m) => (
            <li key={m.name}>
              <a className={link} href={m.url} rel="noopener">
                {m.name}
              </a>
              , © {m.by}
            </li>
          ))}
        </ul>
        <p className="text-sm">
          Licence MIT : la permission est accordée, gratuitement, à toute personne obtenant une copie de ce logiciel et
          des fichiers de documentation associés, de traiter le logiciel sans restriction, y compris les droits
          d&apos;utiliser, copier, modifier, fusionner, publier, distribuer, sous-licencier et vendre des copies du
          logiciel, sous réserve que la mention de copyright et la présente autorisation figurent dans toutes les
          copies ou parties substantielles du logiciel. Le logiciel est fourni « tel quel », sans garantie
          d&apos;aucune sorte, expresse ou implicite. Le texte original anglais fait foi :{" "}
          <a className={link} href="https://opensource.org/license/mit" rel="noopener">
            opensource.org/license/mit
          </a>
          .
        </p>
      </Section>

      <Section title="Polices de caractères">
        <p>
          <a className={link} href="https://github.com/vercel/geist-font" rel="noopener">
            Geist et Geist Mono
          </a>
          , © Vercel, Inc., sous{" "}
          <a className={link} href="https://openfontlicense.org" rel="noopener">
            SIL Open Font License 1.1
          </a>
          . Les polices sont servies par ce site, sans appel à un service extérieur.
        </p>
      </Section>

      <Section title="Données et images">
        <ul>
          <li>
            Annuaire des golfs : données ©{" "}
            <a className={link} href="https://www.openstreetmap.org/copyright" rel="noopener">
              contributeurs OpenStreetMap
            </a>
            , disponibles sous licence Open Database License (ODbL).
          </li>
          <li>
            Photos d&apos;illustration : images libres de droits fournies par{" "}
            <a className={link} href="https://picsum.photos" rel="noopener">
              Lorem Picsum
            </a>{" "}
            à partir de la collection{" "}
            <a className={link} href="https://unsplash.com/license" rel="noopener">
              Unsplash
            </a>
            , sous licence Unsplash.
          </li>
          <li>
            Calcul de l&apos;Index Eagle Touch : inspiré des règles publiques du World Handicap System. Eagle Touch
            n&apos;est ni affilié ni approuvé par The R&amp;A, l&apos;USGA ou une fédération de golf.
          </li>
        </ul>
      </Section>

      <Section title="Eagle Touch">
        <p>
          Le code propre à Eagle Touch, son nom, son logo et son design sont © 2026 {LEGAL.responsable}, tous droits
          réservés, même lorsque le code source est consultable publiquement.
        </p>
      </Section>
    </LegalPage>
  );
}
