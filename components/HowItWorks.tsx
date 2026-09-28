const steps = [
  { verb: "Créez", text: "Nom, dates et règles. Vous devenez l'administrateur de la compétition.", ui: "Eagle Touch Tour 2027" },
  { verb: "Invitez", text: "Partagez le code. Vos amis rejoignent la compétition depuis leur téléphone.", ui: "ET-2027-GENT" },
  { verb: "Planifiez", text: "Choisissez le parcours et la date. Chacun indique s'il participe.", ui: "Golf de Durbuy, sam. 17 avril" },
  { verb: "Jouez", text: "Les coups se saisissent trou par trou, directement sur le parcours.", ui: "Trou 7 : 5 coups, 2 pts" },
  { verb: "Suivez", text: "Points Stableford et classement se mettent à jour à chaque carte validée.", ui: "1. Thomas Laurent  37,00" },
];

export function HowItWorks() {
  return (
    <section id="fonctionnement" className="mx-auto max-w-[1280px] px-4 py-20 md:px-8 md:py-28">
      <h2 className="max-w-[18ch] text-[2rem] leading-[1.05] font-semibold tracking-[-0.03em] md:text-5xl">
        De l&apos;invitation au dernier putt.
      </h2>
      <ol className="mt-10 md:mt-14">
        {steps.map((s) => (
          <li
            key={s.verb}
            className="grid gap-2 border-t border-line py-6 md:grid-cols-12 md:items-baseline md:gap-6 md:py-8"
          >
            <span className="text-[1.75rem] font-semibold tracking-[-0.03em] md:col-span-3 md:text-4xl">{s.verb}</span>
            <p className="max-w-[46ch] text-ink-2 md:col-span-5 md:text-[17px]">{s.text}</p>
            <span className="tnum mt-1 font-mono text-[13px] whitespace-pre text-ink md:col-span-4 md:mt-0 md:text-right md:text-sm">
              {s.ui}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
