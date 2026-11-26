import { createClient } from '@supabase/supabase-js';

export interface AuthUser {
  id: string;
  role: 'collector' | 'store_manager' | 'admin';
}

export interface AuthService {
  /** The user a Supabase access token belongs to, or null if it is invalid or expired. */
  userFromToken(token: string): Promise<AuthUser | null>;
  /** The verified store this user manages, if any. */
  verifiedStoreId(userId: string): Promise<string | null>;
}

export function supabaseAuth(url: string, serviceRoleKey: string): AuthService {
  const db = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return {
    async userFromToken(token) {
      const { data, error } = await db.auth.getUser(token);
      if (error || !data.user) return null;
      const { data: profile, error: profileError } = await db
        .from('profiles')
        .select('user_role')
        .eq('user_id', data.user.id)
        .maybeSingle();
      if (profileError) throw profileError;
      if (!profile) return null;
      return { id: data.user.id, role: profile.user_role };
    },
    async verifiedStoreId(userId) {
      const { data, error } = await db
        .from('stores')
        .select('store_id')
        .eq('manager_user_id', userId)
        .eq('verification_status', 'verified')
        .maybeSingle();
      if (error) throw error;
      return data?.store_id ?? null;
    },
  };
}
