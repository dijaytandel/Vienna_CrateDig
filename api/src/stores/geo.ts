export type Unit = 'mi' | 'km';
export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type OperatingHours = Partial<Record<DayKey, { open: string; close: string } | null>>;

const EARTH_RADIUS_MI = 3958.8;
export const KM_PER_MI = 1.609344;

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle (haversine) distance in miles. */
export function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number) {
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.min(1, Math.sqrt(a)));
}

export const toUnit = (miles: number, unit: Unit) => (unit === 'km' ? miles * KM_PER_MI : miles);

/** A lat/lng box that contains every point within `miles` of the origin (with a small margin). */
export function boundingBox(lat: number, lng: number, miles: number) {
  const dLat = (miles / 69) * 1.01;
  const dLng = Math.min(180, dLat / Math.max(Math.cos(rad(lat)), 0.01));
  return { minLat: lat - dLat, maxLat: lat + dLat, minLng: lng - dLng, maxLng: lng + dLng };
}

// Stores have no time-zone column; use the zone most of each state is in.
const STATE_TIME_ZONES: Record<string, string> = {
  AK: 'America/Anchorage',
  AL: 'America/Chicago',
  AR: 'America/Chicago',
  AZ: 'America/Phoenix',
  CA: 'America/Los_Angeles',
  CO: 'America/Denver',
  HI: 'Pacific/Honolulu',
  IA: 'America/Chicago',
  ID: 'America/Boise',
  IL: 'America/Chicago',
  IN: 'America/Indiana/Indianapolis',
  KS: 'America/Chicago',
  KY: 'America/New_York',
  LA: 'America/Chicago',
  MN: 'America/Chicago',
  MO: 'America/Chicago',
  MS: 'America/Chicago',
  MT: 'America/Denver',
  ND: 'America/Chicago',
  NE: 'America/Chicago',
  NM: 'America/Denver',
  NV: 'America/Los_Angeles',
  OK: 'America/Chicago',
  OR: 'America/Los_Angeles',
  SD: 'America/Chicago',
  TN: 'America/Chicago',
  TX: 'America/Chicago',
  UT: 'America/Denver',
  WA: 'America/Los_Angeles',
  WI: 'America/Chicago',
  WY: 'America/Denver',
  PR: 'America/Puerto_Rico',
  VI: 'America/St_Thomas',
  GU: 'Pacific/Guam',
  AS: 'Pacific/Pago_Pago',
  MP: 'Pacific/Saipan',
};

export const timeZoneForState = (state: string) => STATE_TIME_ZONES[state] ?? 'America/New_York';

const DAYS: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function toMinutes(hhmm: unknown) {
  const m = typeof hhmm === 'string' ? /^([01]\d|2[0-4]):([0-5]\d)$/.exec(hhmm) : null;
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function window(hours: OperatingHours, day: DayKey) {
  const slot = hours[day];
  const open = toMinutes(slot?.open);
  const close = toMinutes(slot?.close);
  return open === null || close === null ? null : { open, close };
}

/** Whether the store is open at `now` in its local time; a close at or before the open time runs past midnight. */
export function isOpenNow(hours: OperatingHours, timeZone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const dayIndex = WEEKDAY_INDEX[get('weekday')]!;
  const minute = Number(get('hour')) * 60 + Number(get('minute'));

  const today = window(hours, DAYS[dayIndex]!);
  if (today) {
    const overnight = today.close <= today.open;
    if (minute >= today.open && (overnight || minute < today.close)) return true;
  }
  const yesterday = window(hours, DAYS[(dayIndex + 6) % 7]!);
  return !!yesterday && yesterday.close <= yesterday.open && minute < yesterday.close;
}
