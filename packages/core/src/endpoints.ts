import type { SpotifyClient } from './client';
import type {
  Album, Artist, PlayHistory, Playlist, SavedAlbum, SavedTrack, TimeRange, Track, User,
} from './types';

/**
 * Solo endpoint disponibili in Development Mode.
 * Riferimento: spotify-api/riferimento-endpoint-spotify-web-api.md nella cartella del progetto.
 */
export function endpoints(c: SpotifyClient) {
  return {
    /** GET /me */
    me: () => c.request<User>('/me'),

    /** GET /me/top/artists (max 50 per periodo) */
    topArtists: (time_range: TimeRange = 'medium_term', limit = 50) =>
      c.request<{ items: Artist[] }>('/me/top/artists', { query: { time_range, limit } }).then((r) => r.items),

    /** GET /me/top/tracks (max 50 per periodo) */
    topTracks: (time_range: TimeRange = 'medium_term', limit = 50) =>
      c.request<{ items: Track[] }>('/me/top/tracks', { query: { time_range, limit } }).then((r) => r.items),

    /** GET /me/player/recently-played: solo gli ultimi 50 brani. `after` in ms per gli ascolti successivi a una data. */
    recentlyPlayed: (opts: { after?: number; before?: number } = {}) =>
      c.request<{ items: PlayHistory[] }>('/me/player/recently-played', { query: { limit: 50, ...opts } })
        .then((r) => r.items),

    /** GET /me/tracks, tutte le pagine (o fino a `max`) */
    savedTracks: (max = 500) => c.paginate<SavedTrack>('/me/tracks', { limit: 50 }, max),

    /** GET /me/albums */
    savedAlbums: (max = 200) => c.paginate<SavedAlbum>('/me/albums', { limit: 50 }, max),

    /** GET /me/following?type=artist (paginazione a cursore) */
    followedArtists: async (max = 200) => {
      const out: Artist[] = [];
      let after: string | undefined;
      do {
        const r = await c.request<{ artists: { items: Artist[]; cursors: { after: string | null } } }>(
          '/me/following', { query: { type: 'artist', limit: 50, after } });
        out.push(...r.artists.items);
        after = r.artists.cursors.after ?? undefined;
      } while (after && out.length < max);
      return out.slice(0, max);
    },

    /** GET /artists/{id}: una chiamata per artista (i "Get Several" non ci sono più) */
    artist: (id: string) => c.request<Artist>(`/artists/${id}`),

    /** GET /artists/{id}/albums: discografia (album e singoli di default), tutte le pagine fino a `max` */
    artistAlbums: (id: string, include_groups = 'album,single', max = 200) =>
      c.paginate<Album>(`/artists/${id}/albums`, { include_groups, limit: 50 }, max),

    /** GET /artists/{id}/albums, una pagina: `total` dice quante uscite ha l'artista in tutto */
    artistAlbumsPage: (id: string, offset = 0, limit = 10, include_groups = 'album,single') =>
      c.request<{ items: Album[]; total: number }>(`/artists/${id}/albums`, { query: { include_groups, limit, offset } }),

    /** GET /search: limit massimo 10 */
    searchTracks: (q: string, limit = 10, offset = 0) =>
      c.request<{ tracks: { items: Track[] } }>('/search', { query: { q, type: 'track', limit: Math.min(limit, 10), offset } })
        .then((r) => r.tracks.items),

    /** POST /me/playlists + POST /playlists/{id}/items (a blocchi da 100) */
    createPlaylist: async (name: string, uris: string[], opts: { description?: string; public?: boolean } = {}) => {
      const pl = await c.request<Playlist>('/me/playlists', {
        method: 'POST',
        body: { name, description: opts.description ?? '', public: opts.public ?? false },
      });
      for (let i = 0; i < uris.length; i += 100) {
        await c.request(`/playlists/${pl.id}/items`, { method: 'POST', body: { uris: uris.slice(i, i + 100) } });
      }
      return pl;
    },

    /** PUT /playlists/{id}/images: JPEG in base64 (senza prefisso data:), max 256 KB. Scope ugc-image-upload. */
    uploadPlaylistCover: (playlistId: string, jpegBase64: string) =>
      c.request<void>(`/playlists/${playlistId}/images`, {
        method: 'PUT', rawBody: { data: jpegBase64, contentType: 'image/jpeg' },
      }),

    /** PUT /me/library: salva brani/album o segue artisti tramite URI (max 40) */
    saveToLibrary: (uris: string[]) =>
      c.request<void>('/me/library', { method: 'PUT', query: { uris: uris.slice(0, 40).join(',') } }),
  };
}

export type Endpoints = ReturnType<typeof endpoints>;
