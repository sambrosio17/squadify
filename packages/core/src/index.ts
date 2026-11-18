import { handleRedirect, login, logout, type AuthConfig } from './auth';
import { createClient } from './client';
import { endpoints } from './endpoints';

export * from './auth';
export * from './client';
export * from './endpoints';
export * from './types';
export * from './utils';

export interface SpotifyAppConfig {
  /** Di default legge VITE_SPOTIFY_CLIENT_ID dal file .env nella root del repository. */
  clientId?: string;
  /** Di default l'indirizzo della pagina corrente, senza query. */
  redirectUri?: string;
  scopes: string[];
}

/**
 * Punto di ingresso unico per ogni app:
 *   const spotify = await createSpotify({ scopes: ['user-top-read'] });
 *   if (!spotify.loggedIn) loginButton.onclick = spotify.login;
 *   else const artists = await spotify.api.topArtists('short_term');
 */
export async function createSpotify(cfg: SpotifyAppConfig) {
  const clientId = cfg.clientId ?? import.meta.env.VITE_SPOTIFY_CLIENT_ID;
  if (!clientId) throw new Error('Manca VITE_SPOTIFY_CLIENT_ID: copia .env.example in .env');
  const auth: AuthConfig = {
    clientId,
    redirectUri: cfg.redirectUri ?? window.location.origin + window.location.pathname,
    scopes: cfg.scopes,
  };
  const token = await handleRedirect(auth);
  const client = createClient(clientId);
  return {
    loggedIn: token !== null,
    login: () => login(auth),
    logout: () => { logout(); window.location.reload(); },
    client,
    api: endpoints(client),
  };
}

export type Spotify = Awaited<ReturnType<typeof createSpotify>>;
