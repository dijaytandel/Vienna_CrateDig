import { apiGet, apiSend } from './client';
import type { ConditionGrade, RecordSummary } from './crate';
import { originParams } from './records';
import type { Origin, StoreSummary, Unit } from './stores';

export type SightingStatus = 'active' | 'sold_out' | 'flagged' | 'archived';

export interface Sighting {
  sightingId: string;
  priceUsd: number;
  conditionGrade: ConditionGrade;
  specialAttributes: string | null;
  storeVerified: boolean;
  status: SightingStatus;
  sightingTimestamp: string;
  archiveDate: string;
  reporter: { userId: string; displayName: string } | null;
  record: RecordSummary;
  store: Omit<StoreSummary, 'tags'>;
  distance?: number | null;
  unit?: Unit;
}

export interface NewSighting {
  apiSourceId?: string;
  recordId?: string;
  storeId: string;
  conditionGrade: ConditionGrade;
  priceUsd?: number | null;
  specialAttributes?: string[];
}

export const STATUS_LABELS: Record<SightingStatus, string> = {
  active: 'Active',
  sold_out: 'Sold Out',
  flagged: 'Flagged',
  archived: 'Archived',
};

export function getSighting(id: string, origin: Origin | null, unit: Unit, signal?: AbortSignal) {
  const params = originParams(origin);
  params.set('unit', unit);
  return apiGet<Sighting>(`/sightings/${encodeURIComponent(id)}?${params}`, signal);
}

export const reportSighting = (body: NewSighting, idempotencyKey: string) =>
  apiSend<Sighting>('POST', '/sightings', body, { idempotencyKey });

export const nearestStore = (lat: number, lng: number, signal?: AbortSignal) =>
  apiGet<{ store: StoreSummary & { distance: number }; unit: 'mi' }>(
    `/stores/nearest?lat=${lat.toFixed(5)}&lng=${lng.toFixed(5)}`,
    signal,
  );
