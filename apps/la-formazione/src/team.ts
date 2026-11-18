import { esc, type Catalog, type CatalogArtist, type CatalogDetail } from '@sportify/core';
import type { Player } from './data';
import { LINE_NAMES, MODULI, MODULI_LIST, roleOf, type Modulo } from './formation';
import type { CardData, Squad } from './squad';

/** I voti del mister, uno per voce, da 40 a 99. */
export const VOTI = [
  { k: 'PEN', label: 'Penna', hint: 'testi e scrittura' },
  { k: 'VOC', label: 'Voce', hint: 'timbro e interpretazione' },
  { k: 'FLO', label: 'Flow', hint: 'ritmo e metrica' },
  { k: 'PAL', label: 'Palco', hint: 'presenza dal vivo' },
] as const;
export const VOTO_BASE = 75;

/** La squadra fatta a mano: 11 posti in ordine di posizione (vedi MODULI). */
export interface Team {
  name: string;
  modulo: Modulo;
  slots: (CatalogArtist | null)[];
  /** Indice del posto del capitano. */
  captain: number;
  /** Voti del mister per artista (id → 4 valori). */
  ratings: Record<string, number[]>;
  /** Nome della squadra che ha lanciato la sfida, se si sta rispondendo. */
  vs?: string;
}

export const emptyTeam = (name = 'La mia squadra'): Team =>
  ({ name, modulo: '433', slots: Array(11).fill(null), captain: 0, ratings: {} });

export const isComplete = (t: Team) => t.slots.every(Boolean);
export const filled = (t: Team) => t.slots.filter(Boolean).length;

// ---------- Salvataggio della bozza nel browser (solo comodità: se non c'è, si riparte da zero) ----------
const KEY = 'squadify.team';
export function saveDraft(t: Team) {
  try { localStorage.setItem(KEY, JSON.stringify(t)); } catch { /* storage non disponibile */ }
}
export function loadDraft(): Team | null {
  try {
    const t = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Team | null;
    if (!t || !Array.isArray(t.slots) || t.slots.length !== 11 || !MODULI_LIST.includes(t.modulo)) return null;
    return { ...emptyTeam(), ...t, ratings: t.ratings ?? {} };
  } catch { return null; }
}

// ---------- Link "sfida un amico": la squadra sta tutta nell'indirizzo, niente database ----------
/*
 * Formato di #sfida=, campi separati da "~":
 *   1 ~ modulo ~ indice del capitano ~ 11 id separati da "." ~ nome della squadra ~ voti (facoltativi)
 * I voti sono gruppi "posto:v1,v2,v3,v4" separati da ".", solo per chi non ha i voti di base.
 * Esempio: #sfida=1~433~0~4U2T…~FC%20Saso~0:90,80,75,75
 */
export function encodeTeam(t: Team): string {
  const r = t.slots.map((a, i) => {
    const v = a && t.ratings[a.id];
    return v && v.some((x) => x !== VOTO_BASE) ? `${i}:${v.join(',')}` : '';
  }).filter(Boolean).join('.');
  const fields = ['1', t.modulo, String(t.captain), t.slots.map((a) => a?.id ?? '').join('.'), encodeURIComponent(t.name)];
  if (r) fields.push(r);
  return fields.join('~');
}

export interface Challenge { name: string; modulo: Modulo; ids: string[]; captain: number; ratings: Record<number, number[]> }

/** Legge `#sfida=…` dall'indirizzo. null se manca o non è valido. */
export function readChallenge(hash = location.hash): Challenge | null {
  const m = hash.match(/[#&]sfida=([^&]+)/);
  if (!m) return null;
  try {
    const [v, modulo, cap, idList, name, rList] = m[1].split('~');
    const ids = (idList ?? '').split('.');
    if (v !== '1' || !MODULI_LIST.includes(modulo as Modulo)) return null;
    if (ids.length !== 11 || ids.some((x) => !/^[\w-]{1,40}$/.test(x))) return null;
    const clamp = (x: string) => Math.max(40, Math.min(99, Math.round(Number(x)) || VOTO_BASE));
    const ratings: Record<number, number[]> = {};
    for (const g of (rList ?? '').split('.').filter(Boolean)) {
      const [i, vals] = g.split(':');
      const k = Number(i);
      if (k >= 0 && k < 11 && vals) ratings[k] = VOTI.map((_, j) => clamp(vals.split(',')[j] ?? ''));
    }
    return {
      name: decodeURIComponent(name ?? '').slice(0, 18) || 'Una squadra',
      modulo: modulo as Modulo, ids,
      captain: Math.max(0, Math.min(10, Number(cap) || 0)),
      ratings,
    };
  } catch { return null; }
}

export const challengeUrl = (t: Team) => `${location.origin}${location.pathname}#sfida=${encodeTeam(t)}`;

/** Ricostruisce la squadra di chi ha lanciato la sfida (nomi e foto dal catalogo). */
export async function teamFromChallenge(c: Challenge, catalog: Catalog): Promise<Team> {
  const found = await catalog.artists([...new Set(c.ids)]);
  const byId = new Map(found.map((a) => [a.id, a]));
  const slots = c.ids.map((id) => byId.get(id) ?? null);
  if (slots.some((s) => !s)) throw new Error('Alcuni artisti di questa squadra non si trovano più su Spotify.');
  const ratings: Record<string, number[]> = {};
  for (const [i, v] of Object.entries(c.ratings)) ratings[c.ids[Number(i)]] = v;
  return { name: c.name, modulo: c.modulo, slots, captain: c.captain, ratings };
}

// ---------- La squadra fatta a mano, vista dal motore della partita ----------
const disStat = (d: CatalogDetail | null) => d?.releases == null ? null : Math.min(99, 40 + Math.round(d.releases * 1.5));
const carYears = (d: CatalogDetail | null) => d?.debut ? new Date().getFullYear() - d.debut : null;

export function manualSquad(t: Team, catalog: Catalog): Squad {
  const ids = t.slots.map((a) => a!.id);
  const players = new Map<string, Player>(t.slots.map((a) => [a!.id, { id: a!.id, name: a!.name, thumb: a!.thumb, photo: a!.image }]));
  const name = (id: string) => players.get(id)?.name ?? '—';
  const lines = MODULI[t.modulo].roles.map((_, k) => ids.filter((_, i) => roleOf(t.modulo, i) === k));
  return {
    players,
    periods: false,
    lineup: () => ids,
    captain: () => ids[t.captain],
    shirt: (id) => MODULI[t.modulo].shirt[ids.indexOf(id)] ?? 0,
    chip: () => t.vs ? `Sfida a ${t.vs}` : 'Scelta del mister',
    board: () => ({
      title: t.vs ? `Sfida · vs ${t.vs}` : 'Formazione ufficiale',
      empty: '',
      slides: lines.map((line, k) => ({
        html: `<div class="none roster flip-in"><small>${LINE_NAMES[k]}</small>${line.map((id) => esc(name(id))).join(' · ')}</div>`,
      })),
    }),
    scheda: (id) => {
      const v = t.ratings[id] ?? VOTI.map(() => VOTO_BASE);
      return `<div class="periods">${VOTI.map((x, i) => `<span class="yes">${x.k} ${v[i]}</span>`).join('')}</div>
        <div class="meta">Voti del mister: si cambiano dalla carta del giocatore.</div>`;
    },
    async card(id): Promise<CardData> {
      const d = await catalog.detail(id).catch((e) => { console.warn('Discografia non disponibile per', id, e); return null; });
      const v = t.ratings[id] ?? VOTI.map(() => VOTO_BASE);
      const st: Record<string, number | null> = {};
      const raw: Record<string, string> = {};
      VOTI.forEach((x, i) => { st[x.k] = v[i]; raw[x.k] = `voto del mister su ${x.label.toLowerCase()} (${x.hint})`; });
      const years = carYears(d);
      st.DIS = disStat(d);
      st.CAR = years === null ? null : Math.min(99, 40 + years * 2);
      raw.DIS = d?.releases == null ? 'dato non disponibile' : `${d.releases} uscite tra album e singoli su Spotify (99 da 40 in su)`;
      raw.CAR = years === null ? 'dato non disponibile' : `${years} anni dal primo disco, ${d!.debut} (99 da 30 anni in su)`;
      const vals = Object.values(st).filter((x): x is number => x !== null);
      const ovr = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
      return {
        st, raw, ovr,
        gen: [
          ['Esordio', String(d?.debut ?? '—')],
          ['Ultima uscita', d?.latest ? `«${esc(d.latest)}»` : '—'],
          ['Uscite', d?.releases == null ? '—' : `${d.releases} tra album e singoli`],
        ],
        tierNote: '',
        captionNote: t.vs ? `Sfida a ${t.vs}` : 'Formazione scelta dal mister',
      };
    },
    howNote: `PEN, VOC, FLO e PAL sono i tuoi voti da mister: cambiali qui sopra.
      DIS e CAR vengono dalla discografia pubblica su Spotify; se non c'è compare un trattino e non contano nella valutazione.`,
    opponent: t.vs ?? 'Noia',
    note: 'Tocca un giocatore per la sua scheda. I numeri di maglia sono quelli classici di ogni ruolo. Il capitano (C) lo scegli tu e segna sempre lui.',
  };
}
