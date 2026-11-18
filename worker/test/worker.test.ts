/**
 * Prova del Worker senza Cloudflare né Spotify: fetch finto, cache in memoria.
 * Esegui con: node --experimental-strip-types test/worker.test.ts
 */
import assert from 'node:assert/strict';
import worker, { type Env } from '../src/index.ts';

const ID = 'A'.repeat(22), ID2 = 'B'.repeat(22);
const calls: string[] = [];
const store = new Map<string, Response>();
(globalThis as any).caches = {
  default: {
    match: async (r: Request) => store.get(r.url)?.clone(),
    put: async (r: Request, res: Response) => { store.set(r.url, res.clone()); },
  },
};
const img = (w: number) => ({ url: `https://i.scdn.co/image/${w}`, width: w, height: w });
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  calls.push(url.replace('https://api.spotify.com/v1', ''));
  if (url.includes('/api/token')) {
    assert.match(String((init?.headers as Record<string, string>).Authorization), /^Basic /);
    return Response.json({ access_token: 'tok', expires_in: 3600 });
  }
  if (url.includes('/search')) return Response.json({ artists: { items: [{ id: ID, name: 'Geolier', images: [img(640), img(320), img(160)] }] } });
  if (url.includes(`/artists/${ID}/albums`)) {
    const offset = Number(new URL(url).searchParams.get('offset'));
    return offset === 0
      ? Response.json({ total: 25, items: [{ name: 'Tutto è possibile', release_date: '2025-06-01', album_type: 'album' }] })
      : Response.json({ total: 25, items: [{ name: 'Primo', release_date: '2018-03', album_type: 'single' }] });
  }
  if (url.includes(`/artists/${ID}`)) return Response.json({ id: ID, name: 'Geolier', images: [img(640), img(160)] });
  if (url.includes(`/artists/${ID2}`)) return new Response('{}', { status: 404 });
  if (url.includes('/artists/QQQ')) return Response.json({ reason: 'QUOTA_EXCEEDED' }, { status: 429 });
  throw new Error('URL inatteso ' + url);
}) as typeof fetch;

const env: Env = { SPOTIFY_CLIENT_ID: 'id', SPOTIFY_CLIENT_SECRET: 'secret', ALLOWED_ORIGINS: 'https://sambrosio17.github.io' };
const pending: Promise<unknown>[] = [];
const ctx = { waitUntil: (p: Promise<unknown>) => { pending.push(p); }, passThroughOnException() {} };
const get = async (path: string, origin = 'https://sambrosio17.github.io') => {
  const res = await worker.fetch(new Request('https://api.test' + path, { headers: { Origin: origin } }), env, ctx);
  await Promise.all(pending);
  return { res, body: await res.json().catch(() => null) as any };
};

// Ricerca: campi ridotti, CORS, immagine grande e piccola.
let r = await get('/search?q=Geolier');
assert.equal(r.res.status, 200);
assert.equal(r.res.headers.get('Access-Control-Allow-Origin'), 'https://sambrosio17.github.io');
assert.deepEqual(r.body.artists[0], { id: ID, name: 'Geolier', image: 'https://i.scdn.co/image/640', thumb: 'https://i.scdn.co/image/160' });

// La stessa ricerca (anche con maiuscole e spazi diversi) arriva dalla cache.
const before = calls.length;
r = await get('/search?q=%20geolier%20');
assert.equal(calls.length, before, 'la seconda ricerca non deve chiamare Spotify');

// Dopo la ricerca, l'artista è già in cache: il link della sfida non costa chiamate.
r = await get(`/artists?ids=${ID},${ID2},nonvalido`);
assert.equal(calls.filter((c) => c === `/artists/${ID}`).length, 0);
assert.deepEqual(r.body.artists.map((a: any) => a.id), [ID], 'gli id sconosciuti vengono scartati');

// Dettaglio: discografia con due pagine.
r = await get(`/artist/${ID}`);
assert.equal(r.body.releases, 25);
assert.equal(r.body.debut, 2018);
assert.equal(r.body.latest, 'Tutto è possibile');
assert.ok(calls.some((c) => c.includes('offset=15')), 'la seconda pagina parte da total - 10');

// Errori.
assert.equal((await get('/search?q=a')).res.status, 400);
assert.equal((await get('/artist/corto')).res.status, 404);
assert.equal((await get(`/artist/${ID2}`)).res.status, 404);
assert.equal((await get('/artists?ids=QQQ')).res.status, 400);
// Origine non ammessa: nessun header CORS.
assert.equal((await get('/health', 'https://altro.sito')).res.headers.get('Access-Control-Allow-Origin'), null);
// Un solo token per tutte le chiamate.
assert.equal(calls.filter((c) => c.includes('/api/token')).length, 1);

console.log('Worker: tutte le prove passate (%d chiamate a Spotify simulate)', calls.length);
