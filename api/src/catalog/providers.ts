import type { CatalogProvider, CatalogResult, FetchFn } from './types.js';

const USER_AGENT = 'CrateDig/1.0 (+https://github.com/dijaytandel/Vienna_CrateDig)';
const TIMEOUT_MS = 5000;

export class UpstreamError extends Error {
  constructor(
    readonly provider: string,
    readonly status?: number,
  ) {
    super(`${provider} request failed${status ? ` with ${status}` : ''}`);
  }
}

async function getJson(provider: string, fetchFn: FetchFn, url: string, headers = {}) {
  let res: Response;
  try {
    res = await fetchFn(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...headers },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new UpstreamError(provider);
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new UpstreamError(provider, res.status);
  return res.json();
}

const year = (v: unknown): number | null => {
  const n = Number.parseInt(String(v ?? ''), 10);
  return n >= 1900 && n <= 2100 ? n : null;
};

const httpUrl = (v: unknown): string | null =>
  typeof v === 'string' && /^https?:\/\//.test(v) && !v.endsWith('spacer.gif') ? v : null;

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Discogs suffixes duplicate artist names with " (2)". */
const discogsArtist = (name: string) => name.replace(/\s\(\d+\)$/, '');

const discogsCredit = (artists: { name: string; join?: string }[]) =>
  artists
    .map((a, i) => {
      if (i === artists.length - 1) return discogsArtist(a.name);
      const join = a.join?.trim();
      return discogsArtist(a.name) + (!join || join === ',' ? ', ' : ` ${join} `);
    })
    .join('');

/** MusicBrainz indexes sized pressings ("12\" Vinyl") separately from generic "Vinyl". */
const MB_VINYL = ['vinyl', '12\\" vinyl', '7\\" vinyl', '10\\" vinyl']
  .map((f) => `format:"${f}"`)
  .join(' OR ');

const escapeLucene = (q: string) => q.replace(/([+\-&|!(){}[\]^"~*?:\\/])/g, '\\$1');

export function discogsProvider(token: string | undefined, fetchFn: FetchFn = fetch) {
  const base = 'https://api.discogs.com';
  const name = 'discogs';
  const auth = token ? { Authorization: `Discogs token=${token}` } : {};

  return {
    name,
    async search(query, limit) {
      if (!token) throw new UpstreamError(name);
      const params = new URLSearchParams({
        q: query,
        type: 'release',
        format: 'Vinyl',
        per_page: String(limit),
      });
      const body = await getJson(name, fetchFn, `${base}/database/search?${params}`, auth);
      return (body?.results ?? []).slice(0, limit).flatMap((r: Record<string, unknown>) => {
        const [artist, ...album] = String(r.title ?? '').split(' - ');
        if (!artist || album.length === 0) return [];
        return [
          {
            apiSourceId: `discogs:${r.id}`,
            artistName: discogsArtist(artist),
            albumTitle: album.join(' - '),
            songTitle: null,
            recordLabel: text((r.label as unknown[])?.[0]),
            releaseYear: year(r.year),
            genre: text((r.genre as unknown[])?.[0]),
            coverArtUrl: httpUrl(r.cover_image),
          },
        ];
      });
    },
    async getById(apiSourceId) {
      const id = /^discogs:([1-9]\d*)$/.exec(apiSourceId)?.[1];
      if (!id) return null;
      const r = await getJson(name, fetchFn, `${base}/releases/${id}`, auth);
      if (!r?.title || !r.artists?.[0]?.name) return null;
      return {
        apiSourceId,
        artistName: discogsCredit(r.artists),
        albumTitle: r.title,
        songTitle: text(
          (r.tracklist as { type_?: string; title?: unknown }[] | undefined)?.find(
            (t) => (t.type_ ?? 'track') === 'track',
          )?.title,
        ),
        recordLabel: text(r.labels?.[0]?.name),
        releaseYear: year(r.year),
        genre: text(r.genres?.[0]),
        coverArtUrl: httpUrl(r.images?.[0]?.uri),
      };
    },
  } satisfies CatalogProvider;
}

interface MbRelease {
  id: string;
  title?: string;
  date?: string;
  'artist-credit'?: { name: string; joinphrase?: string }[];
  'label-info'?: { label?: { name?: string } }[];
  media?: { tracks?: { title?: string }[] }[];
}

function fromMusicBrainz(r: MbRelease): CatalogResult | null {
  const artist = (r['artist-credit'] ?? []).map((c) => c.name + (c.joinphrase ?? '')).join('');
  if (!r.title || !artist) return null;
  return {
    apiSourceId: `musicbrainz:${r.id}`,
    artistName: artist,
    albumTitle: r.title,
    songTitle: text(r.media?.[0]?.tracks?.[0]?.title),
    recordLabel: text(r['label-info']?.[0]?.label?.name),
    releaseYear: year(r.date?.slice(0, 4)),
    genre: null,
    coverArtUrl: null,
  };
}

export function musicBrainzProvider(fetchFn: FetchFn = fetch) {
  const base = 'https://musicbrainz.org/ws/2';
  const name = 'musicbrainz';

  return {
    name,
    async search(query, limit) {
      const params = new URLSearchParams({
        query: `(${escapeLucene(query)}) AND (${MB_VINYL})`,
        fmt: 'json',
        limit: String(limit),
      });
      const body = await getJson(name, fetchFn, `${base}/release?${params}`);
      return ((body?.releases ?? []) as MbRelease[])
        .slice(0, limit)
        .map(fromMusicBrainz)
        .filter((r): r is CatalogResult => r !== null);
    },
    async getById(apiSourceId) {
      const id = /^musicbrainz:([0-9a-f-]{36})$/.exec(apiSourceId)?.[1];
      if (!id) return null;
      const params = new URLSearchParams({ inc: 'artist-credits+labels+recordings', fmt: 'json' });
      const r = await getJson(name, fetchFn, `${base}/release/${id}?${params}`);
      return r ? fromMusicBrainz(r) : null;
    },
  } satisfies CatalogProvider;
}
