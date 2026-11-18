/**
 * Tipi ridotti ai campi che arrivano ancora in Development Mode (novembre 2026).
 * Niente popularity, followers, genres, preview_url: sono stati rimossi.
 */

export interface Image { url: string; width: number | null; height: number | null }

export interface SimplifiedArtist { id: string; name: string; uri: string }

export interface Artist extends SimplifiedArtist { images: Image[] }

export interface Album {
  id: string;
  name: string;
  uri: string;
  images: Image[];
  /** "1985", "1985-06" oppure "1985-06-14" a seconda di release_date_precision. */
  release_date: string;
  release_date_precision: 'year' | 'month' | 'day';
  album_type: 'album' | 'single' | 'compilation';
  artists: SimplifiedArtist[];
}

export interface Track {
  id: string;
  name: string;
  uri: string;
  duration_ms: number;
  explicit: boolean;
  album: Album;
  artists: SimplifiedArtist[];
  external_ids?: { isrc?: string };
}

export interface User {
  id: string;
  display_name: string | null;
  images: Image[];
  uri: string;
  account_id?: string;
}

export interface PlayHistory { track: Track; played_at: string }

export interface SavedTrack { track: Track; added_at: string }

export interface SavedAlbum { album: Album; added_at: string }

export interface Playlist {
  id: string;
  name: string;
  uri: string;
  description: string | null;
  images: Image[] | null;
  external_urls: { spotify: string };
}

export type TimeRange = 'short_term' | 'medium_term' | 'long_term';

export const TIME_RANGES: TimeRange[] = ['short_term', 'medium_term', 'long_term'];
