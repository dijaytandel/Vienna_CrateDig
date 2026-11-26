import { Router } from 'express';
import { z } from 'zod';
import { HttpError } from '../middleware/httpError.js';
import type { SearchRepository } from '../search/repository.js';
import { KM_PER_MI, toUnit } from '../stores/geo.js';
import type { StoreRepository } from '../stores/repository.js';
import { optional, originFields, radiusField, resolveOrigin } from './origin.js';
import { parse } from './parse.js';

const query = z.object({
  q: optional(z.string().trim().max(100)),
  genre: optional(z.string().trim().max(60)),
  radius: radiusField,
  unit: z.enum(['mi', 'km']).default('mi'),
  ...originFields,
});

const round1 = (n: number) => Math.round(n * 10) / 10;

export function searchRouter(search?: SearchRepository, stores?: StoreRepository) {
  const router = Router();

  router.get('/', async (req, res) => {
    const q = parse(query, req.query);
    if (!search || !stores) {
      throw new HttpError(503, 'DATABASE_UNAVAILABLE', 'The database is not configured');
    }
    const origin = await resolveOrigin(q, (zip) => stores.zipCentroid(zip));
    if (!origin) {
      throw new HttpError(400, 'LOCATION_REQUIRED', 'Provide lat and lng, or a 5-digit zip');
    }

    const radiusMiles = q.unit === 'km' ? q.radius / KM_PER_MI : q.radius;
    const base = { q: q.q ?? '', lat: origin.lat, lng: origin.lng, radiusMiles };
    const [hits, genres] = await Promise.all([
      search.search({ ...base, genre: q.genre ?? null }),
      search.genres({ ...base, genre: null }),
    ]);
    const results = hits.map(({ distanceMiles, ...h }) => ({
      ...h,
      distance: round1(toUnit(distanceMiles, q.unit)),
    }));

    res.json({ origin, unit: q.unit, radius: q.radius, genres, results });
  });

  return router;
}
