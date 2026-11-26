import type { CatalogResult } from './catalog';
import { apiGet, apiSend } from './client';
import type { BroadcastDetail } from './feed';
import type { StoreBroadcast } from './stores';

export interface NewBroadcast {
  arrivalSummary: string;
  photoUrl: string | null;
  featuredIds: string[];
}

export const createBroadcast = (b: NewBroadcast) =>
  apiSend<BroadcastDetail & { notified: { sent: number } | null }>('POST', '/broadcasts', b);

export const listMyBroadcasts = (signal?: AbortSignal) =>
  apiGet<{ storeId: string; broadcasts: StoreBroadcast[] }>('/merchant/broadcasts', signal);

/** Saves a catalog pick as a master record so it can be featured. */
export const saveCatalogRecord = (apiSourceId: string) =>
  apiSend<CatalogResult & { recordId: string }>('POST', '/catalog/records', { apiSourceId });

export const getPushPublicKey = () => apiGet<{ publicKey: string }>('/push/public-key');

export const savePushSubscription = (sub: PushSubscriptionJSON) =>
  apiSend<void>('PUT', '/push/subscription', sub);

export const deletePushSubscription = (endpoint: string) =>
  apiSend<void>('DELETE', '/push/subscription', { endpoint });
