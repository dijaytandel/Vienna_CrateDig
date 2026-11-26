import { apiGet } from './client';
import type { ConditionGrade } from './crate';
import { originParams } from './records';
import type { Origin, Radius, Unit } from './stores';

export interface SearchResult {
  sightingId: string;
  priceUsd: number;
  conditionGrade: ConditionGrade;
  specialAttributes: string | null;
  storeVerified: boolean;
  sightingTimestamp: string;
  distance: number;
  record: {
    recordId: string;
    artistName: string;
    albumTitle: string;
    genre: string | null;
    coverArtUrl: string | null;
  };
  store: { storeId: string; businessName: string; isVerified: boolean };
}

export interface SearchResponse {
  unit: Unit;
  radius: Radius;
  genres: string[];
  results: SearchResult[];
}

export function searchSightings(
  query: { q: string; genre: string; radius: Radius; unit: Unit; origin: Origin },
  signal?: AbortSignal,
) {
  const params = originParams(query.origin);
  if (query.q.trim()) params.set('q', query.q.trim());
  if (query.genre) params.set('genre', query.genre);
  params.set('radius', String(query.radius));
  params.set('unit', query.unit);
  return apiGet<SearchResponse>(`/search?${params}`, signal);
}
