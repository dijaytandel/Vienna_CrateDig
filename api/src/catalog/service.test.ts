import { describe, expect, it, vi } from 'vitest';
import { createCatalogService } from './service.js';
import type { CatalogProvider, CatalogResult } from './types.js';

const record = (apiSourceId: string): CatalogResult => ({
  apiSourceId,
  artistName: 'Artist',
  albumTitle: 'Album',
  songTitle: null,
  recordLabel: null,
  releaseYear: null,
  genre: null,
  coverArtUrl: null,
});

const provider = (name: string, results: CatalogResult[] | Error): CatalogProvider => ({
  name,
  search: vi.fn(async () => {
    if (results instanceof Error) throw results;
    return results;
  }),
  getById: vi.fn(async () => null),
});

describe('createCatalogService', () => {
  it('falls back to the next provider when the first fails', async () => {
    const discogs = provider('discogs', new Error('429'));
    const mb = provider('musicbrainz', [record('musicbrainz:1')]);
    const results = await createCatalogService([discogs, mb]).search('Kind of Blue');
    expect(results.map((r) => r.apiSourceId)).toEqual(['musicbrainz:1']);
  });

  it('throws 503 CATALOG_UNAVAILABLE when every provider fails', async () => {
    const service = createCatalogService([provider('a', new Error()), provider('b', new Error())]);
    await expect(service.search('abc')).rejects.toMatchObject({
      status: 503,
      code: 'CATALOG_UNAVAILABLE',
    });
  });

  it('serves identical queries from cache for 24 hours', async () => {
    let now = 0;
    const discogs = provider('discogs', [record('discogs:1')]);
    const service = createCatalogService([discogs], () => now);

    await service.search('Blue Train');
    now += 23 * 60 * 60 * 1000;
    await service.search('  blue   TRAIN ');
    expect(discogs.search).toHaveBeenCalledTimes(1);

    now += 2 * 60 * 60 * 1000;
    await service.search('blue train');
    expect(discogs.search).toHaveBeenCalledTimes(2);
  });

  it('resolves ids from recent search results without another upstream call', async () => {
    const discogs = provider('discogs', [record('discogs:7')]);
    const service = createCatalogService([discogs]);
    await service.search('abc');
    expect(await service.getById('discogs:7')).toEqual(record('discogs:7'));
    expect(discogs.getById).not.toHaveBeenCalled();
  });
});
