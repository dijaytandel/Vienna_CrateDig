import { isOfflineError } from '../api/client';
import {
  acquireCrateItem,
  addCrateItem,
  deleteCrateItem,
  updateCrateItem,
  type CrateFields,
  type CrateItem,
  type ListType,
  type NewCrateItem,
  type RecordSummary,
} from '../api/crate';
import { cacheCrateItem, readCrateCache, uncacheCrateItem } from '../lib/crateCache';
import { newId } from '../lib/format';
import { enqueue, readQueue } from './queue';

/** Crate writes that fall back to the offline queue and update the local snapshot either way. */
export interface Outcome {
  item: CrateItem;
  queued: boolean;
}

export const PENDING_PREFIX = 'pending-';
export const isPendingItem = (i: Pick<CrateItem, 'crateItemId'>) =>
  i.crateItemId.startsWith(PENDING_PREFIX);

export async function saveCrateEdit(
  userId: string | null,
  item: CrateItem,
  patch: CrateFields,
): Promise<Outcome> {
  try {
    const updated = await updateCrateItem(item.crateItemId, patch);
    if (userId) cacheCrateItem(userId, updated);
    return { item: updated, queued: false };
  } catch (err) {
    if (!isOfflineError(err)) throw err;
    enqueue({
      kind: 'update_crate_item',
      id: item.crateItemId,
      body: patch,
      idempotencyKey: newId(),
    });
    const updated = { ...item, ...patch } as CrateItem;
    if (userId) cacheCrateItem(userId, updated);
    return { item: updated, queued: true };
  }
}

export async function removeCrateItem(userId: string | null, item: CrateItem) {
  try {
    await deleteCrateItem(item.crateItemId);
    if (userId) uncacheCrateItem(userId, item.crateItemId);
    return { queued: false };
  } catch (err) {
    if (!isOfflineError(err)) throw err;
    enqueue({ kind: 'delete_crate_item', id: item.crateItemId, idempotencyKey: newId() });
    if (userId) uncacheCrateItem(userId, item.crateItemId);
    return { queued: true };
  }
}

export async function acquireItem(
  userId: string | null,
  item: CrateItem,
  body: { storeId: string | null; purchasePriceUsd?: number | null },
  store: { storeId: string; businessName: string } | null,
  acquire = acquireCrateItem,
): Promise<Outcome> {
  try {
    const res = await acquire(item.crateItemId, body);
    if (userId) cacheCrateItem(userId, res.item);
    return { item: res.item, queued: false };
  } catch (err) {
    if (!isOfflineError(err)) throw err;
    enqueue({ kind: 'acquire_crate_item', id: item.crateItemId, body, idempotencyKey: newId() });
    const acquired: CrateItem = {
      ...item,
      listType: 'collection',
      acquiredAt: new Date().toISOString(),
      purchasePriceUsd: body.purchasePriceUsd ?? null,
      purchasedStore: store,
    };
    if (userId) cacheCrateItem(userId, acquired);
    return { item: acquired, queued: true };
  }
}

/**
 * Adds a record; offline, the add is queued under its idempotency key and a
 * placeholder item stands in until the next sync.
 */
export async function addItem(
  userId: string | null,
  body: NewCrateItem,
  record: RecordSummary,
  idempotencyKey: string,
): Promise<Outcome> {
  try {
    const added = await addCrateItem(body, idempotencyKey);
    if (userId) cacheCrateItem(userId, added);
    return { item: added, queued: false };
  } catch (err) {
    if (!isOfflineError(err)) throw err;
    const preview: CrateItem = {
      crateItemId: `${PENDING_PREFIX}${idempotencyKey}`,
      listType: body.listType,
      conditionGrade: body.conditionGrade ?? null,
      specialAttributes: body.specialAttributes ?? [],
      purchasePriceUsd: body.purchasePriceUsd ?? null,
      userNotes: body.userNotes ?? null,
      acquiredAt: body.listType === 'collection' ? new Date().toISOString() : null,
      createdAt: new Date().toISOString(),
      purchasedStore: null,
      record,
    };
    enqueue({ kind: 'add_crate_item', body, idempotencyKey, preview });
    if (userId) cacheCrateItem(userId, preview);
    return { item: preview, queued: true };
  }
}

/** Queued adds for a list, so they stay visible until the server has them. */
export function pendingAdds(list: ListType): CrateItem[] {
  return readQueue()
    .map((e) => (e.action.kind === 'add_crate_item' ? e.action.preview : undefined))
    .filter((p): p is CrateItem => !!p && p.listType === list);
}

export function findCachedItem(userId: string, crateItemId: string): CrateItem | null {
  for (const list of ['collection', 'want_list'] as const) {
    const hit = readCrateCache(userId, list)?.find((i) => i.crateItemId === crateItemId);
    if (hit) return hit;
  }
  return null;
}
