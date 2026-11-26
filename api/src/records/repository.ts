import { createClient } from '@supabase/supabase-js';
import { RECORD_COLUMNS, toRecord, type RecordSummary } from '../crate/repository.js';

export interface RecordSighting {
  sightingId: string;
  priceUsd: number;
  conditionGrade: string;
  specialAttributes: string | null;
  storeVerified: boolean;
  sightingTimestamp: string;
  store: { storeId: string; businessName: string; geoLat: number; geoLng: number };
}

export interface RecordRepository {
  get(recordId: string): Promise<{ record: RecordSummary; sightings: RecordSighting[] } | null>;
}

export function supabaseRecords(url: string, serviceRoleKey: string): RecordRepository {
  const db = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  return {
    async get(recordId) {
      const { data: record, error } = await db
        .from('master_records')
        .select(RECORD_COLUMNS)
        .eq('record_id', recordId)
        .maybeSingle();
      if (error) throw error;
      if (!record) return null;
      const { data: rows, error: sErr } = await db
        .from('sightings')
        .select(
          'sighting_id, price_usd, condition_grade, special_attributes, store_verified, sighting_timestamp, store:stores!inner(store_id, business_name, geo_lat, geo_lng, verification_status)',
        )
        .eq('record_id', recordId)
        .eq('status', 'active')
        .gt('archive_date', new Date().toISOString())
        .neq('store.verification_status', 'rejected')
        .order('sighting_timestamp', { ascending: false })
        .limit(100);
      if (sErr) throw sErr;
      return {
        record: toRecord(record),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sightings: rows.map((r: any) => ({
          sightingId: r.sighting_id,
          priceUsd: Number(r.price_usd),
          conditionGrade: r.condition_grade,
          specialAttributes: r.special_attributes,
          storeVerified: r.store_verified,
          sightingTimestamp: r.sighting_timestamp,
          store: {
            storeId: r.store.store_id,
            businessName: r.store.business_name,
            geoLat: Number(r.store.geo_lat),
            geoLng: Number(r.store.geo_lng),
          },
        })),
      };
    },
  };
}
