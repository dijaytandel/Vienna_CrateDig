import { Router } from 'express';
import { z } from 'zod';
import type { AuthService } from '../auth/service.js';
import type { MasterRecordRepository } from '../catalog/repository.js';
import type { CatalogService } from '../catalog/service.js';
import type { CrateRepository } from '../crate/repository.js';
import { currentUser, requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/httpError.js';
import { optional } from './origin.js';
import { parse } from './parse.js';

const listType = z.enum(['collection', 'want_list']);
const grade = z.enum(['mint', 'near_mint', 'vg_plus', 'vg', 'fair']);
const price = z
  .number()
  .min(0)
  .max(999999.99)
  .refine(
    (n) => Math.round(n * 100) === n * 100 || Number(n.toFixed(2)) === n,
    'At most 2 decimals',
  );
const attributes = z.array(z.string().trim().min(1).max(40)).max(10);
const notes = z.string().max(1000);

const listQuery = z.object({
  listType: optional(listType),
  q: optional(z.string().trim().max(200)),
  genre: optional(z.string().trim().max(60)),
  recordId: optional(z.string().uuid()),
});

const createBody = z
  .object({
    apiSourceId: z
      .string()
      .regex(/^(discogs:[1-9]\d*|musicbrainz:[0-9a-f-]{36})$/)
      .optional(),
    recordId: z.string().uuid().optional(),
    listType,
    conditionGrade: grade.nullish(),
    specialAttributes: attributes.optional(),
    purchasePriceUsd: price.nullish(),
    userNotes: notes.nullish(),
    force: z.boolean().optional(),
  })
  .refine((b) => Boolean(b.apiSourceId) !== Boolean(b.recordId), {
    message: 'Provide either apiSourceId or recordId',
    path: ['apiSourceId'],
  });

const patchBody = z
  .object({
    conditionGrade: grade.nullable(),
    specialAttributes: attributes,
    purchasePriceUsd: price.nullable(),
    userNotes: notes.nullable(),
  })
  .partial()
  .refine((b) => Object.keys(b).length > 0, 'Nothing to update');

const acquireBody = z.object({
  storeId: z.string().uuid().nullable(),
  purchasePriceUsd: price.nullish(),
});

const idParam = z.object({ id: z.string().uuid() });
const idempotencyKey = z.string().uuid().optional();

export function crateRouter(
  crate: CrateRepository | undefined,
  catalog: CatalogService,
  records: MasterRecordRepository | undefined,
  auth?: AuthService,
) {
  const router = Router();
  router.use(requireAuth(auth));
  const repo = () => {
    if (!crate) throw new HttpError(503, 'DATABASE_UNAVAILABLE', 'The database is not configured');
    return crate;
  };
  const notFound = () => new HttpError(404, 'NOT_FOUND', 'No such crate item');

  router.get('/', async (req, res) => {
    const filter = parse(listQuery, req.query);
    res.json({ items: await repo().list(currentUser(res).id, filter) });
  });

  router.get('/:id', async (req, res) => {
    const { id } = parse(idParam, req.params);
    const item = await repo().get(currentUser(res).id, id);
    if (!item) throw notFound();
    res.json(item);
  });

  router.post('/', async (req, res) => {
    const body = parse(createBody, req.body);
    const clientRef = parse(idempotencyKey, req.get('idempotency-key') || undefined);
    const db = repo();
    const userId = currentUser(res).id;
    if (clientRef) {
      const existing = await db.byClientRef(userId, clientRef);
      if (existing) {
        res.status(200).json(existing);
        return;
      }
    }
    let recordId = body.recordId;
    if (body.apiSourceId) {
      if (!records) {
        throw new HttpError(503, 'DATABASE_UNAVAILABLE', 'The database is not configured');
      }
      const record = await catalog.getById(body.apiSourceId);
      if (!record) throw new HttpError(404, 'NOT_FOUND', `No catalog record ${body.apiSourceId}`);
      recordId = await records.upsert(record);
    }
    if (!recordId) throw new HttpError(400, 'VALIDATION_ERROR', 'Provide apiSourceId or recordId');

    if (await db.hasRecord(userId, recordId, body.listType)) {
      if (body.listType === 'want_list') {
        throw new HttpError(
          409,
          'ALREADY_ON_WANT_LIST',
          'This record is already on your Want List',
        );
      }
      if (!body.force) {
        throw new HttpError(409, 'ALREADY_OWNED', 'You already own this record', { recordId });
      }
    }
    const item = await db.insert(userId, {
      recordId,
      listType: body.listType,
      conditionGrade: body.conditionGrade ?? null,
      specialAttributes: body.specialAttributes ?? [],
      purchasePriceUsd: body.purchasePriceUsd ?? null,
      userNotes: body.userNotes ?? null,
      clientRef,
    });
    res.status(201).json(item);
  });

  router.patch('/:id', async (req, res) => {
    const { id } = parse(idParam, req.params);
    const patch = parse(patchBody, req.body);
    const item = await repo().update(currentUser(res).id, id, patch);
    if (!item) throw notFound();
    res.json(item);
  });

  router.delete('/:id', async (req, res) => {
    const { id } = parse(idParam, req.params);
    if (!(await repo().remove(currentUser(res).id, id))) throw notFound();
    res.status(204).end();
  });

  router.post('/:id/acquire', async (req, res) => {
    const { id } = parse(idParam, req.params);
    const body = parse(acquireBody, req.body);
    const result = await repo().acquire(
      currentUser(res).id,
      id,
      body.storeId,
      body.purchasePriceUsd ?? null,
    );
    if (!result.ok) {
      if (result.reason === 'not_found') throw notFound();
      if (result.reason === 'store_not_found') {
        throw new HttpError(422, 'STORE_NOT_FOUND', 'No such store');
      }
      throw new HttpError(409, 'NOT_ON_WANT_LIST', 'Only Want List items can be acquired');
    }
    res.json({ item: result.item, closedSightingIds: result.closedSightingIds });
  });

  return router;
}
