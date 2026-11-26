import { createClient } from '@supabase/supabase-js';
import type { CatalogResult } from './types.js';

export interface MasterRecordRepository {
  /** Inserts or refreshes the row keyed by api_source_id and returns its record_id. */
  upsert(record: CatalogResult): Promise<string>;
}

/** Null fields are left out so a sparse search preview never erases saved metadata. */
const withoutNulls = (row: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(row).filter(([, v]) => v !== null));

export function supabaseMasterRecords(url: string, serviceRoleKey: string): MasterRecordRepository {
  const db = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  return {
    async upsert(r) {
      const row = {
        api_source_id: r.apiSourceId,
        artist_name: r.artistName,
        album_title: r.albumTitle,
        song_title: r.songTitle,
        record_label: r.recordLabel,
        release_year: r.releaseYear,
        genre: r.genre,
        cover_art_url: r.coverArtUrl,
      };
      const { data, error } = await db
        .from('master_records')
        .upsert(withoutNulls(row), { onConflict: 'api_source_id' })
        .select('record_id')
        .single();
      if (error) throw error;
      return data.record_id as string;
    },
  };
}
