import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { isOfflineError } from '../../api/client';
import { listCrate, type ListType } from '../../api/crate';
import { useAuth } from '../../auth/context';
import VirtualList from '../../components/VirtualList';
import AlbumBadge from '../../components/ui/AlbumBadge';
import Button from '../../components/ui/Button';
import { PillGroup } from '../../components/ui/Pill';
import { readCrateCache, writeCrateCache } from '../../lib/crateCache';
import { useAsync } from '../../lib/useAsync';
import { isPendingItem, pendingAdds } from '../../offline/crateWrites';
import { useQueueCounts } from '../../offline/useQueue';
import type { CrateItem } from '../../api/crate';
import { itemSubtitle } from './itemSubtitle';

const TAB_KEY = 'cratedig.crateTab';
const TABS = [
  { value: 'collection', label: 'Collection' },
  { value: 'want_list', label: 'Want List' },
] as const;

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

function readTab(): ListType {
  try {
    return localStorage.getItem(TAB_KEY) === 'want_list' ? 'want_list' : 'collection';
  } catch {
    return 'collection';
  }
}

export default function CrateScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? 'guest';
  const [tab, setTab] = useState<ListType>(readTab);
  const [q, setQ] = useState('');
  const [genre, setGenre] = useState('');

  // Re-read when queued writes sync, so placeholders give way to the server's items.
  const { pending } = useQueueCounts(session?.user.id ?? null);
  const { data, loading, error, errorValue, reload } = useAsync(
    async (signal) => {
      const withPending = (items: CrateItem[]) => [
        ...pendingAdds(session?.user.id ?? '', tab).filter(
          (p) => !items.some((i) => i.crateItemId === p.crateItemId),
        ),
        ...items,
      ];
      try {
        const { items } = await listCrate({ listType: tab }, signal);
        writeCrateCache(userId, tab, items);
        return { items: withPending(items), offline: false };
      } catch (err) {
        const cached = readCrateCache(userId, tab);
        if (isOfflineError(err) && cached) return { items: withPending(cached), offline: true };
        throw err;
      }
    },
    [tab, userId, pending],
  );

  const items = useMemo(() => data?.items ?? [], [data]);
  const genres = useMemo(
    () => [...new Set(items.map((i) => i.record.genre).filter((g): g is string => !!g))].sort(),
    [items],
  );
  const filtered = useMemo(() => {
    const term = fold(q.trim());
    return items.filter((i) => {
      if (genre && i.record.genre !== genre) return false;
      if (!term) return true;
      return [i.record.albumTitle, i.record.artistName, i.record.genre ?? ''].some((f) =>
        fold(f).includes(term),
      );
    });
  }, [items, q, genre]);

  const changeTab = (next: ListType) => {
    setTab(next);
    setGenre('');
    try {
      localStorage.setItem(TAB_KEY, next);
    } catch {
      // Remembering the tab is best-effort.
    }
  };

  return (
    <section className="stack">
      <h1>My Crate</h1>
      <PillGroup label="List" options={TABS} value={tab} onChange={changeTab} />
      <div className="filter-row">
        <label className="field grow">
          <span className="visually-hidden">Search your crate</span>
          <input
            className="input"
            type="search"
            placeholder="Search title, artist or genre"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="visually-hidden">Genre</span>
          <select className="input" value={genre} onChange={(e) => setGenre(e.target.value)}>
            <option value="">All genres</option>
            {genres.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </label>
      </div>

      {data?.offline && (
        <p className="muted" role="status">
          Showing your crate from the last time you were online.
        </p>
      )}
      {loading && !data && (
        <p className="muted" role="status">
          Loading your crate…
        </p>
      )}
      {error && !data && (
        <div className="stack" role="alert">
          <p className="form-error">{error}</p>
          {isOfflineError(errorValue) && (
            <p className="muted">My Crate needs a connection the first time.</p>
          )}
          <Button variant="secondary" onClick={reload}>
            Try again
          </Button>
        </div>
      )}

      {data && items.length === 0 && (
        <p className="muted">
          {tab === 'collection'
            ? 'Your Collection is empty. Add the records you own so you never buy a duplicate.'
            : 'Your Want List is empty. Add records you are hunting for.'}
        </p>
      )}
      {data && items.length > 0 && filtered.length === 0 && (
        <p className="muted">No records match your search.</p>
      )}
      {filtered.length > 0 && (
        <VirtualList
          label={tab === 'collection' ? 'Collection' : 'Want List'}
          items={filtered}
          rowHeight={80}
          getKey={(i) => i.crateItemId}
          renderItem={(i) => (
            <Link className="store-card crate-card" to={`/crate/items/${i.crateItemId}`}>
              <AlbumBadge
                artistName={i.record.artistName}
                albumTitle={i.record.albumTitle}
                coverArtUrl={i.record.coverArtUrl}
              />
              <span className="store-card-body">
                <span className="store-card-name clamp">{i.record.albumTitle}</span>
                <span className="muted clamp">{i.record.artistName}</span>
                <span className="muted clamp">
                  {isPendingItem(i) ? 'Waiting to sync' : itemSubtitle(i)}
                </span>
              </span>
            </Link>
          )}
        />
      )}

      <div className="action-bar">
        <Link className="button-primary button-block" to={`/crate/add?list=${tab}`}>
          + Add record
        </Link>
      </div>
    </section>
  );
}
