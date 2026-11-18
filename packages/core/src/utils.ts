import type { Album, Image } from './types';

/** Anno di uscita di un album come numero. */
export const releaseYear = (album: Album) => Number(album.release_date.slice(0, 4));

/** Immagine più piccola che sia almeno `min` px (le immagini arrivano dalla più grande alla più piccola). */
export function pickImage(images: Image[] | null | undefined, min = 160): string | undefined {
  if (!images?.length) return undefined;
  const ok = images.filter((i) => (i.width ?? 0) >= min);
  return (ok.at(-1) ?? images[0]).url;
}

/** Conta le occorrenze per chiave, ordinate dalla più frequente. */
export function countBy<T>(items: T[], key: (t: T) => string): [string, number][] {
  const m = new Map<string, number>();
  for (const it of items) m.set(key(it), (m.get(key(it)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

/** Escape per inserire testo (nomi di brani e artisti) in innerHTML. */
export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
