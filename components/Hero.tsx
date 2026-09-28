import Image from "next/image";
import { ArrowDown } from "@phosphor-icons/react/dist/ssr";
import { CREATE_URL } from "@/lib/season";
import { LinkButton } from "./LinkButton";
import { PhoneFrame } from "./app/PhoneFrame";
import { LeaderboardScreen } from "./app/LeaderboardScreen";

export function Hero() {
  return (
    <section className="mx-auto max-w-[1280px] px-4 pt-8 pb-16 md:px-8 md:pt-14 lg:pt-20 lg:pb-28">
      <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:gap-10 xl:grid-cols-[1.05fr_1fr]">
        <div className="max-w-[640px]">
          <h1 className="text-[2.25rem] leading-[1.04] font-semibold tracking-[-0.035em] text-balance md:text-6xl lg:text-[2.9rem] xl:text-[3.5rem] 2xl:text-[3.75rem]">
            Votre saison de golf, classée à la moyenne.
          </h1>
          <p className="mt-5 max-w-[40ch] text-[17px] leading-relaxed text-ink-2 md:text-lg">
            Créez la compétition, saisissez les scores trou par trou. Eagle Touch calcule le Stableford et le
            classement.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
            <LinkButton href={CREATE_URL}>Créer une compétition</LinkButton>
            <a
              href="#moyenne"
              className="inline-flex h-12 items-center gap-1.5 text-[15px] font-medium text-ink underline decoration-line decoration-2 underline-offset-[6px] transition-colors hover:decoration-accent"
            >
              Voir le classement
              <ArrowDown size={16} weight="bold" />
            </a>
          </div>
        </div>

        <div className="relative lg:min-h-[640px]">
          <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[20px] sm:aspect-[16/10] lg:absolute lg:inset-y-0 lg:right-0 lg:aspect-auto lg:w-[72%]">
            <Image
              src="https://picsum.photos/seed/eagletouch-hero-fairway-morning/1200/1500"
              alt="Quatre amis marchent sur un fairway au petit matin, sacs sur l'épaule"
              fill
              priority
              sizes="(min-width: 1024px) 40vw, 100vw"
              className="object-cover"
            />
          </div>
          <div className="relative mx-auto -mt-[86%] w-[84%] max-w-[300px] motion-safe:animate-rise sm:-mt-[42%] sm:w-[48%] lg:absolute lg:top-1/2 lg:left-0 lg:mt-0 lg:w-[296px] lg:-translate-y-1/2">
            <PhoneFrame label="Écran Classement général de l'application Eagle Touch">
              <LeaderboardScreen />
            </PhoneFrame>
          </div>
        </div>
      </div>
    </section>
  );
}
