import { createClient } from '@supabase/supabase-js';
import type { ConditionGrade } from '../sightings/repository.js';

interface FeedStore {
  storeId: string;
  businessName: string;
  isVerified: boolean;
}

interface FeedBase {
  id: string;
  postedAt: string;
  distanceMiles: number;
  store: FeedStore;
}

export interface FeedSighting extends FeedBase {
  type: 'sighting';
  priceUsd: number | null;
  conditionGrade: ConditionGrade;
  specialAttributes: string | null;
  storeVerified: boolean;
  record: {
    recordId: string;
    artistName: string;
    albumTitle: string;
    genre: string | null;
    coverArtUrl: string | null;
  };
}

export interface FeedBroadcast extends FeedBase {
  type: 'broadcast';
  arrivalSummary: string;
  photoUrl: string | null;
  featuredIds: string[];
}

export type FeedItem = FeedSighting | FeedBroadcast;

export interface FeedQuery {
  lat: number;
  lng: number;
  radiusMiles: number;
  before: { postedAt: string; id: string } | null;
  limit: number;
}

export interface FeedPreferences {
  genres: string[];
  favoriteStoreIds: string[];
}

export interface BroadcastDetail {
  broadcastId: string;
  arrivalSummary: string;
  photoUrl: string | null;
  postedAt: string;
  store: FeedStore & {
    streetAddress: string;
    city: string;
    state: string;
    zip: string;
    geoLat: number;
    geoLng: number;
  };
  featured: {
    recordId: string;
    artistName: string;
    albumTitle: string;
    releaseYear: number | null;
    genre: string | null;
    coverArtUrl: string | null;
  }[];
}

export interface FeedRepository {
  /** Active sightings and broadcasts from the last 180 days in the radius, newest first. */
  page(query: FeedQuery): Promise<FeedItem[]>;
  preferences(userId: string): Promise<FeedPreferences>;
  broadcast(id: string): Promise<BroadcastDetail | null>;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const toItem = (r: any): FeedItem => {
  const base = {
    id: r.item_id,
    postedAt: r.posted_at,
    distanceMiles: Number(r.distance_mi),
    store: { storeId: r.store_id, businessName: r.business_name, isVerified: r.store_is_verified },
  };
  if (r.kind === 'broadcast') {
    return {
      ...base,
      type: 'broadcast',
      arrivalSummary: r.arrival_summary,
      photoUrl: r.photo_url,
      featuredIds: r.featured_ids ?? [],
    };
  }
  return {
    ...base,
    type: 'sighting',
    priceUsd: r.price_usd == null ? null : Number(r.price_usd),
    conditionGrade: r.condition_grade,
    specialAttributes: r.special_attributes,
    storeVerified: r.store_verified,
    record: {
      recordId: r.record_id,
      artistName: r.artist_name,
      albumTitle: r.album_title,
      genre: r.genre,
      coverArtUrl: r.cover_art_url,
    },
  };
};

export function supabaseFeed(url: string, serviceRoleKey: string): FeedRepository {
  const db = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  return {
    async page(q) {
      const { data, error } = await db.rpc('feed_page', {
        p_lat: q.lat,
        p_lng: q.lng,
        p_radius_mi: q.radiusMiles,
        p_before_ts: q.before?.postedAt ?? null,
        p_before_id: q.before?.id ?? null,
        p_limit: q.limit,
      });
      if (error) throw error;
      return (data as any[]).map(toItem);
    },

    async preferences(userId) {
      const { data, error } = await db
        .from('profiles')
        .select('genre_preferences, favorite_store_ids')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return {
        genres: data?.genre_preferences ?? [],
        favoriteStoreIds: data?.favorite_store_ids ?? [],
      };
    },

    async broadcast(id) {
      const { data, error } = await db
        .from('merchant_broadcasts')
        .select(
          'broadcast_id, arrival_summary, photo_url, featured_ids, posted_at, store:stores!inner(store_id, business_name, street_address, city, state, zip, geo_lat, geo_lng, verification_status)',
        )
        .eq('broadcast_id', id)
        .neq('store.verification_status', 'rejected')
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const b = data as any;
      const ids: string[] = b.featured_ids ?? [];
      let featured: BroadcastDetail['featured'] = [];
      if (ids.length) {
        const records = await db
          .from('master_records')
          .select('record_id, artist_name, album_title, release_year, genre, cover_art_url')
          .in('record_id', ids);
        if (records.error) throw records.error;
        const byId = new Map((records.data as any[]).map((r) => [r.record_id, r]));
        featured = ids
          .map((rid) => byId.get(rid))
          .filter(Boolean)
          .map((r) => ({
            recordId: r.record_id,
            artistName: r.artist_name,
            albumTitle: r.album_title,
            releaseYear: r.release_year,
            genre: r.genre,
            coverArtUrl: r.cover_art_url,
          }));
      }
      return {
        broadcastId: b.broadcast_id,
        arrivalSummary: b.arrival_summary,
        photoUrl: b.photo_url,
        postedAt: b.posted_at,
        store: {
          storeId: b.store.store_id,
          businessName: b.store.business_name,
          isVerified: b.store.verification_status === 'verified',
          streetAddress: b.store.street_address,
          city: b.store.city,
          state: b.store.state,
          zip: b.store.zip,
          geoLat: Number(b.store.geo_lat),
          geoLng: Number(b.store.geo_lng),
        },
        featured,
      };
    },
  };
}
