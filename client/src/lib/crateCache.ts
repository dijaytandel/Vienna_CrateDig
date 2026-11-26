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

const LISTS: ListType[] = ['collection', 'want_list'];

/** Puts a confirmed write into the snapshot so the change is visible offline. */
export function cacheCrateItem(userId: string, item: CrateItem) {
  for (const list of LISTS) {
    const cached = readCrateCache(userId, list);
    if (!cached && list !== item.listType) continue;
    const rest = (cached ?? []).filter((i) => i.crateItemId !== item.crateItemId);
    writeCrateCache(userId, list, list === item.listType ? [item, ...rest] : rest);
  }
}

export function uncacheCrateItem(userId: string, crateItemId: string) {
  for (const list of LISTS) {
    const cached = readCrateCache(userId, list);
    if (cached) {
      writeCrateCache(
        userId,
        list,
        cached.filter((i) => i.crateItemId !== crateItemId),
      );
    }
  }
}
