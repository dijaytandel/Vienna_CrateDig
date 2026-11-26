import { createClient } from '@supabase/supabase-js';
import type { ConditionGrade } from '../sightings/repository.js';
import type { Box } from '../stores/repository.js';

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
}

export interface SearchRepository {
  /** Active sightings in the box whose record matches every term of `q`, newest first. */
  search(q: string, box: Box): Promise<SearchHit[]>;
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
});

export function supabaseSearch(url: string, serviceRoleKey: string): SearchRepository {
  const db = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  return {
    async search(q, box) {
      const { data, error } = await db.rpc('search_sightings', {
        p_q: q,
        p_min_lat: box.minLat,
        p_max_lat: box.maxLat,
        p_min_lng: box.minLng,
        p_max_lng: box.maxLng,
      });
      if (error) throw error;
      return (data as any[]).map(toHit);
    },
  };
}
