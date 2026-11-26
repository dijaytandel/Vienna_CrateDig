import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import type { MasterRecordRepository } from '../catalog/repository.js';
import { createCatalogService } from '../catalog/service.js';
import type { CatalogProvider, CatalogResult } from '../catalog/types.js';

const nevermind: CatalogResult = {
  apiSourceId: 'discogs:249504',
  artistName: 'Nirvana',
  albumTitle: 'Nevermind',
  songTitle: null,
  recordLabel: 'DGC',
  releaseYear: 1991,
  genre: 'Rock',
  coverArtUrl: null,
};

function setup() {
  const upstream: CatalogProvider = {
    name: 'mock',
    search: vi.fn(async () => Array.from({ length: 20 }, () => nevermind)),
    getById: vi.fn(async (id: string) => (id === nevermind.apiSourceId ? nevermind : null)),
  };
  const rows = new Map<string, string>();
  const records: MasterRecordRepository = {
    upsert: vi.fn(async (r: CatalogResult) => {
      if (!rows.has(r.apiSourceId)) rows.set(r.apiSourceId, `uuid-${rows.size + 1}`);
      return rows.get(r.apiSourceId)!;
    }),
  };
  const app = createApp({ catalog: createCatalogService([upstream]), records });
  return { app, rows };
}

describe('GET /api/v1/catalog/search', () => {
  it('returns at most 20 normalised results', async () => {
    const res = await request(setup().app).get('/api/v1/catalog/search?q=nevermind');
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(20);
    expect(res.body.results[0]).toEqual(nevermind);
  });

  it('rejects queries shorter than 2 characters', async () => {
    const res = await request(setup().app).get('/api/v1/catalog/search?q=%20a%20');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 503 CATALOG_UNAVAILABLE when every provider fails', async () => {
    const failing: CatalogProvider = {
      name: 'down',
      search: async () => {
        throw new Error('down');
      },
      getById: async () => null,
    };
    const app = createApp({ catalog: createCatalogService([failing]) });
    const res = await request(app).get('/api/v1/catalog/search?q=abc');
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('CATALOG_UNAVAILABLE');
  });
});

describe('POST /api/v1/catalog/records', () => {
  it('upserts one master record per apiSourceId', async () => {
    const { app, rows } = setup();
    const first = await request(app)
      .post('/api/v1/catalog/records')
      .send({ apiSourceId: 'discogs:249504' });
    const second = await request(app)
      .post('/api/v1/catalog/records')
      .send({ apiSourceId: 'discogs:249504' });
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ recordId: 'uuid-1', ...nevermind });
    expect(second.body.recordId).toBe('uuid-1');
    expect(rows.size).toBe(1);
  });

  it('returns 404 for an unknown id and 400 for a malformed one', async () => {
    const { app } = setup();
    const missing = await request(app)
      .post('/api/v1/catalog/records')
      .send({ apiSourceId: 'discogs:1' });
    const bad = await request(app).post('/api/v1/catalog/records').send({ apiSourceId: 'x' });
    const padded = await request(app)
      .post('/api/v1/catalog/records')
      .send({ apiSourceId: 'discogs:0249504' });
    expect(missing.status).toBe(404);
    expect(bad.status).toBe(400);
    expect(padded.status).toBe(400);
  });
});
