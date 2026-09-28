import { AverageBoard } from "./AverageBoard";

const examples = [
  { name: "Arthur Petit", sum: "35 + 39 + 32 + 38 = 144", div: "144 ÷ 4 manches", avg: "36,00", note: "Quatre manches jouées." },
  { name: "Thomas Laurent", sum: "38 + 37 + 36 = 111", div: "111 ÷ 3 manches", avg: "37,00", note: "Manche 2 manquée, non comptée." },
];

export function AverageSection() {
  return (
    <section id="moyenne" className="border-y border-line bg-surface">
      <div className="mx-auto max-w-[1280px] px-4 py-20 md:px-8 md:py-28">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-3">La règle Eagle Touch</p>
        <h2 className="mt-3 max-w-[20ch] text-[2rem] leading-[1.05] font-semibold tracking-[-0.03em] md:text-5xl">
          Classés à la moyenne, pas au total.
        </h2>
        <p className="mt-4 max-w-[58ch] text-ink-2 md:text-lg">
          Chaque carte validée entre dans la moyenne du joueur. Comparez avec un classement au total : Thomas passerait troisième.
        </p>

        <div className="mt-10 md:mt-12">
          <AverageBoard />
          <p className="mt-3 px-2 text-[13px] text-ink-3">Exemple : Eagle Touch Tour 2027 après quatre manches.</p>
        </div>

        <div className="mt-14 grid gap-10 md:grid-cols-2 md:gap-8">
          {examples.map((e) => (
            <div key={e.name} className="border-t-2 border-ink pt-5">
              <p className="font-semibold">{e.name}</p>
              <p className="tnum mt-3 font-mono text-[15px] text-ink-2 md:text-base">{e.sum}</p>
              <p className="tnum font-mono text-[15px] text-ink-2 md:text-base">{e.div}</p>
              <p className="tnum mt-2 text-[3.5rem] leading-none font-semibold tracking-[-0.045em] md:text-[4.5rem]">{e.avg}</p>
              <p className="mt-2 text-[15px] text-ink-2">{e.note}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
