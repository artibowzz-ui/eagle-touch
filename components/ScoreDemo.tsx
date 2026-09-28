"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CaretLeft, CaretRight, Minus, Plus } from "@phosphor-icons/react";
import { received, stableford } from "@/lib/season";

/* Interactive copy of the Eagle Touch hole-by-hole entry screen. Playing handicap 20 (index 18,4). */
const PLAYING_HCP = 20;
const POINTS_BEFORE = 11; // holes 1 to 5, sample card
const HOLES = [
  { n: 6, par: 3, si: 15, m: 164 },
  { n: 7, par: 4, si: 3, m: 356 },
  { n: 8, par: 5, si: 9, m: 471 },
];

const netLabel = (d: number) =>
  d <= -2 ? "Eagle net" : d === -1 ? "Birdie net" : d === 0 ? "Par net" : d === 1 ? "Bogey net" : "Double bogey net";

export function ScoreDemo() {
  const reduce = useReducedMotion();
  const [idx, setIdx] = useState(1);
  const [strokes, setStrokes] = useState<number[]>([3, 5, 6]);

  const hole = HOLES[idx];
  const recv = received(PLAYING_HCP, hole.si);
  const gross = strokes[idx];
  const pts = stableford(gross, hole.par, recv);
  const total =
    POINTS_BEFORE +
    HOLES.slice(0, idx + 1).reduce((a, h, i) => a + stableford(strokes[i], h.par, received(PLAYING_HCP, h.si)), 0);

  const step = (d: number) =>
    setStrokes((s) => s.map((v, i) => (i === idx ? Math.min(12, Math.max(1, v + d)) : v)));

  const flip = reduce
    ? {}
    : {
        initial: { y: 14, opacity: 0 },
        animate: { y: 0, opacity: 1 },
        exit: { y: -14, opacity: 0 },
        transition: { type: "spring" as const, stiffness: 420, damping: 32 },
      };

  return (
    <div className="rounded-[20px] border border-line bg-surface p-5 md:p-6">
      <div className="flex items-end justify-between">
        <p className="leading-none">
          <span className="block text-[13px] font-medium text-ink-3">Trou</span>
          <span className="tnum text-[4.5rem] font-semibold tracking-[-0.05em]">{hole.n}</span>
        </p>
        <dl className="grid grid-cols-3 gap-5 text-right">
          {[
            ["Par", hole.par],
            ["Index", hole.si],
            ["Mètres", hole.m],
          ].map(([k, v]) => (
            <div key={k as string}>
              <dt className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-3">{k}</dt>
              <dd className="tnum text-2xl font-semibold tracking-tight">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="mt-3 text-sm text-ink-2">
        Vous recevez {recv} coup{recv > 1 ? "s" : ""} sur ce trou
      </p>

      <div className="mt-5 grid grid-cols-[72px_1fr_72px] items-center rounded-[20px] bg-surface-2 p-3">
        <motion.button
          type="button"
          aria-label="Un coup de moins"
          onClick={() => step(-1)}
          whileTap={reduce ? undefined : { scale: 0.94 }}
          className="grid size-[72px] place-items-center rounded-xl bg-surface text-ink focus-visible:outline-2 focus-visible:outline-accent"
        >
          <Minus size={28} weight="bold" />
        </motion.button>
        <div className="relative h-[88px] overflow-hidden text-center" aria-live="polite">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={`${idx}-${gross}`} {...flip} className="tnum absolute inset-x-0 top-0 text-[4.75rem] leading-none font-semibold tracking-[-0.05em]">
              {gross}
            </motion.span>
          </AnimatePresence>
          <span className="absolute inset-x-0 bottom-0 font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-3">
            Coups
          </span>
        </div>
        <motion.button
          type="button"
          aria-label="Un coup de plus"
          onClick={() => step(1)}
          whileTap={reduce ? undefined : { scale: 0.94 }}
          className="grid size-[72px] place-items-center rounded-xl bg-surface text-ink focus-visible:outline-2 focus-visible:outline-accent"
        >
          <Plus size={28} weight="bold" />
        </motion.button>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-[20px] bg-forest px-5 py-4 text-on-forest">
        <div>
          <p className="relative h-[46px] overflow-hidden leading-none">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span key={`${idx}-${pts}`} {...flip} className="tnum absolute top-0 left-0 text-[2.9rem] font-semibold tracking-[-0.04em]">
                {pts}
                <span className="ml-1 text-lg font-medium text-accent">pts</span>
              </motion.span>
            </AnimatePresence>
          </p>
          <p className="mt-1 text-[13px] text-on-forest/75">{netLabel(gross - recv - hole.par)}</p>
        </div>
        <div className="text-right">
          <p className="tnum text-2xl font-semibold">{total}</p>
          <p className="text-[12px] text-on-forest/75">points après {hole.n} trous</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0}
          className="flex h-12 items-center justify-center gap-1 rounded-xl border border-line text-[14px] font-medium text-ink disabled:opacity-40"
        >
          <CaretLeft size={16} weight="bold" /> Trou précédent
        </button>
        <button
          type="button"
          onClick={() => setIdx((i) => Math.min(HOLES.length - 1, i + 1))}
          disabled={idx === HOLES.length - 1}
          className="flex h-12 items-center justify-center gap-1 rounded-xl bg-forest text-[14px] font-medium text-on-forest disabled:opacity-40"
        >
          Trou suivant <CaretRight size={16} weight="bold" />
        </button>
      </div>
    </div>
  );
}
