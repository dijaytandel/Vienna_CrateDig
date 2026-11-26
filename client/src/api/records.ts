import { apiGet } from './client';
import type { ConditionGrade, RecordSummary } from './crate';
import type { Origin, Unit } from './stores';

export interface RecordSighting {
  sightingId: string;
  priceUsd: number;
  conditionGrade: ConditionGrade;
  specialAttributes: string | null;
  storeVerified: boolean;
  sightingTimestamp: string;
  distance: number | null;
  store: { storeId: string; businessName: string };
}

export interface RecordDetail extends RecordSummary {
  unit: Unit;
  activeSightings: RecordSighting[];
}

export function originParams(origin: Origin | null) {
  const params = new URLSearchParams();
  if (!origin) return params;
  if ('zip' in origin) params.set('zip', origin.zip);
  else {
    params.set('lat', origin.lat.toFixed(5));
    params.set('lng', origin.lng.toFixed(5));
  }
  return params;
}

export function getRecord(id: string, origin: Origin | null, unit: Unit, signal?: AbortSignal) {
  const params = originParams(origin);
  params.set('unit', unit);
  return apiGet<RecordDetail>(`/records/${encodeURIComponent(id)}?${params}`, signal);
}
