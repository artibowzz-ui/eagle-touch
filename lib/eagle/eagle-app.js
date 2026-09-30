/* eslint-disable */
// @ts-nocheck
/* Eagle Touch, application (module client unique). Généré depuis les sources de l'application. */
import DIR_DATA from './dir.json';

/* ============================================================
   Eagle Touch, logique golf (pure, sans DOM)
   Stableford, répartition des coups, handicaps, classements.
   ============================================================ */
const Golf = {
  /* Rang de difficulté de chaque trou (1 = le plus difficile) d'après
     l'index (Stroke Index). Fonctionne pour 1 à 18 comme pour un 9 trous
     indexé 1 à 9 ou en impairs/pairs 1 à 18. */
  ranks(holes) {
    const order = holes.map((h, i) => i).sort((a, b) => holes[a].si - holes[b].si);
    const rank = new Array(holes.length);
    order.forEach((i, k) => { rank[i] = k + 1; });
    return rank;
  },

  /* Coups reçus sur un trou. Gère aussi les handicaps "plus" (négatifs) :
     les coups sont alors rendus sur les trous les plus faciles. */
  received(playingHcp, rank, n) {
    const base = Math.floor(playingHcp / n);
    const rem = playingHcp - base * n;
    return base + (rank <= rem ? 1 : 0);
  },

  /* Points Stableford d'un trou. gross = null (non saisi), 0 (balle relevée). */
  points(gross, par, received) {
    if (gross == null) return null;
    if (gross === 0) return 0;
    return Math.max(0, 2 + par + received - gross);
  },

  card(holes, playingHcp, strokes) {
    const n = holes.length;
    const rank = Golf.ranks(holes);
    let pts = 0, gross = 0, played = 0, pickups = 0;
    const rows = holes.map((h, i) => {
      const recv = Golf.received(playingHcp, rank[i], n);
      const g = strokes && strokes[i] != null ? strokes[i] : null;
      const p = Golf.points(g, h.par, recv);
      if (g != null) { played++; pts += p; if (g === 0) pickups++; else gross += g; }
      return { n: h.n, lbl: h.lbl, par: h.par, si: h.si, dist: h.dist, i, recv, gross: g, net: g ? g - recv : null, pts: p };
    });
    return { rows, pts, gross, played, n, complete: played === n, pickups };
  },

  /* Course Handicap (WHS) : Index × Slope/113 + (CR − Par).
     Sur 9 trous : Index/2. Sans CR/Slope : l'index (ou la moitié) est utilisé. */
  courseHandicap(index, tee, parPlayed, holesPlayed, courseHoles) {
    const nine = holesPlayed === 9;
    const idx = nine ? index / 2 : index;
    if (tee && Number(tee.slope) > 0 && Number(tee.cr) > 0) {
      let cr = Number(tee.cr);
      if (nine && courseHoles === 18) cr = cr / 2;
      return idx * Number(tee.slope) / 113 + (cr - parPlayed);
    }
    return idx;
  },

  handicaps(index, snapshot, allowance) {
    const holes = snapshot.holes;
    const par = holes.reduce((a, h) => a + h.par, 0);
    const ch = Golf.courseHandicap(index, snapshot.tee, par, holes.length, snapshot.courseHoles);
    return { hi: index, ch: Math.round(ch), ph: Math.round(ch * (allowance == null ? 100 : allowance) / 100) };
  },

  /* Classement Eagle Touch : moyenne Stableford sur les manches réellement jouées. */
  rankByAverage(rows) {
    const key = r => r.avg == null ? -1 : Math.round(r.avg * 1000);
    rows.sort((a, b) => key(b) - key(a) || b.played - a.played || b.total - a.total || (a.name || '').localeCompare(b.name || ''));
    let pos = 0, prev = null;
    rows.forEach((r, i) => {
      if (r.avg == null) { r.pos = null; return; }
      if (prev === null || key(r) !== prev) pos = i + 1;
      r.pos = pos; prev = key(r);
    });
    return rows;
  },

  rankByPoints(rows) {
    rows.sort((a, b) => b.pts - a.pts || b.played - a.played || (a.name || '').localeCompare(b.name || ''));
    let pos = 0, prev = null;
    rows.forEach((r, i) => {
      if (!r.played) { r.pos = null; return; }
      if (prev === null || r.pts !== prev) pos = i + 1;
      r.pos = pos; prev = r.pts;
    });
    return rows;
  },

  /* Validation d'un parcours. Renvoie une liste d'erreurs en français. */
  validateCourse(c) {
    const errs = [];
    if (!c.name || !c.name.trim()) errs.push({ f: 'name', m: 'Indiquez le nom du parcours.' });
    const n = c.holesCount;
    if (![9, 18, 27, 36, 45, 54].includes(n)) errs.push({ f: 'holes', m: 'Choisissez le nombre de trous du club.' });
    /* Club de plus de 18 trous = plusieurs 9 trous, chacun validé comme un 9 trous. */
    const multi = n > 18; const m = Math.round(n / 9);
    const groups = multi ? Array.from({ length: m }, (_, k) => ({ k, holes: c.holes.slice(k * 9, k * 9 + 9) })) : [{ k: 0, holes: c.holes }];
    groups.forEach(({ k, holes }) => {
      const nm = multi ? (((c.loops || [])[k] || '').trim() || `Boucle ${k + 1}`) + ', trou ' : 'Trou ';
      const seen = new Map();
      holes.forEach((h, j) => {
        const i = k * 9 + j;
        if (![3, 4, 5].includes(h.par)) errs.push({ f: 'par-' + i, m: `${nm}${j + 1} : le par doit être 3, 4 ou 5.` });
        if (!Number.isInteger(h.si) || h.si < 1 || h.si > 18) errs.push({ f: 'si-' + i, m: `${nm}${j + 1} : l'index doit être un nombre entre 1 et ${holes.length === 18 ? 18 : '9 (ou 18)'}.` });
        else if (seen.has(h.si)) errs.push({ f: 'si-' + i, m: `${nm}${j + 1} : l'index ${h.si} est déjà utilisé au trou ${seen.get(h.si) + 1}.` });
        else seen.set(h.si, j);
        if (h.dist != null && (!Number.isFinite(h.dist) || h.dist <= 0 || h.dist > 800)) errs.push({ f: 'dist-' + i, m: `${nm}${j + 1} : distance invalide.` });
      });
      if (holes.length === 18 && seen.size === 18) {
        for (let v = 1; v <= 18; v++) if (!seen.has(v)) { errs.push({ f: 'si', m: 'Un parcours 18 trous doit utiliser les index 1 à 18.' }); break; }
      }
      if (holes.length === 9 && seen.size === 9) {
        const vals = [...seen.keys()];
        if (!vals.every(v => v <= 9) && !vals.every(v => v % 2 === 1) && !vals.every(v => v % 2 === 0)) errs.push({ f: 'si', m: `${multi ? nm.replace(/, trou $/, '') + ' : s' : 'S'}ur 9 trous, utilisez les index 1 à 9, ou uniquement des impairs (ou pairs) de 1 à 18.` });
      }
    });
    if (multi) {
      for (let k = 0; k < m; k++) if (!((c.loops || [])[k] || '').trim()) errs.push({ f: 'loop-' + k, m: `Donnez un nom au 9 trous n° ${k + 1} (ex. « Les Pins »).` });
      const seenL = new Set();
      (c.layouts || []).forEach((l, k) => {
        const [a, b] = l.nines;
        if (!(a >= 0 && a < m && b >= 0 && b < m) || a === b) errs.push({ f: 'ly-b-' + k, m: `Parcours ${k + 1} : choisissez deux 9 trous différents.` });
        else if (seenL.has(a + '+' + b)) errs.push({ f: 'ly-b-' + k, m: `Parcours ${k + 1} : cette combinaison existe déjà.` });
        seenL.add(a + '+' + b);
      });
    }
    (c.tees || []).forEach((t, i) => {
      if (!t.name) errs.push({ f: 'tee-' + i, m: `Départ ${i + 1} : choisissez une couleur ou un nom.` });
      if (t.slope != null && !(t.slope >= 55 && t.slope <= 155)) errs.push({ f: 'slope-' + i, m: `Départ ${t.name || i + 1} : le slope doit être entre 55 et 155.` });
      if (t.cr != null && !(t.cr >= 20 && t.cr <= 80)) errs.push({ f: 'cr-' + i, m: `Départ ${t.name || i + 1} : le course rating semble invalide.` });
    });
    return errs;
  }
};


/* ============================================================
   Eagle Touch, noyau : utilitaires, stockage, sélecteurs
   ============================================================ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const gid = () => (crypto && crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
const pad = n => String(n).padStart(2, '0');
const todayISO = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const nowISO = () => new Date().toISOString();
const parseD = iso => { if (!iso) return null; const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
const fmt = (iso, o) => { const d = parseD(iso); return d ? new Intl.DateTimeFormat('fr-BE', o).format(d) : ''; };
const fDate = iso => fmt(iso, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const fDateL = iso => fmt(iso, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fDay = iso => fmt(iso, { day: 'numeric' });
const fMon = iso => fmt(iso, { month: 'short' }).replace('.', '');
const dec = (x, d = 2) => x == null ? '-' : Number(x).toFixed(d).replace('.', ',');
const idx1 = x => x == null || x === '' ? '-' : (Number(x) < 0 ? '+' + Math.abs(Number(x)).toFixed(1) : Number(x).toFixed(1)).replace('.', ',');
const ord = n => n == null ? '-' : (n === 1 ? '1er' : n + 'e');
const ordSup = n => n == null ? '-' : (n === 1 ? '1<sup>er</sup>' : n + '<sup>e</sup>');
const pts = p => p == null ? '-' : (p <= 1 ? p + ' pt' : p + ' pts');
const numIn = v => { if (v == null) return null; const s = String(v).trim().replace(',', '.'); if (s === '') return null; const n = Number(s); return Number.isFinite(n) ? n : NaN; };

const I = (d, extra = '') => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true" ${extra}>${d}</svg>`;
const ic = {
  home: I('<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
  trophy: I('<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>'),
  play: I('<path d="M7 21V3.5l10 4-10 4"/><circle cx="17.5" cy="18.5" r="2.2"/>'),
  user: I('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'),
  back: I('<path d="M15 5l-7 7 7 7"/>'),
  chev: I('<path d="M9 5l7 7-7 7"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>'),
  minus: I('<path d="M5 12h14"/>'),
  check: I('<path d="M5 12.5l4.5 4.5L19 7"/>'),
  x: I('<path d="M6 6l12 12M18 6L6 18"/>'),
  trash: I('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  edit: I('<path d="M4 20h4L19 9l-4-4L4 16z"/>'),
  card: I('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/>'),
  copy: I('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>'),
  map: I('<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14"/>'),
  cal: I('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  users: I('<circle cx="9" cy="8" r="3.5"/><path d="M2 20c1-3.5 3.8-5 7-5s6 1.5 7 5"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14c2.5 0 4 1.5 5 4"/>'),
  gear: I('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>'),
  flag: I('<path d="M6 21V3.5l11 4.5-11 4.5"/><path d="M3 21h9"/>'),
  key: I('<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3"/>'),
};
const MARK = '';
const BRAND = `<div class="brand"><b>Eagle Touch</b></div>`;

/* Photos de l'application. Pour utiliser vos propres images, déposez-les dans public/photos/
   et remplacez l'adresse, par exemple : auth: '/photos/connexion.jpg'. */
const PHOTOS = {
  auth: 'https://picsum.photos/seed/eagletouch-hero-fairway-morning/1200/1500',
  home: 'https://picsum.photos/seed/eagletouch-friends-walking-fairway/1600/1000',
  covers: [
    'https://picsum.photos/seed/eagletouch-tee-shot-drive/1400/900',
    'https://picsum.photos/seed/eagletouch-friends-walking-fairway/1400/900',
    'https://picsum.photos/seed/eagletouch-hero-fairway-morning/1400/900',
  ],
};
const coverOf = id => { let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return PHOTOS.covers[h % PHOTOS.covers.length]; };
const plural = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`;

/* Apparence : automatique (réglage du téléphone), clair ou sombre. Mémorisé sur l'appareil. */
const THEME_KEY = 'eagletouch.theme';
const THEMES = [['auto', 'Automatique'], ['light', 'Clair'], ['dark', 'Sombre']];
function getTheme() { try { const t = localStorage.getItem(THEME_KEY); return t === 'light' || t === 'dark' ? t : 'auto'; } catch (e) { return 'auto'; } }
function applyTheme(t) { const r = document.documentElement; if (t === 'light' || t === 'dark') r.dataset.theme = t; else delete r.dataset.theme; }
function setTheme(t) { try { localStorage.setItem(THEME_KEY, t); } catch (e) {} applyTheme(t); }

/* ---------------- Stockage ----------------
   Tables (collections) :
   profiles     /{userId}                 comptes joueurs (index actuel)
   competitions /{id}                     compétitions (admins[] pour l'avenir)
   members      /{compId}__{userId}       CompetitionParticipants
   courses      /{id}                     parcours + trous + départs (tees)
   rounds       /{id}                     manches + instantané figé du parcours
   entries      /{roundId}__{userId}      RoundParticipants + coups par trou
                                          + handicaps figés (index, CH, HJ)
   Les points Stableford et les moyennes sont recalculés, jamais stockés. */
/* ---------------- Stockage : Supabase ----------------
   Tables relationnelles (voir supabase/schema.sql). L'application manipule
   des objets ; cette couche les convertit en lignes et inversement.
   Les écritures sont optimistes : l'écran se met à jour tout de suite,
   la base est écrite ensuite, puis rechargée en cas d'erreur. */
const COLS = ['profiles', 'competitions', 'members', 'courses', 'rounds', 'entries'];
const S = { mode: 'supabase', sb: null, uid: null, email: '', data: {}, remote: {}, dirty: new Map(), chains: new Map(), readonly: false, ui: { hole: {}, player: {} }, after: null, loaded: false };
COLS.forEach(c => { S.data[c] = new Map(); S.remote[c] = new Map(); });
const SESSION_ROUTES = ['connexion', 'inscription', 'mdp-oublie', 'verifier-email', 'nouveau-mdp'];

const num = v => (v === null || v === undefined ? null : Number(v));
const byKey = (rows, k) => { const m = new Map(); for (const r of rows) { const key = r[k]; if (!m.has(key)) m.set(key, []); m.get(key).push(r); } return m; };

async function fetchAll(table) {
  const out = []; const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await S.sb.from(table).select('*').range(from, from + page - 1);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < page) break;
  }
  return out;
}

/* ---------- Lignes -> objets ---------- */
function buildState(t) {
  const d = {}; COLS.forEach(c => { d[c] = new Map(); });
  const hist = byKey(t.handicap_history, 'profile_id');
  for (const p of t.profiles) {
    d.profiles.set(p.id, {
      id: p.id, firstName: p.first_name, lastName: p.last_name, email: p.email, handicap: num(p.handicap), photo: p.photo || null,
      managedBy: p.managed_by || null, createdAt: p.created_at, updatedAt: p.updated_at,
      handicapHistory: (hist.get(p.id) || []).sort((a, b) => a.recorded_at.localeCompare(b.recorded_at)).map(h => ({ value: num(h.value), date: h.recorded_at })),
    });
  }
  const mem = byKey(t.competition_members, 'competition_id');
  for (const m of t.competition_members) {
    const id = m.competition_id + '__' + m.user_id;
    d.members.set(id, { id, competitionId: m.competition_id, userId: m.user_id, role: m.role, joinedAt: m.joined_at, addedBy: m.added_by });
  }
  for (const c of t.competitions) {
    d.competitions.set(c.id, {
      id: c.id, name: c.name, description: c.description, startDate: c.start_date, endDate: c.end_date, code: c.code, createdBy: c.created_by,
      admins: (mem.get(c.id) || []).filter(m => m.role === 'admin').map(m => m.user_id), allowance: c.allowance, challenges: c.challenges || {}, minRounds: c.min_rounds ?? 0,
      createdAt: c.created_at, updatedAt: c.updated_at,
    });
  }
  const holes = byKey(t.golf_holes, 'course_id'), tees = byKey(t.course_tees, 'course_id');
  for (const c of t.golf_courses) {
    d.courses.set(c.id, {
      id: c.id, name: c.name, location: c.location, country: c.country, region: c.region, holesCount: c.holes_count, par: c.par, source: c.source, loops: c.sections && Array.isArray(c.sections.nines) ? c.sections.nines : null, layouts: c.sections && Array.isArray(c.sections.layouts) ? c.sections.layouts : null,
      createdBy: c.created_by, createdAt: c.created_at, updatedAt: c.updated_at,
      holes: (holes.get(c.id) || []).sort((a, b) => a.number - b.number).map(h => ({ n: h.number, par: h.par, si: h.stroke_index, dist: h.distance_m })),
      tees: (tees.get(c.id) || []).sort((a, b) => a.position - b.position).map(x => ({ id: x.id, name: x.name, color: x.color, cr: num(x.course_rating), slope: x.slope, totalDist: x.total_distance, holeDist: x.hole_distances })),
    });
  }
  for (const r of t.rounds) {
    d.rounds.set(r.id, {
      id: r.id, competitionId: r.competition_id, name: r.name, date: r.play_date, teeTime: r.tee_time ? r.tee_time.slice(0, 5) : null,
      deadline: r.registration_deadline, description: r.description, snapshot: r.course_snapshot, ntpHole: r.ntp_hole, ldHole: r.course_snapshot && r.course_snapshot.ldHole != null ? r.course_snapshot.ldHole : null, status: r.status,
      createdAt: r.created_at, updatedAt: r.updated_at,
    });
  }
  const scores = byKey(t.hole_scores, 'round_id');
  for (const p of t.round_participants) {
    const r = d.rounds.get(p.round_id);
    const n = r ? r.snapshot.holes.length : 18;
    const e = {
      id: p.round_id + '__' + p.user_id, roundId: p.round_id, competitionId: p.competition_id, userId: p.user_id, status: p.status,
      strokes: Array(n).fill(null), nains: Array(n).fill(0), ld: Array(n).fill(false), croix: Array(n).fill(false), ntp: p.ntp_winner,
      submitted: p.submitted, submittedAt: p.submitted_at, hcpIndex: num(p.hcp_index), courseHcp: p.course_hcp, playingHcp: p.playing_hcp,
      hcpManual: p.hcp_manual, createdAt: p.created_at, updatedAt: p.updated_at, updatedBy: p.updated_by,
    };
    for (const h of (scores.get(p.round_id) || []).filter(h => h.user_id === p.user_id)) {
      if (h.hole_index >= n) continue;
      e.strokes[h.hole_index] = h.strokes; e.nains[h.hole_index] = h.nains; e.ld[h.hole_index] = h.long_drive; e.croix[h.hole_index] = h.croix;
    }
    d.entries.set(e.id, e);
  }
  return d;
}

const TABLES = ['profiles', 'handicap_history', 'competitions', 'competition_members', 'golf_courses', 'golf_holes', 'course_tees', 'rounds', 'round_participants', 'hole_scores'];
async function loadAll() {
  const res = await Promise.all(TABLES.map(fetchAll));
  const t = {}; TABLES.forEach((k, i) => { t[k] = res[i]; });
  const d = buildState(t);
  COLS.forEach(c => {
    S.remote[c] = new Map([...d[c]].map(([k, v]) => [k, JSON.parse(JSON.stringify(v))]));
    for (const [k, v] of S.dirty) { const [cc, id] = k.split('/'); if (cc === c) d[c].set(id, v); }
    S.data[c] = d[c];
  });
  S.loaded = true;
}
let reloadT = null;
function scheduleReload(ms = 500) {
  clearTimeout(reloadT);
  reloadT = setTimeout(async () => {
    if (!S.uid) return;
    try { await loadAll(); scheduleRender(true); } catch (e) { console.warn('Eagle Touch reload', e); }
  }, ms);
}

/* ---------- Objets -> lignes ---------- */
const must = r => { if (r && r.error) throw r.error; return r; };
const holeRow = (e, i) => ({ round_id: e.roundId, user_id: e.userId, hole_index: i, strokes: e.strokes[i] ?? null, nains: (e.nains || [])[i] || 0, long_drive: !!(e.ld || [])[i], croix: !!(e.croix || [])[i] });
const holeUsed = h => h.strokes !== null || h.nains > 0 || h.long_drive || h.croix;
const WRITE = {
  async profiles(o, prev) {
    must(await S.sb.from('profiles').upsert({ id: o.id, first_name: o.firstName, last_name: o.lastName || '', email: o.email || '', handicap: o.handicap, photo: o.photo || null, managed_by: o.managedBy || null, updated_at: nowISO() }));
    const known = new Set(((prev && prev.handicapHistory) || []).map(h => h.date));
    const add = (o.handicapHistory || []).filter(h => !known.has(h.date)).map(h => ({ profile_id: o.id, value: h.value, recorded_at: h.date }));
    if (add.length) must(await S.sb.from('handicap_history').upsert(add, { onConflict: 'profile_id,recorded_at', ignoreDuplicates: true }));
  },
  async competitions(o) {
    const row = { id: o.id, name: o.name, description: o.description || '', start_date: o.startDate, end_date: o.endDate || null, code: o.code, created_by: o.createdBy, allowance: o.allowance ?? 100, challenges: o.challenges || {}, min_rounds: o.minRounds ?? 0, updated_at: nowISO() };
    let r = await S.sb.from('competitions').upsert(row);
    /* Base pas encore mise à jour (patch 002 non exécuté) : on enregistre sans le minimum de manches. */
    if (r.error && /min_rounds/.test(r.error.message || '')) { console.warn('Eagle Touch : exécutez supabase/patch-002-manches-minimum.sql'); const { min_rounds, ...rest } = row; r = await S.sb.from('competitions').upsert(rest); }
    must(r);
  },
  async members(o) {
    must(await S.sb.from('competition_members').upsert({ competition_id: o.competitionId, user_id: o.userId, role: o.role || 'player', added_by: o.addedBy || null }, { onConflict: 'competition_id,user_id' }));
  },
  async courses(o) {
    const row = { id: o.id, name: o.name, location: o.location || '', country: o.country || '', region: o.region || '', holes_count: o.holesCount, par: o.par, source: o.source || null, created_by: o.createdBy, sections: o.holesCount > 18 ? { nines: o.loops || [], layouts: o.layouts || [] } : null, updated_at: nowISO() };
    let r = await S.sb.from('golf_courses').upsert(row);
    /* Base pas encore mise à jour (patch 003 non exécuté) : 9 et 18 trous s'enregistrent sans la colonne des boucles. */
    if (r.error && /sections/.test(r.error.message || '') && o.holesCount <= 18) { const { sections, ...rest } = row; r = await S.sb.from('golf_courses').upsert(rest); }
    if (r.error && o.holesCount > 18) { console.warn(r.error); throw { message: 'club', code: 'P27' }; }
    must(r);
    must(await S.sb.from('golf_holes').delete().eq('course_id', o.id));
    must(await S.sb.from('golf_holes').insert(o.holes.map(h => ({ course_id: o.id, number: h.n, par: h.par, stroke_index: h.si, distance_m: h.dist ?? null }))));
    must(await S.sb.from('course_tees').delete().eq('course_id', o.id));
    if ((o.tees || []).length) must(await S.sb.from('course_tees').insert(o.tees.map((t, i) => ({ id: t.id, course_id: o.id, position: i, name: t.name, color: t.color || '#999999', course_rating: t.cr ?? null, slope: t.slope ?? null, total_distance: t.totalDist ?? null, hole_distances: t.holeDist || null }))));
  },
  async rounds(o) {
    must(await S.sb.from('rounds').upsert({ id: o.id, competition_id: o.competitionId, name: o.name, play_date: o.date, tee_time: o.teeTime || null, registration_deadline: o.deadline || null, description: o.description || '', course_id: o.snapshot.courseId || null, course_snapshot: { ...o.snapshot, ldHole: o.ldHole ?? null }, ntp_hole: o.ntpHole ?? null, status: o.status || 'open', updated_at: nowISO() }));
  },
  async entries(o, prev) {
    must(await S.sb.from('round_participants').upsert({ round_id: o.roundId, user_id: o.userId, competition_id: o.competitionId, status: o.status, submitted: !!o.submitted, submitted_at: o.submittedAt || null, hcp_index: o.hcpIndex ?? null, course_hcp: o.courseHcp ?? null, playing_hcp: o.playingHcp ?? null, hcp_manual: !!o.hcpManual, ntp_winner: !!o.ntp, updated_at: nowISO(), updated_by: S.uid }, { onConflict: 'round_id,user_id' }));
    const n = Math.max((o.strokes || []).length, (o.nains || []).length, (o.ld || []).length, (o.croix || []).length);
    const rows = []; for (let i = 0; i < n; i++) rows.push(holeRow(o, i));
    const used = rows.filter(holeUsed);
    const before = new Set();
    if (prev) for (let i = 0; i < 18; i++) { const h = holeRow({ ...prev, strokes: prev.strokes || [] }, i); if (holeUsed(h)) before.add(i); }
    const gone = [...before].filter(i => !used.some(h => h.hole_index === i));
    if (used.length) must(await S.sb.from('hole_scores').upsert(used, { onConflict: 'round_id,user_id,hole_index' }));
    if (gone.length) must(await S.sb.from('hole_scores').delete().eq('round_id', o.roundId).eq('user_id', o.userId).in('hole_index', gone));
  },
};
const DELETE = {
  profiles: id => S.sb.from('profiles').delete().eq('id', id),
  competitions: id => S.sb.from('competitions').delete().eq('id', id),
  members: id => { const [c, u] = id.split('__'); return S.sb.from('competition_members').delete().eq('competition_id', c).eq('user_id', u); },
  courses: id => S.sb.from('golf_courses').delete().eq('id', id),
  rounds: id => S.sb.from('rounds').delete().eq('id', id),
  entries: id => { const [r, u] = id.split('__'); return S.sb.from('round_participants').delete().eq('round_id', r).eq('user_id', u); },
};

function writeErr(e) {
  const code = e && (e.code || '');
  console.warn('Eagle Touch write', e);
  if (code === 'P27') { toast("Les clubs de plus de 18 trous demandent une mise à jour de la base (supabase/patch-003-clubs-plusieurs-parcours.sql)."); return; }
  if (code === '42501' || /row-level security|permission/i.test((e && e.message) || '')) toast("Action non autorisée : seul l'administrateur ou le joueur concerné peut faire cette modification.");
  else if (code === '23505') toast('Cette valeur existe déjà (par exemple un code de compétition). Réessayez.');
  else toast("L'enregistrement a échoué. Vérifiez votre connexion et réessayez.");
}
/* Toutes les écritures passent dans une seule file : l'ordre est garanti
   (une compétition existe avant ses membres, une manche avant ses cartes). */
function chain(_key, fn) {
  const key = 'all';
  const prev = S.chains.get(key) || Promise.resolve();
  const p = prev.catch(() => {}).then(fn).catch(e => { writeErr(e); scheduleReload(50); throw e; });
  S.chains.set(key, p.catch(() => {}));
  return p;
}
function put(col, id, obj) {
  S.data[col].set(id, obj);
  const key = col + '/' + id;
  S.dirty.set(key, obj);
  scheduleRender(true);
  return chain(key, async () => {
    await WRITE[col](obj, S.remote[col].get(id));
    S.remote[col].set(id, JSON.parse(JSON.stringify(obj)));
  }).finally(() => { if (S.dirty.get(key) === obj) S.dirty.delete(key); });
}
function del(col, id) {
  S.data[col].delete(id);
  const key = col + '/' + id;
  S.dirty.delete(key);
  scheduleRender(true);
  return chain(key, async () => { must(await DELETE[col](id)); S.remote[col].delete(id); });
}
/* Retire localement les éléments supprimés en cascade par la base. */
function purgeLocal(col, pred) { for (const [k, v] of [...S.data[col]]) if (pred(v)) { S.data[col].delete(k); S.remote[col].delete(k); } }
/* Écriture différée pour la saisie des coups (un seul envoi par pause). */
const timers = new Map();
function putSoon(col, id, obj, ms = 600) {
  const key = col + '/' + id;
  S.data[col].set(id, obj);
  S.dirty.set(key, obj);
  clearTimeout(timers.get(key));
  timers.set(key, setTimeout(() => { timers.delete(key); put(col, id, S.data[col].get(id)); }, ms));
  scheduleRender(true);
}
function flushWrites() { for (const [key, t] of timers) { clearTimeout(t); timers.delete(key); const [c, id] = key.split('/'); put(c, id, S.data[c].get(id)); } }

/* ---------- Session ---------- */
async function initStore(sb) {
  S.sb = sb;
  const { data } = await sb.auth.getSession();
  const session = data && data.session;
  S.uid = session ? session.user.id : null; S.email = session ? session.user.email : '';
  if (S.uid) { try { await loadAll(); } catch (e) { console.warn(e); toast('Impossible de charger vos données. Vérifiez votre connexion.'); } }
  sb.auth.onAuthStateChange((event, s) => {
    const uid = s ? s.user.id : null;
    if (event === 'PASSWORD_RECOVERY') { S.uid = uid; S.email = s ? s.user.email : ''; nav('nouveau-mdp', { replace: true }); return; }
    if (uid === S.uid) return;
    S.uid = uid; S.email = s ? s.user.email : '';
    if (!uid) { COLS.forEach(c => { S.data[c] = new Map(); S.remote[c] = new Map(); }); nav('connexion', { replace: true }); return; }
    loadAll().then(() => nav(S.after || 'accueil', { replace: true })).catch(e => console.warn(e));
  });
  try {
    sb.channel('eagle-touch').on('postgres_changes', { event: '*', schema: 'public' }, () => scheduleReload(700)).subscribe();
  } catch (e) { console.warn('Eagle Touch realtime', e); }
}

/* ---------------- Sélecteurs ---------------- */
const vals = c => [...S.data[c].values()];
const P = id => S.data.profiles.get(id);
const me = () => P(S.uid);
const fullName = id => { const p = P(id); return p ? `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Joueur' : 'Joueur'; };
const firstName = id => { const p = P(id); return p ? (p.firstName || fullName(id)) : 'Joueur'; };
const comp = id => S.data.competitions.get(id);
const round = id => S.data.rounds.get(id);
const course = id => S.data.courses.get(id);
const entry = (rid, uid) => S.data.entries.get(rid + '__' + uid);
const membersOf = cid => vals('members').filter(m => m.competitionId === cid);
const isMember = (cid, uid = S.uid) => S.data.members.has(cid + '__' + uid);
const isAdmin = (c, uid = S.uid) => !!c && (c.admins || []).includes(uid);
const roundsOf = cid => vals('rounds').filter(r => r.competitionId === cid).sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.createdAt || '').localeCompare(b.createdAt || ''));
const entriesOf = rid => vals('entries').filter(e => e.roundId === rid);
const myComps = () => vals('members').filter(m => m.userId === S.uid).map(m => comp(m.competitionId)).filter(Boolean).sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));

function entryHcp(e, r, c) {
  const locked = !!e && (e.hcpManual || e.submitted || (e.strokes || []).some(v => v != null));
  if (locked && e.playingHcp != null) return { hi: e.hcpIndex, ch: e.courseHcp, ph: e.playingHcp, locked: true, manual: !!e.hcpManual };
  const p = P(e ? e.userId : null);
  const hi = p && p.handicap != null ? p.handicap : 54;
  return { ...Golf.handicaps(hi, r.snapshot, c ? c.allowance : 100), locked: false, manual: false };
}
const cardOf = (e, r, c) => Golf.card(r.snapshot.holes, entryHcp(e, r, c).ph, e.strokes || []);
function phase(r) {
  if (r.status === 'closed') return 'done';
  const es = entriesOf(r.id).filter(e => e.status === 'yes');
  const any = es.some(e => (e.strokes || []).some(v => v != null));
  const t = todayISO();
  if (es.length && es.every(e => e.submitted)) return 'done';
  if (any) return 'live';
  if (r.date < t) return 'done';
  if (r.date === t) return 'live';
  return 'upcoming';
}
const PHASE = { upcoming: ['À venir', ''], live: ['En cours', 'live'], done: ['Terminée', 'gold'] };
const phaseChip = r => { const [l, c] = PHASE[phase(r)]; return `<span class="chip ${c}">${l}</span>`; };
function deadlinePassed(r) { return !!r.deadline && r.deadline < todayISO(); }
function canRsvp(r, c, uid) { if (isAdmin(c)) return true; if (uid !== S.uid) return false; if (r.status === 'closed') return false; if (deadlinePassed(r)) return false; const e = entry(r.id, uid); return !(e && (e.submitted || (e.strokes || []).some(v => v != null))); }
function canScore(r, c, uid) {
  if (isAdmin(c)) return true;
  if (r.status === 'closed') return false;
  const e = entry(r.id, uid);
  if (!e || e.status !== 'yes' || e.submitted) return false;
  if (uid === S.uid) return true;
  const mine = entry(r.id, S.uid); /* marqueur : un participant peut tenir la carte de ses partenaires */
  return !!mine && mine.status === 'yes';
}

function roundBoard(r, c) {
  const rows = entriesOf(r.id).filter(e => e.status === 'yes' && isMember(r.competitionId, e.userId)).map(e => {
    const card = cardOf(e, r, c);
    return { uid: e.userId, name: fullName(e.userId), entry: e, card, hcp: entryHcp(e, r, c), pts: card.pts, played: card.played };
  });
  return Golf.rankByPoints(rows);
}
function finalPositions(r, c) {
  const rows = roundBoard(r, c).filter(x => x.entry.submitted && x.card.complete).map(x => ({ ...x }));
  Golf.rankByPoints(rows);
  const m = new Map(); rows.forEach(x => m.set(x.uid, { pos: x.pos, of: rows.length })); return m;
}
function standings(cid) {
  const c = comp(cid); const rs = roundsOf(cid);
  const rows = membersOf(cid).map(m => {
    const results = [];
    for (const r of rs) {
      const e = entry(r.id, m.userId);
      if (e && e.status === 'yes' && e.submitted) {
        const card = cardOf(e, r, c);
        if (card.complete) results.push({ round: r, pts: card.pts, entry: e, card });
      }
    }
    const total = results.reduce((a, x) => a + x.pts, 0);
    return { uid: m.userId, name: fullName(m.userId), played: results.length, total, avg: results.length ? total / results.length : null, results, short: minOf(c) > 0 && results.length < minOf(c), min: minOf(c) };
  });
  if (!seasonOver(c) || !minOf(c)) return Golf.rankByAverage(rows);
  /* Saison terminée : moins de manches que le minimum de la compétition = éliminé du classement. */
  const inn = Golf.rankByAverage(rows.filter(r => !r.short));
  const out = Golf.rankByAverage(rows.filter(r => r.short));
  out.forEach(r => { r.pos = null; r.eliminated = true; });
  return [...inn, ...out];
}
/* Règle de la saison : chaque compétition fixe un nombre minimum de manches (0 = aucun).
   La saison est terminée quand la date de fin de la compétition est passée. */
const minOf = c => (c && c.minRounds) || 0;
function seasonOver(c) { return !!(c && c.endDate && c.endDate < todayISO()); }
const posHtml = r => !r ? '-' : r.eliminated ? '<span class="word">Éliminé</span>' : r.pos ? ordSup(r.pos) : '-';
function lbMeta(r) {
  if (r.eliminated) return `Éliminé · ${plural(r.played, 'manche')} sur ${r.min} minimum`;
  if (r.short) return `${r.played}/${r.min} manches minimum · ${r.total} pts`;
  return `${plural(r.played, 'manche')} · ${r.total} pts au total`;
}
function nextRound(cid) { return roundsOf(cid).find(r => phase(r) !== 'done') || null; }

/* ---------------- Composants ---------------- */
function avatar(uid, cls = '') {
  const p = P(uid);
  if (p && p.photo) return `<img class="av ${cls}" src="${esc(p.photo)}" alt="">`;
  const n = p ? (((p.firstName || '?')[0] || '') + ((p.lastName || '')[0] || '')).toUpperCase() : '?';
  return `<span class="av ${cls}" aria-hidden="true">${esc(n)}</span>`;
}
function empty(msg, btns = '', icon = ic.flag, sub = '') { return `<div class="empty"><span class="empty-ico">${icon}</span><p>${esc(msg)}</p>${sub ? `<span class="small muted">${esc(sub)}</span>` : ''}${btns ? `<div class="btns">${btns}</div>` : ''}</div>`; }
function dateTile(iso) { return `<div class="date-tile"><b>${esc(fDay(iso))}</b><span>${esc(fMon(iso))}</span></div>`; }
function rsvpChip(e) { if (!e) return '<span class="chip wait">Pas encore répondu</span>'; return e.status === 'yes' ? '<span class="chip yes">Je participe</span>' : '<span class="chip no">Je ne participe pas</span>'; }
function rsvpButtons(r, uid, sm = false) {
  const e = entry(r.id, uid); const s = e ? e.status : null;
  const c = comp(r.competitionId);
  const dis = canRsvp(r, c, uid) ? '' : 'disabled';
  return `<div class="rsvp ${sm ? 'sm' : ''}">
    <button class="y ${s === 'yes' ? 'on' : ''}" data-a="rsvp" data-r="${esc(r.id)}" data-u="${esc(uid)}" data-s="yes" ${dis} aria-pressed="${s === 'yes'}">${ic.check} Je participe</button>
    <button class="n ${s === 'no' ? 'on' : ''}" data-a="rsvp" data-r="${esc(r.id)}" data-u="${esc(uid)}" data-s="no" ${dis} aria-pressed="${s === 'no'}">${ic.x} Je ne participe pas</button>
  </div>`;
}
function leaderboard(rows, cid, limit) {
  const list = limit ? rows.slice(0, limit) : rows;
  if (!list.length) return empty("Aucun joueur n'a encore rejoint cette compétition.", '', ic.users);
  const mob = list.map(r => `<a class="lb-row ${r.uid === S.uid ? 'me' : ''} ${r.eliminated ? 'out' : ''}" href="#c/${esc(cid)}/joueur/${esc(r.uid)}" data-nav>
      <div class="lb-pos ${r.pos === 1 ? 'p1' : ''}">${r.pos ?? '-'}</div>${avatar(r.uid)}
      <div class="grow"><div class="lb-name ellip">${esc(r.name)}</div><div class="lb-meta">${esc(lbMeta(r))}</div></div>
      <div class="lb-val"><b>${dec(r.avg)}</b><span>moyenne</span></div></a>`).join('');
  const tbl = `<table class="lb-table"><thead><tr><th>Pos.</th><th>Joueur</th><th class="r">Moyenne</th><th class="r">Manches jouées</th><th class="r">Total</th></tr></thead><tbody>${list.map(r => `
      <tr data-a="go" data-to="c/${esc(cid)}/joueur/${esc(r.uid)}" class="${r.uid === S.uid ? 'me' : ''} ${r.eliminated ? 'out' : ''}"><td><span class="lb-pos ${r.pos === 1 ? 'p1' : ''}" style="display:inline-grid;width:34px">${r.pos ?? '-'}</span></td>
      <td><div class="row">${avatar(r.uid, 'sm')}<b>${esc(r.name)}</b>${r.eliminated ? '<span class="chip no">Éliminé</span>' : ''}</div></td><td class="r big">${dec(r.avg)}</td><td class="r">${r.played}${r.short ? `<span class="muted">/${r.min}</span>` : ''}</td><td class="r">${r.total}</td></tr>`).join('')}</tbody></table>`;
  return `<div class="lb has-table">${mob}${tbl}</div>`;
}
function roundBoardHtml(r, c) {
  const rows = roundBoard(r, c);
  if (!rows.length) return empty('Aucun joueur inscrit pour cette manche.', '', ic.users);
  const n = r.snapshot.holes.length;
  return `<div class="lb">${rows.map(x => `<a class="lb-row ${x.uid === S.uid ? 'me' : ''}" href="#r/${esc(r.id)}/carte/${esc(x.uid)}" data-nav>
    <div class="lb-pos ${x.pos === 1 && phase(r) === 'done' ? 'p1' : ''}">${x.pos ?? '-'}</div>${avatar(x.uid)}
    <div class="grow"><div class="lb-name ellip">${esc(x.name)}</div><div class="lb-meta">Hcp de jeu ${x.hcp.ph} · ${x.entry.submitted ? 'carte validée' : x.played ? `${x.played}/${n} trous` : 'pas encore commencé'}</div></div>
    <div class="lb-val"><b>${x.played ? x.pts : '-'}</b><span>pts</span></div></a>`).join('')}</div>`;
}

/* ---------------- Défis ----------------
   Saisis par trou dans la carte (nains, long drive, plus près du drapeau)
   ou calculés à partir des coups (croix = 0 point Stableford, birdies). */
const CHALLENGES = [
  { k: 'nains', label: 'Nains', badge: 'N', hint: 'Premier coup perdu ou resté avant les départs.' },
  { k: 'ld', label: 'Long drive', badge: 'LD', hint: 'Un seul trou par manche, désigné avant le départ.' },
  { k: 'ntp', label: 'Plus près du drapeau', badge: 'PP', hint: 'Un par 3 désigné par manche.' },
  { k: 'croix', label: 'Croix', badge: '×', hint: 'Chaque balle relevée compte une croix, automatiquement.' },
  { k: 'birdie', label: 'Birdies', badge: 'B', hint: 'Un coup sous le par (brut), compté automatiquement.' },
];
const chOn = (c, k) => !(c && c.challenges && c.challenges[k] === false);
const activeCh = c => CHALLENGES.filter(x => chOn(c, x.k));
const isBirdie = x => x.gross > 0 && x.gross <= x.par - 1;
function entryCh(e, r, c, card) {
  card = card || cardOf(e, r, c); const n = card.n;
  return {
    nains: (e.nains || []).slice(0, n).reduce((a, x) => a + (x || 0), 0),
    ld: r.ldHole != null ? ((e.ld || [])[r.ldHole] ? 1 : 0) : (e.ld || []).slice(0, n).filter(Boolean).length,
    ntp: e.ntp && r.ntpHole != null ? 1 : 0,
    croix: card.rows.filter(x => x.gross === 0).length,
    birdie: card.rows.filter(x => isBirdie(x)).length,
  };
}
function rankBy(rows, key) {
  rows.sort((a, b) => b[key] - a[key] || a.name.localeCompare(b.name));
  let pos = 0, prev = null;
  rows.forEach((r, i) => { if (prev === null || r[key] !== prev) pos = i + 1; r.pos = r[key] ? pos : null; prev = r[key]; });
  return rows;
}
function challengeTotals(cid) {
  const c = comp(cid); const rs = roundsOf(cid);
  return membersOf(cid).map(m => {
    const t = { uid: m.userId, name: fullName(m.userId), played: 0, nains: 0, ld: 0, ntp: 0, croix: 0, birdie: 0 };
    for (const r of rs) {
      const e = entry(r.id, m.userId);
      if (!(e && e.status === 'yes' && e.submitted)) continue;
      const card = cardOf(e, r, c); if (!card.complete) continue;
      const x = entryCh(e, r, c, card); t.played++;
      for (const k in x) t[k] += x[k];
    }
    return t;
  });
}
function roundChTotals(r, c) {
  return entriesOf(r.id).filter(e => e.status === 'yes' && isMember(r.competitionId, e.userId)).map(e => ({ uid: e.userId, name: fullName(e.userId), ...entryCh(e, r, c) }));
}
function chBoardHtml(ch, rows, opts = {}) {
  const list = rankBy(rows.map(x => ({ ...x })), ch.k).filter(x => x[ch.k] > 0);
  return `<div class="card stack ch-card"><div class="row"><span class="ch-ico ch-${ch.k}">${ch.badge}</span><div class="grow"><b>${esc(ch.label)}</b><div class="small muted">${esc(opts.hint || ch.hint)}</div></div></div>
    ${list.length ? `<div class="ch-list">${list.map(x => `<a class="ch-row ${x.uid === S.uid ? 'me' : ''}" ${opts.cid ? `href="#c/${esc(opts.cid)}/joueur/${esc(x.uid)}" data-nav` : ''}><span class="ch-pos">${x.pos}</span>${avatar(x.uid, 'sm')}<span class="grow ellip">${esc(x.name)}</span><b class="num">${x[ch.k]}</b></a>`).join('')}</div>`
      : `<p class="small muted" style="margin:0">${esc(opts.none || 'Personne pour l\'instant.')}</p>`}</div>`;
}

/* ============================================================
   Eagle Touch, vues
   Chaque vue renvoie { title, html, back?, tabs?, form?, action?, bar?, nav? }
   form: true → la vue n'est pas redessinée quand les données changent
   (on ne perd jamais une saisie en cours).
   ============================================================ */

/* ---------- Accès : connexion / inscription ---------- */
function authShell(inner) {
  return `<div class="auth"><div class="auth-art"><img class="cover-img" src="${esc(PHOTOS.auth)}" alt="" decoding="async"><div class="scrim"></div>
    <div class="auth-brand">${BRAND}</div>
    <div class="auth-copy"><h2>Votre saison de golf, classée à la moyenne.</h2>
    <p>Une manche manquée ne vaut pas zéro. Elle n'entre simplement pas dans la moyenne.</p></div></div>
    <div class="auth-pane"><div class="auth-in">${inner}</div></div></div>`;
}
function vLogin() {
  return authShell(`<h1>Connexion</h1>
    <form data-form="login" novalidate>
      <div class="errs" id="errs"></div>
      <div class="field"><label for="l-email">E-mail</label><input class="inp" id="l-email" name="email" type="email" autocomplete="email" inputmode="email" required></div>
      <div class="field"><label for="l-pw">Mot de passe</label><input class="inp" id="l-pw" name="pw" type="password" autocomplete="current-password" required></div>
      <button class="btn pri block" type="submit">Se connecter</button>
      <div class="row" style="justify-content:space-between"><a href="#mdp-oublie" data-nav>Mot de passe oublié ?</a><a href="#inscription" data-nav>Créer un compte</a></div>
    </form>`);
}
function vForgot() {
  return authShell(`<h1>Mot de passe oublié</h1>
    <p class="muted" style="margin:0">Saisissez votre e-mail. Vous recevrez un lien pour choisir un nouveau mot de passe.</p>
    <form data-form="forgot" novalidate>
      <div class="errs" id="errs"></div>
      <div class="field"><label for="f-email">E-mail</label><input class="inp" id="f-email" name="email" type="email" autocomplete="email" inputmode="email" required></div>
      <button class="btn pri block" type="submit">Envoyer le lien</button>
      <a href="#connexion" data-nav>Retour à la connexion</a>
    </form>`);
}
function vCheckEmail() {
  return authShell(`<h1>Vérifiez votre boîte mail</h1>
    <p class="muted" style="margin:0">Nous vous avons envoyé un lien de confirmation${S.ui.pendingEmail ? ' à <b>' + esc(S.ui.pendingEmail) + '</b>' : ''}. Ouvrez-le sur ce téléphone pour activer votre compte, puis connectez-vous.</p>
    <a class="btn sec block" href="#connexion" data-nav>Aller à la connexion</a>`);
}
function vNewPassword() {
  return authShell(`<h1>Nouveau mot de passe</h1>
    <form data-form="newPassword" novalidate>
      <div class="errs" id="errs"></div>
      <div class="field"><label for="n-pw">Nouveau mot de passe</label><input class="inp" id="n-pw" name="pw" type="password" autocomplete="new-password" minlength="8" required><span class="hint">8 caractères minimum.</span></div>
      <div class="field"><label for="n-pw2">Confirmer le mot de passe</label><input class="inp" id="n-pw2" name="pw2" type="password" autocomplete="new-password" required></div>
      <button class="btn pri block" type="submit">Enregistrer le mot de passe</button>
    </form>`);
}
function vRegister(mode = 'signup') {
  const profile = mode === 'profile';
  return authShell(`<h1>${profile ? 'Votre profil de golfeur' : 'Créer un compte'}</h1>
    ${profile ? '<p class="muted" style="margin:0">Dernière étape : complétez votre profil pour rejoindre vos compétitions.</p>' : ''}
    <form data-form="${profile ? 'profileCreate' : 'register'}" novalidate>
      <div class="errs" id="errs"></div>
      <div class="fgrid">
        <div class="field"><label for="r-fn">Prénom</label><input class="inp" id="r-fn" name="firstName" autocomplete="given-name" required></div>
        <div class="field"><label for="r-ln">Nom</label><input class="inp" id="r-ln" name="lastName" autocomplete="family-name" required></div>
        ${profile ? '' : '<div class="field full"><label for="r-email">E-mail</label><input class="inp" id="r-email" name="email" type="email" inputmode="email" autocomplete="email" required></div>'}
        <div class="field full"><label for="r-hcp">Index / handicap</label><input class="inp" id="r-hcp" name="handicap" inputmode="decimal" placeholder="Ex. 28,4" required><span class="hint">Vous pourrez le modifier à tout moment dans votre profil.</span></div>
        ${profile ? '' : `<div class="field"><label for="r-pw">Mot de passe</label><input class="inp" id="r-pw" name="pw" type="password" autocomplete="new-password" minlength="8" required><span class="hint">8 caractères minimum.</span></div>
        <div class="field"><label for="r-pw2">Confirmation</label><input class="inp" id="r-pw2" name="pw2" type="password" autocomplete="new-password" required></div>`}
      </div>
      <button class="btn pri block" type="submit">${profile ? 'Enregistrer mon profil' : 'Créer mon compte'}</button>
      ${profile ? '<button class="btn ghost" type="button" data-a="logout">Se déconnecter</button>' : '<a href="#connexion" data-nav>J\'ai déjà un compte · Connexion</a>'}
    </form>`);
}

/* ---------- Accueil ---------- */
function compCard(c) {
  const st = standings(c.id); const mine = st.find(r => r.uid === S.uid);
  const nr = nextRound(c.id);
  return `<a class="ccard" href="#c/${esc(c.id)}/apercu" data-nav>
    <div class="ccard-img"><img class="cover-img" src="${esc(coverOf(c.id))}" alt="" loading="lazy" decoding="async"></div>
    <div class="ccard-body">
      <div class="row" style="align-items:flex-start"><div class="grow"><h3>${esc(c.name)}</h3>
        <div class="small muted">${plural(membersOf(c.id).length, 'joueur')} · ${plural(roundsOf(c.id).length, 'manche')}</div></div>
        ${isAdmin(c) ? '<span class="chip gold">Admin</span>' : ''}</div>
      <div class="ccard-stats">
        <div><b class="num">${posHtml(mine)}</b><span>position</span></div>
        <div><b class="num">${dec(mine && mine.avg)}</b><span>moyenne</span></div>
        <div><b class="num">${mine ? mine.played : 0}</b><span>${mine && mine.played > 1 ? 'manches jouées' : 'manche jouée'}</span></div>
      </div>
      <div class="next">${ic.cal}<div class="grow ellip">${nr ? `<b>${esc(fDate(nr.date))}</b> · ${esc(nr.snapshot.courseName)}` : '<span class="muted">Aucune manche prévue</span>'}</div><span class="chev">${ic.chev}</span></div>
    </div>
  </a>`;
}
function myRoundItems(filter) {
  const out = [];
  for (const c of myComps()) for (const r of roundsOf(c.id)) { const ph = phase(r); if (filter(r, ph, entry(r.id, S.uid))) out.push({ r, c, ph }); }
  return out;
}
function vHome() {
  const u = me(); const comps = myComps();
  const live = myRoundItems((r, ph, e) => ph === 'live' && e && e.status === 'yes' && !e.submitted);
  const upcoming = myRoundItems((r, ph) => ph === 'upcoming').sort((a, b) => a.r.date.localeCompare(b.r.date)).slice(0, 4);
  const recent = [];
  for (const c of comps) for (const r of roundsOf(c.id)) { const e = entry(r.id, S.uid); if (e && e.status === 'yes' && e.submitted) recent.push({ r, c, e, card: cardOf(e, r, c) }); }
  recent.sort((a, b) => b.r.date.localeCompare(a.r.date));
  const hour = new Date().getHours();
  const hero = `<div class="phero photo"><img class="cover-img" src="${esc(PHOTOS.home)}" alt="" decoding="async"><div class="scrim"></div>
    <div class="phero-in"><h1>${hour >= 18 ? 'Bonsoir' : 'Bonjour'} ${esc(u.firstName)}</h1><p class="phero-sub">Index ${idx1(u.handicap)}${comps.length ? ' · ' + plural(comps.length, 'compétition') : ''}</p></div></div>`;
  let html = '';
  if (live.length) {
    const { r, c } = live[0]; const e = entry(r.id, S.uid); const card = cardOf(e, r, c);
    html += `<div class="hero lift"><div class="row"><span class="chip live">En cours</span><span class="small muted ellip">${esc(c.name)}</span></div>
      <h2>${esc(r.name)}<br><span style="color:var(--gold)">${esc(r.snapshot.courseName)}</span></h2>
      <div class="row" style="gap:28px"><div class="stat"><span class="v">${card.pts}</span><span class="l">points</span></div><div class="stat"><span class="v">${card.played}/${card.n}</span><span class="l">trous</span></div></div>
      <a class="btn pri block" href="#r/${esc(r.id)}/score/${esc(S.uid)}" data-nav>${ic.play} ${card.played ? 'Reprendre ma carte' : 'Commencer ma carte'}</a></div>`;
  }
  if (!comps.length) {
    html += empty('Vous ne participez encore à aucune compétition.', `<a class="btn pri" href="#creer" data-nav>${ic.plus} Créer une compétition</a><a class="btn sec" href="#rejoindre" data-nav>Rejoindre une compétition</a>`, ic.trophy, 'Créez votre saison et invitez vos amis avec un code, ou rejoignez celle d\'un ami.');
    return { title: 'Accueil', html, brand: true, hero };
  }
  html += `<div class="sec"><div class="sec-h"><h2 class="h2">Mes compétitions</h2><a href="#competitions" data-nav>Tout voir</a></div><div class="cards">${comps.slice(0, 4).map(compCard).join('')}</div></div>`;
  html += `<div class="grid2">`;
  html += `<div class="sec"><div class="sec-h"><h2 class="h2">Prochaines manches</h2></div>${upcoming.length ? `<div class="list">${upcoming.map(({ r, c }) => `
      <div class="li" style="flex-direction:column;align-items:stretch;gap:10px"><a class="row" href="#r/${esc(r.id)}" data-nav style="text-decoration:none;color:inherit">${dateTile(r.date)}<div class="grow"><div class="t ellip">${esc(r.name)}</div><div class="s ellip">${esc(r.snapshot.courseName)} · ${esc(c.name)}</div></div><span class="chev">${ic.chev}</span></a>
      ${rsvpButtons(r, S.uid, true)}</div>`).join('')}</div>` : '<p class="muted small" style="margin:0">Aucune manche à venir.</p>'}</div>`;
  html += `<div class="sec"><div class="sec-h"><h2 class="h2">Derniers résultats</h2></div>${recent.length ? `<div class="list">${recent.slice(0, 4).map(({ r, c, card }) => {
      const pos = finalPositions(r, c).get(S.uid);
      return `<a class="li" href="#r/${esc(r.id)}" data-nav>${dateTile(r.date)}<div class="grow"><div class="t ellip">${esc(r.name)}</div><div class="s ellip">${esc(r.snapshot.courseName)}${pos ? ` · ${ord(pos.pos)} sur ${pos.of}` : ''}</div></div><div class="lb-val"><b>${card.pts}</b><span>pts</span></div></a>`;
    }).join('')}</div>` : '<p class="muted small" style="margin:0">Vos résultats apparaîtront ici après votre première carte validée.</p>'}</div>`;
  html += `</div><div class="btns"><a class="btn sec" href="#creer" data-nav>${ic.plus} Créer une compétition</a><a class="btn sec" href="#rejoindre" data-nav>Rejoindre une compétition</a></div>`;
  return { title: 'Accueil', html, brand: true, hero };
}

/* ---------- Compétitions ---------- */
function vComps() {
  const comps = myComps();
  const mine = comps.filter(c => isAdmin(c)), other = comps.filter(c => !isAdmin(c));
  let html = `<div class="btns"><a class="btn pri" href="#creer" data-nav>${ic.plus} Créer une compétition</a><a class="btn sec" href="#rejoindre" data-nav>Rejoindre une compétition</a></div>`;
  if (!comps.length) html += empty('Vous ne participez encore à aucune compétition.', '', ic.trophy);
  if (mine.length) html += `<div class="sec"><h2 class="h2">Créées par moi</h2><div class="cards">${mine.map(compCard).join('')}</div></div>`;
  if (other.length) html += `<div class="sec"><h2 class="h2">Auxquelles je participe</h2><div class="cards">${other.map(compCard).join('')}</div></div>`;
  html += `<a class="card tap row" href="#parcours" data-nav>${ic.map}<div class="grow"><b>Parcours</b><div class="small muted">${S.data.courses.size} parcours enregistrés · trous, par, index et départs</div></div><span class="chev">${ic.chev}</span></a>`;
  return { title: 'Compétitions', html, brand: true, large: true };
}
function compForm(c) {
  const y = new Date().getFullYear();
  return `<div class="field"><label for="c-name">Nom de la compétition</label><input class="inp" id="c-name" name="name" required placeholder="Eagle Touch Championship ${y + 1}" value="${esc(c ? c.name : '')}"></div>
    <div class="field"><label for="c-desc">Description</label><textarea class="inp" id="c-desc" name="description" placeholder="Règlement, esprit de la saison…">${esc(c ? c.description : '')}</textarea></div>
    <div class="field"><label for="c-min">Nombre minimum de manches</label><input class="inp" id="c-min" name="minRounds" inputmode="numeric" required placeholder="Ex. 6" value="${esc(c ? String(c.minRounds ?? 0) : '')}" style="max-width:160px">
      <span class="hint">Un joueur qui a joué moins de manches à la fin de la saison est éliminé du classement. Mettez 0 pour ne pas fixer de minimum.</span></div>
    <div class="fgrid"><div class="field"><label for="c-start">Début</label><input class="inp" id="c-start" name="startDate" type="date" required value="${esc(c ? c.startDate : todayISO())}"></div>
    <div class="field"><label for="c-end">Fin de la saison</label><input class="inp" id="c-end" name="endDate" type="date" value="${esc(c ? c.endDate || '' : '')}"></div></div>`;
}
function vCreate() {
  return { title: 'Créer une compétition', back: 'competitions', form: true, html: `<div class="card"><form data-form="compCreate" novalidate><div class="errs" id="errs"></div>${compForm(null)}
    <p class="small muted" style="margin:0">Vous deviendrez l'administrateur de la compétition. Un code d'invitation sera créé pour vos joueurs.</p>
    <button class="btn pri block" type="submit">Créer la compétition</button></form></div>` };
}
function vJoin(code) {
  return { title: 'Rejoindre une compétition', back: 'competitions', form: true, html: `<div class="card"><form data-form="join" novalidate>
    <div class="errs" id="errs"></div>
    <div class="field"><label for="j-code">Code de la compétition</label><input class="inp code" id="j-code" name="code" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="ET-2027-GENT" value="${esc(code || '')}" style="font-size:24px;text-align:center"><span class="hint">Demandez ce code à l'administrateur de la compétition.</span></div>
    <button class="btn pri block" type="submit">Rejoindre la compétition</button></form></div>` };
}

/* ---------- Compétition : onglets ---------- */
function compTabs(c, cur) {
  const t = [['apercu', 'Aperçu'], ['manches', 'Manches'], ['classement', 'Classement'], ['defis', 'Défis'], ['joueurs', 'Joueurs']];
  if (isAdmin(c)) t.push(['parametres', 'Paramètres']);
  return t.map(([k, l]) => `<a href="#c/${esc(c.id)}/${k}" data-nav class="${k === cur ? 'on' : ''}" ${k === cur ? 'aria-current="page"' : ''}>${l}</a>`).join('');
}
function roundItem(r, showRsvp) {
  const e = entry(r.id, S.uid);
  return `<div class="li" style="flex-direction:column;align-items:stretch;gap:10px">
    <a class="row" href="#r/${esc(r.id)}" data-nav style="text-decoration:none;color:inherit">${dateTile(r.date)}
      <div class="grow"><div class="t ellip">${esc(r.name)}</div><div class="s ellip">${esc(r.snapshot.courseName)} · ${r.snapshot.holes.length} trous${r.teeTime ? ' · ' + esc(r.teeTime) : ''}</div></div>
      <div class="stack" style="align-items:flex-end;gap:4px">${phaseChip(r)}${phase(r) !== 'done' ? rsvpChip(e) : ''}</div></a>
    ${showRsvp && phase(r) === 'upcoming' && isMember(r.competitionId) ? rsvpButtons(r, S.uid, true) : ''}</div>`;
}
function vComp(cid, tab) {
  const c = comp(cid);
  if (!c) return notFound('Cette compétition n\'existe plus.');
  if (!isMember(cid) && !isAdmin(c)) return notFound('Vous ne faites pas partie de cette compétition.');
  const admin = isAdmin(c);
  const nR = roundsOf(cid).length;
  const hero = `<div class="phero photo short"><img class="cover-img" src="${esc(coverOf(c.id))}" alt="" decoding="async"><div class="scrim"></div>
    <div class="phero-in"><h1>${esc(c.name)}</h1><p class="phero-sub">${plural(membersOf(cid).length, 'joueur')} · ${plural(nR, 'manche')}${admin ? ' · administrateur' : ''}</p></div></div>`;
  const base = { title: c.name, back: 'competitions', tabs: compTabs(c, tab), hero };
  if (tab === 'manches') {
    const rs = roundsOf(cid);
    let html = admin ? `<a class="btn pri" href="#c/${esc(cid)}/nouvelle-manche" data-nav>${ic.plus} Créer une manche</a>` : '';
    html += rs.length ? `<div class="list">${rs.map(r => roundItem(r, true)).join('')}</div>` : empty("Aucune manche n'a encore été créée.", admin ? `<a class="btn pri" href="#c/${esc(cid)}/nouvelle-manche" data-nav>Créer une manche</a>` : '', ic.cal);
    return { ...base, html };
  }
  if (tab === 'classement') {
    const st = standings(cid);
    return { ...base, html: `<div class="sec"><div><h2 class="h2">Classement général</h2><p class="sub">Moyenne Stableford des manches jouées</p></div>${leaderboard(st, cid)}</div>
      ${minOf(comp(cid)) ? `<div class="rule"><b>Minimum ${plural(minOf(comp(cid)), 'manche')}.</b> ${seasonOver(comp(cid)) ? `La saison est terminée : les joueurs avec moins de ${plural(minOf(comp(cid)), 'manche')} jouée${minOf(comp(cid)) > 1 ? 's' : ''} sont éliminés du classement.` : `À la fin de la saison${comp(cid).endDate ? ' (' + esc(fDate(comp(cid).endDate)) + ')' : ''}, un joueur avec moins de ${plural(minOf(comp(cid)), 'manche')} jouée${minOf(comp(cid)) > 1 ? 's' : ''} est éliminé du classement.`}${!comp(cid).endDate && isAdmin(comp(cid)) ? ` <a href="#c/${esc(cid)}/parametres" data-nav>Indiquez la date de fin</a> pour clôturer la saison.` : ''}</div>` : ''}
      <p class="small muted" style="margin:0">Seules les cartes validées comptent. Une manche non jouée n'est pas comptée comme zéro : elle n'entre simplement pas dans la moyenne.</p>` };
  }
  if (tab === 'defis') {
    const act = activeCh(c);
    if (!act.length) return { ...base, html: empty('Aucun défi n\'est activé pour cette compétition.', admin ? `<a class="btn pri" href="#c/${esc(cid)}/parametres" data-nav>Activer des défis</a>` : '', ic.trophy) };
    const tot = challengeTotals(cid);
    return { ...base, html: `<div><h2 class="h2">Classements des défis</h2><p class="sub">Cartes validées, sur toute la compétition</p></div>
      <div class="cards c3">${act.map(ch => chBoardHtml(ch, tot, { cid })).join('')}</div>` };
  }
  if (tab === 'joueurs') {
    const ms = membersOf(cid).sort((a, b) => fullName(a.userId).localeCompare(fullName(b.userId)));
    let html = '';
    if (admin) html += `<div class="card stack"><h2 class="h2">Inviter des joueurs</h2><div class="row wrap"><span class="code grow">${esc(c.code)}</span><button class="btn sec sm" data-a="copy" data-t="${esc(c.code)}">${ic.copy} Copier le code</button></div>
      <p class="small muted" style="margin:0">Partagez le lien d'Eagle Touch avec ce code : vos joueurs le saisissent dans « Rejoindre une compétition ».</p>
      <details class="more"><summary>Ajouter un joueur sans compte <span class="chev">${ic.plus}</span></summary><div class="in"><form data-form="guestAdd" data-c="${esc(cid)}" novalidate>
        <div class="errs" id="errs"></div>
        <div class="fgrid"><div class="field"><label for="g-fn">Prénom</label><input class="inp" id="g-fn" name="firstName" required></div><div class="field"><label for="g-ln">Nom</label><input class="inp" id="g-ln" name="lastName"></div>
        <div class="field full"><label for="g-hcp">Index</label><input class="inp" id="g-hcp" name="handicap" inputmode="decimal" placeholder="Ex. 17,2"></div></div>
        <p class="small muted" style="margin:0">Vous gérez sa participation et saisissez ses scores.</p>
        <button class="btn pri" type="submit">Ajouter le joueur</button></form></div></details></div>`;
    html += ms.length ? `<div class="list">${ms.map(m => {
      const p = P(m.userId) || {};
      return `<div class="li"><a class="row grow" href="#c/${esc(cid)}/joueur/${esc(m.userId)}" data-nav style="text-decoration:none;color:inherit">${avatar(m.userId)}<div class="grow"><div class="t ellip">${esc(fullName(m.userId))}${m.userId === S.uid ? ' <span class="muted">(vous)</span>' : ''}</div><div class="s">Index ${idx1(p.handicap)}${p.managedBy ? ' · joueur sans compte' : ''}</div></div></a>
        ${isAdmin(c, m.userId) ? '<span class="chip gold">Admin</span>' : admin ? `<button class="btn danger sm" data-a="removeMember" data-c="${esc(cid)}" data-u="${esc(m.userId)}" aria-label="Retirer">${ic.trash}</button>` : ''}</div>`;
    }).join('')}</div>` : empty("Aucun joueur n'a encore rejoint cette compétition.", '', ic.users);
    return { ...base, html, form: false };
  }
  if (tab === 'parametres') {
    if (!admin) return notFound('Seul l\'administrateur peut modifier les paramètres de la compétition.');
    const al = c.allowance ?? 100;
    return { ...base, form: true, html: `<div class="card"><form data-form="compEdit" data-c="${esc(cid)}" novalidate><h2 class="h2">Paramètres de la compétition</h2><div class="errs" id="errs"></div>${compForm(c)}
      <div class="field"><span class="flabel">Handicap de jeu (allowance)</span><div class="seg">${[100, 95, 90, 85].map(v => `<label><input type="radio" name="allowance" value="${v}" ${al === v ? 'checked' : ''}><span>${v} %</span></label>`).join('')}</div>
      <span class="hint">Pourcentage du handicap de parcours accordé. Appliqué aux manches dont les cartes ne sont pas encore commencées.</span></div>
      <div class="field"><span class="flabel">Défis de la compétition</span><div class="pick">${CHALLENGES.map(ch => `<label><input type="checkbox" name="ch-${ch.k}" ${chOn(c, ch.k) ? 'checked' : ''}><span class="grow"><b>${esc(ch.label)}</b><br><span class="small muted">${esc(ch.hint)}</span></span></label>`).join('')}</div></div>
      <button class="btn pri block" type="submit">Enregistrer</button></form></div>
      <div class="card stack"><h2 class="h2">Code d'invitation</h2><div class="row wrap"><span class="code grow">${esc(c.code)}</span><button class="btn sec sm" data-a="regenCode" data-c="${esc(cid)}">Générer un nouveau code</button></div></div>
      <a class="card tap row" href="#parcours" data-nav>${ic.map}<div class="grow"><b>Gérer les parcours</b><div class="small muted">Trous, par, index, départs, course rating et slope</div></div><span class="chev">${ic.chev}</span></a>
      <div class="card stack"><h2 class="h2" style="color:var(--bad)">Zone sensible</h2><p class="small muted" style="margin:0">Supprime la compétition, ses manches et toutes les cartes de score. Cette action est définitive.</p><button class="btn danger" data-a="deleteComp" data-c="${esc(cid)}">${ic.trash} Supprimer la compétition</button></div>` };
  }
  /* Aperçu */
  const st = standings(cid); const mine = st.find(r => r.uid === S.uid);
  const nr = nextRound(cid);
  const lastDone = roundsOf(cid).filter(r => phase(r) === 'done').pop();
  let html = mine ? `<div class="band4"><div><b class="num">${posHtml(mine)}</b><span>ma position</span></div><div><b class="num">${dec(mine.avg)}</b><span>ma moyenne</span></div><div><b class="num">${mine.played}</b><span>${mine.played > 1 ? 'manches jouées' : 'manche jouée'}</span></div><div><b class="num">${mine.total}</b><span>points au total</span></div></div>` : '';
  html += `<p class="small muted" style="margin:0">${esc(fDate(c.startDate))}${c.endDate ? ' au ' + esc(fDate(c.endDate)) : ''}${c.description ? '<br>' + esc(c.description) : ''}</p>`;
  html += `<div class="grid2"><div class="sec"><h2 class="h2">Prochaine manche</h2>${nr ? `<div class="card stack"><a class="row" href="#r/${esc(nr.id)}" data-nav style="text-decoration:none;color:inherit">${dateTile(nr.date)}<div class="grow"><div style="font-weight:700" class="ellip">${esc(nr.name)}</div><div class="small muted ellip">${esc(nr.snapshot.courseName)} · ${nr.snapshot.holes.length} trous${nr.teeTime ? ' · départ ' + esc(nr.teeTime) : ''}</div></div>${phaseChip(nr)}</a>
      ${phase(nr) === 'upcoming' ? rsvpButtons(nr, S.uid) : `<a class="btn pri" href="#r/${esc(nr.id)}" data-nav>Voir la manche</a>`}</div>` : empty(admin ? "Aucune manche n'a encore été créée." : 'Aucune manche prévue pour le moment.', admin ? `<a class="btn pri" href="#c/${esc(cid)}/nouvelle-manche" data-nav>Créer une manche</a>` : '', ic.cal)}
      ${lastDone ? `<h2 class="h2" style="margin-top:14px">Dernière manche · ${esc(lastDone.name)}</h2>${roundBoardHtml(lastDone, c)}` : ''}</div>
    <div class="sec"><div class="sec-h"><h2 class="h2">Classement général</h2><a href="#c/${esc(cid)}/classement" data-nav>Tout voir</a></div>${leaderboard(st, cid, 5)}</div></div>`;
  return { ...base, html };
}

/* ---------- Joueur ---------- */
function vPlayer(cid, uid) {
  const c = comp(cid); if (!c || !isMember(cid, uid)) return notFound('Ce joueur ne fait pas partie de la compétition.');
  const st = standings(cid); const s = st.find(r => r.uid === uid);
  const p = P(uid) || {};
  const res = [...s.results].sort((a, b) => b.round.date.localeCompare(a.round.date));
  let html = `<div class="idband"><div class="row">${avatar(uid, 'lg')}<div class="grow"><h2>${esc(fullName(uid))}</h2><div class="idsub">Index actuel ${idx1(p.handicap)} · ${esc(c.name)}</div></div></div>
    <div class="band4 in"><div><b class="num">${posHtml(s)}</b><span>position</span></div><div><b class="num">${dec(s.avg)}</b><span>moyenne</span></div><div><b class="num">${s.played}</b><span>${s.played > 1 ? 'manches jouées' : 'manche jouée'}</span></div><div><b class="num">${s.total}</b><span>points au total</span></div></div></div>
    ${activeCh(c).length ? (() => { const t = challengeTotals(cid).find(x => x.uid === uid); return `<div class="sec"><h2 class="h2">Défis</h2><div class="chtiles">${activeCh(c).map(ch => `<div class="chtile"><span class="ch-ico ch-${ch.k}">${ch.badge}</span><b class="num">${t[ch.k]}</b><span>${esc(ch.label)}</span></div>`).join('')}</div></div>`; })() : ''}
    <div class="sec"><h2 class="h2">Résultats par manche</h2>${res.length ? `<div class="list">${res.map(x => {
      const pos = finalPositions(x.round, c).get(uid); const h = entryHcp(x.entry, x.round, c);
      return `<a class="li" href="#r/${esc(x.round.id)}/carte/${esc(uid)}" data-nav>${dateTile(x.round.date)}<div class="grow"><div class="t ellip">${esc(x.round.name)}</div><div class="s ellip">${esc(x.round.snapshot.courseName)} · index ${idx1(h.hi)} → hcp de jeu ${h.ph}${pos ? ` · ${ord(pos.pos)} sur ${pos.of}` : ''}</div></div><div class="lb-val"><b>${x.pts}</b><span>pts</span></div></a>`;
    }).join('')}</div>` : '<p class="muted small" style="margin:0">Aucune manche jouée pour le moment.</p>'}</div>`;
  if (isAdmin(c) && p.managedBy) html += `<div class="card"><form data-form="guestIndex" data-u="${esc(uid)}" novalidate><h2 class="h2">Joueur sans compte</h2><div class="errs" id="errs"></div>
    <div class="field"><label for="gi-hcp">Index actuel</label><input class="inp" id="gi-hcp" name="handicap" inputmode="decimal" value="${esc(p.handicap ?? '')}"></div><button class="btn sec" type="submit">Mettre à jour l'index</button></form></div>`;
  return { title: fullName(uid), back: `c/${cid}/classement`, html };
}

/* ---------- Manche ---------- */
function vRound(rid) {
  const r = round(rid); if (!r) return notFound('Cette manche n\'existe plus.');
  const c = comp(r.competitionId); if (!c || (!isMember(c.id) && !isAdmin(c))) return notFound('Vous ne faites pas partie de cette compétition.');
  const admin = isAdmin(c); const ph = phase(r); const s = r.snapshot;
  const e = entry(rid, S.uid); const member = isMember(c.id);
  const ms = membersOf(c.id);
  const yes = ms.filter(m => (entry(rid, m.userId) || {}).status === 'yes');
  const no = ms.filter(m => (entry(rid, m.userId) || {}).status === 'no');
  const wait = ms.filter(m => !entry(rid, m.userId));
  const par = s.holes.reduce((a, h) => a + h.par, 0);

  const hero = `<div class="phero band"><canvas id="green-art" aria-hidden="true"></canvas>
    <div class="phero-in"><p class="phero-kick">${esc(c.name)}</p><h1>${esc(r.name)}</h1><p class="phero-sub">${esc(fDateL(r.date))}${r.teeTime ? ' · départ ' + esc(r.teeTime) : ''}<br>${esc(s.courseName)}</p>${phaseChip(r)}</div></div>`;
  const header = `<div class="sec"><h2 class="h2">Détails</h2><div class="card stack">
    <dl class="kv"><dt>Parcours</dt><dd>${esc(s.courseName)}${s.location ? ', ' + esc(s.location) : ''}</dd>
    <dt>Trous</dt><dd>${s.loopNames ? esc(s.loopNames.join(' + ')) + ' · ' : ''}${s.holes.length} trous${s.mode === '9a' ? ' (1 à 9)' : s.mode === '9r' ? ' (10 à 18)' : ''} · par ${par}</dd>
    <dt>Départ</dt><dd>${s.tee ? `<span class="row" style="justify-content:flex-end;gap:6px"><span class="tee-dot" style="background:${esc(s.tee.color || '#ccc')}"></span>${esc(s.tee.name)}${s.tee.cr ? ` · CR ${dec(s.tee.cr, 1)} / Slope ${esc(s.tee.slope)}` : ''}</span>` : '-'}</dd>
    ${r.teeTime ? `<dt>Heure de départ</dt><dd>${esc(r.teeTime)}</dd>` : ''}
    ${r.deadline ? `<dt>Inscriptions</dt><dd>${deadlinePassed(r) ? 'Clôturées' : "Jusqu'au " + esc(fDate(r.deadline))}</dd>` : ''}
    ${chOn(c, 'ld') ? `<dt>Long drive</dt><dd>${r.ldHole != null && s.holes[r.ldHole] ? esc(s.holes[r.ldHole].lbl || 'Trou ' + s.holes[r.ldHole].n) : 'Aucun trou choisi'}</dd>` : ''}
    ${chOn(c, 'ntp') ? `<dt>Plus près du drapeau</dt><dd>${r.ntpHole != null && s.holes[r.ntpHole] ? esc(s.holes[r.ntpHole].lbl || 'Trou ' + s.holes[r.ntpHole].n) : 'Aucun par 3 choisi'}</dd>` : ''}
    <dt>Inscrits</dt><dd>${yes.length} participent · ${wait.length} sans réponse</dd></dl>
    ${r.description ? `<p style="margin:0" class="muted">${esc(r.description)}</p>` : ''}</div></div>`;

  const myBlock = member ? (() => {
    let b = `<div class="card stack"><h2 class="h2">Ma participation</h2>`;
    if (ph === 'done' && !(e && e.status === 'yes')) b += `<div>${rsvpChip(e)}</div>`;
    else if (!(e && e.submitted)) b += rsvpButtons(r, S.uid);
    if (e && e.status === 'yes') {
      const h = entryHcp(e, r, c); const card = cardOf(e, r, c);
      b += `<div class="hflow"><div><b class="num">${idx1(h.hi)}</b><span>index</span></div><div><b class="num">${h.ch}</b><span>hcp de parcours</span></div><div class="on"><b class="num">${h.ph}</b><span>hcp de jeu${h.locked ? ' · figé' : ''}</span></div></div>`;
      if (e.submitted) b += `<div class="row"><div class="grow"><b>Carte validée</b> · ${card.pts} points</div><a class="btn sec sm" href="#r/${esc(rid)}/carte/${esc(S.uid)}" data-nav>${ic.card} Ma carte</a></div>`;
      else if (ph !== 'upcoming' || card.played) b += `<a class="btn pri block" href="#r/${esc(rid)}/score/${esc(S.uid)}" data-nav>${ic.play} ${card.played ? `Reprendre ma carte · ${card.pts} pts` : 'Saisir mon score'}</a>`;
      else b += `<a class="btn sec block" href="#r/${esc(rid)}/score/${esc(S.uid)}" data-nav>${ic.card} Ouvrir la carte de score</a>`;
    }
    if (!canRsvp(r, c, S.uid) && deadlinePassed(r) && !(e && e.submitted) && ph === 'upcoming') b += `<p class="small muted" style="margin:0">La date limite d'inscription est passée. Contactez l'administrateur pour modifier votre réponse.</p>`;
    return b + '</div>';
  })() : '';

  const people = `<div class="sec"><h2 class="h2">Joueurs</h2><div class="list">${[...yes, ...wait, ...no].map(m => {
    const pe = entry(rid, m.userId);
    return `<div class="li">${avatar(m.userId, 'sm')}<div class="grow"><div class="t ellip">${esc(fullName(m.userId))}</div><div class="s">${rsvpChip(pe)}</div></div>
      ${admin && !(pe && pe.submitted) ? `<div class="mini-rsvp"><button class="y ${pe && pe.status === 'yes' ? 'on' : ''}" data-a="rsvp" data-r="${esc(rid)}" data-u="${esc(m.userId)}" data-s="yes" aria-label="Participe">${ic.check}</button><button class="n ${pe && pe.status === 'no' ? 'on' : ''}" data-a="rsvp" data-r="${esc(rid)}" data-u="${esc(m.userId)}" data-s="no" aria-label="Ne participe pas">${ic.x}</button></div>` : ''}</div>`;
  }).join('') || '<div class="li muted">Aucun joueur dans la compétition.</div>'}</div></div>`;

  const board = `<div class="sec"><div class="sec-h"><h2 class="h2">Classement · ${esc(r.name)}</h2>${ph === 'live' ? '<span class="chip live">En direct</span>' : ''}</div>${roundBoardHtml(r, c)}</div>`;

  const holesTbl = `<details class="more"><summary>Informations du parcours <span class="chev">${ic.chev}</span></summary><div class="sc-wrap" style="border:0;border-radius:0"><table class="sc"><thead><tr><th>Trou</th><th>Par</th><th>Index</th><th>Distance</th></tr></thead><tbody>${s.holes.map(h => `<tr><td><b>${h.n}</b></td><td>${h.par}</td><td>${h.si}</td><td>${h.dist ? h.dist + ' m' : '-'}</td></tr>`).join('')}<tr class="sub"><td>Total</td><td>${par}</td><td></td><td>${s.holes.some(h => h.dist) ? s.holes.reduce((a, h) => a + (h.dist || 0), 0) + ' m' : '-'}</td></tr></tbody></table></div></details>`;

  const adminBlock = admin ? `<div class="card stack"><h2 class="h2">Administration de la manche</h2>
    ${yes.length ? `<div class="stack"><span class="small muted">Handicap de jeu (HJ) et carte de chaque participant</span>${yes.map(m => {
      const pe = entry(rid, m.userId); const h = entryHcp(pe, r, c); const card = cardOf(pe, r, c);
      return `<div class="adm-row"><div class="grow"><b class="ellip" style="display:block">${esc(fullName(m.userId))}</b><div class="small muted">Index ${idx1(h.hi)} · parcours ${h.ch}${h.manual ? ' · ajusté' : ''}</div></div>
        <label class="sr" for="ph-${esc(m.userId)}">Handicap de jeu</label><input class="inp ph" id="ph-${esc(m.userId)}" inputmode="numeric" value="${h.ph}" title="Handicap de jeu" data-a="setPh" data-r="${esc(rid)}" data-u="${esc(m.userId)}" ${pe.submitted ? 'disabled' : ''}>
        <a class="btn sec sm" href="#r/${esc(rid)}/score/${esc(m.userId)}" data-nav>${pe.submitted ? 'Carte validée' : card.played ? card.played + '/' + card.n : 'Saisir'}</a></div>`;
    }).join('')}</div>` : ''}
    <div class="btns"><a class="btn sec sm" href="#r/${esc(rid)}/modifier" data-nav>${ic.edit} Modifier la manche</a>
    ${r.status === 'closed' ? `<button class="btn sec sm" data-a="reopenRound" data-r="${esc(rid)}">Rouvrir la manche</button>` : `<button class="btn sec sm" data-a="closeRound" data-r="${esc(rid)}">Clôturer la manche</button>`}
    <button class="btn danger sm" data-a="deleteRound" data-r="${esc(rid)}">${ic.trash} Supprimer</button></div>
    <p class="small muted" style="margin:0">Clôturer verrouille les cartes. Seules les cartes validées comptent dans la moyenne.</p></div>` : '';

  /* L'ordre des blocs suit le moment de la manche. */
  let parts;
  if (ph === 'upcoming') parts = [myBlock, header, people, holesTbl, adminBlock];
  else if (ph === 'live') parts = [myBlock, board, header, people, holesTbl, adminBlock];
  else parts = [board, myBlock, header, holesTbl, people, adminBlock];
  return { title: r.name, back: `c/${c.id}/manches`, html: parts.join(''), hero };
}

/* ---------- Saisie hole par trou ---------- */
function scorePlayers(r, c) {
  const all = entriesOf(r.id).filter(e => e.status === 'yes' && isMember(c.id, e.userId));
  return all.filter(e => canScore(r, c, e.userId) || e.userId === S.uid).map(e => e.userId)
    .sort((a, b) => (a === S.uid ? -1 : b === S.uid ? 1 : fullName(a).localeCompare(fullName(b))));
}
const NETL = d => d <= -3 ? 'Albatros net' : d === -2 ? 'Eagle net' : d === -1 ? 'Birdie net' : d === 0 ? 'Par net' : d === 1 ? 'Bogey net' : 'Double bogey net ou pire';
function vScore(rid, uid) {
  const r = round(rid); if (!r) return notFound('Cette manche n\'existe plus.');
  const c = comp(r.competitionId); const e = entry(rid, uid);
  if (!c || !e || e.status !== 'yes') return notFound('Ce joueur ne participe pas à cette manche.');
  if (!canScore(r, c, uid)) return vCard(rid, uid);
  const holes = r.snapshot.holes; const n = holes.length;
  const card = cardOf(e, r, c); const h = entryHcp(e, r, c);
  const key = rid + uid;
  if (S.ui.hole[key] == null) { const f = card.rows.findIndex(x => x.gross == null); S.ui.hole[key] = f < 0 ? n - 1 : f; }
  const i = Math.min(S.ui.hole[key], n - 1);
  const row = card.rows[i];
  const g = row.gross;
  const ptsTxt = g == null ? '-' : row.pts;
  const label = g == null ? 'Touchez le chiffre pour inscrire le par' : g === 0 ? (chOn(c, 'croix') ? 'Balle relevée · 0 point · croix' : 'Balle relevée · 0 point') : NETL(row.net - row.par);
  const players = scorePlayers(r, c);
  const q = [[row.par - 1, 'Birdie'], [row.par, 'Par'], [row.par + 1, 'Bogey'], [row.par + 2, 'Double']];
  const act = activeCh(c); const es = entriesOf(rid).filter(x => x.status === 'yes');
  const who = u => u === S.uid ? 'Vous' : firstName(u);
  const chRows = [];
  if (chOn(c, 'nains')) { const v = (e.nains || [])[i] || 0; chRows.push(`<div class="chrow"><span class="ch-ico ch-nains">N</span><div class="grow"><b>Nains</b><div class="small muted">Premier coup perdu ou resté avant les départs</div></div><div class="mini-step"><button data-a="nains" data-d="-1" ${v ? '' : 'disabled'} aria-label="Retirer un nain">${ic.minus}</button><b class="num">${v}</b><button data-a="nains" data-d="1" aria-label="Ajouter un nain">${ic.plus}</button></div></div>`); }
  if (chOn(c, 'ld') && r.ldHole === i) { const h = es.find(x => (x.ld || [])[i]); const mine = h && h.userId === uid; chRows.push(`<div class="chrow"><span class="ch-ico ch-ld">LD</span><div class="grow"><b>Long drive</b><div class="small muted">${h ? esc(who(h.userId)) + ' · plus long drive' : 'Le trou du défi long drive'}</div></div><button class="chip-btn ${mine ? 'on' : ''}" data-a="chWin" data-k="ld" aria-pressed="${!!mine}">${mine ? ic.check + ' ' + esc(who(uid)) : 'Attribuer'}</button></div>`); }
  if (chOn(c, 'ntp') && r.ntpHole === i) { const h = es.find(x => x.ntp); const mine = h && h.userId === uid; chRows.push(`<div class="chrow"><span class="ch-ico ch-ntp">PP</span><div class="grow"><b>Plus près du drapeau</b><div class="small muted">${h ? esc(who(h.userId)) + ' · le plus près' : 'Le par 3 du défi'}</div></div><button class="chip-btn ${mine ? 'on' : ''}" data-a="chWin" data-k="ntp" aria-pressed="${!!mine}">${mine ? ic.check + ' ' + esc(who(uid)) : 'Attribuer'}</button></div>`); }
  const auto = [];
  if (chOn(c, 'croix') && row.gross === 0) auto.push(`<span class="chip no">× Croix comptée</span>`);
  if (chOn(c, 'birdie') && isBirdie(row)) auto.push(`<span class="chip yes">${ic.check} ${row.gross <= row.par - 2 ? 'Eagle ou mieux · compte 1 birdie' : 'Birdie compté'}</span>`);
  const chPanel = act.length && (chRows.length || auto.length) ? `<div class="card stack" style="gap:12px"><h2 class="h2">Défis du trou</h2>${chRows.join('')}${auto.length ? `<div class="badges">${auto.join('')}</div>` : ''}</div>` : '';
  const html = `<div class="score">
    ${players.length > 1 ? `<div class="players" role="tablist">${players.map(u => `<button class="${u === uid ? 'on' : ''}" data-a="go" data-to="r/${esc(rid)}/score/${esc(u)}" role="tab" aria-selected="${u === uid}">${avatar(u, 'sm')}${esc(u === S.uid ? 'Moi' : firstName(u))}</button>`).join('')}</div>` : ''}
    <div class="hole-head"><div class="hno"><small>${row.lbl ? 'Trou · ' + esc(row.lbl) : 'TROU'}</small>${row.n}</div>
      <div class="hole-facts"><div><b>${row.par}</b><span>Par</span></div><div><b>${row.si}</b><span>Index</span></div><div><b>${row.dist ? row.dist : '-'}</b><span>${row.dist ? 'mètres' : 'Distance'}</span></div></div></div>
    <div class="recv">${row.recv > 0 ? `<span class="dots">${'<i></i>'.repeat(Math.min(row.recv, 4))}</span> ${esc(uid === S.uid ? 'Vous recevez' : firstName(uid) + ' reçoit')} ${row.recv} coup${row.recv > 1 ? 's' : ''} sur ce trou` : row.recv < 0 ? `${esc(uid === S.uid ? 'Vous rendez' : firstName(uid) + ' rend')} ${-row.recv} coup sur ce trou` : 'Aucun coup reçu sur ce trou'}</div>
    <div class="stepper"><button class="sb" data-a="step" data-d="-1" aria-label="Un coup de moins">${ic.minus}</button>
      <div class="val num ${g == null ? 'ghost' : ''}" data-a="tapVal" role="button" tabindex="0" aria-label="Nombre de coups">${g == null ? row.par : g === 0 ? '×' : g}<small>${g == null ? 'COUPS' : g === 0 ? 'RELEVÉE' : 'COUPS'}</small></div>
      <button class="sb" data-a="step" data-d="1" aria-label="Un coup de plus">${ic.plus}</button></div>
    <div class="quick">${q.map(([v, l]) => `<button class="${g === v ? 'on' : ''}" data-a="setS" data-v="${v}"><b>${v}</b><span>${l}</span></button>`).join('')}<button class="${g === 0 ? 'on' : ''}" data-a="setS" data-v="0"><b>×</b><span>Relevée</span></button></div>
    <div class="ptsbox"><div><div class="p num">${ptsTxt}<small>pts</small></div><div class="lab">${esc(label)}</div></div>
      <div class="tot"><b class="num">${card.pts}</b><span class="lab">${card.played}/${n} trous · HJ ${h.ph}</span></div></div>
    ${chPanel}
    <div class="strip" aria-label="Trous">${card.rows.map(x => `<button class="${x.gross != null ? 'done' : ''} ${x.i === i ? 'cur' : ''}" data-a="hole" data-h="${x.i}" aria-label="Trou ${x.n}"><b>${x.n}</b>${x.gross != null ? x.pts : ''}</button>`).join('')}</div>
  </div>`;
  const last = i === n - 1;
  const bar = `<div class="actionbar"><button class="btn sec" data-a="hole" data-h="${i - 1}" ${i === 0 ? 'disabled' : ''}>${ic.back} Trou précédent</button>
    ${last ? `<a class="btn pri" href="#r/${esc(rid)}/carte/${esc(uid)}" data-nav>${ic.card} Voir la carte</a>` : `<button class="btn pri" data-a="hole" data-h="${i + 1}">Trou suivant ${ic.chev}</button>`}</div>`;
  return { title: uid === S.uid ? r.name : `${r.name} · ${firstName(uid)}`, back: `r/${rid}`, html, bar, nav: false, action: `<a class="tact" href="#r/${esc(rid)}/carte/${esc(uid)}" data-nav>${ic.card} Carte</a>`, ctx: { rid, uid } };
}

/* ---------- Carte de score ---------- */
function mark(x) {
  if (x.gross == null) return '<span class="muted">·</span>';
  if (x.gross === 0) return '<span class="mk pu">×</span>';
  const d = x.gross - x.par;
  const cls = d <= -2 ? 'e' : d === -1 ? 'b' : d === 1 ? 'bo' : d >= 2 ? 'db' : '';
  return `<span class="mk ${cls}">${x.gross}</span>`;
}
function vCard(rid, uid) {
  const r = round(rid); if (!r) return notFound('Cette manche n\'existe plus.');
  const c = comp(r.competitionId); const e = entry(rid, uid);
  if (!c || !e || e.status !== 'yes') return notFound('Ce joueur ne participe pas à cette manche.');
  const card = cardOf(e, r, c); const h = entryHcp(e, r, c);
  const editable = canScore(r, c, uid);
  const chCol = chOn(c, 'nains') || (chOn(c, 'ld') && ((e.ld || []).some(Boolean))) || (chOn(c, 'ntp') && r.ntpHole != null);
  const tags = x => { const t = []; const nn = (e.nains || [])[x.i] || 0; if (chOn(c, 'nains') && nn) t.push(`<span class="tag t-nains">N${nn > 1 ? nn : ''}</span>`); if (chOn(c, 'ld') && (e.ld || [])[x.i]) t.push('<span class="tag t-ld">LD</span>'); if (chOn(c, 'ntp') && e.ntp && r.ntpHole === x.i) t.push('<span class="tag t-ntp">PP</span>');  return t.join(''); };
  const chT = entryCh(e, r, c, card);
  const segs = card.n === 18 ? [card.rows.slice(0, 9), card.rows.slice(9)] : [card.rows];
  const sub = (rows, l) => `<tr class="sub"><td>${l}</td><td>${rows.reduce((a, x) => a + x.par, 0)}</td><td></td><td>${rows.reduce((a, x) => a + (x.gross || 0), 0) || '-'}</td><td class="pts">${rows.reduce((a, x) => a + (x.pts || 0), 0)}</td>${chCol ? '<td></td>' : ''}</tr>`;
  const body = segs.map((rows, k) => rows.map(x => `<tr ${editable ? `data-a="goHole" data-h="${x.i}"` : ''}><td><b>${x.n}</b>${x.recv > 0 ? ` <span class="dots" style="vertical-align:middle">${'<i style="width:6px;height:6px"></i>'.repeat(Math.min(x.recv, 3))}</span>` : ''}</td><td>${x.par}</td><td>${x.si}</td><td>${mark(x)}</td><td class="pts">${x.pts ?? '-'}</td>${chCol ? `<td>${tags(x)}</td>` : ''}</tr>`).join('') + sub(rows, segs.length > 1 ? ((r.snapshot.loopNames || [])[k] || (k === 0 ? 'Aller' : 'Retour')) : 'Total')).join('');
  const total = segs.length > 1 ? `<tr class="sub"><td>Total</td><td>${card.rows.reduce((a, x) => a + x.par, 0)}</td><td></td><td>${card.gross || '-'}</td><td class="pts">${card.pts}</td>${chCol ? '<td></td>' : ''}</tr>` : '';
  const missing = card.n - card.played;
  const html = `<div class="idband"><div class="row" style="align-items:flex-start">${avatar(uid, 'lg')}<div class="grow"><h2>${esc(fullName(uid))}</h2><div class="idsub">${esc(r.name)} · ${esc(r.snapshot.courseName)}</div></div></div>
      <div class="idfoot"><div class="bigpts"><b class="num">${card.pts}</b><span>points Stableford${card.complete ? '' : ` · ${card.played}/${card.n} trous`}</span></div>
      <div class="hflow dark"><div><b class="num">${idx1(h.hi)}</b><span>index</span></div><div><b class="num">${h.ch}</b><span>parcours</span></div><div class="on"><b class="num">${h.ph}</b><span>hcp de jeu</span></div></div></div></div>
    <div class="sc-wrap"><table class="sc"><thead><tr><th>Trou</th><th>Par</th><th>Index</th><th>Coups</th><th>Pts</th>${chCol ? '<th>Défis</th>' : ''}</tr></thead><tbody>${body}${total}</tbody></table></div>
    <div class="legend"><span><span class="mk e">3</span> eagle ou mieux</span><span><span class="mk b">3</span> birdie</span><span><span class="mk bo">5</span> bogey</span><span><span class="mk db">6</span> double ou pire</span><span><span class="mk pu">×</span> balle relevée${chOn(c, 'croix') ? ' (croix)' : ''}</span><span><span class="dots"><i style="width:6px;height:6px"></i></span> coup reçu</span></div>
    ${activeCh(c).length ? `<div class="chtiles">${activeCh(c).map(ch => `<div class="chtile"><span class="ch-ico ch-${ch.k}">${ch.badge}</span><b class="num">${chT[ch.k]}</b><span>${esc(ch.label)}</span></div>`).join('')}</div>` : ''}
    ${e.submitted ? `<div class="card row"><span class="chip yes">${ic.check} Carte validée</span><span class="grow small muted">${e.submittedAt ? 'le ' + esc(fDate(e.submittedAt.slice(0, 10))) : ''}</span>${isAdmin(c) && r.status !== 'closed' ? `<button class="btn sec sm" data-a="reopenCard" data-r="${esc(rid)}" data-u="${esc(uid)}">Rouvrir la carte</button>` : ''}</div>`
      : editable ? `<div class="btns"><a class="btn sec" href="#r/${esc(rid)}/score/${esc(uid)}" data-nav>${ic.edit} Modifier les coups</a><button class="btn pri" data-a="submitCard" data-r="${esc(rid)}" data-u="${esc(uid)}" ${missing ? 'disabled' : ''}>${ic.check} Valider la carte</button></div>
        ${missing ? `<p class="small muted" style="margin:0">Il reste ${missing} trou${missing > 1 ? 's' : ''} à saisir avant de valider. Une balle relevée compte 0 point.</p>` : '<p class="small muted" style="margin:0">Une fois validée, la carte compte dans la moyenne de la compétition.</p>'}` : ''}`;
  return { title: 'Carte de score', back: `r/${rid}`, html };
}

/* ---------- Formulaire manche ---------- */
function vRoundForm(cid, rid) {
  const r = rid ? round(rid) : null;
  const c = comp(r ? r.competitionId : cid);
  if (!c || !isAdmin(c)) return notFound('Seul l\'administrateur peut créer ou modifier les manches.');
  const locked = r && entriesOf(r.id).some(e => (e.strokes || []).some(v => v != null));
  const courses = vals('courses').sort((a, b) => a.name.localeCompare(b.name));
  const d = S.ui.roundDraft && S.ui.roundDraft.key === (rid || 'new:' + c.id) ? S.ui.roundDraft : null;
  const selCourse = d ? d.courseId : r ? r.snapshot.courseId : (courses[0] && courses[0].id);
  const n = roundsOf(c.id).length + (r ? 0 : 1);
  const html = `<div class="card"><form data-form="round" data-c="${esc(c.id)}" data-r="${esc(rid || '')}" novalidate>
    <div class="errs" id="errs"></div>
    <div class="field"><label for="m-name">Nom de la manche</label><input class="inp" id="m-name" name="name" placeholder="Manche ${n}" value="${esc(r ? r.name : '')}"></div>
    <div class="fgrid"><div class="field"><label for="m-date">Date</label><input class="inp" id="m-date" name="date" type="date" required value="${esc(r ? r.date : '')}"></div>
    <div class="field"><label for="m-time">Heure de départ</label><input class="inp" id="m-time" name="teeTime" type="time" value="${esc(r ? r.teeTime || '' : '')}"></div></div>
    <div class="field"><span class="flabel">Parcours</span>${locked ? `<div class="banner">Des scores ont déjà été saisis : le parcours, le départ et les trous de cette manche sont figés.</div>` : ''}
      ${courses.length ? `<div class="pick" id="course-pick">${courses.map(co => `<label><input type="radio" name="courseId" value="${esc(co.id)}" ${co.id === selCourse ? 'checked' : ''} ${locked ? 'disabled' : ''}><span class="grow"><b>${esc(co.name)}</b><br><span class="small muted">${esc(co.location || '')}${co.country ? ', ' + esc(co.country) : ''} · ${co.holesCount} trous${isMulti(co) ? ' (' + esc(loopNames(co).join(', ')) + ')' : ' · par ' + co.par}</span></span></label>`).join('')}</div>`
        : '<div class="banner">Aucun parcours enregistré. Choisissez le golf de cette manche dans l\'annuaire.</div>'}
      ${locked ? '' : `<div class="row wrap"><a class="btn ghost" href="#annuaire" data-a="newCourseFromRound" data-nav>${ic.map} Choisir dans l'annuaire</a><a class="btn ghost" href="#parcours/nouveau" data-a="newCourseFromRound" data-nav>${ic.plus} Créer un parcours</a></div>`}</div>
    <div id="course-opts">${roundCourseOpts(selCourse, r, locked, c)}</div>
    <div class="fgrid"><div class="field full"><label for="m-dl">Date limite d'inscription (facultatif)</label><input class="inp" id="m-dl" name="deadline" type="date" value="${esc(r ? r.deadline || '' : '')}"></div></div>
    <div class="field"><label for="m-desc">Description (facultatif)</label><textarea class="inp" id="m-desc" name="description" placeholder="Formule, rendez-vous, informations pratiques…">${esc(r ? r.description || '' : '')}</textarea></div>
    <button class="btn pri block" type="submit">${r ? 'Enregistrer la manche' : 'Créer la manche'}</button></form></div>`;
  return { title: r ? 'Modifier la manche' : 'Nouvelle manche', back: r ? `r/${rid}` : `c/${c.id}/manches`, html, form: true };
}
function roundCourseOpts(courseId, r, locked, c) {
  const co = course(courseId);
  if (!co) return '';
  const tees = co.tees || [];
  const same = r && r.snapshot.courseId === courseId;
  const curTee = same ? (r.snapshot.teeId || (tees.find(t => t.name === (r.snapshot.tee || {}).name) || {}).id) : (tees[0] || {}).id;
  const curMode = same ? r.snapshot.mode : isMulti(co) ? (layoutsOf(co)[0] ? layoutMode(layoutsOf(co)[0]) : 'L0') : co.holesCount === 18 ? '18' : '9';
  const dis = locked ? 'disabled' : '';
  let play;
  if (isMulti(co)) {
    const names = loopNames(co); const single = loopsOfMode(curMode).length === 1;
    const parOf = ns => ns.reduce((t, k) => t + co.holes.slice(k * 9, k * 9 + 9).reduce((x, h) => x + h.par, 0), 0);
    const opt = (v, t, sub) => `<label><input type="radio" name="layout" value="${v}" ${v === curMode ? 'checked' : ''} ${dis}><span class="grow"><b>${esc(t)}</b><br><span class="small muted">${esc(sub)}</span></span></label>`;
    play = `<div class="field"><span class="flabel">Parcours joué</span>${layoutsOf(co).length ? `<div class="pick">${layoutsOf(co).map(l => opt(layoutMode(l), layoutLabel(co, l), `${l.nines.map(k => names[k]).join(' + ')} · 18 trous · par ${parOf(l.nines)}`)).join('')}</div>` : ''}
      <details class="more" ${single ? 'open' : ''}><summary>Jouer un seul 9 trous <span class="chev">${ic.chev}</span></summary><div class="in pick">${names.map((nm, k) => opt('L' + k, nm, `9 trous · par ${parOf([k])}`)).join('')}</div></details></div>`;
  } else {
    const modes = co.holesCount === 18 ? [['18', '18 trous'], ['9a', '9 trous · aller'], ['9r', '9 trous · retour']] : [['9', '9 trous']];
    play = `<div class="field"><span class="flabel">Trous joués</span><div class="seg">${modes.map(([v, l]) => `<label><input type="radio" name="mode" value="${v}" ${v === curMode ? 'checked' : ''} ${dis}><span>${l}</span></label>`).join('')}</div></div>`;
  }
  return `<div class="stack" style="gap:16px">
    ${play}
    <div class="field"><span class="flabel">Départ</span>${tees.length ? `<div class="seg" style="flex-wrap:wrap">${tees.map(t => `<label style="min-width:30%"><input type="radio" name="teeId" value="${esc(t.id)}" ${t.id === curTee ? 'checked' : ''} ${dis}><span><span class="tee-dot" style="background:${esc(t.color)};margin-right:6px"></span>${esc(t.name)}</span></label>`).join('')}</div>
      <span class="hint">Avec le course rating et le slope, le handicap de jeu est calculé selon le WHS.</span>` : '<span class="hint">Ce parcours n\'a pas de départ enregistré : le handicap de jeu sera égal à l\'index (arrondi).</span>'}</div>
    <div id="rating-box">${isMulti(co) ? ratingBox(co, curTee, curMode, same ? r.snapshot.tee : null, locked) : ''}</div>
    <div id="hole-picks" class="stack" style="gap:16px">${holePicks(co, curMode, r, locked, c)}</div></div>`;
}
/* Clubs de plus de 18 trous : course rating et slope du parcours joué. */
function ratingBox(co, teeId, mode, cur, locked) {
  if (!teeId) return '';
  const v = cur && cur.cr ? cur : ratingFor(co, teeId, mode);
  const nine = loopsOfMode(mode).length === 1;
  return `<div class="fgrid"><div class="field"><label for="m-cr">Course rating${nine ? ' (9 trous)' : ''}</label><input class="inp" id="m-cr" name="rCr" inputmode="decimal" placeholder="${nine ? '35,4' : '70,8'}" value="${v.cr != null ? esc(String(v.cr).replace('.', ',')) : ''}" ${locked ? 'disabled' : ''}></div>
    <div class="field"><label for="m-slope">Slope</label><input class="inp" id="m-slope" name="rSlope" inputmode="numeric" placeholder="128" value="${v.slope != null ? esc(v.slope) : ''}" ${locked ? 'disabled' : ''}></div>
    <span class="hint full">Chaque combinaison a son propre course rating et slope (carte de score du club). Pré-rempli avec la dernière manche jouée sur cette combinaison.</span></div>`;
}
/* Trous des défis : uniquement parmi les trous joués avec la combinaison choisie. */
function holePicks(co, mode, r, locked, c) {
  const nums = new Set(playedNums(co, mode));
  const pool = co.holes.filter(h => nums.has(h.n));
  const same = r && r.snapshot.courseId === co.id;
  const curOf = k => (same && r[k] != null && r.snapshot.holes[r[k]] ? (r.snapshot.holes[r[k]].src ?? r.snapshot.holes[r[k]].n) : null);
  const lab = h => `${holeName(co, h.n)} · par ${h.par}${h.dist ? ' · ' + h.dist + ' m' : ''}`;
  const hint = locked ? 'La manche a commencé : le trou est figé.' : 'Un seul trou par manche, à choisir avant le départ. Il ne pourra plus changer une fois les scores commencés.';
  let out = '';
  if (chOn(c, 'ld')) {
    const lh = pool.filter(h => h.par >= 4); const cur = curOf('ldHole');
    out += `<div class="field"><label for="m-ld">Trou du défi « long drive »</label>${lh.length ? `<select class="inp" id="m-ld" name="ldHole" ${locked ? 'disabled' : ''}><option value="">Choisir un par 4 ou 5…</option>${lh.map(h => `<option value="${h.n}" ${cur === h.n ? 'selected' : ''}>${esc(lab(h))}</option>`).join('')}</select><span class="hint">${hint}</span>` : '<span class="hint">Pas de par 4 ou 5 sur ces trous : pas de défi « long drive ».</span>'}</div>`;
  }
  if (chOn(c, 'ntp')) {
    const p3 = pool.filter(h => h.par === 3); const cur = curOf('ntpHole');
    out += `<div class="field"><label for="m-ntp">Par 3 du défi « plus près du drapeau »</label>${p3.length ? `<select class="inp" id="m-ntp" name="ntpHole" ${locked ? 'disabled' : ''}><option value="">Choisir un par 3…</option>${p3.map(h => `<option value="${h.n}" ${cur === h.n ? 'selected' : ''}>${esc(lab(h).replace(' · par 3', ''))}</option>`).join('')}</select><span class="hint">${locked ? 'La manche a commencé : le par 3 est figé.' : 'À choisir avant le départ. Il ne pourra plus changer une fois les scores commencés.'}</span>` : '<span class="hint">Pas de par 3 sur ces trous : pas de défi « plus près du drapeau ».</span>'}</div>`;
  }
  return out;
}
/* Mode de jeu lu dans le formulaire de manche. */
function formMode(f, co) {
  if (isMulti(co)) return (f.querySelector('input[name="layout"]:checked') || {}).value || null;
  return (f.querySelector('input[name="mode"]:checked') || {}).value || (co.holesCount === 18 ? '18' : '9');
}

/* ---------- Parcours ---------- */
function vCourses() {
  const cs = vals('courses').sort((a, b) => a.name.localeCompare(b.name));
  const html = `<div class="btns"><a class="btn pri" href="#annuaire" data-nav>${ic.map} Choisir dans l'annuaire</a><a class="btn sec" href="#parcours/nouveau" data-nav>${ic.plus} Créer un parcours</a></div>
    ${cs.length ? `<div class="list">${cs.map(co => `<a class="li" href="#parcours/${esc(co.id)}" data-nav>${ic.map}<div class="grow"><div class="t ellip">${esc(co.name)}</div><div class="s ellip">${esc(co.location || '')}${co.country ? ', ' + esc(co.country) : ''} · ${co.holesCount} trous${isMulti(co) ? ' (' + esc(loopNames(co).join(', ')) + ')' : ' · par ' + co.par} · ${(co.tees || []).length} départ${(co.tees || []).length > 1 ? 's' : ''}</div></div><span class="chev">${ic.chev}</span></a>`).join('')}</div>`
      : empty('Aucun parcours enregistré pour le moment.', '', ic.map)}`;
  return { title: 'Parcours', back: 'competitions', html };
}
const TEE_COLORS = [['Blanc', '#F4F4F0'], ['Jaune', '#E2BE2C'], ['Bleu', '#2F62C1'], ['Rouge', '#C6382E'], ['Noir', '#1C1C1C'], ['Orange', '#E07A2A'], ['Vert', '#2E8A57'], ['Violet', '#7B4FB0'], ['Or', '#C9A233']];
function defaultCourseDraft(n = 18) {
  return { id: null, name: '', location: '', country: 'Belgique', holesCount: n, holes: Array.from({ length: n }, (_, i) => ({ n: i + 1, par: 4, si: null, dist: null })), tees: [{ id: gid('t'), name: 'Jaune', color: '#E2BE2C', cr: null, slope: null, totalDist: null }] };
}
function vCourseForm(id) {
  let d = S.ui.courseDraft;
  if (!d || d.id !== (id || null)) {
    const co = id ? course(id) : null;
    if (id && !co) return notFound('Ce parcours n\'existe plus.');
    d = co ? JSON.parse(JSON.stringify({ ...co, tees: co.tees || [] })) : defaultCourseDraft();
    if (!co) d.id = null;
    S.ui.courseDraft = d;
  }
  const used = id ? vals('rounds').filter(r => r.snapshot.courseId === id).length : 0;
  const par = d.holes.reduce((a, h) => a + (h.par || 0), 0);
  const holeIn = (h, i, lab) => `<div class="hole-in"><div class="hn">${lab}</div>
        <div class="seg" role="radiogroup" aria-label="Par du trou ${lab}">${[3, 4, 5].map(p => `<label><input type="radio" name="par-${i}" value="${p}" ${h.par === p ? 'checked' : ''}><span>Par ${p}</span></label>`).join('')}</div>
        <div class="two"><input class="inp" id="si-${i}" name="si-${i}" inputmode="numeric" placeholder="Index" aria-label="Index du trou ${lab}" value="${esc(h.si ?? '')}"><input class="inp" id="dist-${i}" name="dist-${i}" inputmode="numeric" placeholder="Distance m" aria-label="Distance du trou ${lab}" value="${esc(h.dist ?? '')}"></div></div>`;
  const html = `<form data-form="course" novalidate>
    <div class="errs" id="errs"></div>
    ${d.fromDir === 'card' ? `<div class="banner">Carte importée de l'annuaire (OpenStreetMap). Vérifiez par, index et distances sur la carte officielle du club avant d'enregistrer.</div>` : d.fromDir === 'name' ? `<div class="banner">Nom et lieu importés de l'annuaire. Saisissez le par et l'index de chaque trou depuis la carte du club.</div>` : ''}
    ${used ? `<div class="banner">Ce parcours est utilisé par ${used} manche${used > 1 ? 's' : ''}. Les manches existantes gardent la configuration enregistrée au moment de leur création.</div>` : ''}
    <div class="card stack"><h2 class="h2">Parcours</h2>
      <div class="field"><label for="co-name">Nom du parcours</label><input class="inp" id="co-name" name="name" required placeholder="Golf Club Gent" value="${esc(d.name)}"></div>
      <div class="fgrid"><div class="field"><label for="co-loc">Lieu</label><input class="inp" id="co-loc" name="location" placeholder="Sint-Martens-Latem" value="${esc(d.location || '')}"></div>
      <div class="field"><label for="co-country">Pays</label><input class="inp" id="co-country" name="country" value="${esc(d.country || '')}"></div></div>
      <div class="field"><span class="flabel">Nombre de trous</span><div class="seg">${[9, 18, 27, 36, 45, 54].map(v => `<label><input type="radio" name="holesCount" value="${v}" ${d.holesCount === v ? 'checked' : ''} data-a="holesCount"><span>${v}</span></label>`).join('')}</div>
        <span class="hint">${d.holesCount > 18 ? 'Le club est découpé en 9 trous que l\'on combine en parcours de 18 trous (par exemple « Les Pins + Le Lac »).' : 'Plus de 18 trous : choisissez 27, 36… pour un club avec plusieurs 9 trous combinables.'}</span></div>
    </div>
    <div class="card stack"><div class="sec-h"><h2 class="h2">Départs (tees)</h2><button class="btn ghost" type="button" data-a="addTee">${ic.plus} Ajouter</button></div>
      <span class="hint small muted">Course rating et slope servent au calcul du handicap de jeu. Laissez vide si vous ne les connaissez pas.</span>
      ${d.tees.map((t, k) => `<div class="tee-in"><div class="field"><label for="tn-${k}">Couleur</label><select class="inp" id="tn-${k}" name="tee-name-${k}">${TEE_COLORS.map(([nm]) => `<option ${nm === t.name ? 'selected' : ''}>${nm}</option>`).join('')}</select></div>
        <div class="field"><label for="td-${k}">Distance totale (m)</label><input class="inp" id="td-${k}" name="tee-dist-${k}" inputmode="numeric" value="${esc(t.totalDist ?? '')}"></div>
        <div class="field"><label for="tc-${k}">Course rating</label><input class="inp" id="tc-${k}" name="tee-cr-${k}" inputmode="decimal" placeholder="70,1" value="${esc(t.cr ?? '')}"></div>
        <div class="field"><label for="ts-${k}">Slope</label><input class="inp" id="ts-${k}" name="tee-slope-${k}" inputmode="numeric" placeholder="128" value="${esc(t.slope ?? '')}"></div>
        <button class="btn ghost" type="button" data-a="removeTee" data-k="${k}" style="grid-column:1/-1;color:var(--bad)">${ic.trash} Retirer ce départ</button></div>`).join('')}
    </div>
    <div class="card stack"><div class="sec-h"><h2 class="h2">Trous</h2><span class="small muted">Par total <b id="par-total" style="color:var(--ink)">${par}</b></span></div>
      <span class="hint small muted">Index (stroke index) : 1 = trou le plus difficile. ${d.holesCount === 18 ? 'Chaque valeur de 1 à 18 une seule fois.' : d.holesCount > 18 ? 'Pour chaque 9 trous : de 1 à 9, ou les impairs (ou pairs) de 1 à 18. L\'index des combinaisons est calculé automatiquement.' : 'De 1 à 9, ou les impairs (ou pairs) de 1 à 18.'}</span>
      ${d.holesCount > 18 ? Array.from({ length: d.holesCount / 9 }, (_, k) => k).map(k => `<div class="loop-h"><div class="field"><label for="loop-${k}">Nom du 9 trous n° ${k + 1}</label><input class="inp" id="loop-${k}" name="loop-${k}" placeholder="${LOOP_DEFAULTS[k]}" value="${esc((d.loops || [])[k] || '')}"></div>
        <span class="small muted">Par <b style="color:var(--ink)">${d.holes.slice(k * 9, k * 9 + 9).reduce((a, h) => a + (h.par || 0), 0)}</b></span></div>
        <div class="holes">${d.holes.slice(k * 9, k * 9 + 9).map((h, j) => holeIn(h, k * 9 + j, j + 1)).join('')}</div>`).join('') : `<div class="holes">${d.holes.map((h, i) => holeIn(h, i, i + 1)).join('')}</div>`}
    </div>
    ${d.holesCount > 18 ? `<div class="card stack"><div class="sec-h"><h2 class="h2">Parcours du club</h2><button class="btn ghost" type="button" data-a="addLayout">${ic.plus} Ajouter</button></div>
      <span class="hint small muted">Les combinaisons de deux 9 trous jouées au club. Chaque 9 trous peut aussi être joué seul, sans rien ajouter ici. Laissez le nom vide pour « 9 trous + 9 trous ».</span>
      ${(d.layouts || []).map((l, k) => { const names = Array.from({ length: d.holesCount / 9 }, (_, j) => ((d.loops || [])[j] || '').trim() || 'Boucle ' + (j + 1)); const sel = (nm, v) => `<select class="inp" id="${nm}-${k}" name="${nm}-${k}">${names.map((x, j) => `<option value="${j}" ${v === j ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>`;
        return `<div class="tee-in"><div class="field" style="grid-column:1/-1"><label for="ly-name-${k}">Nom du parcours (facultatif)</label><input class="inp" id="ly-name-${k}" name="ly-name-${k}" placeholder="${esc(l.nines.map(j => names[j]).join(' + '))}" value="${esc(l.name || '')}"></div>
          <div class="field"><label for="ly-a-${k}">Premier 9</label>${sel('ly-a', l.nines[0])}</div><div class="field"><label for="ly-b-${k}">Deuxième 9</label>${sel('ly-b', l.nines[1])}</div>
          <button class="btn ghost" type="button" data-a="removeLayout" data-k="${k}" style="grid-column:1/-1;color:var(--bad)">${ic.trash} Retirer ce parcours</button></div>`; }).join('')}
    </div>` : ''}
    <div class="btns"><button class="btn pri" type="submit">${ic.check} Enregistrer le parcours</button>${id && !used ? `<button class="btn danger" type="button" data-a="deleteCourse" data-id="${esc(id)}">${ic.trash} Supprimer</button>` : ''}</div>
  </form>`;
  return { title: id ? 'Modifier le parcours' : 'Nouveau parcours', back: S.ui.returnTo || 'parcours', html, form: true };
}

/* ---------- Jouer ---------- */
function vPlay() {
  const live = myRoundItems((r, ph, e) => ph === 'live' && e && e.status === 'yes' && !e.submitted);
  const soon = myRoundItems((r, ph, e) => ph === 'upcoming' && e && e.status === 'yes').sort((a, b) => a.r.date.localeCompare(b.r.date));
  const pending = myRoundItems((r, ph, e) => ph === 'upcoming' && !e).sort((a, b) => a.r.date.localeCompare(b.r.date));
  let html = '';
  if (live.length) html += `<div class="sec"><h2 class="h2">À jouer maintenant</h2>${live.map(({ r, c }) => { const card = cardOf(entry(r.id, S.uid), r, c); return `<div class="hero"><div class="row"><span class="chip live">En cours</span><span class="small muted">${esc(c.name)}</span></div><h2>${esc(r.name)} · ${esc(r.snapshot.courseName)}</h2><div class="small muted">${card.played}/${card.n} trous · ${card.pts} points</div><a class="btn pri block" href="#r/${esc(r.id)}/score/${esc(S.uid)}" data-nav>${ic.play} ${card.played ? 'Reprendre ma carte' : 'Commencer ma carte'}</a></div>`; }).join('')}</div>`;
  if (pending.length) html += `<div class="sec"><h2 class="h2">En attente de votre réponse</h2><div class="list">${pending.map(({ r }) => roundItem(r, true)).join('')}</div></div>`;
  if (soon.length) html += `<div class="sec"><h2 class="h2">Mes prochaines manches</h2><div class="list">${soon.map(({ r }) => roundItem(r, false)).join('')}</div></div>`;
  if (!html) html = empty("Aucune manche à jouer pour l'instant. Inscrivez-vous à une prochaine manche depuis vos compétitions.", `<a class="btn pri" href="#competitions" data-nav>Mes compétitions</a>`, ic.play);
  return { title: 'Jouer', html, brand: true, large: true };
}

/* ---------- Profil ---------- */
function vProfile() {
  const u = me();
  const hist = [];
  for (const c of myComps()) for (const r of roundsOf(c.id)) { const e = entry(r.id, S.uid); if (e && e.status === 'yes' && (e.submitted || (e.strokes || []).some(v => v != null))) hist.push({ r, c, h: entryHcp(e, r, c) }); }
  hist.sort((a, b) => b.r.date.localeCompare(a.r.date));
  const html = `<div class="idband"><div class="row">${avatar(S.uid, 'lg')}<div class="grow"><h2>${esc(fullName(S.uid))}</h2><div class="idsub">Membre depuis le ${esc(fDate((u.createdAt || '').slice(0, 10)))}</div></div></div>
    <div class="idfoot"><div class="bigpts"><b class="num">${idx1(u.handicap)}</b><span>index actuel</span></div><div class="bigpts r"><b class="num">${myComps().length}</b><span>${myComps().length > 1 ? 'compétitions' : 'compétition'}</span></div></div></div>
    <div class="card stack"><h2 class="h2">Apparence</h2>
      <div class="seg" role="radiogroup" aria-label="Apparence">${THEMES.map(([v, l]) => `<label><input type="radio" name="theme" value="${v}" ${getTheme() === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
      <span class="small muted">Automatique suit le réglage clair ou sombre de votre téléphone.</span></div>
    <div class="grid2"><div class="card"><form data-form="profile" novalidate><h2 class="h2">Mon profil</h2><div class="errs" id="errs"></div>
      <div class="fgrid"><div class="field"><label for="p-fn">Prénom</label><input class="inp" id="p-fn" name="firstName" value="${esc(u.firstName)}"></div><div class="field"><label for="p-ln">Nom</label><input class="inp" id="p-ln" name="lastName" value="${esc(u.lastName)}"></div>
      <div class="field full"><label for="p-email">E-mail</label><input class="inp" id="p-email" name="email" type="email" value="${esc(u.email)}"></div>
      <div class="field full"><label for="p-hcp">Index / handicap actuel</label><input class="inp" id="p-hcp" name="handicap" inputmode="decimal" value="${esc(u.handicap ?? '')}"><span class="hint">Modifier votre index ne change jamais les résultats des manches déjà jouées.</span></div>
      <div class="field full"><span class="flabel">Photo de profil (facultatif)</span><label class="filebtn" for="p-photo">${ic.user} ${u.photo ? 'Changer la photo' : 'Choisir une photo'}</label><input class="sr" id="p-photo" type="file" accept="image/*" data-a="photo">${u.photo ? `<button class="btn ghost" type="button" data-a="removePhoto" style="align-self:flex-start">Retirer la photo</button>` : ''}</div></div>
      <button class="btn pri block" type="submit">Enregistrer</button></form></div>
    <div class="sec"><h2 class="h2">Index utilisés en manche</h2>${hist.length ? `<div class="list">${hist.map(({ r, c, h }) => `<a class="li" href="#r/${esc(r.id)}" data-nav>${dateTile(r.date)}<div class="grow"><div class="t ellip">${esc(r.name)} · ${esc(r.snapshot.courseName)}</div><div class="s ellip">${esc(c.name)}</div></div><div style="text-align:right"><b>${idx1(h.hi)}</b><div class="small muted">HJ ${h.ph}</div></div></a>`).join('')}</div>` : '<p class="small muted" style="margin:0">L\'index figé pour chaque manche jouée apparaîtra ici.</p>'}
      ${(u.handicapHistory || []).length ? `<h2 class="h2" style="margin-top:14px">Historique de l'index</h2><div class="list">${[...u.handicapHistory].reverse().slice(0, 8).map(x => `<div class="li"><span class="grow">${esc(fDate(x.date.slice(0, 10)))}</span><b>${idx1(x.value)}</b></div>`).join('')}</div>` : ''}</div></div>
    <button class="btn sec" data-a="logout">Se déconnecter</button>`;
  return { title: 'Profil', html, brand: true, form: true, large: true };
}

function notFound(msg) { return { title: 'Eagle Touch', back: 'accueil', html: empty(msg, `<a class="btn pri" href="#accueil" data-nav>Retour à l'accueil</a>`) }; }

const DIR = DIR_DATA;

/* ============================================================
   Eagle Touch, annuaire des golfs de Belgique et de France
   Source : OpenStreetMap (© contributeurs OpenStreetMap, ODbL).
   DIR = [id, nom, pays, commune, département/province, région, lat, lon, cartes]
   cartes = [{ name, h: [[par, index, distance], …], tees: [{ c, d: [distances] }] }]
   ============================================================ */
const normTxt = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const parseCards = cs => cs ? cs.map(c => ({ name: c.n || '', h: c.h.split(' ').map(x => { const p = x.split('.').map(Number); return [p[0], p[1], p[2] || null]; }), tees: (c.t || []).map(s => { const [col, ds] = s.split(':'); return { c: OSM_TEES_KEYS.includes(col) ? col : 'standard', d: ds.split(',').map(Number) }; }) })) : null;
const OSM_TEES_KEYS = ['white', 'yellow', 'blue', 'red', 'black', 'orange', 'purple', 'gold', 'green', 'standard'];
const DIRX = DIR.map(r => ({ id: r[0], n: r[1], cc: r[2], town: r[3] || '', dept: r[4] || '', reg: r[5] || '', lat: r[6], lon: r[7], cards: parseCards(r[8]) }));
DIRX.forEach(g => { g.q = normTxt([g.n, g.town, g.dept, g.reg].join(' ')); g.nq = normTxt(g.n); });
DIRX.sort((a, b) => a.n.localeCompare(b.n, 'fr'));
const DIRMAP = new Map(DIRX.map(g => [g.id, g]));
const OSM_TEES = { white: ['Blanc', '#F4F4F0'], yellow: ['Jaune', '#E2BE2C'], blue: ['Bleu', '#2F62C1'], red: ['Rouge', '#C6382E'], black: ['Noir', '#1C1C1C'], orange: ['Orange', '#E07A2A'], purple: ['Violet', '#7B4FB0'], gold: ['Or', '#C9A233'], green: ['Vert', '#2E8A57'], standard: ['Jaune', '#E2BE2C'] };
const countryName = cc => cc === 'BE' ? 'Belgique' : 'France';
const cardPar = c => c.h.reduce((a, x) => a + x[0], 0);
const importedFrom = g => vals('courses').filter(c => (c.source || '').split(':')[0] === g.id);

function dirResults() {
  const ui = S.ui.dir || (S.ui.dir = { q: '', cc: '', card: false });
  const q = normTxt(ui.q);
  const words = q ? q.split(' ') : [];
  const hit = (g, w) => (' ' + g.q).includes(' ' + w);
  let list = DIRX.filter(g => (!ui.cc || g.cc === ui.cc) && (!ui.card || g.cards) && words.every(w => hit(g, w)));
  const score = g => g.nq.startsWith(q) ? 3 : (' ' + g.nq).includes(' ' + q) ? 2 : words.every(w => (' ' + g.nq).includes(' ' + w)) ? 1 : 0;
  if (q) list.sort((a, b) => (score(b) - score(a)) || (!!b.cards - !!a.cards) || a.n.localeCompare(b.n, 'fr'));
  const total = list.length; const shown = list.slice(0, 60);
  const head = `<div class="small muted">${total} golf${total > 1 ? 's' : ''}${total > shown.length ? ` · ${shown.length} premiers affichés, précisez la recherche` : ''}</div>`;
  if (!total) return head + empty('Aucun golf ne correspond à cette recherche. Vous pouvez créer le parcours vous-même.', `<a class="btn pri" href="#parcours/nouveau" data-nav>${ic.plus} Créer un parcours</a>`, ic.map);
  return head + `<div class="list">${shown.map(g => {
    const have = importedFrom(g).length;
    return `<a class="li" href="#annuaire/${esc(g.id)}" data-nav><span class="flagcc">${esc(g.cc)}</span><div class="grow"><div class="t ellip">${esc(g.n)}</div><div class="s ellip">${esc([g.town, g.dept].filter(Boolean).join(' · ') || countryName(g.cc))}</div></div>
      ${have ? '<span class="chip yes">Enregistré</span>' : g.cards ? '<span class="chip gold">Carte dispo</span>' : ''}<span class="chev">${ic.chev}</span></a>`;
  }).join('')}</div>`;
}
function vDirectory() {
  const ui = S.ui.dir || (S.ui.dir = { q: '', cc: '', card: false });
  const withCards = DIRX.filter(g => g.cards).length;
  const html = `<div class="card stack">
      <div class="field"><label for="dir-q">Rechercher un golf</label><input class="inp" id="dir-q" type="search" autocomplete="off" placeholder="Nom, ville, province ou département" value="${esc(ui.q)}"></div>
      <div class="seg" id="dir-cc">${[['', 'Tous'], ['BE', 'Belgique'], ['FR', 'France']].map(([v, l]) => `<label><input type="radio" name="dircc" value="${v}" ${ui.cc === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
      <label class="row small" style="gap:10px;cursor:pointer"><input type="checkbox" id="dir-card" ${ui.card ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--accent)"> Uniquement les golfs avec carte de score (${withCards})</label>
    </div>
    <div class="stack" id="dir-res">${dirResults()}</div>
    <p class="small muted" style="margin:0">${DIRX.length} parcours en Belgique et en France. Données © contributeurs <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> (ODbL). Les cartes de score proviennent de la même source : vérifiez par et index sur la carte officielle du club.</p>`;
  return { title: 'Annuaire des golfs', back: S.ui.returnTo || 'parcours', html, form: true };
}
function vDirGolf(id) {
  const g = DIRMAP.get(id); if (!g) return notFound('Ce golf ne figure pas dans l\'annuaire.');
  const have = importedFrom(g);
  const cards = g.cards || [];
  const html = `<div class="card stack"><div class="row" style="align-items:flex-start"><span class="flagcc">${esc(g.cc)}</span><div class="grow"><h2 style="font-family:var(--disp);font-size:28px;font-weight:600">${esc(g.n)}</h2>
      <div class="muted small">${esc([g.town, g.dept, g.reg, countryName(g.cc)].filter(Boolean).join(' · '))}</div></div></div>
      ${g.lat != null ? `<a class="small" href="https://www.openstreetmap.org/?mlat=${g.lat}&mlon=${g.lon}#map=15/${g.lat}/${g.lon}" target="_blank" rel="noopener">Voir sur la carte</a>` : ''}</div>
    ${have.length ? `<div class="sec"><h2 class="h2">Déjà dans vos parcours</h2><div class="list">${have.map(c => `<a class="li" href="#parcours/${esc(c.id)}" data-nav>${ic.map}<div class="grow"><div class="t">${esc(c.name)}</div><div class="s">${c.holesCount} trous · par ${c.par}</div></div><span class="chev">${ic.chev}</span></a>`).join('')}</div></div>` : ''}
    <div class="sec"><h2 class="h2">${cards.length ? 'Cartes de score disponibles' : 'Carte de score'}</h2>
    ${cards.length ? `<div class="list">${cards.map((c, i) => `<button class="li" style="width:100%;text-align:left" data-a="dirImport" data-id="${esc(g.id)}" data-k="${i}"><div class="grow"><div class="t">${esc(c.name || (c.h.length === 18 ? 'Parcours 18 trous' : 'Parcours 9 trous'))}</div>
        <div class="s">${c.h.length} trous · par ${cardPar(c)}${c.tees.length ? ' · départs ' + c.tees.map(t => OSM_TEES[t.c][0].toLowerCase()).join(', ') : ''}</div></div><span class="btn pri sm">Importer</span></button>`).join('')}</div>
      ${cards.length > 1 && [27, 36, 45, 54].includes(cards.reduce((a, c) => a + c.h.length, 0)) && cards.every(c => c.h.length === 9 || c.h.length === 18) ? `<div class="list"><button class="li" style="width:100%;text-align:left" data-a="dirImport" data-id="${esc(g.id)}" data-k="all"><div class="grow"><div class="t">Tout le club (${cards.reduce((a, c) => a + c.h.length, 0)} trous)</div><div class="s">${esc(cards.map(c => c.name || c.h.length + ' trous').join(' + '))} · un seul club, plusieurs parcours au choix dans chaque manche</div></div><span class="btn pri sm">Importer</span></button></div>` : ''}
      <p class="small muted" style="margin:0">Par, index et distances sont préremplis. Vous pourrez tout vérifier avant d'enregistrer.</p>` : '<p class="small muted" style="margin:0">L\'annuaire ne contient pas encore la carte de ce golf. Le nom et le lieu seront préremplis ; saisissez par et index depuis la carte du club.</p>'}
    <button class="btn ${cards.length ? 'sec' : 'pri'}" data-a="dirImport" data-id="${esc(g.id)}" data-k="-1">${ic.edit} ${cards.length ? 'Créer sans carte et tout saisir' : 'Créer ce parcours'}</button></div>`;
  return { title: g.n, back: 'annuaire', html };
}
/* Club dont les cartes totalisent 27 à 54 trous (ex. un 18 + un 9, deux 18) : un club de plusieurs 9 trous.
   Chaque carte de 18 trous devient un parcours du club. */
function draftFromDirMulti(g) {
  const total = g.cards.reduce((a, c) => a + c.h.length, 0);
  const d = defaultCourseDraft(total);
  const loops = []; const holes = []; const layouts = [];
  for (const c of g.cards) {
    const nm = c.name || (c.h.length === 18 ? 'Parcours' : 'Neuf trous');
    if (c.h.length === 18) { layouts.push({ name: nm, nines: [loops.length, loops.length + 1] }); loops.push(nm + ' aller', nm + ' retour'); } else loops.push(nm);
    c.h.forEach(([par, si, dist]) => holes.push({ n: holes.length + 1, par, si, dist }));
  }
  /* Index par 9 trous : ordre de difficulté ramené de 1 à 9. */
  for (let k = 0; k < loops.length; k++) { const gr = holes.slice(k * 9, k * 9 + 9); if (gr.every(h => h.si)) { const rk = Golf.ranks(gr); gr.forEach((h, j) => { h.si = rk[j]; }); } }
  const common = g.cards.map(c => c.tees.map(t => t.c)).reduce((a, b) => a.filter(x => b.includes(x)));
  if (common.length) d.tees = common.map(col => ({ id: gid('t'), name: OSM_TEES[col][0], color: OSM_TEES[col][1], cr: null, slope: null, holeDist: g.cards.flatMap(c => c.tees.find(t => t.c === col).d), totalDist: null }));
  Object.assign(d, { name: g.n, location: g.town || '', country: countryName(g.cc), region: g.dept || '', source: g.id + ':all', fromDir: 'card', holes, loops, layouts: layouts.length ? layouts : defaultLayouts(loops.length) });
  return d;
}
function draftFromDir(g, card) {
  const d = defaultCourseDraft(card ? card.h.length : 18);
  d.name = g.n + (card && card.name ? ' · ' + card.name : '');
  d.location = g.town || '';
  d.country = countryName(g.cc);
  d.region = g.dept || '';
  d.source = g.id + (card ? ':' + (g.cards.indexOf(card)) : '');
  d.fromDir = card ? 'card' : 'name';
  if (card) {
    d.holes = card.h.map(([par, si, dist], i) => ({ n: i + 1, par, si, dist }));
    if (card.tees.length) d.tees = card.tees.map(t => ({ id: gid('t'), name: OSM_TEES[t.c][0], color: OSM_TEES[t.c][1], cr: null, slope: null, totalDist: t.d.reduce((a, x) => a + x, 0), holeDist: t.d.slice() }));
  }
  return d;
}

/* ============================================================
   Eagle Touch, navigation, rendu, actions, formulaires
   ============================================================ */
let ROUTE = 'accueil', VIEW = null, rq = false;
const root = () => document.getElementById('app');

function parseHash() { try { return decodeURIComponent((location.hash || '').slice(1)); } catch (e) { return ''; } }
function nav(to, opts = {}) {
  flushWrites();
  if (to !== ROUTE && !opts.keepDraft) { S.ui.courseDraft = null; S.ui.roundDraft = null; }
  if (!to.startsWith('parcours/') && !to.startsWith('annuaire') && !opts.keepReturn) S.ui.returnTo = null;
  ROUTE = to;
  try { history[opts.replace ? 'replaceState' : 'pushState']({ r: to }, '', '#' + to); } catch (e) {}
  render({ nav: true });
}
window.addEventListener('popstate', e => { flushWrites(); ROUTE = (e.state && e.state.r) || parseHash() || 'accueil'; S.ui.courseDraft = null; render({ nav: true }); });

function resolve(route) {
  const p = route.split('/');
  if (p[0] === 'nouveau-mdp' && S.uid) return { raw: true, form: true, html: vNewPassword() };
  if (!S.uid) {
    if (p[0] === 'inscription') return { raw: true, form: true, html: vRegister('signup') };
    if (p[0] === 'mdp-oublie') return { raw: true, form: true, html: vForgot() };
    if (p[0] === 'verifier-email') return { raw: true, html: vCheckEmail() };
    return { raw: true, form: true, html: vLogin() };
  }
  if (!S.loaded) return { raw: true, html: `<div class="loading">${BRAND}</div>` };
  if (!me()) return { raw: true, form: true, html: vRegister('profile') };
  switch (p[0]) {
    case 'competitions': return vComps();
    case 'jouer': return vPlay();
    case 'profil': return vProfile();
    case 'creer': return vCreate();
    case 'rejoindre': return vJoin(p[1]);
    case 'annuaire': return p[1] ? vDirGolf(p[1]) : vDirectory();
    case 'parcours': return p[1] === 'nouveau' ? vCourseForm(null) : p[1] ? vCourseForm(p[1]) : vCourses();
    case 'c':
      if (p[2] === 'joueur') return vPlayer(p[1], p[3]);
      if (p[2] === 'nouvelle-manche') return vRoundForm(p[1], null);
      return vComp(p[1], p[2] || 'apercu');
    case 'r':
      if (p[2] === 'score') return vScore(p[1], p[3]);
      if (p[2] === 'carte') return vCard(p[1], p[3]);
      if (p[2] === 'modifier') return vRoundForm(null, p[1]);
      return vRound(p[1]);
    default: return vHome();
  }
}

function scheduleRender() { if (rq) return; rq = true; requestAnimationFrame(() => { rq = false; render({}); }); }
function render(o = {}) {
  const el = root(); if (!el) return;
  if (!o.nav && !o.force && VIEW) {
    if (VIEW.form) return;
    const a = document.activeElement;
    if (a && a.closest && a.closest('#content') && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
  }
  const y = window.scrollY;
  const v = resolve(ROUTE); VIEW = v;
  el.innerHTML = v.raw ? v.html : shell(v);
  if (o.nav) window.scrollTo(0, 0); else window.scrollTo(0, y);
  if (o.nav) { const ct = document.getElementById('content'); if (ct) ct.classList.add('enter'); }
  watchHero();
  const t = v.raw ? 'Eagle Touch' : v.title + ' · Eagle Touch';
  if (document.title !== t) document.title = t;
  if (document.getElementById('green-art')) drawArt();
}
function shell(v) {
  const sect = ROUTE.split('/')[0];
  let on = ['accueil', 'competitions', 'jouer', 'profil'].includes(sect) ? sect : 'competitions';
  if (sect === 'r' && /\/(score|carte)\//.test(ROUTE)) on = 'jouer';
  if (!ROUTE || sect === '') on = 'accueil';
  const items = [['accueil', 'Accueil', ic.home], ['competitions', 'Compétitions', ic.trophy], ['jouer', 'Jouer', ic.play], ['profil', 'Profil', ic.user]];
  const link = ([k, l, i]) => `<a href="#${k}" data-nav class="${k === on ? 'on' : ''}" ${k === on ? 'aria-current="page"' : ''}>${i}<span>${l}</span></a>`;
  const top = `<header class="top ${v.hero ? 'over' : 'solid'}" id="top">${v.back ? `<a class="ib" href="#${esc(v.back)}" data-nav aria-label="Retour">${ic.back}</a>` : ''}${v.brand ? BRAND : ''}<h1 class="${v.brand ? 'dt-only' : ''}">${esc(v.title)}</h1>${v.action || ''}${v.brand && sect !== 'profil' ? `<a class="me-btn" href="#profil" data-nav aria-label="Mon profil">${avatar(S.uid, 'sm')}</a>` : ''}</header>`;
  return `<div class="app"><aside class="side">${BRAND}${items.map(link).join('')}<a class="sfoot" href="#profil" data-nav>${avatar(S.uid, 'sm')}<span class="ellip">${esc(fullName(S.uid))}</span></a></aside>
    <div class="main">${top}${v.hero || ''}${v.tabs ? `<nav class="tabs" aria-label="Sections"><div class="tabs-in">${v.tabs}</div></nav>` : ''}
    <main class="content ${v.bar ? 'has-bar' : ''} ${v.hero ? 'after-hero' : ''}" id="content">${S.readonly ? '<div class="banner">Accès en lecture seule : vos modifications ne seront pas enregistrées.</div>' : ''}${v.large ? `<h1 class="ptitle">${esc(v.title)}</h1>` : ''}${v.html}</main></div>
    ${v.bar || ''}${v.nav === false ? '' : `<nav class="bnav" aria-label="Navigation principale">${items.map(link).join('')}</nav>`}</div>`;
}

/* La barre du haut est transparente sur la photo, puis devient pleine
   quand le titre passe dessous (IntersectionObserver, pas d'écouteur de défilement). */
let heroObs = null;
function watchHero() {
  if (heroObs) { heroObs.disconnect(); heroObs = null; }
  const t = document.getElementById('top'); const h = document.querySelector('.phero .phero-in');
  if (!t || !h) return;
  const set = under => t.classList.toggle('solid', under);
  set(h.getBoundingClientRect().bottom < t.offsetHeight);
  if (!('IntersectionObserver' in window)) { set(true); return; }
  heroObs = new IntersectionObserver(([en]) => set(!en.isIntersecting && en.boundingClientRect.top < t.offsetHeight), { rootMargin: `-${t.offsetHeight}px 0px 0px 0px` });
  heroObs.observe(h);
}

/* ---------- Petits outils d'interface ---------- */
let toastT;
function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600);
}
function armed(el, label = 'Confirmer ?') {
  if (el.dataset.armed) return true;
  el.dataset.armed = '1'; const html = el.innerHTML; el.innerHTML = label; el.classList.add('armed');
  setTimeout(() => { if (el.isConnected && el.dataset.armed) { delete el.dataset.armed; el.innerHTML = html; el.classList.remove('armed'); } }, 3500);
  return false;
}
function showErrs(form, errs) {
  $$('.invalid', form).forEach(x => x.classList.remove('invalid'));
  const box = $('#errs', form) || $('#errs');
  if (!errs.length) { if (box) box.innerHTML = ''; return false; }
  if (box) { box.innerHTML = errs.map(e => `<div>${esc(e.m)}</div>`).join(''); box.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  errs.forEach(e => { const f = form.querySelector(`[name="${e.f}"]`) || form.querySelector('#' + e.f); if (f) f.classList.add('invalid'); });
  return true;
}
function parseHcp(v) {
  const s = String(v ?? '').trim();
  if (s === '') return null;
  const n = numIn(s.replace(/^\+/, ''));
  if (!Number.isFinite(n)) return NaN;
  return s.startsWith('+') ? -Math.abs(n) : n;
}
const validHcp = h => Number.isFinite(h) && h >= -10 && h <= 54;
async function hashPw(pw, salt) {
  try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ':' + pw)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
  catch (e) { let h = 7; for (const ch of salt + pw) h = (h * 31 + ch.charCodeAt(0)) | 0; return 'x' + h; }
}
function makeCode(name, start) {
  const y = (start || todayISO()).slice(0, 4);
  const stop = ['EAGLE', 'TOUCH', 'LE', 'LA', 'LES', 'DE', 'DU', 'DES', 'THE', 'OF', 'GOLF', 'CHAMPIONSHIP', 'COMPETITION', 'TROPHEE', 'CUP', 'OPEN', 'SAISON'];
  const words = (name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter(w => w && !/^\d+$/.test(w) && !stop.includes(w));
  const rnd = () => Math.random().toString(36).slice(2, 6).toUpperCase().replace(/[^A-Z]/g, 'K').padEnd(4, 'X');
  let base = words[0] && words[0].length >= 3 ? words[0].slice(0, 4) : rnd();
  const taken = new Set(vals('competitions').map(c => c.code));
  let code = `ET-${y}-${base}`;
  while (taken.has(code)) code = `ET-${y}-${rnd()}`;
  return code;
}
/* Clubs de plus de 18 trous : plusieurs 9 trous. Une manche joue un 9 trous (mode 'L2')
   ou un parcours du club, c'est-à-dire deux 9 trous dans l'ordre (mode 'L0+1'). */
const LOOP_DEFAULTS = ['Les Pins', 'Le Lac', 'La Forêt', 'Les Chênes', 'La Rivière', 'Les Bruyères'];
const isMulti = co => !!co && co.holesCount > 18;
const nineCount = co => Math.round(co.holesCount / 9);
const loopNames = co => Array.from({ length: nineCount(co) }, (_, k) => ((co.loops || [])[k] || '').trim() || 'Boucle ' + (k + 1));
/* Parcours (combinaisons de deux 9 trous) proposés par défaut : A+B, B+C, C+A pour 27 trous ; A+B, C+D… au-delà. */
function defaultLayouts(m) { const pairs = m === 3 ? [[0, 1], [1, 2], [2, 0]] : Array.from({ length: Math.floor(m / 2) }, (_, k) => [2 * k, 2 * k + 1]); return pairs.map(p => ({ name: '', nines: p })); }
const layoutsOf = co => (co.layouts && co.layouts.length ? co.layouts : defaultLayouts(nineCount(co)));
const layoutMode = l => 'L' + l.nines.join('+');
const layoutLabel = (co, l) => (l.name || '').trim() || l.nines.map(k => loopNames(co)[k]).join(' + ');
const loopsOfMode = m => (String(m || '').startsWith('L') ? m.slice(1).split('+').map(Number) : [0, 1]);
function playedNums(co, mode) {
  if (isMulti(co)) return loopsOfMode(mode).flatMap(k => Array.from({ length: 9 }, (_, j) => k * 9 + j + 1));
  if (mode === '9a') return co.holes.slice(0, 9).map(h => h.n);
  if (mode === '9r') return co.holes.slice(9, 18).map(h => h.n);
  return co.holes.map(h => h.n);
}
const holeName = (co, n) => (isMulti(co) ? `${loopNames(co)[Math.floor((n - 1) / 9)]} ${((n - 1) % 9) + 1}` : `Trou ${n}`);
/* Course rating / slope d'une combinaison : dernière manche jouée sur la même combinaison et le même départ, sinon ceux du départ. */
function ratingFor(co, teeId, mode) {
  const prev = vals('rounds').filter(r => r.snapshot && r.snapshot.courseId === co.id && r.snapshot.mode === mode && r.snapshot.teeId === teeId && r.snapshot.tee && r.snapshot.tee.cr).sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
  if (prev) return { cr: prev.snapshot.tee.cr, slope: prev.snapshot.tee.slope };
  const t = (co.tees || []).find(x => x.id === teeId);
  if (!t || !t.cr) return { cr: null, slope: t ? t.slope : null };
  return { cr: loopsOfMode(mode).length === 1 ? Math.round(t.cr * 5) / 10 : t.cr, slope: t.slope };
}
function buildSnapshotMulti(co, teeId, mode, rating) {
  const ls = loopsOfMode(mode); const names = loopNames(co);
  const t = (co.tees || []).find(x => x.id === teeId) || null;
  const dists = t && Array.isArray(t.holeDist) && t.holeDist.length === 27 ? t.holeDist : null;
  const holes = [];
  ls.forEach((k, pos) => {
    const g = co.holes.slice(k * 9, k * 9 + 9); const rk = Golf.ranks(g);
    /* Index de la combinaison : ordre de difficulté de chaque boucle, impairs sur le premier 9, pairs sur le second. */
    g.forEach((h, j) => holes.push({ n: holes.length + 1, src: h.n, lbl: `${names[k]} ${j + 1}`, par: h.par, si: ls.length === 2 ? 2 * rk[j] - (pos === 0 ? 1 : 0) : rk[j], dist: (dists ? dists[h.n - 1] : null) ?? h.dist ?? null }));
  });
  const rt = rating || ratingFor(co, teeId, mode);
  const lay = ls.length === 2 ? layoutsOf(co).find(l => layoutMode(l) === mode) : null;
  const layName = lay ? layoutLabel(co, lay) : ls.map(k => names[k]).join(' + ');
  return { courseId: co.id, courseName: `${co.name} · ${layName}`, layoutName: layName, location: co.location || '', country: co.country || '', courseHoles: holes.length, mode, loopNames: ls.map(k => names[k]), teeId: t ? t.id : null, holes, par: holes.reduce((a, h) => a + h.par, 0), tee: t ? { name: t.name, color: t.color, cr: rt.cr, slope: rt.slope } : null };
}
function buildSnapshot(co, teeId, mode, rating) {
  if (isMulti(co)) return buildSnapshotMulti(co, teeId, mode, rating);
  let holes = co.holes.map(h => ({ n: h.n, par: h.par, si: h.si, dist: h.dist ?? null }));
  if (mode === '9a') holes = holes.slice(0, 9);
  if (mode === '9r') holes = holes.slice(9, 18);
  const t = (co.tees || []).find(x => x.id === teeId) || null;
  if (t && Array.isArray(t.holeDist) && t.holeDist.length === co.holes.length) {
    const off = mode === '9r' ? 9 : 0;
    holes = holes.map((h, i) => ({ ...h, dist: t.holeDist[i + off] ?? h.dist }));
  }
  return { courseId: co.id, courseName: co.name, location: co.location || '', country: co.country || '', courseHoles: co.holesCount, mode, teeId: t ? t.id : null, holes, par: holes.reduce((a, h) => a + h.par, 0), tee: t ? { name: t.name, color: t.color, cr: t.cr, slope: t.slope } : null };
}
function hiOf(uid) { const p = P(uid); return p && p.handicap != null ? p.handicap : 54; }
function freezeHcp(e, r, c) {
  if (e.hcpManual) return;
  const h = Golf.handicaps(hiOf(e.userId), r.snapshot, c.allowance);
  e.hcpIndex = h.hi; e.courseHcp = h.ch; e.playingHcp = h.ph;
}

/* ---------- Actions ---------- */
function setRsvp(rid, uid, s) {
  const r = round(rid); const c = r && comp(r.competitionId); if (!r || !c) return;
  if (!canRsvp(r, c, uid)) { toast(deadlinePassed(r) ? "La date limite d'inscription est passée." : 'Vous ne pouvez pas modifier cette réponse.'); return; }
  const cur = entry(rid, uid);
  if (cur && cur.status === s) return;
  const e = cur ? { ...cur, strokes: (cur.strokes || []).slice() } : { id: rid + '__' + uid, roundId: rid, competitionId: c.id, userId: uid, strokes: r.snapshot.holes.map(() => null), submitted: false, hcpManual: false, createdAt: nowISO() };
  e.status = s;
  if (s === 'yes' && !(e.strokes || []).some(v => v != null)) freezeHcp(e, r, c);
  e.updatedAt = nowISO(); e.updatedBy = S.uid;
  put('entries', e.id, e);
  toast(s === 'yes' ? (uid === S.uid ? 'Inscription confirmée. À bientôt sur le tee !' : `${firstName(uid)} participe`) : 'Réponse enregistrée');
}
function curScore() { return VIEW && VIEW.ctx ? VIEW.ctx : null; }
function setStroke(v) {
  const ctx = curScore(); if (!ctx) return;
  const r = round(ctx.rid), c = comp(r.competitionId);
  if (!canScore(r, c, ctx.uid)) return;
  const old = entry(ctx.rid, ctx.uid);
  const e = { ...old, strokes: (old.strokes || []).slice() };
  const n = r.snapshot.holes.length;
  while (e.strokes.length < n) e.strokes.push(null);
  if (!(old.strokes || []).some(x => x != null)) freezeHcp(e, r, c);
  e.strokes[S.ui.hole[ctx.rid + ctx.uid]] = v;
  e.updatedAt = nowISO(); e.updatedBy = S.uid;
  putSoon('entries', e.id, e);
  render({ force: true });
}
function stepStroke(d) {
  const ctx = curScore(); if (!ctx) return;
  const r = round(ctx.rid); const i = S.ui.hole[ctx.rid + ctx.uid];
  const par = r.snapshot.holes[i].par;
  const g = (entry(ctx.rid, ctx.uid).strokes || [])[i];
  const base = g == null || g === 0 ? par : g;
  setStroke(Math.max(1, Math.min(15, base + d)));
}
function goHole(h) {
  const ctx = curScore(); if (!ctx) return;
  const n = round(ctx.rid).snapshot.holes.length;
  if (h < 0 || h >= n) return;
  S.ui.hole[ctx.rid + ctx.uid] = h;
  render({ force: true }); window.scrollTo(0, 0);
}
function cascadeDeleteRound(rid) { purgeLocal('entries', e => e.roundId === rid); del('rounds', rid); }

const ACTIONS = {
  go: el => nav(el.dataset.to),
  rsvp: el => setRsvp(el.dataset.r, el.dataset.u, el.dataset.s),
  step: el => stepStroke(Number(el.dataset.d)),
  tapVal: () => { const ctx = curScore(); if (!ctx) return; const r = round(ctx.rid); const i = S.ui.hole[ctx.rid + ctx.uid]; const g = (entry(ctx.rid, ctx.uid).strokes || [])[i]; if (g == null) setStroke(r.snapshot.holes[i].par); },
  setS: el => setStroke(Number(el.dataset.v)),
  hole: el => goHole(Number(el.dataset.h)),
  goHole: el => { const rid = ROUTE.split('/')[1], uid = ROUTE.split('/')[3]; S.ui.hole[rid + uid] = Number(el.dataset.h); nav(`r/${rid}/score/${uid}`); },
  submitCard: el => {
    const r = round(el.dataset.r), c = comp(r.competitionId), e = entry(el.dataset.r, el.dataset.u);
    if (!canScore(r, c, e.userId)) return;
    const card = cardOf(e, r, c); if (!card.complete) { toast('Complétez tous les trous avant de valider.'); return; }
    const n = { ...e, strokes: e.strokes.slice(), submitted: true, submittedAt: nowISO(), updatedAt: nowISO(), updatedBy: S.uid };
    if (n.playingHcp == null) freezeHcp(n, r, c);
    put('entries', n.id, n); toast(`Carte validée · ${card.pts} points`); nav('r/' + r.id);
  },
  reopenCard: el => { const e = entry(el.dataset.r, el.dataset.u); if (!e || !isAdmin(comp(e.competitionId))) return; put('entries', e.id, { ...e, submitted: false, updatedAt: nowISO(), updatedBy: S.uid }); toast('Carte rouverte pour correction'); },
  closeRound: el => { const r = round(el.dataset.r); if (!armed(el, 'Confirmer la clôture')) return; put('rounds', r.id, { ...r, status: 'closed', updatedAt: nowISO() }); toast('Manche clôturée'); },
  reopenRound: el => { const r = round(el.dataset.r); put('rounds', r.id, { ...r, status: 'open', updatedAt: nowISO() }); toast('Manche rouverte'); },
  deleteRound: el => { if (!armed(el, 'Supprimer définitivement ?')) return; const r = round(el.dataset.r); const cid = r.competitionId; cascadeDeleteRound(r.id); toast('Manche supprimée'); nav(`c/${cid}/manches`, { replace: true }); },
  removeMember: el => { if (!armed(el, 'Retirer ?')) return; del('members', el.dataset.c + '__' + el.dataset.u); toast(`${fullName(el.dataset.u)} a été retiré de la compétition`); },
  deleteComp: el => {
    if (!armed(el, 'Tout supprimer définitivement ?')) return;
    const cid = el.dataset.c;
    const rids = new Set(roundsOf(cid).map(r => r.id));
    purgeLocal('entries', e => rids.has(e.roundId)); purgeLocal('rounds', r => r.competitionId === cid); purgeLocal('members', m => m.competitionId === cid);
    del('competitions', cid); toast('Compétition supprimée'); nav('competitions', { replace: true });
  },
  regenCode: el => { const c = comp(el.dataset.c); const code = makeCode(c.name + ' X', c.startDate); put('competitions', c.id, { ...c, code, updatedAt: nowISO() }); toast('Nouveau code : ' + code); render({ force: true }); },
  copy: el => {
    const t = el.dataset.t;
    const ok = () => toast('Code copié : ' + t);
    try { navigator.clipboard.writeText(t).then(ok, () => toast('Code : ' + t)); } catch (e) { toast('Code : ' + t); }
  },
  logout: async () => { flushWrites(); await S.sb.auth.signOut(); S.uid = null; S.loaded = false; COLS.forEach(c => { S.data[c] = new Map(); S.remote[c] = new Map(); }); nav('connexion', { replace: true }); },
  removePhoto: () => { const u = me(); const n = { ...u, photo: null, updatedAt: nowISO() }; put('profiles', u.id, n); render({ force: true }); toast('Photo retirée'); },
  addTee: () => { const d = collectCourse(); const used = new Set(d.tees.map(t => t.name)); const next = TEE_COLORS.find(([n]) => !used.has(n)) || TEE_COLORS[0]; d.tees.push({ id: gid('t'), name: next[0], color: next[1], cr: null, slope: null, totalDist: null }); render({ force: true }); },
  addLayout: () => { const d = collectCourse(); const m = d.holesCount / 9; (d.layouts = d.layouts || []).push({ name: '', nines: [0, Math.min(1, m - 1)] }); render({ force: true }); },
  removeLayout: el => { const d = collectCourse(); d.layouts.splice(Number(el.dataset.k), 1); render({ force: true }); },
  removeTee: el => { const d = collectCourse(); d.tees.splice(Number(el.dataset.k), 1); render({ force: true }); },
  deleteCourse: el => { if (!armed(el, 'Supprimer le parcours ?')) return; del('courses', el.dataset.id); toast('Parcours supprimé'); nav('parcours', { replace: true }); },
  newCourseFromRound: () => { S.ui.returnTo = ROUTE; },
  nains: el => {
    const ctx = curScore(); if (!ctx) return;
    const r = round(ctx.rid), c = comp(r.competitionId); if (!canScore(r, c, ctx.uid)) return;
    const old = entry(ctx.rid, ctx.uid); const i = S.ui.hole[ctx.rid + ctx.uid];
    const a = (old.nains || []).slice(); while (a.length <= i) a.push(0);
    a[i] = Math.max(0, Math.min(9, (a[i] || 0) + Number(el.dataset.d)));
    putSoon('entries', old.id, { ...old, strokes: (old.strokes || []).slice(), nains: a, updatedAt: nowISO(), updatedBy: S.uid });
    render({ force: true });
  },
  chWin: el => {
    const ctx = curScore(); if (!ctx) return;
    const k = el.dataset.k; const r = round(ctx.rid), c = comp(r.competitionId); const i = S.ui.hole[ctx.rid + ctx.uid];
    const has = e => k === 'ld' ? !!(e.ld || [])[i] : !!e.ntp;
    const es = entriesOf(ctx.rid).filter(e => e.status === 'yes');
    const cur = es.find(has); const win = !(cur && cur.userId === ctx.uid);
    const change = es.filter(e => has(e) !== (win && e.userId === ctx.uid));
    const blocked = change.find(e => !canScore(r, c, e.userId));
    if (blocked) { toast(`La carte de ${firstName(blocked.userId)} est validée : seul l'administrateur peut modifier ce défi.`); return; }
    change.forEach(e0 => {
      const e = S.data.entries.get(e0.id); const n = { ...e, strokes: (e.strokes || []).slice(), updatedAt: nowISO(), updatedBy: S.uid };
      if (k === 'ld') { const a = (e.ld || []).slice(); while (a.length <= i) a.push(false); a[i] = win && e.userId === ctx.uid; n.ld = a; } else n.ntp = win && e.userId === ctx.uid;
      put('entries', n.id, n);
    });
    toast(win ? `${k === 'ld' ? 'Long drive' : 'Plus près du drapeau'} : ${ctx.uid === S.uid ? 'à vous' : firstName(ctx.uid)}` : 'Défi retiré');
    render({ force: true });
  },
  dirImport: el => { const g = DIRMAP.get(el.dataset.id); const k = el.dataset.k === 'all' ? 'all' : Number(el.dataset.k); const d = k === 'all' ? draftFromDirMulti(g) : draftFromDir(g, k >= 0 ? g.cards[k] : null); S.ui.courseDraft = d; nav('parcours/nouveau', { keepDraft: true }); },
};

/* ---------- Formulaire parcours : lecture de l'état ---------- */
function collectCourse() {
  const d = S.ui.courseDraft; const f = document.querySelector('form[data-form="course"]');
  if (!d || !f) return d;
  const g = n => { const x = f.elements[n]; return x ? x.value : undefined; };
  d.name = (g('name') || '').trim(); d.location = (g('location') || '').trim(); d.country = (g('country') || '').trim();
  if (d.holesCount > 18) {
    d.loops = Array.from({ length: d.holesCount / 9 }, (_, k) => (g('loop-' + k) || '').trim());
    (d.layouts || []).forEach((l, k) => { const nm = g('ly-name-' + k); if (nm != null) l.name = nm.trim(); const a = g('ly-a-' + k), b = g('ly-b-' + k); if (a != null) l.nines = [Number(a), Number(b)]; });
  }
  d.holes.forEach((h, i) => {
    const p = f.querySelector(`input[name="par-${i}"]:checked`); h.par = p ? Number(p.value) : null;
    const si = numIn(g('si-' + i)); h.si = si == null ? null : si;
    const di = numIn(g('dist-' + i)); h.dist = di == null ? null : di;
  });
  d.tees.forEach((t, k) => {
    const nm = g('tee-name-' + k); if (nm) { t.name = nm; t.color = (TEE_COLORS.find(x => x[0] === nm) || [nm, '#999'])[1]; }
    t.cr = numIn(g('tee-cr-' + k)); t.slope = numIn(g('tee-slope-' + k)); t.totalDist = numIn(g('tee-dist-' + k));
  });
  return d;
}

/* Nombre minimum de manches : obligatoire, entier de 0 à 50 ; avec un minimum, la date de fin est obligatoire. */
function checkMinRounds(f, errs) {
  const raw = f.minRounds.value.trim(); const v = numIn(raw);
  if (raw === '' || !Number.isInteger(v) || v < 0 || v > 50) { errs.push({ f: 'minRounds', m: 'Indiquez le nombre minimum de manches à jouer (0 à 50, 0 = pas de minimum).' }); return 0; }
  if (v > 0 && !f.endDate.value) errs.push({ f: 'endDate', m: 'Avec un minimum de manches, indiquez la date de fin de la saison : les éliminations se font à cette date.' });
  return v;
}

/* ---------- Soumission des formulaires ---------- */
const FORMS = {
  async login(f) {
    const email = f.email.value.trim(), pw = f.pw.value;
    if (!email || !pw) return showErrs(f, [{ f: 'email', m: 'Saisissez votre e-mail et votre mot de passe.' }]);
    const btn = f.querySelector('button[type="submit"]'); btn.disabled = true;
    const { data, error } = await S.sb.auth.signInWithPassword({ email, password: pw });
    btn.disabled = false;
    if (error) return showErrs(f, [{ f: 'pw', m: /confirm/i.test(error.message) ? "Votre adresse e-mail n'est pas encore confirmée. Ouvrez le lien reçu par e-mail." : 'E-mail ou mot de passe incorrect.' }]);
    S.uid = data.user.id; S.email = data.user.email;
    try { await loadAll(); } catch (e) { toast('Impossible de charger vos données. Vérifiez votre connexion.'); }
    nav(S.after || 'accueil', { replace: true }); S.after = null;
  },
  async forgot(f) {
    const email = f.email.value.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return showErrs(f, [{ f: 'email', m: 'Indiquez une adresse e-mail valide.' }]);
    await S.sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname + '#nouveau-mdp' });
    showErrs(f, []); toast("Si un compte existe pour cette adresse, un e-mail vient d'être envoyé.");
    nav('connexion', { replace: true });
  },
  async newPassword(f) {
    const errs = [];
    if (f.pw.value.length < 8) errs.push({ f: 'pw', m: 'Le mot de passe doit contenir au moins 8 caractères.' });
    if (f.pw.value !== f.pw2.value) errs.push({ f: 'pw2', m: 'Les deux mots de passe ne correspondent pas.' });
    if (showErrs(f, errs)) return;
    const { error } = await S.sb.auth.updateUser({ password: f.pw.value });
    if (error) return showErrs(f, [{ f: 'pw', m: "Le lien a expiré. Recommencez depuis « Mot de passe oublié »." }]);
    toast('Mot de passe mis à jour');
    if (!S.loaded) { try { await loadAll(); } catch (e) {} }
    nav('accueil', { replace: true });
  },
  async register(f) {
    const errs = []; const email = f.email.value.trim();
    const hcp = parseHcp(f.handicap.value);
    if (!f.firstName.value.trim()) errs.push({ f: 'firstName', m: 'Indiquez votre prénom.' });
    if (!f.lastName.value.trim()) errs.push({ f: 'lastName', m: 'Indiquez votre nom.' });
    if (!/^\S+@\S+\.\S+$/.test(email)) errs.push({ f: 'email', m: 'Indiquez une adresse e-mail valide.' });
    if (!validHcp(hcp)) errs.push({ f: 'handicap', m: "Indiquez un index entre +10 et 54 (ex. 28,4)." });
    if (f.pw.value.length < 8) errs.push({ f: 'pw', m: 'Le mot de passe doit contenir au moins 8 caractères.' });
    if (f.pw.value !== f.pw2.value) errs.push({ f: 'pw2', m: 'Les deux mots de passe ne correspondent pas.' });
    if (showErrs(f, errs)) return;
    const btn = f.querySelector('button[type="submit"]'); btn.disabled = true;
    const { data, error } = await S.sb.auth.signUp({ email, password: f.pw.value, options: { emailRedirectTo: location.origin + location.pathname, data: { first_name: f.firstName.value.trim(), last_name: f.lastName.value.trim(), handicap: hcp } } });
    btn.disabled = false;
    if (error) return showErrs(f, [{ f: 'email', m: /registered|already/i.test(error.message) ? 'Un compte existe déjà avec cet e-mail. Connectez-vous.' : "L'inscription a échoué. Réessayez dans un instant." }]);
    if (data.session) {
      S.uid = data.user.id; S.email = email;
      try { await loadAll(); } catch (e) {}
      toast(`Bienvenue sur Eagle Touch, ${f.firstName.value.trim()} !`);
      nav(S.after || 'accueil', { replace: true }); S.after = null;
    } else { S.ui.pendingEmail = email; nav('verifier-email', { replace: true }); }
  },
  profileCreate(f) {
    const errs = []; const hcp = parseHcp(f.handicap.value);
    if (!f.firstName.value.trim()) errs.push({ f: 'firstName', m: 'Indiquez votre prénom.' });
    if (!validHcp(hcp)) errs.push({ f: 'handicap', m: "Indiquez un index entre +10 et 54 (ex. 28,4)." });
    if (showErrs(f, errs)) return;
    const t = nowISO();
    put('profiles', S.uid, { id: S.uid, firstName: f.firstName.value.trim(), lastName: f.lastName.value.trim(), email: S.email || '', handicap: hcp, photo: null, handicapHistory: [{ value: hcp, date: t }], createdAt: t, updatedAt: t });
    nav(S.after || 'accueil', { replace: true }); S.after = null;
  },
  profile(f) {
    const u = me(); const errs = []; const hcp = parseHcp(f.handicap.value);
    if (!f.firstName.value.trim()) errs.push({ f: 'firstName', m: 'Indiquez votre prénom.' });
    if (!/^\S+@\S+\.\S+$/.test(f.email.value.trim())) errs.push({ f: 'email', m: 'Indiquez une adresse e-mail valide.' });
    if (!validHcp(hcp)) errs.push({ f: 'handicap', m: 'Indiquez un index entre +10 et 54.' });
    if (showErrs(f, errs)) return;
    const n = { ...u, firstName: f.firstName.value.trim(), lastName: f.lastName.value.trim(), email: f.email.value.trim(), handicap: hcp, updatedAt: nowISO() };
    if (hcp !== u.handicap) n.handicapHistory = [...(u.handicapHistory || []), { value: hcp, date: nowISO() }].slice(-40);
    put('profiles', u.id, n); toast(hcp !== u.handicap ? `Index mis à jour : ${idx1(hcp)}` : 'Profil enregistré'); render({ force: true });
  },
  compCreate(f) {
    const errs = []; const name = f.name.value.trim();
    const minR = checkMinRounds(f, errs);
    if (!name) errs.push({ f: 'name', m: 'Donnez un nom à la compétition.' });
    if (!f.startDate.value) errs.push({ f: 'startDate', m: 'Indiquez la date de début.' });
    if (f.endDate.value && f.endDate.value < f.startDate.value) errs.push({ f: 'endDate', m: 'La date de fin doit suivre la date de début.' });
    if (showErrs(f, errs)) return;
    const id = gid('c'); const t = nowISO(); const code = makeCode(name, f.startDate.value);
    put('competitions', id, { id, name, description: f.description.value.trim(), startDate: f.startDate.value, endDate: f.endDate.value || null, code, createdBy: S.uid, admins: [S.uid], allowance: 100, minRounds: minR, createdAt: t, updatedAt: t });
    put('members', id + '__' + S.uid, { id: id + '__' + S.uid, competitionId: id, userId: S.uid, role: 'admin', joinedAt: t });
    toast(`Compétition créée. Code d'invitation : ${code}`); nav(`c/${id}/joueurs`, { replace: true });
  },
  compEdit(f) {
    const c = comp(f.dataset.c); if (!isAdmin(c)) return;
    const errs = [];
    const minR = checkMinRounds(f, errs);
    if (!f.name.value.trim()) errs.push({ f: 'name', m: 'Donnez un nom à la compétition.' });
    if (f.endDate.value && f.endDate.value < f.startDate.value) errs.push({ f: 'endDate', m: 'La date de fin doit suivre la date de début.' });
    if (showErrs(f, errs)) return;
    const al = f.querySelector('input[name="allowance"]:checked');
    const challenges = Object.fromEntries(CHALLENGES.map(ch => [ch.k, !!(f.querySelector(`input[name="ch-${ch.k}"]`) || {}).checked]));
    put('competitions', c.id, { ...c, name: f.name.value.trim(), description: f.description.value.trim(), startDate: f.startDate.value, endDate: f.endDate.value || null, allowance: al ? Number(al.value) : 100, challenges, minRounds: minR, updatedAt: nowISO() });
    toast('Compétition enregistrée'); render({ force: true });
  },
  async join(f) {
    const code = f.code.value.trim().toUpperCase().replace(/\s+/g, '');
    if (!code) return showErrs(f, [{ f: 'code', m: 'Saisissez le code de la compétition.' }]);
    const { data: cid, error } = await S.sb.rpc('join_competition', { p_code: code });
    if (error) return showErrs(f, [{ f: 'code', m: "Impossible de rejoindre la compétition pour l'instant. Réessayez." }]);
    if (!cid) return showErrs(f, [{ f: 'code', m: "Aucune compétition ne correspond à ce code. Vérifiez-le auprès de l'administrateur." }]);
    try { await loadAll(); } catch (e) {}
    const c = comp(cid); toast(c ? `Bienvenue dans ${c.name} !` : 'Compétition rejointe');
    nav(`c/${cid}/apercu`, { replace: true });
  },
  guestAdd(f) {
    const cid = f.dataset.c; const c = comp(cid); if (!isAdmin(c)) return;
    const hcp = parseHcp(f.handicap.value); const errs = [];
    if (!f.firstName.value.trim()) errs.push({ f: 'firstName', m: 'Indiquez le prénom du joueur.' });
    if (hcp != null && !validHcp(hcp)) errs.push({ f: 'handicap', m: 'Indiquez un index entre +10 et 54.' });
    if (showErrs(f, errs)) return;
    const uid = gid('g'); const t = nowISO();
    put('profiles', uid, { id: uid, firstName: f.firstName.value.trim(), lastName: f.lastName.value.trim(), email: '', handicap: hcp ?? 54, photo: null, managedBy: S.uid, handicapHistory: [{ value: hcp ?? 54, date: t }], createdAt: t, updatedAt: t });
    put('members', cid + '__' + uid, { id: cid + '__' + uid, competitionId: cid, userId: uid, role: 'player', joinedAt: t, addedBy: S.uid });
    toast(`${f.firstName.value.trim()} a été ajouté`); f.reset(); render({ force: true });
  },
  guestIndex(f) {
    const p = P(f.dataset.u); const hcp = parseHcp(f.handicap.value);
    if (!validHcp(hcp)) return showErrs(f, [{ f: 'handicap', m: 'Indiquez un index entre +10 et 54.' }]);
    put('profiles', p.id, { ...p, handicap: hcp, handicapHistory: [...(p.handicapHistory || []), { value: hcp, date: nowISO() }].slice(-40), updatedAt: nowISO() });
    toast('Index mis à jour'); render({ force: true });
  },
  course(f) {
    const d = collectCourse();
    const holes = d.holes.map((h, i) => ({ n: i + 1, par: h.par, si: h.si, dist: h.dist }));
    const errs = Golf.validateCourse({ name: d.name, holesCount: d.holesCount, holes, tees: d.tees, loops: d.loops, layouts: d.layouts });
    if (showErrs(f, errs)) return;
    const id = d.id || gid('p'); const prev = course(id); const t = nowISO();
    const obj = { id, name: d.name, location: d.location, country: d.country, holesCount: d.holesCount, loops: d.holesCount > 18 ? d.loops : null, layouts: d.holesCount > 18 ? (d.layouts || []).map(l => ({ name: l.name || '', nines: l.nines })) : null, par: holes.reduce((a, h) => a + h.par, 0), holes, tees: d.tees.map(x => ({ ...x, holeDist: x.holeDist && x.holeDist.length === holes.length ? x.holeDist : null })), source: d.source || (prev && prev.source) || null, region: d.region || (prev && prev.region) || '', createdBy: prev ? prev.createdBy : S.uid, createdAt: prev ? prev.createdAt : t, updatedAt: t };
    put('courses', id, obj); toast('Parcours enregistré'); S.ui.courseDraft = null;
    const back = S.ui.returnTo;
    if (back) { const key = back.includes('/modifier') ? back.split('/')[1] : 'new:' + back.split('/')[1]; S.ui.roundDraft = { key, courseId: id }; nav(back, { replace: true, keepDraft: true }); }
    else nav('parcours', { replace: true });
  },
  round(f) {
    const c = comp(f.dataset.c); if (!isAdmin(c)) return;
    const rid = f.dataset.r || null; const r = rid ? round(rid) : null;
    const locked = r && entriesOf(r.id).some(e => (e.strokes || []).some(v => v != null));
    const errs = [];
    if (!f.date.value) errs.push({ f: 'date', m: 'Indiquez la date de la manche.' });
    const cSel = f.querySelector('input[name="courseId"]:checked');
    if (!locked && !cSel) errs.push({ f: 'courseId', m: 'Choisissez le parcours de la manche.' });
    if (f.deadline.value && f.date.value && f.deadline.value > f.date.value) errs.push({ f: 'deadline', m: "La date limite d'inscription doit précéder la manche." });
    if (showErrs(f, errs)) return;
    let snapshot = r ? r.snapshot : null;
    if (!locked) {
      const co = course(cSel.value);
      const mode = formMode(f, co);
      if (isMulti(co) && !mode) return showErrs(f, [{ f: 'layout', m: 'Choisissez le parcours joué.' }]);
      const tee = (f.querySelector('input[name="teeId"]:checked') || {}).value || null;
      let rating = null;
      if (isMulti(co) && f.rCr) {
        const cr = numIn(f.rCr.value), sl = numIn(f.rSlope.value); const nine = loopsOfMode(mode).length === 1;
        if (cr != null && !(cr >= (nine ? 10 : 20) && cr <= (nine ? 40 : 80))) return showErrs(f, [{ f: 'rCr', m: `Course rating invalide pour ${nine ? '9' : '18'} trous.` }]);
        if (sl != null && !(Number.isInteger(sl) && sl >= 55 && sl <= 155)) return showErrs(f, [{ f: 'rSlope', m: 'Le slope doit être un nombre entre 55 et 155.' }]);
        rating = { cr, slope: sl };
      }
      snapshot = buildSnapshot(co, tee, mode, rating);
    }
    const id = rid || gid('r'); const n = roundsOf(c.id).length + (r ? 0 : 1); const t = nowISO();
    let ntpHole = r ? (r.ntpHole ?? null) : null;
    if (!locked && chOn(c, 'ntp')) {
      const sel = f.querySelector('select[name="ntpHole"]');
      const hn = sel && sel.value ? Number(sel.value) : null;
      const k = hn == null ? -1 : snapshot.holes.findIndex(h => (h.src ?? h.n) === hn);
      const hasP3 = snapshot.holes.some(h => h.par === 3);
      if (hasP3 && hn == null) return showErrs(f, [{ f: 'ntpHole', m: 'Choisissez le par 3 du défi « plus près du drapeau ».' }]);
      if (hn != null && k < 0) return showErrs(f, [{ f: 'ntpHole', m: `Le trou ${hn} ne fait pas partie des trous joués dans cette manche.` }]);
      ntpHole = k >= 0 ? k : null;
    }
    let ldHole = r ? (r.ldHole ?? null) : null;
    if (!locked && chOn(c, 'ld')) {
      const sel = f.querySelector('select[name="ldHole"]');
      const hn = sel && sel.value ? Number(sel.value) : null;
      const k = hn == null ? -1 : snapshot.holes.findIndex(h => (h.src ?? h.n) === hn);
      if (snapshot.holes.some(h => h.par >= 4) && hn == null) return showErrs(f, [{ f: 'ldHole', m: 'Choisissez le trou du défi « long drive ».' }]);
      if (hn != null && k < 0) return showErrs(f, [{ f: 'ldHole', m: `Le trou ${hn} ne fait pas partie des trous joués dans cette manche.` }]);
      ldHole = k >= 0 ? k : null;
    }
    put('rounds', id, { ...(r || {}), id, competitionId: c.id, name: f.name.value.trim() || `Manche ${n}`, date: f.date.value, teeTime: f.teeTime.value || null, deadline: f.deadline.value || null, description: f.description.value.trim(), snapshot, ntpHole, ldHole, status: r ? r.status : 'open', createdAt: r ? r.createdAt : t, updatedAt: t });
    toast(r ? 'Manche enregistrée' : 'Manche créée. Les joueurs peuvent confirmer leur participation.');
    nav('r/' + id, { replace: true });
  },
};

/* ---------- Écouteurs globaux ---------- */
document.addEventListener('click', e => {
  const act = e.target.closest('[data-a]');
  if (act && act.tagName !== 'INPUT' && act.tagName !== 'SELECT') {
    const fn = ACTIONS[act.dataset.a];
    if (fn) { if (act.tagName === 'BUTTON' || act.tagName === 'TR' || act.getAttribute('role') === 'button') e.preventDefault(); if (!act.disabled) fn(act, e); if (act.tagName !== 'A') return; }
  }
  const a = e.target.closest('a[href^="#"]');
  if (a) { e.preventDefault(); const to = a.getAttribute('href').slice(1); nav(to, { keepReturn: act && act.dataset.a === 'newCourseFromRound' }); }
});
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role="button"][data-a]')) { e.preventDefault(); e.target.click(); }
  if (VIEW && VIEW.ctx && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) {
    if (e.key === 'ArrowRight') goHole(S.ui.hole[VIEW.ctx.rid + VIEW.ctx.uid] + 1);
    else if (e.key === 'ArrowLeft') goHole(S.ui.hole[VIEW.ctx.rid + VIEW.ctx.uid] - 1);
    else if (e.key === '+' || e.key === 'ArrowUp') { e.preventDefault(); stepStroke(1); }
    else if (e.key === '-' || e.key === 'ArrowDown') { e.preventDefault(); stepStroke(-1); }
  }
});
document.addEventListener('submit', e => {
  const f = e.target.closest('form[data-form]'); if (!f) return;
  e.preventDefault();
  if (S.readonly) { toast("Accès en lecture seule : impossible d'enregistrer."); return; }
  const fn = FORMS[f.dataset.form]; if (fn) fn(f);
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.name === 'theme') { setTheme(t.value); toast(t.value === 'dark' ? 'Mode sombre activé' : t.value === 'light' ? 'Mode clair activé' : 'Apparence automatique'); return; }
  if (t.name === 'dircc' || t.id === 'dir-card') {
    if (t.name === 'dircc') S.ui.dir.cc = t.value; else S.ui.dir.card = t.checked;
    const box = document.getElementById('dir-res'); if (box) box.innerHTML = dirResults(); return;
  }
  if (t.matches('input[data-a="holesCount"]')) {
    const d = collectCourse(); const n = Number(t.value);
    if (d && d.holesCount !== n) {
      d.holesCount = n;
      d.holes = d.holes.slice(0, n);
      while (d.holes.length < n) d.holes.push({ n: d.holes.length + 1, par: 4, si: null, dist: null });
      if (n > 18) { const m = n / 9; d.loops = Array.from({ length: m }, (_, k) => (d.loops || [])[k] || ''); d.layouts = defaultLayouts(m); } else { d.loops = null; d.layouts = null; }
      render({ force: true });
    }
  } else if (t.matches('#course-opts input[name="mode"], #course-opts input[name="layout"], #course-opts input[name="teeId"]')) {
    const f = t.form; const co = course((f.querySelector('input[name="courseId"]:checked') || {}).value); if (!co) return;
    const mode = formMode(f, co); if (!mode) return;
    const r = f.dataset.r ? round(f.dataset.r) : null; const c = comp(f.dataset.c);
    const keep = ['ldHole', 'ntpHole'].map(n => [n, (f.elements[n] || {}).value]);
    const hp = document.getElementById('hole-picks'); if (hp) hp.innerHTML = holePicks(co, mode, r, false, c);
    keep.forEach(([n, v]) => { const el = f.elements[n]; if (el && v && [...el.options].some(o => o.value === v)) el.value = v; });
    const rb = document.getElementById('rating-box'); const tee = (f.querySelector('input[name="teeId"]:checked') || {}).value;
    if (rb && isMulti(co)) rb.innerHTML = ratingBox(co, tee, mode, null, false);
  } else if (t.matches('#course-pick input')) {
    const box = document.getElementById('course-opts'); const f = t.form;
    const r = f.dataset.r ? round(f.dataset.r) : null;
    if (box) box.innerHTML = roundCourseOpts(t.value, r, false, comp(f.dataset.c));
  } else if (t.matches('select[data-a="ntpHole"]')) {
    const r = round(t.dataset.r); const c = comp(r.competitionId); if (!isAdmin(c)) return;
    const v = t.value === '' ? null : Number(t.value);
    if (v === r.ntpHole) return;
    put('rounds', r.id, { ...r, ntpHole: v, updatedAt: nowISO() });
    entriesOf(r.id).filter(e => e.ntp).forEach(e => put('entries', e.id, { ...e, strokes: (e.strokes || []).slice(), ntp: false, updatedAt: nowISO(), updatedBy: S.uid }));
    toast(v == null ? 'Défi « plus près du drapeau » désactivé pour cette manche' : `Plus près du drapeau : trou ${r.snapshot.holes[v].n}`);
    t.blur(); render({ force: true });
  } else if (t.matches('input[data-a="setPh"]')) {
    const e2 = entry(t.dataset.r, t.dataset.u); const r = round(t.dataset.r); const c = comp(r.competitionId);
    if (!isAdmin(c) || !e2) return;
    const v = numIn(t.value);
    if (!Number.isInteger(v) || v < -10 || v > 60) { toast('Handicap de jeu invalide (nombre entier).'); t.value = entryHcp(e2, r, c).ph; return; }
    const h = entryHcp(e2, r, c);
    put('entries', e2.id, { ...e2, strokes: (e2.strokes || []).slice(), hcpIndex: h.hi, courseHcp: h.ch, playingHcp: v, hcpManual: true, updatedAt: nowISO(), updatedBy: S.uid });
    toast(`Handicap de jeu de ${firstName(e2.userId)} : ${v}`);
  } else if (t.matches('input[data-a="photo"]')) {
    const file = t.files && t.files[0]; if (!file) return;
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const s = 192, cv = document.createElement('canvas'); cv.width = cv.height = s;
      const k = Math.max(s / img.width, s / img.height), w = img.width * k, h = img.height * k;
      cv.getContext('2d').drawImage(img, (s - w) / 2, (s - h) / 2, w, h);
      URL.revokeObjectURL(url);
      const u = me(); put('profiles', u.id, { ...u, photo: cv.toDataURL('image/jpeg', 0.82), updatedAt: nowISO() });
      toast('Photo mise à jour'); render({ force: true });
    };
    img.onerror = () => toast("Cette image ne peut pas être lue. Essayez un fichier JPEG ou PNG.");
    img.src = url;
  }
});
document.addEventListener('input', e => {
  if (e.target.id === 'dir-q') { S.ui.dir.q = e.target.value; const box = document.getElementById('dir-res'); if (box) box.innerHTML = dirResults(); return; }
  if (e.target.closest('form[data-form="course"]') && e.target.name && e.target.name.startsWith('par-')) {
    const f = e.target.form; let sum = 0;
    $$('input[name^="par-"]:checked', f).forEach(x => { sum += Number(x.value); });
    const el = document.getElementById('par-total'); if (el) el.textContent = sum;
  }
});
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushWrites(); });

/* ---------- Illustration de l'écran d'accueil : courbes de niveau d'un green ---------- */
function drawArt() {
  const cv = document.getElementById('green-art'); if (!cv) return;
  const r = cv.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
  cv.width = r.width * dpr; cv.height = r.height * dpr;
  const g = cv.getContext('2d'); g.scale(dpr, dpr);
  const cx = r.width * 0.62, cy = r.height * 0.36;
  for (let k = 1; k <= 18; k++) {
    g.beginPath();
    for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.04) {
      const rad = k * 26 * (1 + 0.12 * Math.sin(a * 3 + k * 0.35) + 0.06 * Math.cos(a * 5 - k * 0.2));
      const x = cx + Math.cos(a) * rad * 1.35, y = cy + Math.sin(a) * rad;
      a === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.strokeStyle = `rgba(210,176,102,${k === 3 ? 0.55 : 0.07 + 0.012 * (18 - k)})`;
    g.lineWidth = k === 3 ? 1.4 : 1; g.stroke();
  }
  g.fillStyle = '#EEF2EC'; g.beginPath(); g.arc(cx + 8, cy + 4, 5, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#D2B066'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx, cy - 64); g.stroke();
  g.fillStyle = '#D2B066'; g.beginPath(); g.moveTo(cx, cy - 64); g.lineTo(cx + 30, cy - 54); g.lineTo(cx, cy - 44); g.closePath(); g.fill();
}
window.addEventListener('resize', () => { if (document.getElementById('green-art')) drawArt(); });

/* ---------- Démarrage ---------- */
export async function boot(sb) {
  applyTheme(getTheme());
  root().innerHTML = `<div class="loading">${BRAND}</div>`;
  const initial = parseHash() || 'accueil';
  await initStore(sb);
  ROUTE = initial;
  if (!S.uid && !SESSION_ROUTES.includes(ROUTE)) { S.after = ROUTE; ROUTE = 'connexion'; }
  if (S.uid && SESSION_ROUTES.includes(ROUTE) && ROUTE !== 'nouveau-mdp') ROUTE = 'accueil';
  if (ROUTE === 'creer' || ROUTE === 'rejoindre') { /* liens du site vitrine */ }
  try { history.replaceState({ r: ROUTE }, '', location.pathname + '#' + ROUTE); } catch (e) {}
  render({ nav: true });
}
export const __debug = { S, loadAll, standings, nav };
