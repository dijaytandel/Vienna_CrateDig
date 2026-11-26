import { createClient } from '@supabase/supabase-js';
import { HttpError } from '../middleware/httpError.js';

export type ListType = 'collection' | 'want_list';
export type ConditionGrade = 'mint' | 'near_mint' | 'vg_plus' | 'vg' | 'fair';

export interface RecordSummary {
  recordId: string;
  apiSourceId: string;
  artistName: string;
  albumTitle: string;
  songTitle: string | null;
  recordLabel: string | null;
  releaseYear: number | null;
  genre: string | null;
  coverArtUrl: string | null;
}

export interface CrateItem {
  crateItemId: string;
  listType: ListType;
  conditionGrade: ConditionGrade | null;
  specialAttributes: string[];
  purchasePriceUsd: number | null;
  userNotes: string | null;
  acquiredAt: string | null;
  createdAt: string;
  purchasedStore: { storeId: string; businessName: string } | null;
  record: RecordSummary;
}

export interface CrateFilter {
  listType?: ListType;
  q?: string;
  genre?: string;
  recordId?: string;
}

export interface NewCrateItem {
  recordId: string;
  listType: ListType;
  conditionGrade?: ConditionGrade | null;
  specialAttributes?: string[];
  purchasePriceUsd?: number | null;
  userNotes?: string | null;
  clientRef?: string;
}

export type CratePatch = Partial<
  Pick<NewCrateItem, 'conditionGrade' | 'specialAttributes' | 'purchasePriceUsd' | 'userNotes'>
>;

export type AcquireResult =
  | { ok: true; item: CrateItem; closedSightingIds: string[] }
  | { ok: false; reason: 'not_found' | 'not_want_list' | 'store_not_found' };

export interface CrateRepository {
  list(userId: string, filter: CrateFilter): Promise<CrateItem[]>;
  get(userId: string, id: string): Promise<CrateItem | null>;
  byClientRef(userId: string, clientRef: string): Promise<CrateItem | null>;
  hasRecord(userId: string, recordId: string, listType: ListType): Promise<boolean>;
  insert(userId: string, item: NewCrateItem): Promise<CrateItem>;
  update(userId: string, id: string, patch: CratePatch): Promise<CrateItem | null>;
  remove(userId: string, id: string): Promise<boolean>;
  acquire(
    userId: string,
    id: string,
    storeId: string | null,
    priceUsd: number | null,
  ): Promise<AcquireResult>;
}

export const RECORD_COLUMNS =
  'record_id, api_source_id, artist_name, album_title, song_title, record_label, release_year, genre, cover_art_url';

const COLUMNS = `crate_item_id, list_type, condition_grade, special_attributes, purchase_price_usd, user_notes, acquired_at, created_at, purchased_store:stores(store_id, business_name), record:master_records!inner(${RECORD_COLUMNS})`;

/* eslint-disable @typescript-eslint/no-explicit-any */
export const toRecord = (r: any): RecordSummary => ({
  recordId: r.record_id,
  apiSourceId: r.api_source_id,
  artistName: r.artist_name,
  albumTitle: r.album_title,
  songTitle: r.song_title,
  recordLabel: r.record_label,
  releaseYear: r.release_year,
  genre: r.genre,
  coverArtUrl: r.cover_art_url,
});

const toItem = (row: any): CrateItem => ({
  crateItemId: row.crate_item_id,
  listType: row.list_type,
  conditionGrade: row.condition_grade,
  specialAttributes: row.special_attributes ?? [],
  purchasePriceUsd: row.purchase_price_usd === null ? null : Number(row.purchase_price_usd),
  userNotes: row.user_notes,
  acquiredAt: row.acquired_at,
  createdAt: row.created_at,
  purchasedStore: row.purchased_store
    ? { storeId: row.purchased_store.store_id, businessName: row.purchased_store.business_name }
    : null,
  record: toRecord(row.record),
});
/* eslint-enable @typescript-eslint/no-explicit-any */

const toRow = (p: CratePatch) => {
  const row: Record<string, unknown> = {};
  if (p.conditionGrade !== undefined) row.condition_grade = p.conditionGrade;
  if (p.specialAttributes !== undefined) row.special_attributes = p.specialAttributes;
  if (p.purchasePriceUsd !== undefined) row.purchase_price_usd = p.purchasePriceUsd;
  if (p.userNotes !== undefined) row.user_notes = p.userNotes;
  return row;
};

/** Escapes a user term for a PostgREST `ilike` inside an `or=(...)` filter. */
export const ilikeTerm = (q: string) => `"%${q.replace(/[\\%_"]/g, (c) => `\\${c}`)}%"`;

export function supabaseCrate(url: string, serviceRoleKey: string): CrateRepository {
  const db = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  const one = async (userId: string, column: string, value: string) => {
    const { data, error } = await db
      .from('crate_items')
      .select(COLUMNS)
      .eq('user_id', userId)
      .eq(column, value)
      .maybeSingle();
    if (error) throw error;
    return data ? toItem(data) : null;
  };
  return {
    async list(userId, f) {
      let query = db
        .from('crate_items')
        .select(COLUMNS)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(2000);
      if (f.listType) query = query.eq('list_type', f.listType);
      if (f.recordId) query = query.eq('record_id', f.recordId);
      if (f.genre) query = query.ilike('record.genre', f.genre);
      if (f.q) {
        const t = ilikeTerm(f.q);
        query = query.or(`album_title.ilike.${t},artist_name.ilike.${t},genre.ilike.${t}`, {
          referencedTable: 'record',
        });
      }
      const { data, error } = await query;
      if (error) throw error;
      return data.map(toItem);
    },
    get: (userId, id) => one(userId, 'crate_item_id', id),
    byClientRef: (userId, ref) => one(userId, 'client_ref', ref),
    async hasRecord(userId, recordId, listType) {
      const { count, error } = await db
        .from('crate_items')
        .select('crate_item_id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('record_id', recordId)
        .eq('list_type', listType);
      if (error) throw error;
      return (count ?? 0) > 0;
    },
    async insert(userId, item) {
      const { data, error } = await db
        .from('crate_items')
        .insert({
          user_id: userId,
          record_id: item.recordId,
          list_type: item.listType,
          client_ref: item.clientRef ?? null,
          acquired_at: item.listType === 'collection' ? new Date().toISOString() : null,
          ...toRow(item),
        })
        .select(COLUMNS)
        .single();
      if (error?.code === '23503') throw new HttpError(404, 'NOT_FOUND', 'No such record');
      if (error?.code === '23505') {
        throw new HttpError(
          409,
          'ALREADY_ON_WANT_LIST',
          'This record is already on your Want List',
        );
      }
      if (error) throw error;
      return toItem(data);
    },
    async update(userId, id, patch) {
      const { data, error } = await db
        .from('crate_items')
        .update(toRow(patch))
        .eq('user_id', userId)
        .eq('crate_item_id', id)
        .select(COLUMNS)
        .maybeSingle();
      if (error) throw error;
      return data ? toItem(data) : null;
    },
    async remove(userId, id) {
      const { data, error } = await db
        .from('crate_items')
        .delete()
        .eq('user_id', userId)
        .eq('crate_item_id', id)
        .select('crate_item_id');
      if (error) throw error;
      return data.length > 0;
    },
    async acquire(userId, id, storeId, priceUsd) {
      const { data, error } = await db.rpc('acquire_crate_item', {
        p_user: userId,
        p_item: id,
        p_store: storeId,
        p_price: priceUsd,
      });
      if (error) {
        const reason = (
          { CD404: 'not_found', CD409: 'not_want_list', CD422: 'store_not_found' } as const
        )[error.code as 'CD404'];
        if (reason) return { ok: false, reason };
        throw error;
      }
      const item = await one(userId, 'crate_item_id', id);
      return { ok: true, item: item!, closedSightingIds: data.closedSightingIds as string[] };
    },
  };
}
