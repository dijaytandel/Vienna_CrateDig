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
import { enqueue, flushQueue, hasPendingWrites, queueFor } from './queue';

/** Crate writes that fall back to the offline queue and update the local snapshot either way. */
export interface Outcome {
  item: CrateItem;
  queued: boolean;
}

export const PENDING_PREFIX = 'pending-';
export const isPendingItem = (i: Pick<CrateItem, 'crateItemId'>) =>
  i.crateItemId.startsWith(PENDING_PREFIX);

/**
 * Sends a write now, or queues it when offline. While older writes are still
 * queued, the new one joins the back of the queue so replays keep their order.
 */
async function sendOrQueue<T>(
  userId: string | null,
  send: () => Promise<T>,
  queue: (owner: string) => void,
): Promise<{ result: T; queued: false } | { queued: true }> {
  if (userId && hasPendingWrites(userId)) {
    queue(userId);
    if (navigator.onLine) void flushQueue(userId);
    return { queued: true };
  }
  try {
    return { result: await send(), queued: false };
  } catch (err) {
    if (!userId || !isOfflineError(err)) throw err;
    queue(userId);
    return { queued: true };
  }
}

export async function saveCrateEdit(
  userId: string | null,
  item: CrateItem,
  patch: CrateFields,
): Promise<Outcome> {
  const out = await sendOrQueue(
    userId,
    () => updateCrateItem(item.crateItemId, patch),
    (owner) =>
      enqueue(
        { kind: 'update_crate_item', id: item.crateItemId, body: patch, idempotencyKey: newId() },
        owner,
      ),
  );
  const updated = out.queued ? ({ ...item, ...patch } as CrateItem) : out.result;
  if (userId) cacheCrateItem(userId, updated);
  return { item: updated, queued: out.queued };
}

export async function removeCrateItem(userId: string | null, item: CrateItem) {
  const out = await sendOrQueue(
    userId,
    () => deleteCrateItem(item.crateItemId),
    (owner) =>
      enqueue({ kind: 'delete_crate_item', id: item.crateItemId, idempotencyKey: newId() }, owner),
  );
  if (userId) uncacheCrateItem(userId, item.crateItemId);
  return { queued: out.queued };
}

export async function acquireItem(
  userId: string | null,
  item: CrateItem,
  body: { storeId: string | null; purchasePriceUsd?: number | null },
  store: { storeId: string; businessName: string } | null,
  acquire = acquireCrateItem,
): Promise<Outcome> {
  const out = await sendOrQueue(
    userId,
    () => acquire(item.crateItemId, body),
    (owner) =>
      enqueue(
        { kind: 'acquire_crate_item', id: item.crateItemId, body, idempotencyKey: newId() },
        owner,
      ),
  );
  if (!out.queued) {
    if (userId) cacheCrateItem(userId, out.result.item);
    return { item: out.result.item, queued: false };
  }
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
    if (!userId || !isOfflineError(err)) throw err;
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
    enqueue({ kind: 'add_crate_item', body, idempotencyKey, preview }, userId);
    cacheCrateItem(userId, preview);
    return { item: preview, queued: true };
  }
}

/** Queued adds for a list, so they stay visible until the server has them. */
export function pendingAdds(owner: string, list: ListType): CrateItem[] {
  return queueFor(owner)
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
