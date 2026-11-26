import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_ROUTES } from '../../app/router';
import type { AvatarUser } from '../../components/AvatarMenu';
import { FakeAuth } from '../../test/auth';

const MANAGER: AvatarUser = { displayName: 'Mo Manager', role: 'store_manager' };
const STORE = '00000000-0000-4000-8000-000000000001';
const REC = '00000000-0000-4000-b000-000000000001';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

let fetchMock: ReturnType<typeof vi.fn>;
let history: unknown[];

beforeEach(() => {
  history = [
    {
      broadcastId: 'b2',
      arrivalSummary: 'Newest crate',
      photoUrl: null,
      featuredIds: ['x', 'y'],
      postedAt: new Date(Date.now() - 3_600_000).toISOString(),
    },
    {
      broadcastId: 'b1',
      arrivalSummary: 'Older crate',
      photoUrl: null,
      featuredIds: [],
      postedAt: new Date(Date.now() - 86_400_000 * 2).toISOString(),
    },
  ];
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/merchant/broadcasts')) return json({ storeId: STORE, broadcasts: history });
    if (url.includes(`/stores/${STORE}`)) {
      return json({
        storeId: STORE,
        businessName: 'Low End Theory',
        isVerified: true,
        streetAddress: '1 Main St',
        city: 'Portland',
        state: 'OR',
        zip: '97205',
      });
    }
    if (url.includes('/catalog/search')) {
      return json({
        results: [
          {
            apiSourceId: 'discogs:1',
            artistName: 'John Coltrane',
            albumTitle: 'A Love Supreme',
            songTitle: null,
            recordLabel: null,
            releaseYear: 1965,
            genre: 'Jazz',
            coverArtUrl: null,
          },
        ],
      });
    }
    if (url.endsWith('/catalog/records')) {
      return json({
        recordId: REC,
        apiSourceId: 'discogs:1',
        artistName: 'John Coltrane',
        albumTitle: 'A Love Supreme',
        releaseYear: 1965,
        genre: 'Jazz',
        coverArtUrl: null,
      });
    }
    if (url.endsWith('/broadcasts') && init?.method === 'POST') {
      return json({ broadcastId: 'new', notified: { sent: 3, removed: 0, failed: 0 } }, 201);
    }
    return json({ error: { code: 'NOT_FOUND', message: 'nope' } }, 404);
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function renderAt(path: string) {
  const router = createMemoryRouter(APP_ROUTES, { initialEntries: [path] });
  render(
    <FakeAuth user={MANAGER}>
      <RouterProvider router={router} />
    </FakeAuth>,
  );
  return router;
}

describe('/merchant/broadcasts', () => {
  it('lists past broadcasts newest first with a New broadcast link', async () => {
    renderAt('/merchant/broadcasts');
    const list = await screen.findByRole('list', { name: 'Past broadcasts' });
    const links = list.querySelectorAll('a');
    expect(links[0]).toHaveTextContent('Newest crate');
    expect(links[0]).toHaveTextContent('2 featured records');
    expect(links[0]).toHaveAttribute('href', '/broadcasts/b2');
    expect(links[1]).toHaveTextContent('Older crate');
    expect(screen.getByRole('link', { name: 'New broadcast' })).toHaveAttribute(
      'href',
      '/merchant/broadcasts/new',
    );
  });

  it('sends collectors to store verification', async () => {
    const router = createMemoryRouter(APP_ROUTES, { initialEntries: ['/merchant/broadcasts'] });
    render(
      <FakeAuth user={{ displayName: 'C', role: 'collector' }}>
        <RouterProvider router={router} />
      </FakeAuth>,
    );
    await waitFor(() => expect(router.state.location.pathname).toBe('/merchant/verify'));
  });
});

describe('/merchant/broadcasts/new', () => {
  it('counts characters, validates the photo link and previews before publishing', async () => {
    const router = renderAt('/merchant/broadcasts/new');
    const summary = await screen.findByLabelText('What just arrived?');
    const preview = screen.getByRole('button', { name: 'Preview' });
    expect(preview).toBeDisabled();
    fireEvent.change(summary, { target: { value: 'Fresh soul 45s' } });
    expect(screen.getByText('14/500')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Photo link (optional)'), {
      target: { value: 'http://example.com/a.jpg' },
    });
    expect(screen.getByText('Photo link must start with https://')).toBeInTheDocument();
    expect(preview).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Photo link (optional)'), {
      target: { value: 'https://example.com/a.jpg' },
    });

    fireEvent.change(screen.getByLabelText('Find a record to feature'), {
      target: { value: 'coltrane' },
    });
    fireEvent.click(await screen.findByRole('button', { name: /A Love Supreme/ }));
    const featured = await screen.findByRole('list', { name: 'Featured records' });
    expect(featured).toHaveTextContent('A Love Supreme');
    expect(screen.getByText('Featured records (1/10)')).toBeInTheDocument();

    fireEvent.click(preview);
    const frame = await screen.findByLabelText('Broadcast preview');
    expect(frame).toHaveTextContent('Fresh soul 45s');
    await waitFor(() => expect(frame).toHaveTextContent('Low End Theory'));
    expect(screen.getByRole('link', { name: 'View photo' })).toHaveAttribute(
      'href',
      'https://example.com/a.jpg',
    );
    expect(screen.getByRole('link', { name: /A Love Supreme/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    expect(
      await screen.findByText(/Broadcast published. 3 collector devices notified./),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/merchant/broadcasts');
    const post = fetchMock.mock.calls.find(
      ([u, i]) => String(u).endsWith('/broadcasts') && i?.method === 'POST',
    );
    expect(JSON.parse(post![1].body)).toEqual({
      arrivalSummary: 'Fresh soul 45s',
      photoUrl: 'https://example.com/a.jpg',
      featuredIds: [REC],
    });
  });

  it('caps the summary at 500 characters', async () => {
    renderAt('/merchant/broadcasts/new');
    const summary = await screen.findByLabelText('What just arrived?');
    expect(summary).toHaveAttribute('maxLength', '500');
    fireEvent.change(summary, { target: { value: 'x'.repeat(500) } });
    expect(screen.getByText('500/500')).toHaveClass('counter-full');
  });
});
