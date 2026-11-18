import { getAccessToken, logout } from './auth';

const API = 'https://api.spotify.com/v1';

export class SpotifyError extends Error {
  constructor(
    public status: number,
    message: string,
    /** Per i 429 di Development Mode vale "QUOTA_EXCEEDED". */
    public reason?: string,
  ) {
    super(message);
  }
}

export type Query = Record<string, string | number | boolean | undefined>;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  query?: Query;
  body?: unknown;
  /** Corpo grezzo (es. JPEG in base64 per le copertine). */
  rawBody?: { data: string; contentType: string };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Il "motorino": una sola funzione per tutte le chiamate.
 * Gestisce token, query string, JSON, 401 (logout), 429 (attesa Retry-After) e 5xx (un nuovo tentativo).
 */
export function createClient(clientId: string) {
  async function request<T>(path: string, opts: RequestOptions = {}, attempt = 0): Promise<T> {
    const url = new URL(path.startsWith('http') ? path : API + path);
    for (const [k, v] of Object.entries(opts.query ?? {})) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
    const headers: Record<string, string> = {
      Authorization: `Bearer ${await getAccessToken(clientId)}`,
    };
    let body: BodyInit | undefined;
    if (opts.rawBody) {
      headers['Content-Type'] = opts.rawBody.contentType;
      body = opts.rawBody.data;
    } else if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(opts.body);
    }

    const res = await fetch(url, { method: opts.method ?? 'GET', headers, body });

    if (res.status === 429 && attempt < 3) {
      const json = await res.clone().json().catch(() => null);
      if (json?.reason === 'QUOTA_EXCEEDED') {
        throw new SpotifyError(429, 'Quota di Development Mode esaurita', 'QUOTA_EXCEEDED');
      }
      const wait = Number(res.headers.get('Retry-After') ?? '1');
      await sleep(Math.min(wait, 30) * 1000);
      return request<T>(path, opts, attempt + 1);
    }
    if (res.status >= 500 && attempt < 1) {
      await sleep(800);
      return request<T>(path, opts, attempt + 1);
    }
    if (res.status === 401) logout();
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      throw new SpotifyError(res.status, json?.error?.message ?? res.statusText, json?.reason);
    }
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  /** Scorre tutte le pagine di un endpoint con paginazione a offset (campo `next`). */
  async function paginate<T>(path: string, query: Query = {}, max = Infinity): Promise<T[]> {
    const out: T[] = [];
    let page = await request<{ items: T[]; next: string | null }>(path, { query });
    out.push(...page.items);
    while (page.next && out.length < max) {
      page = await request(page.next);
      out.push(...page.items);
    }
    return out.slice(0, max);
  }

  return { request, paginate };
}

export type SpotifyClient = ReturnType<typeof createClient>;
