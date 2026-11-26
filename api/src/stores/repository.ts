import { createClient } from '@supabase/supabase-js';
import type { OperatingHours } from './geo.js';

export interface StoreSummary {
  storeId: string;
  businessName: string;
  streetAddress: string;
  city: string;
  state: string;
  zip: string;
  geoLat: number;
  geoLng: number;
  tags: string[];
  isVerified: boolean;
}

export interface StoreDetail extends StoreSummary {
  phone: string | null;
  websiteUrl: string | null;
  operatingHours: OperatingHours;
  paymentMethods: string[];
}

export interface StoreSighting {
  sightingId: string;
  recordId: string;
  artistName: string;
  albumTitle: string;
  genre: string | null;
  coverArtUrl: string | null;
  priceUsd: number | null;
  conditionGrade: string;
  specialAttributes: string | null;
  storeVerified: boolean;
  sightingTimestamp: string;
}

export interface StoreBroadcast {
  broadcastId: string;
  arrivalSummary: string;
  photoUrl: string | null;
  featuredIds: string[];
  postedAt: string;
}

export interface Box {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface StoreRepository {
  zipCentroid(zip: string): Promise<{ lat: number; lng: number } | null>;
  /** Non-rejected stores inside the box. */
  listInBox(box: Box): Promise<StoreSummary[]>;
  /** A non-rejected store with its active sightings and recent broadcasts. */
  getById(storeId: string): Promise<{
    store: StoreDetail;
    sightings: StoreSighting[];
    broadcasts: StoreBroadcast[];
  } | null>;
}

// Name columns explicitly: license_doc_url must never leave the database.
const SUMMARY_COLUMNS =
  'store_id, business_name, street_address, city, state, zip, geo_lat, geo_lng, tags, verification_status';
const DETAIL_COLUMNS = `${SUMMARY_COLUMNS}, phone, website_url, operating_hours, payment_methods`;

type Row = Record<string, unknown>;

const toSummary = (r: Row): StoreSummary => ({
  storeId: r.store_id as string,
  businessName: r.business_name as string,
  streetAddress: r.street_address as string,
  city: r.city as string,
  state: r.state as string,
  zip: r.zip as string,
  geoLat: Number(r.geo_lat),
  geoLng: Number(r.geo_lng),
  tags: r.tags as string[],
  isVerified: r.verification_status === 'verified',
});

export function supabaseStores(url: string, serviceRoleKey: string): StoreRepository {
  const db = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  return {
    async zipCentroid(zip) {
      const { data, error } = await db
        .from('zip_centroids')
        .select('geo_lat, geo_lng')
        .eq('zip', zip)
        .maybeSingle();
      if (error) throw error;
      return data ? { lat: Number(data.geo_lat), lng: Number(data.geo_lng) } : null;
    },

    async listInBox(box) {
      const { data, error } = await db
        .from('stores')
        .select(SUMMARY_COLUMNS)
        .neq('verification_status', 'rejected')
        .gte('geo_lat', box.minLat)
        .lte('geo_lat', box.maxLat)
        .gte('geo_lng', box.minLng)
        .lte('geo_lng', box.maxLng);
      if (error) throw error;
      return (data as Row[]).map(toSummary);
    },

    async getById(storeId) {
      const [store, sightings, broadcasts] = await Promise.all([
        db
          .from('stores')
          .select(DETAIL_COLUMNS)
          .eq('store_id', storeId)
          .neq('verification_status', 'rejected')
          .maybeSingle(),
        db
          .from('sightings')
          .select(
            'sighting_id, price_usd, condition_grade, special_attributes, store_verified, sighting_timestamp, master_records (record_id, artist_name, album_title, genre, cover_art_url)',
          )
          .eq('store_id', storeId)
          .eq('status', 'active')
          .gt('archive_date', new Date().toISOString())
          .order('sighting_timestamp', { ascending: false })
          .limit(50),
        db
          .from('merchant_broadcasts')
          .select('broadcast_id, arrival_summary, photo_url, featured_ids, posted_at')
          .eq('store_id', storeId)
          .order('posted_at', { ascending: false })
          .limit(10),
      ]);
      if (store.error) throw store.error;
      if (sightings.error) throw sightings.error;
      if (broadcasts.error) throw broadcasts.error;
      if (!store.data) return null;

      const s = store.data as Row;
      return {
        store: {
          ...toSummary(s),
          phone: s.phone as string | null,
          websiteUrl: s.website_url as string | null,
          operatingHours: s.operating_hours as OperatingHours,
          paymentMethods: s.payment_methods as string[],
        },
        sightings: (sightings.data as Row[]).map((r) => {
          const record = r.master_records as Row;
          return {
            sightingId: r.sighting_id as string,
            recordId: record.record_id as string,
            artistName: record.artist_name as string,
            albumTitle: record.album_title as string,
            genre: record.genre as string | null,
            coverArtUrl: record.cover_art_url as string | null,
            priceUsd: r.price_usd == null ? null : Number(r.price_usd),
            conditionGrade: r.condition_grade as string,
            specialAttributes: r.special_attributes as string | null,
            storeVerified: r.store_verified as boolean,
            sightingTimestamp: r.sighting_timestamp as string,
          };
        }),
        broadcasts: (broadcasts.data as Row[]).map((r) => ({
          broadcastId: r.broadcast_id as string,
          arrivalSummary: r.arrival_summary as string,
          photoUrl: r.photo_url as string | null,
          featuredIds: r.featured_ids as string[],
          postedAt: r.posted_at as string,
        })),
      };
    },
  };
}
