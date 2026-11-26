import { apiGet } from './client';

export type Unit = 'mi' | 'km';
export type Radius = 5 | 10 | 25;
export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type DayHours = { open: string; close: string } | null;

export interface StoreSummary {
  storeId: string;
  businessName: string;
  streetAddress: string;
  city: string;
  state: string;
  zip: string;
  geoLat: number;
  geoLng: number;
  tags: string[];
  isVerified: boolean;
}

export interface StoreListItem extends StoreSummary {
  distance: number;
}

export interface StoreSighting {
  sightingId: string;
  recordId: string;
  artistName: string;
  albumTitle: string;
  genre: string | null;
  coverArtUrl: string | null;
  priceUsd: number | null;
  conditionGrade: 'mint' | 'near_mint' | 'vg_plus' | 'vg' | 'fair';
  specialAttributes: string | null;
  storeVerified: boolean;
  sightingTimestamp: string;
}

export interface StoreBroadcast {
  broadcastId: string;
  arrivalSummary: string;
  photoUrl: string | null;
  featuredIds: string[];
  postedAt: string;
}

export interface StoreDetail extends StoreSummary {
  phone: string | null;
  websiteUrl: string | null;
  operatingHours: Partial<Record<DayKey, DayHours>>;
  timeZone: string;
  isOpenNow: boolean;
  paymentMethods: string[];
  activeSightings: StoreSighting[];
  recentBroadcasts: StoreBroadcast[];
}

export type Origin = { lat: number; lng: number } | { zip: string };

export interface StoreList {
  origin: { lat: number; lng: number; source: 'coordinates' | 'zip' };
  unit: Unit;
  radius: Radius;
  stores: StoreListItem[];
}

export function listStores(origin: Origin, radius: Radius, unit: Unit, signal?: AbortSignal) {
  const params = new URLSearchParams(
    'zip' in origin
      ? { zip: origin.zip }
      : { lat: origin.lat.toFixed(5), lng: origin.lng.toFixed(5) },
  );
  params.set('radius', String(radius));
  params.set('unit', unit);
  return apiGet<StoreList>(`/stores?${params}`, signal);
}

export const getStore = (id: string, signal?: AbortSignal) =>
  apiGet<StoreDetail>(`/stores/${encodeURIComponent(id)}`, signal);
