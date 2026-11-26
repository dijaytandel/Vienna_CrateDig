import { useSyncExternalStore } from 'react';
import { QUEUE_EVENT, readQueue } from './queue';

const subscribe = (onChange: () => void) => {
  window.addEventListener(QUEUE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(QUEUE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
};

// A string snapshot keeps useSyncExternalStore stable between unchanged reads.
const snapshot = () => {
  const q = readQueue();
  return `${q.filter((e) => !e.lastError).length}|${q.filter((e) => e.lastError).length}`;
};

/** Counts of writes waiting to sync and writes the server rejected. */
export function useQueueCounts() {
  const [pending, failed] = useSyncExternalStore(subscribe, snapshot, () => '0|0')
    .split('|')
    .map(Number);
  return { pending, failed };
}
