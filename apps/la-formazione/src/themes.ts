import type { Catalog, CatalogArtist } from '@sportify/core';

/**
 * Squadre a tema: 11 nomi in ordine di posizione (prima l'attacco, ultimo il portiere).
 * Ogni nome si cerca nel catalogo di Spotify; se non c'è una corrispondenza esatta si prende il primo risultato.
 */
export const THEMES: { id: string; label: string; names: string[] }[] = [
  { id: 'rap', label: 'Rap italiano', names: ['Sfera Ebbasta', 'Lazza', 'Geolier', 'Marracash', 'Guè', 'Tedua', 'Salmo', 'Ernia', 'Anna', 'Shiva', 'Fabri Fibra'] },
  { id: 'napoli', label: 'Napoli', names: ['Geolier', 'Liberato', 'Luchè', 'Pino Daniele', 'Nino D\'Angelo', 'Clementino', 'Rocco Hunt', 'Co\'Sang', 'Enzo Avitabile', 'Gigi D\'Alessio', 'Massimo Ranieri'] },
  { id: 'cantautori', label: 'Cantautori', names: ['Lucio Dalla', 'Fabrizio De André', 'Lucio Battisti', 'Francesco De Gregori', 'Franco Battiato', 'Rino Gaetano', 'Paolo Conte', 'Francesco Guccini', 'Vasco Rossi', 'Luciano Ligabue', 'Gino Paoli'] },
  { id: 'sanremo', label: 'Pop da Sanremo', names: ['Mahmood', 'Elodie', 'Annalisa', 'Marco Mengoni', 'Angelina Mango', 'Måneskin', 'Tananai', 'Blanco', 'Olly', 'Achille Lauro', 'Laura Pausini'] },
  { id: 'mondo', label: 'Stelle mondiali', names: ['Bad Bunny', 'Taylor Swift', 'The Weeknd', 'Kendrick Lamar', 'Billie Eilish', 'Dua Lipa', 'Drake', 'Rihanna', 'Beyoncé', 'Ed Sheeran', 'Coldplay'] },
];

/** Tutti i nomi delle squadre a tema, senza doppioni: il "mercato" del draft casuale. */
export const POOL = [...new Set(THEMES.flatMap((t) => t.names))];

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Trova un artista per nome: corrispondenza esatta se c'è, altrimenti il primo risultato. */
export async function findArtist(catalog: Catalog, name: string): Promise<CatalogArtist | null> {
  const res = await catalog.search(name);
  return res.find((a) => norm(a.name) === norm(name)) ?? res[0] ?? null;
}

export function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
