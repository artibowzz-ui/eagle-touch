"use client";

import { useState } from "react";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { ROUNDS, fr, standings } from "@/lib/season";
import { Avatar } from "./app/Avatar";

type Mode = "avg" | "total";

export function AverageBoard() {
  const [mode, setMode] = useState<Mode>("avg");
  const reduce = useReducedMotion();
  const rows = standings(mode);

  return (
    <div>
      <div role="radiogroup" aria-label="Mode de classement" className="inline-grid grid-cols-2 rounded-xl bg-surface-2 p-1 text-sm font-medium">
        {(
          [
            ["total", "Total des points"],
            ["avg", "Moyenne Eagle Touch"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={mode === k}
            onClick={() => setMode(k)}
            className={`h-10 rounded-lg px-3 transition-colors focus-visible:outline-2 focus-visible:outline-accent md:px-4 ${
              mode === k ? "bg-surface text-ink shadow-[0_1px_2px_rgb(16_24_20/0.08)]" : "text-ink-2 hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6 hidden grid-cols-[48px_1fr_repeat(4,64px)_84px_84px_110px] items-end gap-2 px-2 pb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-3 lg:grid">
        <span>Pos.</span>
        <span>Joueur</span>
        {ROUNDS.map((r) => (
          <span key={r.short} className="text-center" title={r.course}>
            {r.short}
          </span>
        ))}
        <span className="text-right">Manches</span>
        <span className="text-right">Total</span>
        <span className="text-right">{mode === "avg" ? "Moyenne" : "Points"}</span>
      </div>

      <LayoutGroup>
        <ol className="mt-4 lg:mt-0">
          {rows.map((r, i) => (
            <motion.li
              layout={!reduce}
              initial={reduce ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{
                layout: { type: "spring", stiffness: 260, damping: 30 },
                opacity: { duration: 0.5, delay: i * 0.07 },
                y: { duration: 0.6, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] },
              }}
              key={r.id}
              className="grid grid-cols-[36px_1fr_auto] items-center gap-x-3 gap-y-2 border-t border-line px-2 py-4 lg:grid-cols-[48px_1fr_repeat(4,64px)_84px_84px_110px] lg:gap-2"
            >
              <span
                className={`tnum grid h-8 w-8 place-items-center rounded-lg text-lg font-semibold ${
                  i === 0 ? "bg-accent text-on-accent" : "text-ink-3"
                }`}
              >
                {i + 1}
              </span>
              <span className="flex min-w-0 items-center gap-3">
                <Avatar initials={r.initials} size={36} />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{r.name}</span>
                  <span className="tnum block text-[13px] text-ink-3">Index {r.index}</span>
                </span>
              </span>
              <span className="text-right lg:hidden">
                <span className="tnum block text-[1.75rem] leading-none font-semibold tracking-[-0.03em]">
                  {mode === "avg" ? fr(r.avg) : r.total}
                </span>
                <span className="text-[12px] text-ink-3">{mode === "avg" ? "moyenne" : "points"}</span>
              </span>
              <span className="col-span-3 grid grid-cols-4 gap-1.5 lg:contents">
                {r.rounds.map((s, k) =>
                  s === null ? (
                    <span
                      key={k}
                      className="grid h-10 place-items-center rounded-lg border border-dashed border-line text-[12px] text-ink-3"
                    >
                      Absent
                    </span>
                  ) : (
                    <span key={k} className="tnum grid h-10 place-items-center rounded-lg bg-surface-2 text-[15px] font-medium">
                      {s}
                    </span>
                  ),
                )}
              </span>
              <span className="tnum hidden text-right text-ink-2 lg:block">{r.played}</span>
              <span className={`tnum hidden text-right lg:block ${mode === "total" ? "font-semibold text-ink" : "text-ink-2"}`}>{r.total}</span>
              <span className="tnum hidden text-right text-[2rem] leading-none font-semibold tracking-[-0.03em] lg:block">
                {mode === "avg" ? fr(r.avg) : r.total}
              </span>
            </motion.li>
          ))}
        </ol>
      </LayoutGroup>
    </div>
  );
}
