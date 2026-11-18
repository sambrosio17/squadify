import { esc, type Endpoints } from '@sportify/core';
import { cardStats, discography, PERIOD_FULL, PERIOD_LBL, PERIODS, type Model, type Period, type Player } from './data';

/** Una schermata del tabellone sotto il campo. `sub` fa partire l'animazione del cambio. */
export interface BoardSlide { html: string; sub?: { in: string; out?: string } }

export interface CardData {
  /** Statistiche nell'ordine in cui compaiono sulla carta: valore 40–99 o null se manca il dato. */
  st: Record<string, number | null>;
  /** Da dove viene ogni numero, in parole. */
  raw: Record<string, string>;
  ovr: number;
  /** Righe sotto le statistiche: [etichetta, valore già in HTML sicuro]. */
  gen: [string, string][];
  /** Dopo il livello (oro, argento, bronzo): es. "4 settimane". */
  tierNote: string;
  /** Sotto la didascalia: es. "Ascolti: ultime 4 settimane". */
  captionNote: string;
}

/**
 * Da dove arriva la squadra: dagli ascolti dell'utente (login Spotify) o dalle scelte del mister (a mano).
 * Il motore della partita (engine.ts) legge solo da qui.
 */
export interface Squad {
  players: Map<string, Player>;
  /** Mostra la scelta del periodo (solo con gli ascolti). */
  periods: boolean;
  /** Gli 11 titolari in ordine di posizione (vedi MODULI). */
  lineup(p: Period): string[];
  captain(p: Period): string;
  shirt(id: string, p: Period): number;
  /** Etichetta in alto a destra nella partita. */
  chip(p: Period): string;
  board(p: Period): { title: string; slides: BoardSlide[]; empty: string };
  /** Righe in più nella scheda giocatore (HTML). */
  scheda(id: string, p: Period): string;
  card(id: string, p: Period): Promise<CardData>;
  /** Spiegazione dei numeri della carta, sotto l'elenco. */
  howNote: string;
  /** Nome della squadra avversaria nello scorebug. */
  opponent: string;
  /** Nota in fondo alla regia. */
  note: string;
}

const NEXT: Record<Period, Period | null> = { short: 'medium', medium: 'long', long: null };

/** La squadra dagli ascolti: il comportamento originale di La Formazione. */
export function spotifySquad(m: Model, api: Endpoints): Squad {
  const name = (id: string) => m.players.get(id)?.name ?? '—';
  return {
    players: m.players,
    periods: true,
    lineup: (p) => m.lineups[p],
    captain: (p) => m.lineups[p][0],
    shirt: (id, p) => m.lineups[p].indexOf(id) + 1,
    chip: (p) => PERIOD_FULL[p],
    board(p) {
      const next = NEXT[p];
      const empty = p === 'long' ? `NESSUN CAMBIO<br>SQUADRA DELL'ANNO` : `STESSA SQUADRA<br>DEL PERIODO PRIMA`;
      if (!next) return { title: 'Formazione storica', slides: [], empty };
      const now = m.lineups[p], before = m.lineups[next];
      const out = before.filter((id) => !now.includes(id));
      const inn = now.filter((id) => !before.includes(id));
      const slides = inn.map((id, i) => {
        const o = out[i] as string | undefined;
        return {
          sub: { in: id, out: o },
          html: `<div class="sub flip-in">
            <div class="side out"><span class="arrow">▼</span><span class="n">${String(o ? before.indexOf(o) + 1 : '–').padStart(2, '0')}</span><span class="who"><span>Esce</span><b>${o ? esc(name(o)) : '—'}</b></span></div>
            <div class="side in"><span class="arrow">▲</span><span class="n">${String(now.indexOf(id) + 1).padStart(2, '0')}</span><span class="who"><span>Entra</span><b>${esc(name(id))}</b></span></div>
          </div>`,
        };
      });
      return { title: `Sostituzioni · vs ${PERIOD_LBL[next]}`, slides, empty };
    },
    scheda(id, p) {
      const inP = PERIODS.map((x) => `<span class="${m.lineups[x].includes(id) ? 'yes' : ''}">${PERIOD_LBL[x]}${m.lineups[x].includes(id) ? ' ✓' : ''}</span>`).join('');
      return `<div class="periods">${inP}</div><div class="meta">In campo per i tuoi ascolti delle ultime ${PERIOD_LBL[p]}.</div>`;
    },
    async card(id, p) {
      const disc = await discography(api, id);
      const { st, raw, ovr } = cardStats(m, id, p, disc);
      const present = PERIODS.filter((x) => m.lineups[x].includes(id)).length;
      const song = m.song.get(id);
      return {
        st, raw, ovr,
        gen: [
          ['Esordio', String(disc.debut ?? '—')],
          ['Brano simbolo', song ? `«${esc(song)}»` : '—'],
          ['In squadra', `${present} ${present === 1 ? 'periodo' : 'periodi'} su 3`],
        ],
        tierNote: PERIOD_LBL[p],
        captionNote: `Ascolti: ${PERIOD_FULL[p].toLowerCase()}`,
      };
    },
    howNote: `FED, RIP, LIB e HIT sono relativi alla tua squadra del periodo: il titolare con il valore più alto prende 99, chi ha zero prende 40.
      DIS e CAR vengono dalla discografia (<code>/artists/{id}/albums</code>); se Spotify non la fornisce compare un trattino e non contano nella valutazione.`,
    opponent: 'Noia',
    note: 'Tocca un giocatore per la sua scheda. Il numero di maglia è la posizione nella classifica degli artisti più ascoltati del periodo. Il capitano (C) è il numero 1 e segna sempre lui.',
  };
}
