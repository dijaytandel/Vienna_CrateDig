import { createClient } from '@supabase/supabase-js';
import { RECORD_COLUMNS, toRecord, type RecordSummary } from '../crate/repository.js';
import { HttpError } from '../middleware/httpError.js';

export type ConditionGrade = 'mint' | 'near_mint' | 'vg_plus' | 'vg' | 'fair';
export type SightingStatus = 'active' | 'sold_out' | 'flagged' | 'archived';
export type ModerationAction = 'confirm' | 'flag' | 'mark_sold';

export interface SightingDetail {
  sightingId: string;
  priceUsd: number | null;
  conditionGrade: ConditionGrade;
  specialAttributes: string | null;
  storeVerified: boolean;
  status: SightingStatus;
  sightingTimestamp: string;
  archiveDate: string;
  reporter: { userId: string; displayName: string } | null;
  record: RecordSummary;
  store: {
    storeId: string;
    businessName: string;
    streetAddress: string;
    city: string;
    state: string;
    zip: string;
    geoLat: number;
    geoLng: number;
    isVerified: boolean;
  };
}

export interface NewSighting {
  recordId: string;
  storeId: string;
  priceUsd: number | null;
  conditionGrade: ConditionGrade;
  specialAttributes: string | null;
  clientRef?: string;
}

export interface SightingRepository {
  get(id: string): Promise<SightingDetail | null>;
  byClientRef(userId: string, clientRef: string): Promise<SightingDetail | null>;
  countSince(userId: string, since: Date): Promise<number>;
  create(userId: string, input: NewSighting): Promise<SightingDetail>;
  moderate(actorId: string, id: string, action: ModerationAction): Promise<SightingDetail | null>;
}

export const SIGHTING_COLUMNS = `sighting_id, price_usd, condition_grade, special_attributes, store_verified, status, sighting_timestamp, archive_date, reporter:profiles(user_id, display_name), record:master_records!inner(${RECORD_COLUMNS}), store:stores!inner(store_id, business_name, street_address, city, state, zip, geo_lat, geo_lng, verification_status)`;

/* eslint-disable @typescript-eslint/no-explicit-any */
export const toSighting = (r: any): SightingDetail => ({
  sightingId: r.sighting_id,
  priceUsd: r.price_usd == null ? null : Number(r.price_usd),
  conditionGrade: r.condition_grade,
  specialAttributes: r.special_attributes,
  storeVerified: r.store_verified,
  status: r.status,
  sightingTimestamp: r.sighting_timestamp,
  archiveDate: r.archive_date,
  reporter: r.reporter
    ? { userId: r.reporter.user_id, displayName: r.reporter.display_name }
    : null,
  record: toRecord(r.record),
  store: {
    storeId: r.store.store_id,
    businessName: r.store.business_name,
    streetAddress: r.store.street_address,
    city: r.store.city,
    state: r.store.state,
    zip: r.store.zip,
    geoLat: Number(r.store.geo_lat),
    geoLng: Number(r.store.geo_lng),
    isVerified: r.store.verification_status === 'verified',
  },
});
/* eslint-enable @typescript-eslint/no-explicit-any */

export function supabaseSightings(url: string, serviceRoleKey: string): SightingRepository {
  const db = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  const one = async (column: string, value: string, userId?: string) => {
    let q = db.from('sightings').select(SIGHTING_COLUMNS).eq(column, value);
    if (userId) q = q.eq('user_id', userId);
    const { data, error } = await q.maybeSingle();
    if (error) throw error;
    return data ? toSighting(data) : null;
  };
  return {
    get: (id) => one('sighting_id', id),
    byClientRef: (userId, ref) => one('client_ref', ref, userId),
    async countSince(userId, since) {
      const { count, error } = await db
        .from('sightings')
        .select('sighting_id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('sighting_timestamp', since.toISOString());
      if (error) throw error;
      return count ?? 0;
    },
    async create(userId, s) {
      const { data, error } = await db
        .from('sightings')
        .insert({
          user_id: userId,
          record_id: s.recordId,
          store_id: s.storeId,
          price_usd: s.priceUsd,
          condition_grade: s.conditionGrade,
          special_attributes: s.specialAttributes,
          client_ref: s.clientRef ?? null,
        })
        .select(SIGHTING_COLUMNS)
        .single();
      if (error?.code === '23503') throw new HttpError(422, 'NOT_FOUND', 'Unknown store or record');
      if (error) throw error;
      return toSighting(data);
    },
    async moderate(actorId, id, action) {
      const { error } = await db.rpc('moderate_sighting', {
        p_actor: actorId,
        p_sighting: id,
        p_action: action,
      });
      if (error?.code === 'CD404') return null;
      if (error) throw error;
      return one('sighting_id', id);
    },
  };
}
