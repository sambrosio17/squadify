import { pickImage, releaseYear, type Artist, type Endpoints, type SimplifiedArtist, type Track } from '@sportify/core';

export type Period = 'short' | 'medium' | 'long';
export const PERIODS: Period[] = ['short', 'medium', 'long'];
export const PERIOD_LBL: Record<Period, string> = { short: '4 settimane', medium: '6 mesi', long: '1 anno' };
/** Come si legge sulla card condivisa: il periodo di ascolti su cui è calcolata. */
export const PERIOD_FULL: Record<Period, string> = { short: 'Ultime 4 settimane', medium: 'Ultimi 6 mesi', long: 'Ultimo anno' };
const RANGE = { short: 'short_term', medium: 'medium_term', long: 'long_term' } as const;

export interface Player {
  id: string;
  name: string;
  /** Foto piccola per il dischetto in campo. */
  thumb?: string;
  /** Foto grande per la carta. */
  photo?: string;
}

export interface Model {
  /** 11 titolari per periodo, in ordine di classifica (indice 0 = capitano). */
  lineups: Record<Period, string[]>;
  players: Map<string, Player>;
  /** Ascolti negli ultimi 50 brani, per artista. */
  plays: Map<string, number>;
  /** Brani salvati in libreria, per artista. */
  saved: Map<string, number>;
  /** Brani nella top 50 di ciascun periodo, per artista. */
  hits: Record<Period, Map<string, number>>;
  /** Brano simbolo: il brano dell'artista più in alto nelle tue top, altrimenti l'ultimo salvato. */
  song: Map<string, string>;
}

/** Discografia: `null` quando Spotify non risponde (in quel caso la statistica non viene inventata). */
export interface Discography { releases: number | null; debut: number | null }

function count(map: Map<string, number>, artists: SimplifiedArtist[]) {
  for (const a of artists) map.set(a.id, (map.get(a.id) ?? 0) + 1);
}

/** Carica in parallelo tutto quello che serve a formazione, sostituzioni e carte. */
export async function loadModel(api: Endpoints): Promise<Model> {
  const [artists, tracks, recent, saved] = await Promise.all([
    Promise.all(PERIODS.map((p) => api.topArtists(RANGE[p], 50))),
    Promise.all(PERIODS.map((p) => api.topTracks(RANGE[p], 50))),
    api.recentlyPlayed(),
    api.savedTracks(500),
  ]);

  const players = new Map<string, Player>();
  const add = (a: Artist) => {
    if (!players.has(a.id)) players.set(a.id, { id: a.id, name: a.name, thumb: pickImage(a.images, 100), photo: pickImage(a.images, 600) });
  };
  artists.flat().forEach(add);

  const lineups = {} as Record<Period, string[]>;
  PERIODS.forEach((p, i) => {
    // Se un periodo ha meno di 11 artisti si completa con quelli degli altri periodi.
    const ids = [...new Set([...artists[i], ...artists.flat()].map((a) => a.id))];
    lineups[p] = ids.slice(0, 11);
  });
  if (lineups.short.length < 11) throw new Error('Servono almeno 11 artisti ascoltati per schierare la squadra.');

  const plays = new Map<string, number>();
  recent.forEach((r) => count(plays, r.track.artists));
  const savedCount = new Map<string, number>();
  saved.forEach((s) => count(savedCount, s.track.artists));
  const hits = {} as Record<Period, Map<string, number>>;
  PERIODS.forEach((p, i) => { hits[p] = new Map(); tracks[i].forEach((t) => count(hits[p], t.artists)); });

  const song = new Map<string, string>();
  const offer = (t: Track) => t.artists.forEach((a) => { if (!song.has(a.id)) song.set(a.id, t.name); });
  tracks.flat().forEach(offer);
  saved.forEach((s) => offer(s.track));

  return { lineups, players, plays, saved: savedCount, hits, song };
}

const discCache = new Map<string, Promise<Discography>>();

/**
 * Discografia di un artista (solo quando serve, per la carta).
 * Due chiamate da 10: la prima dà il totale (`total`) e le uscite più recenti,
 * la seconda l'ultima pagina, dove stanno le più vecchie (l'ordine è dalla più recente).
 */
export function discography(api: Endpoints, id: string): Promise<Discography> {
  if (!discCache.has(id)) {
    const page = (offset: number) => api.artistAlbumsPage(id, offset);
    discCache.set(id, (async () => {
      const first = await page(0);
      const last = first.total > 10 ? await page(first.total - 10) : first;
      const years = [...first.items, ...last.items].map(releaseYear).filter((y) => y > 1900);
      return { releases: first.total, debut: years.length ? Math.min(...years) : null };
    })().catch((e) => {
      console.warn('Discografia non disponibile per', id, e);
      discCache.delete(id);
      return { releases: null, debut: null };
    }));
  }
  return discCache.get(id)!;
}

export type StatKey = 'FED' | 'RIP' | 'LIB' | 'HIT' | 'DIS' | 'CAR';
export const STAT_KEYS: StatKey[] = ['FED', 'RIP', 'LIB', 'HIT', 'DIS', 'CAR'];
const WEIGHT: Record<StatKey, number> = { FED: 3, RIP: 2, LIB: 2, HIT: 2, DIS: 1, CAR: 1 };

/** Da 40 a 99 in proporzione al valore più alto della tua squadra. */
const relative = (v: number, max: number) => Math.round(40 + 59 * (max > 0 ? v / max : 0));

/** Punti fedeltà: in ogni periodo in cui l'artista è titolare prende 11 punti se è il n.1, 1 se è l'11°. */
export function loyalty(m: Model, id: string) {
  return PERIODS.reduce((s, p) => { const r = m.lineups[p].indexOf(id); return s + (r >= 0 ? 11 - r : 0); }, 0);
}

export interface CardStats {
  /** Valore 40–99, oppure null se il dato non è disponibile. */
  st: Record<StatKey, number | null>;
  /** Da dove viene ogni numero, in parole. */
  raw: Record<StatKey, string>;
  ovr: number;
}

/**
 * Statistiche della carta. Le prime quattro sono relative alla tua squadra del periodo:
 * chi ha il valore più alto tra gli 11 titolari prende 99. Discografia e carriera sono assolute.
 */
export function cardStats(m: Model, id: string, period: Period, d: Discography): CardStats {
  const squad = m.lineups[period];
  const max = (f: (x: string) => number) => Math.max(...squad.map(f));
  const plays = (x: string) => m.plays.get(x) ?? 0;
  const saved = (x: string) => m.saved.get(x) ?? 0;
  const hits = (x: string) => m.hits[period].get(x) ?? 0;
  const years = d.debut ? new Date().getFullYear() - d.debut : null;
  const st: Record<StatKey, number | null> = {
    FED: relative(loyalty(m, id), max((x) => loyalty(m, x))),
    RIP: relative(plays(id), max(plays)),
    LIB: relative(saved(id), max(saved)),
    HIT: relative(hits(id), max(hits)),
    DIS: d.releases === null ? null : Math.min(99, 40 + Math.round(d.releases * 1.5)),
    CAR: years === null ? null : Math.min(99, 40 + years * 2),
  };
  const present = PERIODS.filter((p) => m.lineups[p].includes(id)).map((p) => PERIOD_LBL[p]);
  const raw: Record<StatKey, string> = {
    FED: `${loyalty(m, id)} punti: titolare in ${present.join(', ')} (max squadra ${max((x) => loyalty(m, x))})`,
    RIP: `${plays(id)} ascolti negli ultimi 50 brani (max squadra ${max(plays)})`,
    LIB: `${saved(id)} brani salvati (max squadra ${max(saved)})`,
    HIT: `${hits(id)} brani nella top 50 di ${PERIOD_LBL[period]} (max squadra ${max(hits)})`,
    DIS: d.releases === null ? 'dato non disponibile' : `${d.releases} uscite tra album e singoli (99 da 40 in su)`,
    CAR: years === null ? 'dato non disponibile' : `${years} anni dal primo disco, ${d.debut} (99 da 30 anni in su)`,
  };
  let sum = 0, w = 0;
  for (const k of STAT_KEYS) { const v = st[k]; if (v !== null) { sum += v * WEIGHT[k]; w += WEIGHT[k]; } }
  return { st, raw, ovr: Math.round(sum / w) };
}
