import { HttpError } from '../middleware/httpError.js';
import type { CatalogProvider, CatalogResult } from './types.js';

export const MAX_RESULTS = 20;
const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 1000;

class TtlCache<T> {
  private entries = new Map<string, { value: T; expires: number }>();
  constructor(private now: () => number) {}

  get(key: string): T | undefined {
    const hit = this.entries.get(key);
    if (!hit) return undefined;
    if (hit.expires <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: T) {
    this.entries.delete(key);
    if (this.entries.size >= MAX_ENTRIES) this.entries.delete(this.entries.keys().next().value!);
    this.entries.set(key, { value, expires: this.now() + TTL_MS });
  }
}

const unavailable = () =>
  new HttpError(503, 'CATALOG_UNAVAILABLE', 'The record catalog is unavailable, try again later');

export function createCatalogService(providers: CatalogProvider[], now: () => number = Date.now) {
  const searches = new TtlCache<CatalogResult[]>(now);
  const records = new TtlCache<CatalogResult>(now);

  return {
    async search(query: string): Promise<CatalogResult[]> {
      const key = query.trim().toLowerCase().replace(/\s+/g, ' ');
      const cached = searches.get(key);
      if (cached) return cached;
      for (const provider of providers) {
        try {
          const results = await provider.search(key, MAX_RESULTS);
          searches.set(key, results);
          for (const r of results) records.set(r.apiSourceId, r);
          return results;
        } catch {
          continue;
        }
      }
      throw unavailable();
    },

    async getById(apiSourceId: string): Promise<CatalogResult | null> {
      const cached = records.get(apiSourceId);
      if (cached) return cached;
      for (const provider of providers) {
        let result: CatalogResult | null;
        try {
          result = await provider.getById(apiSourceId);
        } catch {
          throw unavailable();
        }
        if (result) {
          records.set(apiSourceId, result);
          return result;
        }
      }
      return null;
    },
  };
}

export type CatalogService = ReturnType<typeof createCatalogService>;
