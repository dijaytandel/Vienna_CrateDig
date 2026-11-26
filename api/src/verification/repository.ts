import { createClient } from '@supabase/supabase-js';

export type ClaimStatus = 'pending' | 'verified' | 'rejected';

export interface StoreClaim {
  storeId: string;
  businessName: string;
  city: string;
  state: string;
  status: ClaimStatus;
  licenseDocUrl: string | null;
}

export interface ClaimableStore {
  storeId: string;
  businessName: string;
  city: string;
  state: string;
  zip: string;
}

export interface VerificationRepository {
  myClaim(userId: string): Promise<StoreClaim | null>;
  /** Stores the user may apply for: not verified, and not pending for someone else. */
  claimable(userId: string): Promise<ClaimableStore[]>;
  /** Throws `ClaimError` for unknown stores or blocked claims. */
  claim(userId: string, storeId: string, licenseUrl: string): Promise<void>;
}

export class ClaimError extends Error {
  constructor(
    readonly status: 404 | 409,
    message: string,
  ) {
    super(message);
  }
}

const CLAIMABLE_LIMIT = 500;

export function supabaseVerification(url: string, serviceRoleKey: string): VerificationRepository {
  const db = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  return {
    async myClaim(userId) {
      const { data, error } = await db
        .from('stores')
        .select('store_id, business_name, city, state, verification_status, license_doc_url')
        .eq('manager_user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return data
        ? {
            storeId: data.store_id,
            businessName: data.business_name,
            city: data.city,
            state: data.state,
            status: data.verification_status as ClaimStatus,
            licenseDocUrl: data.license_doc_url,
          }
        : null;
    },
    async claimable(userId) {
      const { data, error } = await db
        .from('stores')
        .select('store_id, business_name, city, state, zip')
        .neq('verification_status', 'verified')
        .or(`manager_user_id.is.null,manager_user_id.eq.${userId},verification_status.eq.rejected`)
        .order('business_name')
        .limit(CLAIMABLE_LIMIT);
      if (error) throw error;
      return (data ?? []).map((s) => ({
        storeId: s.store_id,
        businessName: s.business_name,
        city: s.city,
        state: s.state,
        zip: s.zip,
      }));
    },
    async claim(userId, storeId, licenseUrl) {
      const { error } = await db.rpc('claim_store', {
        p_user: userId,
        p_store: storeId,
        p_license_url: licenseUrl,
      });
      if (error?.code === 'CD404') throw new ClaimError(404, error.message);
      if (error?.code === 'CD409') throw new ClaimError(409, error.message);
      if (error) throw error;
    },
  };
}
