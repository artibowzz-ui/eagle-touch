import Image from "next/image";

type Cell = { title: string; rule: string; leader: string; count: number; unit: string };

const longDrive: Cell = { title: "Long drive", rule: "Le plus long drive, attribué trou par trou.", leader: "Julien Moreau", count: 11, unit: "trous gagnés" };
const small: (Cell & { tone: "plain" | "forest" | "stone" })[] = [
  { title: "Plus près du drapeau", rule: "Un par 3 désigné avant la manche.", leader: "Thomas Laurent", count: 2, unit: "victoires", tone: "forest" },
  { title: "Nains", rule: "Premier coup perdu ou resté avant les départs.", leader: "Louis Martin", count: 7, unit: "nains", tone: "plain" },
  { title: "Croix", rule: "Déclarée par le joueur sur le trou.", leader: "Arthur Petit", count: 5, unit: "croix", tone: "plain" },
  { title: "Birdies", rule: "Un coup sous le par, compté tout seul.", leader: "Julien Moreau", count: 9, unit: "birdies", tone: "stone" },
];

const toneClass = {
  plain: "border border-line bg-surface",
  forest: "bg-forest text-on-forest",
  stone: "bg-surface-2",
};

export function Challenges() {
  return (
    <section id="defis" className="mx-auto max-w-[1280px] px-4 pb-20 md:px-8 md:pb-28">
      <h2 className="max-w-[20ch] text-[2rem] leading-[1.05] font-semibold tracking-[-0.03em] md:text-5xl">
        Les petits jeux dans la partie.
      </h2>
      <p className="mt-4 max-w-[52ch] text-ink-2 md:text-lg">
        Cinq défis suivis pendant chaque manche, chacun avec son classement sur toute la saison.
      </p>

      <div className="mt-10 grid grid-cols-2 gap-3 md:mt-12 lg:grid-cols-4 lg:grid-rows-2">
        <article className="relative isolate flex min-h-[380px] flex-col justify-end overflow-hidden rounded-[20px] p-6 text-[#eef1ec] col-span-2 lg:row-span-2 md:min-h-[480px] md:p-8">
          <Image
            src="https://picsum.photos/seed/eagletouch-tee-shot-drive/1400/1100"
            alt="Un joueur au départ, en fin de swing, le fairway devant lui"
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="-z-10 object-cover"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[rgb(8_14_11/0.85)] via-[rgb(8_14_11/0.25)] to-transparent" />
          <h3 className="text-3xl font-semibold tracking-[-0.03em] md:text-4xl">{longDrive.title}</h3>
          <p className="mt-2 max-w-[36ch] text-[#eef1ec]/80">{longDrive.rule}</p>
          <div className="mt-6 flex items-end justify-between gap-4 border-t border-[#eef1ec]/25 pt-4">
            <p className="text-[15px]">
              <span className="block text-[13px] text-[#eef1ec]/70">En tête</span>
              {longDrive.leader}
            </p>
            <p className="tnum text-right text-5xl leading-none font-semibold tracking-[-0.04em]">
              {longDrive.count}
              <span className="block text-right text-[13px] font-normal tracking-normal text-[#eef1ec]/70">{longDrive.unit}</span>
            </p>
          </div>
        </article>

        {small.map((c) => (
          <article key={c.title} className={`flex min-h-[236px] flex-col rounded-[20px] p-4 sm:p-6 ${toneClass[c.tone]}`}>
            <h3 className="text-[17px] leading-tight font-semibold tracking-[-0.02em] sm:text-xl">{c.title}</h3>
            <p className={`mt-1.5 text-[13.5px] leading-snug sm:text-[15px] ${c.tone === "forest" ? "text-on-forest/80" : "text-ink-2"}`}>{c.rule}</p>
            <div className="mt-auto pt-5">
              <p className="tnum text-[2.5rem] leading-none font-semibold tracking-[-0.04em]">
                {c.count}
                <span className={`ml-1.5 text-[13px] font-normal tracking-normal ${c.tone === "forest" ? "text-on-forest/70" : "text-ink-3"}`}>{c.unit}</span>
              </p>
              <p className="mt-1.5 text-[13.5px] leading-snug">
                <span className={c.tone === "forest" ? "text-on-forest/70" : "text-ink-3"}>En tête : </span>
                {c.leader}
              </p>
            </div>
          </article>
        ))}
      </div>
      <p className="mt-3 text-[13px] text-ink-3">Exemple : Eagle Touch Tour 2027 après quatre manches.</p>
    </section>
  );
}
