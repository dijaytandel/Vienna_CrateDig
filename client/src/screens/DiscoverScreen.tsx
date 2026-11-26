import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type TouchEvent,
} from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ApiError, errorText } from '../api/client';
import { getFeed, type FeedItem } from '../api/feed';
import type { Origin } from '../api/stores';
import { useAuth } from '../auth/context';
import AlbumBadge from '../components/ui/AlbumBadge';
import Button from '../components/ui/Button';
import { formatUsd, timeAgo } from '../lib/format';
import { isZip, readGuestZip, saveGuestZip } from '../lib/guestZip';
import { originKey, useCurrentOrigin } from '../lib/useCurrentOrigin';
import StoreIcon, { VerifiedCheck } from './stores/StoreIcon';

const PULL_TRIGGER_PX = 70;

interface FeedState {
  key: string;
  items: FeedItem[];
  nextCursor: string | null;
  loadingMore: boolean;
  error: string | null;
}

function FeedCard({ item, unit }: { item: FeedItem; unit: string }) {
  const forYou = item.isForYou && <span className="chip chip-accent">For you</span>;
  if (item.type === 'broadcast') {
    return (
      <Link className="broadcast-card" to={`/broadcasts/${item.id}`}>
        <span className="feed-card-head">
          <StoreIcon name={item.store.businessName} />
          <span className="store-card-body">
            <span className="store-card-name">
              {item.store.businessName} {item.store.isVerified && <VerifiedCheck />}
            </span>
            <span className="muted">
              Broadcast · {item.distance.toFixed(1)} {unit} · {timeAgo(item.postedAt)}
            </span>
          </span>
          {forYou}
        </span>
        <span>{item.arrivalSummary}</span>
      </Link>
    );
  }
  return (
    <Link className="sighting-card" to={`/sightings/${item.id}`}>
      <AlbumBadge
        artistName={item.record.artistName}
        albumTitle={item.record.albumTitle}
        coverArtUrl={item.record.coverArtUrl}
      />
      <span className="store-card-body">
        <span className="store-card-name">{item.record.albumTitle}</span>
        <span className="muted">{item.record.artistName}</span>
        <span className="muted">
          {item.store.businessName} · {item.distance.toFixed(1)} {unit} · {timeAgo(item.postedAt)}
        </span>
        {forYou}
      </span>
      <span className="store-card-distance">{formatUsd(item.priceUsd)}</span>
    </Link>
  );
}

export default function DiscoverScreen() {
  const { session, preferences } = useAuth();
  const location = useLocation();
  const toast = (location.state as { toast?: string } | null)?.toast;
  const unit = preferences?.distanceUnit ?? 'mi';
  const radius = preferences?.radiusMiles ?? 10;

  const [typedZip, setTypedZip] = useState<string | null>(null);
  const [guestZip, setGuestZip] = useState(readGuestZip);
  const located = useCurrentOrigin(typedZip);
  const origin = useMemo<Origin | null>(
    () => located.origin ?? (!session && located.gpsDenied && guestZip ? { zip: guestZip } : null),
    [located.origin, located.gpsDenied, session, guestZip],
  );
  const needZip = !origin && !located.locating;
  const [zipInput, setZipInput] = useState('');
  const [zipError, setZipError] = useState<string | null>(null);

  const [attempt, setAttempt] = useState(0);
  const key = origin ? `${originKey(origin)}|${radius}|${unit}|${attempt}` : null;
  const [feed, setFeed] = useState<FeedState | null>(null);
  const current = feed && feed.key === key ? feed : null;

  useEffect(() => {
    if (!origin || !key) return;
    const controller = new AbortController();
    getFeed({ origin, radius, unit }, controller.signal).then(
      (page) =>
        setFeed({
          key,
          items: page.items,
          nextCursor: page.nextCursor,
          loadingMore: false,
          error: null,
        }),
      (err: unknown) => {
        if (controller.signal.aborted) return;
        const message =
          err instanceof ApiError && err.code === 'ZIP_NOT_FOUND' && 'zip' in origin
            ? `We don't have a location for ZIP ${origin.zip}. Try a nearby ZIP code.`
            : errorText(err);
        setFeed((prev) => ({
          key,
          // A failed refresh keeps the cards already on screen.
          items: prev?.items ?? [],
          nextCursor: null,
          loadingMore: false,
          error: message,
        }));
      },
    );
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const loadMore = useCallback(() => {
    if (!origin || !current?.nextCursor || current.loadingMore) return;
    const { key: pageKey, nextCursor } = current;
    setFeed({ ...current, loadingMore: true });
    getFeed({ origin, radius, unit, cursor: nextCursor }).then(
      (page) =>
        setFeed((prev) =>
          prev && prev.key === pageKey
            ? {
                ...prev,
                items: [...prev.items, ...page.items],
                nextCursor: page.nextCursor,
                loadingMore: false,
              }
            : prev,
        ),
      (err: unknown) =>
        setFeed((prev) =>
          prev && prev.key === pageKey
            ? { ...prev, loadingMore: false, error: errorText(err) }
            : prev,
        ),
    );
  }, [origin, current, radius, unit]);

  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) loadMore();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  const refresh = () => setAttempt((n) => n + 1);

  const pullStart = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const onTouchStart = (e: TouchEvent) => {
    pullStart.current = window.scrollY <= 0 ? e.touches[0]!.clientY : null;
  };
  const onTouchMove = (e: TouchEvent) => {
    if (pullStart.current === null) return;
    setPull(Math.max(0, Math.min(120, e.touches[0]!.clientY - pullStart.current)));
  };
  const onTouchEnd = () => {
    if (pull >= PULL_TRIGGER_PX) refresh();
    pullStart.current = null;
    setPull(0);
  };

  const onZip = (e: FormEvent) => {
    e.preventDefault();
    const zip = zipInput.trim();
    if (!isZip(zip)) {
      setZipError('Enter a 5-digit ZIP code.');
      return;
    }
    setZipError(null);
    if (!session) {
      saveGuestZip(zip);
      setGuestZip(zip);
    }
    setTypedZip(zip);
  };

  const loading = located.locating || (!!key && !current);

  return (
    <section
      className="stack"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className="screen-header">
        <h1>Discover</h1>
        {origin && (
          <Button variant="secondary" onClick={refresh} disabled={loading}>
            Refresh
          </Button>
        )}
      </div>
      {pull > 0 && (
        <p className="muted pull-hint" style={{ height: pull / 2 }} aria-hidden="true">
          {pull >= PULL_TRIGGER_PX ? 'Release to refresh' : 'Pull to refresh'}
        </p>
      )}
      {toast && (
        <p className="toast" role="status">
          {toast}
        </p>
      )}
      {!session && (
        <p className="guest-banner">
          <Link to="/signup">Create an account</Link> to report and save records.
        </p>
      )}
      {preferences && (
        <p className="muted" data-testid="discover-filters">
          Within {radius} {unit}
          {preferences.defaultZip && ` of ${preferences.defaultZip}`}
          {preferences.genres.length > 0 && ` · ${preferences.genres.join(', ')}`}
        </p>
      )}

      {(needZip || typedZip) && (
        <form className="zip-form" onSubmit={onZip} noValidate>
          <label className="field">
            {origin ? 'Show a different ZIP' : 'Enter your 5-digit ZIP code to see nearby finds'}
            <input
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={5}
              value={zipInput}
              onChange={(e) => setZipInput(e.target.value)}
              aria-invalid={!!zipError}
            />
          </label>
          <Button type="submit" variant="secondary">
            Use ZIP
          </Button>
          {zipError && (
            <p role="alert" className="form-error">
              {zipError}
            </p>
          )}
        </form>
      )}

      {loading && (
        <p className="muted" role="status">
          {located.locating ? 'Finding your location…' : 'Loading nearby finds…'}
        </p>
      )}

      {current?.error && (
        <div className="stack" role="alert">
          <p className="form-error">{current.error}</p>
          <Button variant="secondary" onClick={refresh}>
            Try again
          </Button>
        </div>
      )}

      {current && !current.error && current.items.length === 0 && (
        <div className="notice stack-tight">
          <p>
            Nothing spotted within {radius} {unit} in the last 6 months.
          </p>
          <div className="button-row">
            <Link className="button-secondary" to="/report">
              Report a sighting
            </Link>
            <Link className="button-secondary" to="/stores">
              Browse stores
            </Link>
          </div>
        </div>
      )}

      {current && current.items.length > 0 && (
        <ul className="card-list" aria-label="Nearby finds">
          {current.items.map((item) => (
            <li key={`${item.type}-${item.id}`}>
              <FeedCard item={item} unit={unit} />
            </li>
          ))}
        </ul>
      )}

      {current?.nextCursor && (
        <div ref={sentinel}>
          <Button variant="secondary" block onClick={loadMore} disabled={current.loadingMore}>
            {current.loadingMore ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
    </section>
  );
}
