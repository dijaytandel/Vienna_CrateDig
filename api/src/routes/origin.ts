import { z } from 'zod';
import { HttpError } from '../middleware/httpError.js';

export const RADII = [5, 10, 25] as const;

const blankAsUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
export const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(blankAsUndefined, schema.optional());

/** `lat`+`lng` or `zip`, both optional; pair with `resolveOrigin`. */
export const originFields = {
  lat: optional(z.coerce.number().min(-90).max(90)),
  lng: optional(z.coerce.number().min(-180).max(180)),
  zip: optional(z.string().regex(/^\d{5}$/, 'Must be a 5-digit ZIP')),
};

export const radiusField = z.coerce
  .number()
  .refine((r) => (RADII as readonly number[]).includes(r), 'Must be 5, 10 or 25')
  .default(10);

export interface Origin {
  lat: number;
  lng: number;
  source: 'coordinates' | 'zip';
}

/** Coordinates win over ZIP; null when neither was given. */
export async function resolveOrigin(
  q: { lat?: number; lng?: number; zip?: string },
  zipCentroid: (zip: string) => Promise<{ lat: number; lng: number } | null>,
): Promise<Origin | null> {
  if (q.lat !== undefined && q.lng !== undefined) {
    return { lat: q.lat, lng: q.lng, source: 'coordinates' };
  }
  if (q.lat !== undefined || q.lng !== undefined) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Provide both lat and lng');
  }
  if (!q.zip) return null;
  const centroid = await zipCentroid(q.zip);
  if (!centroid) throw new HttpError(404, 'ZIP_NOT_FOUND', `No location for ZIP ${q.zip}`);
  return { ...centroid, source: 'zip' };
}
