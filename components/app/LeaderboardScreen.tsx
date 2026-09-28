import { Check, House, Play, Trophy, User } from "@phosphor-icons/react/dist/ssr";
import { COMPETITION, NEXT_ROUND, PLAYER_COUNT, fr, standings } from "@/lib/season";
import { Avatar } from "./Avatar";

/* Real mini version of the Eagle Touch "Classement" screen. */
export function LeaderboardScreen() {
  const rows = standings("avg");
  const tabs = ["Aperçu", "Manches", "Classement", "Défis"];
  return (
    <div className="select-none text-ink">
      <div className="bg-forest px-4 pt-9 pb-3 text-on-forest">
        <p className="text-[15px] font-semibold tracking-tight">{COMPETITION}</p>
        <div className="mt-2.5 flex gap-0.5 text-[10.5px] font-medium">
          {tabs.map((t) =>
            t === "Classement" ? (
              <span key={t} className="rounded-md bg-on-forest px-2 py-1 text-forest">
                {t}
              </span>
            ) : (
              <span key={t} className="px-2 py-1 text-on-forest/70">
                {t}
              </span>
            ),
          )}
        </div>
      </div>

      <div className="flex items-baseline justify-between px-4 pt-3.5 pb-1.5">
        <p className="text-[12.5px] font-semibold">Classement général</p>
        <p className="font-mono text-[10px] text-ink-3">{PLAYER_COUNT} joueurs</p>
      </div>

      <ol>
        {rows.map((r, i) => (
          <li
            key={r.id}
            className={`grid grid-cols-[20px_28px_1fr_auto] items-center gap-2.5 border-t border-line px-4 py-2.5 ${
              r.id === "arthur" ? "bg-surface-2/70" : ""
            }`}
          >
            <span
              className={`tnum grid h-5 place-items-center text-[13px] font-semibold ${
                i === 0 ? "rounded-[5px] bg-accent text-on-accent" : "text-ink-3"
              }`}
            >
              {i + 1}
            </span>
            <Avatar initials={r.initials} />
            <span className="min-w-0">
              <span className="block truncate text-[12.5px] font-semibold leading-tight">{r.name}</span>
              <span className="tnum block text-[10px] leading-tight text-ink-3">
                {r.played} manches, {r.total} pts
              </span>
            </span>
            <span className="text-right leading-none">
              <span className="tnum block text-[19px] font-semibold tracking-tight">{fr(r.avg)}</span>
              <span className="text-[10px] text-ink-3">moyenne</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="mx-3 mt-2 rounded-xl bg-surface-2 p-3">
        <p className="text-[10px] font-medium text-ink-3">Prochaine manche</p>
        <p className="mt-0.5 text-[13px] font-semibold">{NEXT_ROUND.course}</p>
        <p className="text-[11px] text-ink-2">
          {NEXT_ROUND.date}, départ {NEXT_ROUND.teeTime}
        </p>
        <div className="mt-2.5 grid grid-cols-2 gap-1.5 text-[10.5px] font-medium">
          <span className="flex h-8 items-center justify-center gap-1 rounded-lg bg-forest text-on-forest">
            <Check size={12} weight="bold" /> Je participe
          </span>
          <span className="flex h-8 items-center justify-center rounded-lg border border-line text-ink-2">
            Je ne participe pas
          </span>
        </div>
      </div>

      <nav className="mt-3 grid grid-cols-4 border-t border-line px-1 pt-2 pb-3 text-[10px] font-medium text-ink-3">
        {[
          { l: "Accueil", I: House },
          { l: "Compétitions", I: Trophy, on: true },
          { l: "Jouer", I: Play },
          { l: "Profil", I: User },
        ].map(({ l, I, on }) => (
          <span key={l} className={`flex flex-col items-center gap-0.5 ${on ? "text-ink" : ""}`}>
            <I size={17} weight={on ? "fill" : "regular"} />
            {l}
          </span>
        ))}
      </nav>
    </div>
  );
}
