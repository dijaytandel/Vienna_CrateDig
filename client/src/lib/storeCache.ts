import type { StoreDetail } from '../api/stores';

const KEY = 'cratedig.recentStores';
export const RECENT_STORE_LIMIT = 10;

export interface CachedStore {
  store: StoreDetail;
  savedAt: string;
}

function read(): CachedStore[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CachedStore[]) : [];
  } catch {
    return [];
  }
}

/** Keeps the last ten store profiles viewed, most recent first, so they open offline. */
export function rememberStore(store: StoreDetail, now = new Date()) {
  const rest = read().filter((c) => c.store.storeId !== store.storeId);
  const next = [{ store, savedAt: now.toISOString() }, ...rest].slice(0, RECENT_STORE_LIMIT);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage full or disabled: the profile still works online.
  }
}

export function readCachedStore(storeId: string): CachedStore | null {
  return read().find((c) => c.store.storeId === storeId) ?? null;
}
