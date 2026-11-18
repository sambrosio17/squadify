/**
 * Squadify API: un piccolo proxy davanti al catalogo pubblico di Spotify.
 *
 * - Tiene il client secret (Client Credentials) lontano dal browser.
 * - Restituisce solo i campi che servono all'app (nome, foto, discografia).
 * - Mette in cache le risposte all'edge di Cloudflare: in Development Mode le quote sono
 *   per account sviluppatore, quindi ogni chiamata risparmiata conta.
 *
 * Rotte (solo GET):
 *   /search?q=geolier     → { artists: Artist[] }        fino a 10 artisti
 *   /artists?ids=a,b,c    → { artists: Artist[] }        fino a 15 id (link "sfida un amico")
 *   /artist/{id}          → ArtistDetail                 artista + discografia (per la carta)
 */

export interface Env {
  SPOTIFY_CLIENT_ID: string;
  /** Impostalo con `npx wrangler secret put SPOTIFY_CLIENT_SECRET`. */
  SPOTIFY_CLIENT_SECRET: string;
  /** Origini ammesse separate da virgola, es. "https://sambrosio17.github.io,http://127.0.0.1:5172". */
  ALLOWED_ORIGINS?: string;
}

interface SpImage { url: string; width: number | null; height: number | null }
interface SpArtist { id: string; name: string; images?: SpImage[] }
interface SpAlbum { name: string; release_date: string; album_type: string }

export interface Artist { id: string; name: string; image?: string; thumb?: string }
export interface ArtistDetail extends Artist {
  /** Uscite tra album e singoli (campo `total`). */
  releases: number | null;
  /** Anno della prima uscita. */
  debut: number | null;
  /** Titolo dell'uscita più recente. */
  latest: string | null;
}

const API = 'https://api.spotify.com/v1';
const ID = /^[0-9A-Za-z]{22}$/;
const DAY = 86400;
/** Quanto restano in cache le risposte, in secondi. */
const TTL = { search: DAY, artist: 7 * DAY, detail: 3 * DAY } as const;

class HttpError extends Error {
  status: number;
  retryAfter?: string;
  constructor(status: number, message: string, retryAfter?: string) { super(message); this.status = status; this.retryAfter = retryAfter; }
}

/** La cache dell'edge (`caches.default` esiste solo su Cloudflare). */
const edgeCache = () => (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;

// ---------- Token Client Credentials (vale un'ora, si tiene in memoria finché l'isolate è vivo) ----------
let token: { value: string; exp: number } | null = null;

async function getToken(env: Env): Promise<string> {
  if (token && token.exp > Date.now() + 60_000) return token.value;
  if (!env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET) throw new HttpError(500, 'Worker non configurato: mancano SPOTIFY_CLIENT_ID o SPOTIFY_CLIENT_SECRET');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new HttpError(502, `Token Spotify rifiutato (${res.status})`);
  const json = await res.json() as { access_token: string; expires_in: number };
  token = { value: json.access_token, exp: Date.now() + json.expires_in * 1000 };
  return token.value;
}

async function spotify<T>(env: Env, path: string, retry = true): Promise<T> {
  const res = await fetch(API + path, { headers: { Authorization: `Bearer ${await getToken(env)}` } });
  if (res.status === 401 && retry) { token = null; return spotify<T>(env, path, false); }
  if (res.status === 429) {
    const body = await res.json().catch(() => null) as { reason?: string } | null;
    throw new HttpError(429, body?.reason === 'QUOTA_EXCEEDED' ? 'QUOTA_EXCEEDED' : 'RATE_LIMITED', res.headers.get('Retry-After') ?? '30');
  }
  if (res.status === 404 || res.status === 400) throw new HttpError(404, 'Non trovato');
  if (!res.ok) throw new HttpError(502, `Spotify ha risposto ${res.status}`);
  return res.json() as Promise<T>;
}

// ---------- Forma delle risposte ----------
/** La più piccola immagine larga almeno `min` px (Spotify le manda dalla più grande). */
function pick(images: SpImage[] | undefined, min: number) {
  if (!images?.length) return undefined;
  return (images.filter((i) => (i.width ?? 0) >= min).at(-1) ?? images[0]).url;
}
const slim = (a: SpArtist): Artist => ({ id: a.id, name: a.name, image: pick(a.images, 600), thumb: pick(a.images, 160) });

// ---------- Cache all'edge ----------
async function cached<T>(key: string, ttl: number, ctx: ExecutionContext, load: () => Promise<T>): Promise<T> {
  const cache = edgeCache();
  const req = new Request(`https://cache.squadify/${key}`);
  const hit = await cache?.match(req);
  if (hit) return hit.json() as Promise<T>;
  const value = await load();
  const res = new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${ttl}` } });
  if (cache) ctx.waitUntil(cache.put(req, res));
  return value;
}

const artist = (env: Env, ctx: ExecutionContext, id: string) =>
  cached(`artist/${id}`, TTL.artist, ctx, async () => slim(await spotify<SpArtist>(env, `/artists/${id}`)));

async function search(env: Env, ctx: ExecutionContext, q: string) {
  const norm = q.trim().replace(/\s+/g, ' ').toLowerCase();
  if (norm.length < 2 || norm.length > 60) throw new HttpError(400, 'La ricerca va da 2 a 60 caratteri');
  return cached(`search/${encodeURIComponent(norm)}`, TTL.search, ctx, async () => {
    const r = await spotify<{ artists: { items: SpArtist[] } }>(env, `/search?type=artist&limit=10&q=${encodeURIComponent(norm)}`);
    const artists = r.artists.items.map(slim);
    // Ogni artista trovato finisce anche nella cache dei singoli: il link della sfida poi costa zero.
    const cache = edgeCache();
    if (cache) for (const a of artists) {
      ctx.waitUntil(cache.put(new Request(`https://cache.squadify/artist/${a.id}`),
        new Response(JSON.stringify(a), { headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${TTL.artist}` } })));
    }
    return { artists };
  });
}

/**
 * Discografia con due chiamate da 10: la prima dà il totale e le uscite più recenti,
 * la seconda l'ultima pagina, dove stanno le più vecchie (l'ordine è dalla più recente).
 */
function detail(env: Env, ctx: ExecutionContext, id: string) {
  return cached(`detail/${id}`, TTL.detail, ctx, async (): Promise<ArtistDetail> => {
    const page = (offset: number) => spotify<{ items: SpAlbum[]; total: number }>(env, `/artists/${id}/albums?include_groups=album,single&limit=10&offset=${offset}`);
    const [a, first] = await Promise.all([artist(env, ctx, id), page(0)]);
    const last = first.total > 10 ? await page(first.total - 10) : first;
    const years = [...first.items, ...last.items].map((x) => Number(x.release_date.slice(0, 4))).filter((y) => y > 1900);
    return { ...a, releases: first.total, debut: years.length ? Math.min(...years) : null, latest: first.items[0]?.name ?? null };
  });
}

// ---------- Router ----------
function cors(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const allowed = (env.ALLOWED_ORIGINS ?? '*').split(',').map((s) => s.trim());
  const ok = allowed.includes('*') ? '*' : allowed.includes(origin) ? origin : '';
  return ok ? { 'Access-Control-Allow-Origin': ok, 'Access-Control-Allow-Methods': 'GET, OPTIONS', Vary: 'Origin' } : {};
}

async function route(url: URL, env: Env, ctx: ExecutionContext): Promise<unknown> {
  const p = url.pathname.replace(/\/+$/, '');
  if (p === '/search') return search(env, ctx, url.searchParams.get('q') ?? '');
  if (p === '/artists') {
    const ids = [...new Set((url.searchParams.get('ids') ?? '').split(',').filter((x) => ID.test(x)))].slice(0, 15);
    if (!ids.length) throw new HttpError(400, 'Nessun id valido');
    const found = await Promise.all(ids.map((id) => artist(env, ctx, id).catch(() => null)));
    return { artists: found.filter(Boolean) };
  }
  const m = p.match(/^\/artist\/([0-9A-Za-z]{22})$/);
  if (m) return detail(env, ctx, m[1]);
  if (p === '' || p === '/health') return { ok: true, service: 'squadify-api' };
  throw new HttpError(404, 'Rotta sconosciuta');
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const headers = cors(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...headers, 'Access-Control-Max-Age': '86400' } });
    if (req.method !== 'GET') return new Response('Solo GET', { status: 405, headers });
    try {
      const body = await route(new URL(req.url), env, ctx);
      // Anche il browser può tenere le risposte per un'ora.
      return Response.json(body, { headers: { ...headers, 'Cache-Control': 'public, max-age=3600' } });
    } catch (e) {
      const err = e instanceof HttpError ? e : new HttpError(500, (e as Error).message);
      if (err.status >= 500) console.error(err);
      return Response.json({ error: err.message }, {
        status: err.status,
        headers: { ...headers, ...(err.retryAfter ? { 'Retry-After': err.retryAfter } : {}) },
      });
    }
  },
};
