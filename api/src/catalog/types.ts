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

export interface CatalogProvider {
  readonly name: string;
  search(query: string, limit: number): Promise<CatalogResult[]>;
  /** Returns null when the provider does not own this id. */
  getById(apiSourceId: string): Promise<CatalogResult | null>;
}

export type FetchFn = typeof fetch;
