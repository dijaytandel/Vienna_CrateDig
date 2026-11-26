import { describe, expect, it, vi } from 'vitest';
import { discogsProvider, musicBrainzProvider, UpstreamError } from './providers.js';

const json = (body: unknown, status = 200) =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));

describe('discogsProvider', () => {
  it('normalises search results and keeps the token server-side', async () => {
    const fetchFn = json({
      results: [
        {
          id: 249504,
          title: 'Nirvana (2) - Nevermind',
          year: '1991',
          label: ['DGC'],
          genre: ['Rock'],
          cover_image: 'https://i.discogs.com/n.jpg',
        },
        { id: 1, title: 'Unknown', year: '', cover_image: 'https://s.discogs.com/spacer.gif' },
        { id: 2, title: 'Miles Davis - Kind Of Blue', year: '0', cover_image: 'x/spacer.gif' },
      ],
    });
    const results = await discogsProvider('tok', fetchFn).search('nevermind', 20);

    expect(results).toEqual([
      {
        apiSourceId: 'discogs:249504',
        artistName: 'Nirvana',
        albumTitle: 'Nevermind',
        songTitle: null,
        recordLabel: 'DGC',
        releaseYear: 1991,
        genre: 'Rock',
        coverArtUrl: 'https://i.discogs.com/n.jpg',
      },
      expect.objectContaining({ apiSourceId: 'discogs:2', releaseYear: null, coverArtUrl: null }),
    ]);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toContain('q=nevermind');
    expect(url).toContain('format=Vinyl');
    expect(init.headers.Authorization).toBe('Discogs token=tok');
  });

  it('throws on rate limiting and when no token is configured', async () => {
    await expect(discogsProvider('tok', json({}, 429)).search('abc', 20)).rejects.toThrow(
      UpstreamError,
    );
    await expect(discogsProvider(undefined, json({})).search('abc', 20)).rejects.toThrow(
      UpstreamError,
    );
  });

  it('keeps every credited artist on a direct lookup', async () => {
    const fetchFn = json({
      title: 'Watch The Throne',
      artists: [
        { name: 'Jay-Z', join: '&' },
        { name: 'Kanye West (2)', join: ',' },
        { name: 'Frank Ocean', join: '' },
      ],
    });
    const r = await discogsProvider('tok', fetchFn).getById('discogs:3109130');
    expect(r?.artistName).toBe('Jay-Z & Kanye West, Frank Ocean');
  });

  it('skips tracklist headings when picking the key track', async () => {
    const fetchFn = json({
      title: 'Album',
      artists: [{ name: 'Artist' }],
      tracklist: [
        { type_: 'heading', title: 'Side A' },
        {
          type_: 'index',
          title: 'Symphony No. 5',
          sub_tracks: [{ type_: 'track', title: 'I. Allegro' }],
        },
        { type_: 'track', title: 'Encore' },
      ],
    });
    const r = await discogsProvider('tok', fetchFn).getById('discogs:1');
    expect(r?.songTitle).toBe('I. Allegro');
  });

  it('rejects zero-padded ids', async () => {
    const fetchFn = json({});
    expect(await discogsProvider('tok', fetchFn).getById('discogs:0249504')).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('ignores ids from other providers', async () => {
    const fetchFn = json({});
    expect(await discogsProvider('tok', fetchFn).getById('musicbrainz:x')).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('musicBrainzProvider', () => {
  const mbid = 'b84ee12a-09ef-421b-82de-0441a926375b';

  it('normalises search results', async () => {
    const fetchFn = json({
      releases: [
        {
          id: mbid,
          title: 'Watch the Throne',
          date: '2011-08-08',
          'artist-credit': [{ name: 'JAY-Z', joinphrase: ' & ' }, { name: 'Kanye West' }],
          'label-info': [{ label: { name: 'Roc-A-Fella' } }],
        },
      ],
    });
    expect(await musicBrainzProvider(fetchFn).search('throne', 20)).toEqual([
      {
        apiSourceId: `musicbrainz:${mbid}`,
        artistName: 'JAY-Z & Kanye West',
        albumTitle: 'Watch the Throne',
        songTitle: null,
        recordLabel: 'Roc-A-Fella',
        releaseYear: 2011,
        genre: null,
        coverArtUrl: null,
      },
    ]);
  });

  it('limits search to vinyl and escapes query syntax', async () => {
    const fetchFn = json({ releases: [] });
    await musicBrainzProvider(fetchFn).search('ac/dc: back', 20);
    const query = new URL(fetchFn.mock.calls[0][0]).searchParams.get('query');
    expect(query).toBe(
      '(ac\\/dc\\: back) AND (format:"vinyl" OR format:"12\\" vinyl" OR format:"7\\" vinyl" OR format:"10\\" vinyl")',
    );
  });

  it('returns null for an unknown release', async () => {
    expect(await musicBrainzProvider(json({}, 404)).getById(`musicbrainz:${mbid}`)).toBeNull();
  });
});
