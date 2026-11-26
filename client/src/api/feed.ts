import { apiGet } from './client';
import type { ConditionGrade } from './crate';
import { originParams } from './records';
import type { Origin, Radius, StoreSummary, Unit } from './stores';

interface FeedBase {
  id: string;
  postedAt: string;
  distance: number;
  isForYou: boolean;
  store: { storeId: string; businessName: string; isVerified: boolean };
}

export interface FeedSighting extends FeedBase {
  type: 'sighting';
  priceUsd: number | null;
  conditionGrade: ConditionGrade;
  specialAttributes: string | null;
  storeVerified: boolean;
  record: {
    recordId: string;
    artistName: string;
    albumTitle: string;
    genre: string | null;
    coverArtUrl: string | null;
  };
}

export interface FeedBroadcast extends FeedBase {
  type: 'broadcast';
  arrivalSummary: string;
  photoUrl: string | null;
  featuredIds: string[];
}

export type FeedItem = FeedSighting | FeedBroadcast;

export interface FeedPage {
  unit: Unit;
  radius: Radius;
  items: FeedItem[];
  nextCursor: string | null;
}

export function getFeed(
  query: { origin: Origin; radius: Radius; unit: Unit; cursor?: string | null },
  signal?: AbortSignal,
) {
  const params = originParams(query.origin);
  params.set('radius', String(query.radius));
  params.set('unit', query.unit);
  if (query.cursor) params.set('cursor', query.cursor);
  return apiGet<FeedPage>(`/feed?${params}`, signal);
}

export interface BroadcastDetail {
  broadcastId: string;
  arrivalSummary: string;
  photoUrl: string | null;
  postedAt: string;
  unit: Unit;
  distance: number | null;
  store: Pick<
    StoreSummary,
    'storeId' | 'businessName' | 'isVerified' | 'streetAddress' | 'city' | 'state' | 'zip'
  >;
  featured: {
    recordId: string;
    artistName: string;
    albumTitle: string;
    releaseYear: number | null;
    genre: string | null;
    coverArtUrl: string | null;
  }[];
}

export function getBroadcast(id: string, origin: Origin | null, unit: Unit, signal?: AbortSignal) {
  const params = origin ? originParams(origin) : new URLSearchParams();
  params.set('unit', unit);
  return apiGet<BroadcastDetail>(`/broadcasts/${encodeURIComponent(id)}?${params}`, signal);
}
