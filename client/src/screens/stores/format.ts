import type { DayHours, DayKey, StoreSighting, StoreSummary } from '../../api/stores';

export const DAYS: { key: DayKey; label: string }[] = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
];

export const CONDITION_LABEL: Record<StoreSighting['conditionGrade'], string> = {
  mint: 'Mint',
  near_mint: 'Near Mint',
  vg_plus: 'VG+',
  vg: 'VG',
  fair: 'Fair',
};

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
export const formatUsd = (n: number) => usd.format(n);

/** "13:30" → "1:30 PM". */
export function formatTime(hhmm: string) {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  const suffix = h % 24 < 12 ? 'AM' : 'PM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${suffix}`;
}

const HHMM = /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/;
const isTime = (v: unknown): v is string => typeof v === 'string' && HHMM.test(v);

/** Store owners write hours JSON directly, so anything that isn't {open, close} in HH:MM reads as closed. */
export function formatHours(slot: DayHours | undefined) {
  if (!slot || typeof slot !== 'object' || !isTime(slot.open) || !isTime(slot.close)) {
    return 'Closed';
  }
  return `${formatTime(slot.open)} – ${formatTime(slot.close)}`;
}

export const formatAddress = (s: StoreSummary) =>
  `${s.streetAddress}, ${s.city}, ${s.state} ${s.zip}`;

export const mapsHref = (s: StoreSummary) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${s.businessName}, ${formatAddress(s)}`,
  )}`;

/** A tel: link for a U.S. number, or null when it isn't a 10-digit NANP number. */
export function telHref(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `tel:+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `tel:+${digits}`;
  return null;
}

export const storeLetter = (name: string) => name.match(/[\p{L}\p{N}]/u)?.[0]?.toUpperCase() ?? '?';
