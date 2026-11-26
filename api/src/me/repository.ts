import { createClient } from '@supabase/supabase-js';

export interface Profile {
  userId: string;
  email: string;
  displayName: string;
  role: 'collector' | 'store_manager' | 'admin';
  defaultZip: string | null;
  radiusMiles: 5 | 10 | 25;
  distanceUnit: 'mi' | 'km';
  genres: string[];
  favoriteStoreIds: string[];
  pushBroadcastsEnabled: boolean;
}

export type ProfilePatch = Partial<
  Pick<
    Profile,
    'displayName' | 'defaultZip' | 'radiusMiles' | 'distanceUnit' | 'genres' | 'favoriteStoreIds'
  >
>;

export interface ProfileRepository {
  get(userId: string): Promise<Profile | null>;
  update(userId: string, patch: ProfilePatch): Promise<Profile | null>;
}

const COLUMNS =
  'user_id, email, display_name, user_role, default_zip, default_radius_miles, distance_unit, genre_preferences, favorite_store_ids, push_broadcasts_enabled';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toProfile = (r: any): Profile => ({
  userId: r.user_id,
  email: r.email,
  displayName: r.display_name,
  role: r.user_role,
  defaultZip: r.default_zip,
  radiusMiles: r.default_radius_miles,
  distanceUnit: r.distance_unit,
  genres: r.genre_preferences ?? [],
  favoriteStoreIds: r.favorite_store_ids ?? [],
  pushBroadcastsEnabled: r.push_broadcasts_enabled,
});

export function supabaseProfiles(url: string, serviceRoleKey: string): ProfileRepository {
  const db = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  return {
    async get(userId) {
      const { data, error } = await db
        .from('profiles')
        .select(COLUMNS)
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return data ? toProfile(data) : null;
    },
    async update(userId, p) {
      const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (p.displayName !== undefined) row.display_name = p.displayName;
      if (p.defaultZip !== undefined) row.default_zip = p.defaultZip;
      if (p.radiusMiles !== undefined) row.default_radius_miles = p.radiusMiles;
      if (p.distanceUnit !== undefined) row.distance_unit = p.distanceUnit;
      if (p.genres !== undefined) row.genre_preferences = p.genres;
      if (p.favoriteStoreIds !== undefined) row.favorite_store_ids = p.favoriteStoreIds;
      const { data, error } = await db
        .from('profiles')
        .update(row)
        .eq('user_id', userId)
        .select(COLUMNS)
        .maybeSingle();
      if (error) throw error;
      return data ? toProfile(data) : null;
    },
  };
}
