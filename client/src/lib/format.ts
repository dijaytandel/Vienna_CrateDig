import type { ConditionGrade } from '../api/crate';

export const CONDITIONS: { value: ConditionGrade; label: string }[] = [
  { value: 'mint', label: 'Mint' },
  { value: 'near_mint', label: 'Near Mint' },
  { value: 'vg_plus', label: 'VG+' },
  { value: 'vg', label: 'VG' },
  { value: 'fair', label: 'Fair' },
];

export const ATTRIBUTE_SUGGESTIONS = ['Colored vinyl', '180g', 'First pressing', 'Remaster'];

export const conditionLabel = (grade: ConditionGrade | null | undefined) =>
  CONDITIONS.find((c) => c.value === grade)?.label ?? '—';

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
export const formatUsd = (n: number | null | undefined) => (n == null ? '—' : usd.format(n));

/** Parses a USD amount typed by the user; null for blank, NaN for invalid. */
export function parseUsd(input: string): number | null {
  const t = input.trim().replace(/^\$/, '');
  if (!t) return null;
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(t)) return NaN;
  return Number(t);
}

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export function timeAgo(iso: string, now = Date.now()) {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days < 30 ? `${days}d ago` : formatDate(iso);
}

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () =>
        Math.floor(Math.random() * 16).toString(16),
      );
