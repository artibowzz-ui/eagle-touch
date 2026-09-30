import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { APP_URL, JOIN_URL } from "@/lib/season";
import { LinkButton } from "./LinkButton";

export function FinalCta() {
  return (
    <section className="px-4 pb-6 md:px-8">
      <div className="mx-auto grid max-w-[1280px] gap-8 rounded-[20px] bg-forest px-6 py-14 text-on-forest md:px-12 md:py-20 lg:grid-cols-[1.3fr_1fr] lg:items-end lg:px-16">
        <div>
          <h2 className="max-w-[16ch] text-[2.25rem] leading-[1.03] font-semibold tracking-[-0.035em] md:text-6xl">
            La saison 2027 commence ici.
          </h2>
          <p className="mt-5 max-w-[42ch] text-on-forest/80 md:text-lg">
            Créez votre compétition et partagez le code. Vos amis la rejoignent depuis leur téléphone.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 lg:justify-end">
          <LinkButton href={APP_URL} variant="accent">
            Connectez-vous <ArrowRight size={16} weight="bold" />
          </LinkButton>
          <LinkButton href={JOIN_URL} variant="outlineOnForest">
            Rejoindre une compétition
          </LinkButton>
        </div>
      </div>
    </section>
  );
}
