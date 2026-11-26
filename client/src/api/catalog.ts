import { apiGet } from './client';

export interface CatalogResult {
  apiSourceId: string;
  artistName: string;
  albumTitle: string;
  songTitle: string | null;
  recordLabel: string | null;
  releaseYear: number | null;
  genre: string | null;
  coverArtUrl: string | null;
}

export const searchCatalog = (q: string, signal?: AbortSignal) =>
  apiGet<{ results: CatalogResult[] }>(`/catalog/search?q=${encodeURIComponent(q)}`, signal);
