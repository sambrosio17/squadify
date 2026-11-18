/**
 * Login Spotify con Authorization Code + PKCE (nessun client secret nel browser).
 * L'Implicit Grant non esiste più (rimosso il 27/11/2025).
 */

const AUTH_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const STORAGE_KEY = 'sportify.token';
const VERIFIER_KEY = 'sportify.pkce_verifier';
const STATE_KEY = 'sportify.pkce_state';

export interface AuthConfig {
  clientId: string;
  /** Deve essere registrato nella Dashboard: HTTPS oppure http://127.0.0.1:PORTA/ (niente localhost). */
  redirectUri: string;
  scopes: string[];
}

export interface StoredToken {
  accessToken: string;
  refreshToken?: string;
  /** Epoch in ms. */
  expiresAt: number;
  scope: string;
}

function randomString(bytes = 64): string {
  const arr = crypto.getRandomValues(new Uint8Array(bytes));
  return base64url(arr);
}

function base64url(buf: Uint8Array): string {
  let s = '';
  for (const b of buf) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function challengeFrom(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

function save(token: StoredToken) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(token));
}

export function loadToken(): StoredToken | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredToken) : null;
  } catch {
    return null;
  }
}

export function logout() {
  localStorage.removeItem(STORAGE_KEY);
}

/** Reindirizza l'utente alla pagina di consenso di Spotify. */
export async function login(cfg: AuthConfig): Promise<never> {
  const verifier = randomString();
  const state = randomString(16);
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: 'code',
    redirect_uri: cfg.redirectUri,
    scope: cfg.scopes.join(' '),
    code_challenge_method: 'S256',
    code_challenge: await challengeFrom(verifier),
    state,
  });
  window.location.assign(`${AUTH_URL}?${params}`);
  return new Promise<never>(() => {});
}

async function requestToken(body: Record<string, string>): Promise<StoredToken> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  if (!res.ok) throw new Error(`Token Spotify: ${res.status} ${await res.text()}`);
  const json = await res.json();
  const prev = loadToken();
  const token: StoredToken = {
    accessToken: json.access_token,
    // Il refresh può non restituire un nuovo refresh_token: in quel caso si tiene il vecchio.
    refreshToken: json.refresh_token ?? prev?.refreshToken,
    expiresAt: Date.now() + (json.expires_in - 60) * 1000,
    scope: json.scope ?? '',
  };
  save(token);
  return token;
}

/**
 * Da chiamare all'avvio dell'app: se l'URL contiene ?code=..., completa il login
 * e ripulisce l'URL. Restituisce il token valido (o null se l'utente non è loggato).
 */
export async function handleRedirect(cfg: AuthConfig): Promise<StoredToken | null> {
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  if (error) {
    history.replaceState(null, '', cfg.redirectUri);
    throw new Error(`Login annullato: ${error}`);
  }
  if (code) {
    const state = url.searchParams.get('state');
    if (state !== sessionStorage.getItem(STATE_KEY)) throw new Error('State OAuth non valido');
    const verifier = sessionStorage.getItem(VERIFIER_KEY) ?? '';
    sessionStorage.removeItem(VERIFIER_KEY);
    sessionStorage.removeItem(STATE_KEY);
    history.replaceState(null, '', cfg.redirectUri);
    return requestToken({
      client_id: cfg.clientId,
      grant_type: 'authorization_code',
      code,
      redirect_uri: cfg.redirectUri,
      code_verifier: verifier,
    });
  }
  return loadToken();
}

let refreshing: Promise<StoredToken> | null = null;

/** Restituisce un access token valido, rinnovandolo se scaduto. */
export async function getAccessToken(clientId: string): Promise<string> {
  const token = loadToken();
  if (!token) throw new Error('Utente non autenticato');
  if (Date.now() < token.expiresAt) return token.accessToken;
  if (!token.refreshToken) throw new Error('Sessione scaduta, rifai il login');
  refreshing ??= requestToken({
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: token.refreshToken,
  }).finally(() => (refreshing = null));
  return (await refreshing).accessToken;
}
