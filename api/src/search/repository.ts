import { createClient } from '@supabase/supabase-js';
import type { ConditionGrade } from '../sightings/repository.js';

export interface SearchHit {
  sightingId: string;
  priceUsd: number;
  conditionGrade: ConditionGrade;
  specialAttributes: string | null;
  storeVerified: boolean;
  sightingTimestamp: string;
  record: {
    recordId: string;
    artistName: string;
    albumTitle: string;
    genre: string | null;
    coverArtUrl: string | null;
  };
  store: {
    storeId: string;
    businessName: string;
    geoLat: number;
    geoLng: number;
    isVerified: boolean;
  };
  distanceMiles: number;
}

export interface SearchQuery {
  q: string;
  genre: string | null;
  lat: number;
  lng: number;
  radiusMiles: number;
}

export interface SearchRepository {
  /** Active sightings in the radius matching every term of `q`, nearest then newest. */
  search(query: SearchQuery): Promise<SearchHit[]>;
  /** Genres among the keyword matches, ignoring the genre filter. */
  genres(query: SearchQuery): Promise<string[]>;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const toHit = (r: any): SearchHit => ({
  sightingId: r.sighting_id,
  priceUsd: Number(r.price_usd),
  conditionGrade: r.condition_grade,
  specialAttributes: r.special_attributes,
  storeVerified: r.store_verified,
  sightingTimestamp: r.sighting_timestamp,
  record: {
    recordId: r.record_id,
    artistName: r.artist_name,
    albumTitle: r.album_title,
    genre: r.genre,
    coverArtUrl: r.cover_art_url,
  },
  store: {
    storeId: r.store_id,
    businessName: r.business_name,
    geoLat: Number(r.geo_lat),
    geoLng: Number(r.geo_lng),
    isVerified: r.store_is_verified,
  },
  distanceMiles: Number(r.distance_mi),
});

const params = (q: SearchQuery) => ({
  p_q: q.q,
  p_lat: q.lat,
  p_lng: q.lng,
  p_radius_mi: q.radiusMiles,
});

export function supabaseSearch(url: string, serviceRoleKey: string): SearchRepository {
  const db = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  return {
    async search(q) {
      const { data, error } = await db.rpc('search_sightings', { ...params(q), p_genre: q.genre });
      if (error) throw error;
      return (data as any[]).map(toHit);
    },
    async genres(q) {
      const { data, error } = await db.rpc('search_genres', params(q));
      if (error) throw error;
      return data as string[];
    },
  };
}
