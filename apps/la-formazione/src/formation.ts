export type Modulo = '433' | '442' | '352';
export const MODULI_LIST: Modulo[] = ['433', '442', '352'];
export const MODULO_LBL: Record<Modulo, string> = { '433': '4-3-3', '442': '4-4-2', '352': '3-5-2' };

/**
 * Posizioni in % del campo, in ordine: attacco (il primo è il centravanti), centrocampo, difesa, portiere.
 * `shirt` è il numero di maglia classico di ogni posizione (nella squadra fatta a mano).
 */
export const MODULI: Record<Modulo, { roles: number[]; pos: [number, number][]; shirt: number[] }> = {
  '433': { roles: [3, 3, 4, 1], pos: [[50, 17], [20, 24], [80, 24], [50, 46], [24, 51], [76, 51], [38, 75], [62, 75], [13, 71], [87, 71], [50, 88]], shirt: [9, 11, 7, 10, 8, 4, 5, 6, 3, 2, 1] },
  '442': { roles: [2, 4, 4, 1], pos: [[38, 19], [62, 19], [37, 48], [63, 48], [11, 45], [89, 45], [38, 75], [62, 75], [13, 71], [87, 71], [50, 88]], shirt: [9, 10, 8, 4, 11, 7, 5, 6, 3, 2, 1] },
  '352': { roles: [2, 5, 3, 1], pos: [[38, 19], [62, 19], [50, 40], [30, 52], [70, 52], [9, 46], [91, 46], [26, 75], [50, 77], [74, 75], [50, 88]], shirt: [9, 10, 8, 4, 6, 11, 7, 3, 5, 2, 1] },
};
export const ROLE_NAMES = ['Attaccante', 'Centrocampista', 'Difensore', 'Portiere'];
export const ROLE_SHORT = ['ATT', 'CEN', 'DIF', 'POR'];
export const LINE_NAMES = ['Attacco', 'Centrocampo', 'Difesa', 'Porta'];

/** Reparto (0 attacco … 3 porta) della posizione `i` nel modulo. */
export function roleOf(modulo: Modulo, i: number) {
  const r = MODULI[modulo].roles; let acc = 0;
  for (let k = 0; k < r.length; k++) { acc += r[k]; if (i < acc) return k; }
  return 3;
}

// Colori e iniziali stabili per chi non ha foto.
export function hue(s: string) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }
export const grad = (s: string) => `linear-gradient(140deg, hsl(${hue(s)} 70% 55%), hsl(${(hue(s) + 50) % 360} 65% 30%))`;
export const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
