import { Router } from 'express';
import { z } from 'zod';
import type { AuthService } from '../auth/service.js';
import type { MasterRecordRepository } from '../catalog/repository.js';
import type { CatalogService } from '../catalog/service.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/httpError.js';

const searchQuery = z.object({ q: z.string().trim().min(2).max(200) });
const recordBody = z.object({
  apiSourceId: z.string().regex(/^(discogs:[1-9]\d*|musicbrainz:[0-9a-f-]{36})$/),
});

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Request is invalid', {
      issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  return result.data;
}

export function catalogRouter(
  catalog: CatalogService,
  records?: MasterRecordRepository,
  auth?: AuthService,
) {
  const router = Router();

  router.get('/search', async (req, res) => {
    const { q } = parse(searchQuery, req.query);
    res.json({ results: await catalog.search(q) });
  });

  router.post('/records', requireAuth(auth), async (req, res) => {
    const { apiSourceId } = parse(recordBody, req.body);
    if (!records) {
      throw new HttpError(503, 'DATABASE_UNAVAILABLE', 'The database is not configured');
    }
    const record = await catalog.getById(apiSourceId);
    if (!record) throw new HttpError(404, 'NOT_FOUND', `No catalog record ${apiSourceId}`);
    res.json({ recordId: await records.upsert(record), ...record });
  });

  return router;
}
