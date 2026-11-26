import { Router } from 'express';
import { z } from 'zod';
import { HttpError } from '../middleware/httpError.js';
import type { SearchRepository } from '../search/repository.js';
import { boundingBox, distanceMiles, KM_PER_MI, toUnit } from '../stores/geo.js';
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

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
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
    const hits = (await search.search(q.q ?? '', boundingBox(origin.lat, origin.lng, radiusMiles)))
      .map((h) => ({
        h,
        miles: distanceMiles(origin.lat, origin.lng, h.store.geoLat, h.store.geoLng),
      }))
      .filter(({ miles }) => miles <= radiusMiles);

    // Genres offered by the dropdown come from the keyword matches before the genre filter.
    const genres = [...new Set(hits.map(({ h }) => h.record.genre).filter((g) => !!g))].sort(
      (a, b) => a!.localeCompare(b!),
    ) as string[];
    const wanted = q.genre ? fold(q.genre) : null;

    const results = hits
      .filter(({ h }) => !wanted || (h.record.genre && fold(h.record.genre) === wanted))
      .sort(
        (a, b) => a.miles - b.miles || b.h.sightingTimestamp.localeCompare(a.h.sightingTimestamp),
      )
      .map(({ h, miles }) => ({ ...h, distance: round1(toUnit(miles, q.unit)) }));

    res.json({ origin, unit: q.unit, radius: q.radius, genres, results });
  });

  return router;
}
