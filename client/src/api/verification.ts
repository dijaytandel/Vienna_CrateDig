import { apiGet, apiSend } from './client';

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

export const CLAIM_LABELS: Record<ClaimStatus, string> = {
  pending: 'Pending',
  verified: 'Verified',
  rejected: 'Rejected',
};

export const getMyClaim = (signal?: AbortSignal) =>
  apiGet<{ claim: StoreClaim | null }>('/merchant/verification', signal);

export const listClaimableStores = (signal?: AbortSignal) =>
  apiGet<{ stores: ClaimableStore[] }>('/merchant/claimable-stores', signal);

export const submitClaim = (storeId: string, licenseDocUrl: string) =>
  apiSend<{ claim: StoreClaim }>('POST', '/merchant/verification', { storeId, licenseDocUrl });
