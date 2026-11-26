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

  it('returns null for an unknown release', async () => {
    expect(await musicBrainzProvider(json({}, 404)).getById(`musicbrainz:${mbid}`)).toBeNull();
  });
});
