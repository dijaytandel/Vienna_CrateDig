import { apiSend, ApiError, isOfflineError } from '../api/client';
import type { CrateItem } from '../api/crate';

/** Writes made while offline, replayed in order with their idempotency keys. */
export type QueuedAction =
  | { kind: 'report_sighting'; body: unknown; idempotencyKey: string }
  | { kind: 'add_crate_item'; body: unknown; idempotencyKey: string; preview?: CrateItem }
  | { kind: 'update_crate_item'; id: string; body: unknown; idempotencyKey: string }
  | { kind: 'delete_crate_item'; id: string; idempotencyKey: string }
  | { kind: 'acquire_crate_item'; id: string; body: unknown; idempotencyKey: string };

export interface QueueEntry {
  action: QueuedAction;
  queuedAt: string;
  attempts: number;
  lastError?: string;
}

const KEY = 'cratedig.offlineQueue';
export const QUEUE_EVENT = 'cratedig:queue';

export function readQueue(): QueueEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as QueueEntry[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(entries: QueueEntry[]) {
  localStorage.setItem(KEY, JSON.stringify(entries));
  window.dispatchEvent(new Event(QUEUE_EVENT));
}

export function enqueue(action: QueuedAction) {
  const entries = readQueue().filter((e) => e.action.idempotencyKey !== action.idempotencyKey);
  writeQueue([...entries, { action, queuedAt: new Date().toISOString(), attempts: 0 }]);
}

export function discard(idempotencyKey: string) {
  writeQueue(readQueue().filter((e) => e.action.idempotencyKey !== idempotencyKey));
}

/** Drops writes the server rejected, after the user has seen them. */
export function discardFailed() {
  writeQueue(readQueue().filter((e) => !e.lastError));
}

/** Replays whose first attempt already landed before the connection dropped. */
const alreadyApplied = (a: QueuedAction, err: unknown) =>
  err instanceof ApiError &&
  ((a.kind === 'delete_crate_item' && err.status === 404) ||
    (a.kind === 'acquire_crate_item' && err.code === 'NOT_ON_WANT_LIST'));

function send(a: QueuedAction) {
  const opts = { idempotencyKey: a.idempotencyKey };
  switch (a.kind) {
    case 'report_sighting':
      return apiSend('POST', '/sightings', a.body, opts);
    case 'add_crate_item':
      return apiSend('POST', '/crate', a.body, opts);
    case 'update_crate_item':
      return apiSend('PATCH', `/crate/${a.id}`, a.body, opts);
    case 'delete_crate_item':
      return apiSend('DELETE', `/crate/${a.id}`, undefined, opts);
    case 'acquire_crate_item':
      return apiSend('POST', `/crate/${a.id}/acquire`, a.body, opts);
  }
}

let flushing: Promise<{ sent: number; failed: number }> | null = null;

/**
 * Sends queued writes oldest first. Stops at the first network failure; a
 * rejected write (4xx) is kept with its error so the user can see and discard it.
 */
export function flushQueue() {
  flushing ??= (async () => {
    let sent = 0;
    let failed = 0;
    for (const entry of readQueue()) {
      if (entry.lastError) continue;
      try {
        await send(entry.action);
        discard(entry.action.idempotencyKey);
        sent++;
      } catch (err) {
        if (isOfflineError(err)) break;
        if (alreadyApplied(entry.action, err)) {
          discard(entry.action.idempotencyKey);
          sent++;
          continue;
        }
        const retryable = err instanceof ApiError && (err.status >= 500 || err.status === 429);
        writeQueue(
          readQueue().map((e) =>
            e.action.idempotencyKey === entry.action.idempotencyKey
              ? {
                  ...e,
                  attempts: e.attempts + 1,
                  lastError: retryable ? undefined : (err as Error).message,
                }
              : e,
          ),
        );
        failed++;
        if (retryable) break;
      }
    }
    return { sent, failed };
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}
