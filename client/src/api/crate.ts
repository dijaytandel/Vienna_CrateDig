import { apiGet, apiSend } from './client';
import type { CatalogResult } from './catalog';

export type ListType = 'collection' | 'want_list';
export type ConditionGrade = 'mint' | 'near_mint' | 'vg_plus' | 'vg' | 'fair';

export interface RecordSummary extends CatalogResult {
  recordId: string;
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

export interface CrateFields {
  conditionGrade?: ConditionGrade | null;
  specialAttributes?: string[];
  purchasePriceUsd?: number | null;
  userNotes?: string | null;
}

export interface NewCrateItem extends CrateFields {
  apiSourceId?: string;
  recordId?: string;
  listType: ListType;
  force?: boolean;
}

export function listCrate(
  filter: { listType?: ListType; q?: string; genre?: string; recordId?: string },
  signal?: AbortSignal,
) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filter)) if (v) params.set(k, v);
  return apiGet<{ items: CrateItem[] }>(`/crate?${params}`, signal);
}

export const getCrateItem = (id: string, signal?: AbortSignal) =>
  apiGet<CrateItem>(`/crate/${encodeURIComponent(id)}`, signal);

export const addCrateItem = (item: NewCrateItem, idempotencyKey?: string) =>
  apiSend<CrateItem>('POST', '/crate', item, { idempotencyKey });

export const updateCrateItem = (id: string, patch: CrateFields) =>
  apiSend<CrateItem>('PATCH', `/crate/${encodeURIComponent(id)}`, patch);

export const deleteCrateItem = (id: string) =>
  apiSend<void>('DELETE', `/crate/${encodeURIComponent(id)}`);

export const acquireCrateItem = (
  id: string,
  body: { storeId: string | null; purchasePriceUsd?: number | null },
) =>
  apiSend<{ item: CrateItem; closedSightingIds: string[] }>(
    'POST',
    `/crate/${encodeURIComponent(id)}/acquire`,
    body,
  );
