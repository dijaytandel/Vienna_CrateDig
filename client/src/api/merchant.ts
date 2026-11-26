import { apiGet, apiSend } from './client';
import type { Sighting } from './sightings';
import type { DayHours, DayKey, StoreDetail } from './stores';

export type ModerationAction = 'confirm' | 'flag' | 'mark_sold';

export interface StorePatch {
  phone?: string | null;
  websiteUrl?: string | null;
  operatingHours?: Record<DayKey, DayHours>;
  paymentMethods?: string[];
  tags?: string[];
}

export const listMerchantSightings = (signal?: AbortSignal) =>
  apiGet<{ storeId: string; sightings: Sighting[] }>('/merchant/sightings', signal);

export const moderateSighting = (id: string, action: ModerationAction) =>
  apiSend<Sighting>('PATCH', `/sightings/${id}`, { action });

export const updateMyStore = (patch: StorePatch) =>
  apiSend<StoreDetail>('PATCH', '/merchant/store', patch);
