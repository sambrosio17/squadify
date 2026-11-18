/**
 * Catalogo pubblico di Spotify senza login: passa dal Worker "squadify-api" (cartella worker/),
 * che tiene il client secret e mette in cache le risposte.
 */

export interface CatalogArtist { id: string; name: string; image?: string; thumb?: string }
export interface CatalogDetail extends CatalogArtist {
  releases: number | null;
  debut: number | null;
  latest: string | null;
}

export interface Catalog {
  /** true quando i dati sono finti (manca l'indirizzo del Worker). */
  demo: boolean;
  search(q: string): Promise<CatalogArtist[]>;
  artists(ids: string[]): Promise<CatalogArtist[]>;
  detail(id: string): Promise<CatalogDetail>;
}

export class CatalogError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

export function createCatalog(baseUrl: string): Catalog {
  const base = baseUrl.replace(/\/+$/, '');
  const memo = new Map<string, Promise<unknown>>();
  async function get<T>(path: string): Promise<T> {
    if (!memo.has(path)) {
      memo.set(path, (async () => {
        const res = await fetch(base + path).catch(() => {
          throw new CatalogError(0, 'Non riesco a raggiungere il catalogo di Spotify: controlla la connessione e riprova.');
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          const msg = json?.error === 'QUOTA_EXCEEDED' || json?.error === 'RATE_LIMITED'
            ? 'Troppe richieste a Spotify in questo momento: riprova tra poco.'
            : json?.error ?? res.statusText;
          throw new CatalogError(res.status, msg);
        }
        return json;
      })().catch((e) => { memo.delete(path); throw e; }));
    }
    return memo.get(path) as Promise<T>;
  }
  return {
    demo: false,
    search: (q) => get<{ artists: CatalogArtist[] }>(`/search?q=${encodeURIComponent(q.trim().toLowerCase())}`).then((r) => r.artists),
    artists: (ids) => ids.length ? get<{ artists: CatalogArtist[] }>(`/artists?ids=${ids.join(',')}`).then((r) => r.artists) : Promise.resolve([]),
    detail: (id) => get<CatalogDetail>(`/artist/${id}`),
  };
}
