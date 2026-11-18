import type { Catalog, CatalogArtist } from '@sportify/core';
import { POOL } from './themes';

/**
 * Catalogo di prova, usato quando manca VITE_SQUADIFY_API (il Worker non è ancora online).
 * Solo nomi: niente foto né discografia, così nessun dato sembra vero quando non lo è.
 */
const EXTRA = ['Ultimo', 'Cesare Cremonini', 'Jovanotti', 'Tiziano Ferro', 'Gianna Nannini', 'Mina', 'Adriano Celentano', 'Caparezza', 'Club Dogo', 'Articolo 31', 'Neffa', 'J-Ax', 'Gemitaiz', 'Madame', 'Rose Villain', 'Ghali', 'Tony Effe', 'Anna Tatangelo', 'Calcutta', 'Coez', 'Frah Quintale', 'Gazzelle', 'Thasup', 'Kid Yugi', 'Simba La Rue', 'Baby Gang', 'Rondo', 'Paky', 'Capo Plaza', 'Mace', 'Dardust', 'Elisa', 'Giorgia', 'Emma', 'Arisa', 'Diodato', 'Brunori Sas', 'Colapesce', 'Dimartino', 'Subsonica', 'Afterhours', 'Negramaro', 'Modà', 'The Kolors', 'Il Volo', 'Andrea Bocelli', 'Eros Ramazzotti', 'Zucchero', 'Pooh', 'Daft Punk', 'Eminem', 'Kanye West', 'Travis Scott', 'SZA', 'Ariana Grande', 'Olivia Rodrigo', 'Rosalía', 'Karol G', 'Shakira', 'Stromae', 'Arctic Monkeys', 'Radiohead', 'Queen', 'The Beatles', 'Michael Jackson'];

const slug = (s: string) => 'demo-' + s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const ALL: CatalogArtist[] = [...new Set([...POOL, ...EXTRA])].map((name) => ({ id: slug(name), name }));
const BY_ID = new Map(ALL.map((a) => [a.id, a]));
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const wait = <T>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 120));

export function demoCatalog(): Catalog {
  return {
    demo: true,
    search: (q) => {
      const n = norm(q.trim());
      const starts = ALL.filter((a) => norm(a.name).startsWith(n));
      const has = ALL.filter((a) => !starts.includes(a) && norm(a.name).includes(n));
      return wait([...starts, ...has].slice(0, 10));
    },
    artists: (ids) => wait(ids.map((id) => BY_ID.get(id)).filter((a): a is CatalogArtist => !!a)),
    detail: (id) => {
      const a = BY_ID.get(id);
      return a ? wait({ ...a, releases: null, debut: null, latest: null }) : Promise.reject(new Error('Artista non trovato'));
    },
  };
}
