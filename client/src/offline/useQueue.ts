import { useCallback, useSyncExternalStore } from 'react';
import { QUEUE_EVENT, queueFor } from './queue';

const subscribe = (onChange: () => void) => {
  window.addEventListener(QUEUE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(QUEUE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
};

/** Counts of the account's writes waiting to sync and writes the server rejected. */
export function useQueueCounts(owner: string | null) {
  // A string snapshot keeps useSyncExternalStore stable between unchanged reads.
  const snapshot = useCallback(() => {
    const q = owner ? queueFor(owner) : [];
    return `${q.filter((e) => !e.lastError).length}|${q.filter((e) => e.lastError).length}`;
  }, [owner]);
  const [pending, failed] = useSyncExternalStore(subscribe, snapshot, () => '0|0')
    .split('|')
    .map(Number);
  return { pending, failed };
}
