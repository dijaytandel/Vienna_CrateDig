import type { CrateItem, ListType } from '../api/crate';

const key = (userId: string, list: ListType) => `cratedig.crate.${userId}.${list}`;

/** Last My Crate snapshot per user and list, so the crate opens offline. */
export function readCrateCache(userId: string, list: ListType): CrateItem[] | null {
  try {
    const raw = localStorage.getItem(key(userId, list));
    return raw ? (JSON.parse(raw) as CrateItem[]) : null;
  } catch {
    return null;
  }
}

export function writeCrateCache(userId: string, list: ListType, items: CrateItem[]) {
  try {
    localStorage.setItem(key(userId, list), JSON.stringify(items));
  } catch {
    // Storage full or disabled: the crate still works online.
  }
}
