import { NEXT_ROUND, ROUNDS, roundWinner } from "@/lib/season";

export function SeasonTimeline() {
  return (
    <section id="saison" className="mx-auto max-w-[1280px] px-4 py-20 md:px-8 md:py-28">
      <h2 className="max-w-[18ch] text-[2rem] leading-[1.05] font-semibold tracking-[-0.03em] md:text-5xl">
        Une saison, plusieurs parcours.
      </h2>
      <p className="mt-4 max-w-[52ch] text-ink-2 md:text-lg">
        Chaque manche a son parcours, sa date et ses joueurs. Avant le départ, chacun répond : je participe, ou pas.
      </p>

      <ol className="mt-12 border-l border-line pl-5 lg:grid lg:grid-cols-5 lg:border-t lg:border-l-0 lg:pl-0">
        {ROUNDS.map((r, i) => {
          const w = roundWinner(i);
          return (
            <li
              key={r.short}
              className="grid grid-cols-[1fr_auto] gap-4 pb-8 lg:block lg:border-r lg:border-line lg:px-6 lg:pt-6 lg:pb-2 lg:first:pl-0"
            >
              <div>
                <p className="tnum font-mono text-[12.5px] text-ink-3">{r.date}</p>
                <p className="mt-1 text-[15px] text-ink-2">{r.name}</p>
                <p className="mt-0.5 font-semibold leading-snug">{r.course}</p>
              </div>
              {w && (
                <div className="text-right lg:mt-5 lg:text-left">
                  <p className="text-[13px] text-ink-3">Meilleur score</p>
                  <p className="text-[15px]">{w.name}</p>
                  <p className="tnum text-[2.5rem] leading-none font-semibold tracking-[-0.04em]">
                    {w.pts}
                    <span className="ml-1 text-base font-medium text-ink-3">pts</span>
                  </p>
                </div>
              )}
            </li>
          );
        })}
        <li className="relative -ml-5 border-l-2 border-accent pl-5 lg:-mt-px lg:ml-0 lg:border-t-2 lg:border-l-0 lg:pt-6 lg:pl-6">
          <p className="tnum font-mono text-[12.5px] text-ink-3">{NEXT_ROUND.date}</p>
          <p className="mt-1 text-[15px] text-ink-2">Prochaine manche</p>
          <p className="mt-0.5 font-semibold leading-snug">{NEXT_ROUND.course}</p>
          <dl className="mt-5 grid grid-cols-3 gap-3 lg:grid-cols-1 lg:gap-2">
            {[
              [NEXT_ROUND.yes, "Je participe"],
              [NEXT_ROUND.no, "Je ne participe pas"],
              [NEXT_ROUND.pending, "Pas encore répondu"],
            ].map(([n, l]) => (
              <div key={l} className="lg:flex lg:items-baseline lg:gap-3">
                <dt className="tnum order-2 text-[2rem] leading-none font-semibold tracking-[-0.04em] lg:w-8">{n}</dt>
                <dd className="mt-1 text-[13px] leading-tight text-ink-2 lg:mt-0">{l}</dd>
              </div>
            ))}
          </dl>
        </li>
      </ol>
    </section>
  );
}
