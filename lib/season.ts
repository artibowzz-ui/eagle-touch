/*
  Example season shown on the marketing page (sample data, labelled as such on the page).
  All figures are internally consistent: averages are computed from the round scores.
*/

export type Player = {
  id: string;
  name: string;
  initials: string;
  index: string;
  rounds: (number | null)[];
};

export const COMPETITION = "Eagle Touch Tour 2027";
export const PLAYER_COUNT = 14;

export const ROUNDS = [
  { short: "M1", name: "Manche 1", course: "Golf Club Gent", date: "Sam. 27 février" },
  { short: "M2", name: "Manche 2", course: "Golf Château de la Tournette", date: "Sam. 13 mars" },
  { short: "M3", name: "Manche 3", course: "Golf de Rigenée", date: "Sam. 27 mars" },
  { short: "M4", name: "Manche 4", course: "Golf de Naxhelet", date: "Sam. 10 avril" },
];

export const NEXT_ROUND = {
  name: "Manche 5",
  course: "Golf de Durbuy",
  date: "Samedi 17 avril",
  teeTime: "9 h 10",
  yes: 9,
  no: 2,
  pending: 3,
};

export const PLAYERS: Player[] = [
  { id: "thomas", name: "Thomas Laurent", initials: "TL", index: "14,2", rounds: [38, null, 37, 36] },
  { id: "arthur", name: "Arthur Petit", initials: "AP", index: "18,4", rounds: [35, 39, 32, 38] },
  { id: "louis", name: "Louis Martin", initials: "LM", index: "22,7", rounds: [36, 33, 35, 35] },
  { id: "julien", name: "Julien Moreau", initials: "JM", index: "11,9", rounds: [32, null, 34, 35] },
];

export type Standing = Player & { played: number; total: number; avg: number };

export function standings(mode: "avg" | "total" = "avg"): Standing[] {
  const rows = PLAYERS.map((p) => {
    const scores = p.rounds.filter((r): r is number => r !== null);
    const total = scores.reduce((a, b) => a + b, 0);
    return { ...p, played: scores.length, total, avg: total / scores.length };
  });
  return rows.sort((a, b) => (mode === "avg" ? b.avg - a.avg : b.total - a.total));
}

export const fr = (n: number, digits = 2) => n.toFixed(digits).replace(".", ",");

export function roundWinner(i: number) {
  let best: Player | null = null;
  for (const p of PLAYERS) {
    const s = p.rounds[i];
    if (s !== null && (best === null || s > (best.rounds[i] ?? -1))) best = p;
  }
  return best ? { name: best.name, pts: best.rounds[i] as number } : null;
}

/* Stableford for one hole, standard allocation by stroke index. */
export function received(playingHcp: number, strokeIndex: number) {
  const base = Math.floor(playingHcp / 18);
  return base + (strokeIndex <= playingHcp % 18 ? 1 : 0);
}

export function stableford(gross: number, par: number, strokesReceived: number) {
  return Math.max(0, 2 + par + strokesReceived - gross);
}

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "/app";
export const CREATE_URL = `${APP_URL}#creer`;
export const JOIN_URL = `${APP_URL}#rejoindre`;
