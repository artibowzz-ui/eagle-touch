import { ScoreDemo } from "./ScoreDemo";

const notesLeft = [
  { t: "Coups reçus", d: "Calculés depuis votre index et l'index du trou. Ici, un coup sur le trou 7." },
  { t: "Points en direct", d: "Chaque coup ajouté recalcule le net et les points Stableford." },
];
const notesRight = [
  { t: "Une main suffit", d: "Grands boutons, grands chiffres, aucun clavier à ouvrir entre deux coups." },
  { t: "Carte relue", d: "Toute la carte se vérifie avant validation. Une balle relevée compte zéro point." },
];

function Notes({ items, align }: { items: typeof notesLeft; align: "left" | "right" }) {
  return (
    <ul className={`grid gap-6 sm:grid-cols-2 lg:grid-cols-1 lg:gap-10 ${align === "right" ? "" : "lg:text-right"}`}>
      {items.map((n) => (
        <li key={n.t} className="border-t border-line pt-4 lg:border-t-0 lg:pt-0">
          <p className="font-semibold">{n.t}</p>
          <p className={`mt-1 max-w-[34ch] text-[15px] text-ink-2 ${align === "right" ? "" : "lg:ml-auto"}`}>{n.d}</p>
        </li>
      ))}
    </ul>
  );
}

export function ScoreSection() {
  return (
    <section id="score" className="mx-auto max-w-[1280px] px-4 py-20 md:px-8 md:py-28">
      <div className="max-w-[640px] lg:mx-auto lg:text-center">
        <h2 className="text-[2rem] leading-[1.05] font-semibold tracking-[-0.03em] md:text-5xl">Un trou, un geste.</h2>
        <p className="mt-4 text-ink-2 md:text-lg">
          Le nombre de coups au pouce, les points Stableford avant de marcher vers le départ suivant. Essayez.
        </p>
      </div>
      <div className="mt-12 grid gap-10 lg:mt-16 lg:grid-cols-[1fr_392px_1fr] lg:items-center lg:gap-14">
        <div className="order-2 lg:order-1">
          <Notes items={notesLeft} align="left" />
        </div>
        <div className="order-1 mx-auto w-full max-w-[392px] lg:order-2">
          <ScoreDemo />
        </div>
        <div className="order-3">
          <Notes items={notesRight} align="right" />
        </div>
      </div>
    </section>
  );
}
