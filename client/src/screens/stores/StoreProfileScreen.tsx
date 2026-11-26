import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, isOfflineError } from '../../api/client';
import { getStore, type StoreDetail } from '../../api/stores';
import { useAuth } from '../../auth/context';
import { useProtectedAction } from '../../auth/useProtectedAction';
import AlbumBadge from '../../components/ui/AlbumBadge';
import Button from '../../components/ui/Button';
import { formatDate } from '../../lib/format';
import { readCachedStore, rememberStore } from '../../lib/storeCache';
import {
  CONDITION_LABEL,
  DAYS,
  formatAddress,
  formatHours,
  formatUsd,
  mapsHref,
  telHref,
} from './format';
import StoreIcon, { VerifiedCheck } from './StoreIcon';

const postedDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

function FavoriteButton({ storeId }: { storeId: string }) {
  const { preferences, toggleFavoriteStore } = useAuth();
  const protect = useProtectedAction();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const favorite = preferences?.favoriteStoreIds.includes(storeId) ?? false;

  const onClick = () =>
    protect(async () => {
      setPending(true);
      const result = await toggleFavoriteStore(storeId);
      setPending(false);
      setError(result.error);
    });

  return (
    <>
      <Button variant="secondary" aria-pressed={favorite} disabled={pending} onClick={onClick}>
        {favorite ? '★ Favorite' : '☆ Add to favorites'}
      </Button>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </>
  );
}

function Chips({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section className="stack-tight">
      <h2>{label}</h2>
      <ul className="chip-list">
        {items.map((item) => (
          <li key={item} className="chip">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

function StoreProfile({ store, savedAt }: { store: StoreDetail; savedAt?: string }) {
  const tel = store.phone ? telHref(store.phone) : null;
  return (
    <section className="stack">
      <header className="store-header">
        <StoreIcon name={store.businessName} size={56} />
        <div>
          <h1>
            {store.businessName}
            {store.isVerified && <VerifiedCheck />}
          </h1>
          <p className={store.isOpenNow && !savedAt ? 'open-now' : 'muted'}>
            {!savedAt && (store.isOpenNow ? 'Open now' : 'Closed now')}
            {!store.isVerified && `${savedAt ? '' : ' · '}Verification pending`}
          </p>
          {savedAt && (
            <p className="muted" role="status">
              Saved copy from {formatDate(savedAt)}. Hours and sightings may have changed.
            </p>
          )}
        </div>
      </header>

      <FavoriteButton storeId={store.storeId} />

      <dl className="details">
        <dt>Address</dt>
        <dd>
          {formatAddress(store)}
          <br />
          <a href={mapsHref(store)} target="_blank" rel="noopener noreferrer">
            Open in Maps
          </a>
        </dd>
        {store.phone && (
          <>
            <dt>Phone</dt>
            <dd>{tel ? <a href={tel}>{store.phone}</a> : store.phone}</dd>
          </>
        )}
        {store.websiteUrl && (
          <>
            <dt>Website</dt>
            <dd>
              <a href={store.websiteUrl} target="_blank" rel="noopener noreferrer">
                {store.websiteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
              </a>
            </dd>
          </>
        )}
      </dl>

      <section className="stack-tight">
        <h2>Hours</h2>
        <table className="hours-table">
          <tbody>
            {DAYS.map((d) => (
              <tr key={d.key}>
                <th scope="row">{d.label}</th>
                <td>{formatHours(store.operatingHours[d.key])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <Chips label="Payment methods" items={store.paymentMethods} />
      <Chips label="Specialties" items={store.tags} />

      <section className="stack-tight">
        <h2>Spotted here</h2>
        {store.activeSightings.length === 0 ? (
          <p className="muted">No active sightings yet.</p>
        ) : (
          <ul className="card-list">
            {store.activeSightings.map((s) => (
              <li key={s.sightingId}>
                <Link className="sighting-card" to={`/sightings/${s.sightingId}`}>
                  <AlbumBadge
                    artistName={s.artistName}
                    albumTitle={s.albumTitle}
                    coverArtUrl={s.coverArtUrl}
                  />
                  <span className="store-card-body">
                    <span className="store-card-name">{s.albumTitle}</span>
                    <span className="muted">
                      {s.artistName} · {CONDITION_LABEL[s.conditionGrade]}
                      {s.storeVerified && ' · Store confirmed'}
                    </span>
                  </span>
                  <span className="store-card-distance">{formatUsd(s.priceUsd)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="stack-tight">
        <h2>Broadcasts</h2>
        {store.recentBroadcasts.length === 0 ? (
          <p className="muted">No broadcasts yet.</p>
        ) : (
          <ul className="card-list">
            {store.recentBroadcasts.map((b) => (
              <li key={b.broadcastId}>
                <Link className="broadcast-card" to={`/broadcasts/${b.broadcastId}`}>
                  <span className="muted">{postedDate.format(new Date(b.postedAt))}</span>
                  <span>{b.arrivalSummary}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

export default function StoreProfileScreen() {
  const { id = '' } = useParams();
  const [attempt, setAttempt] = useState(0);
  const key = `${id}|${attempt}`;
  const [result, setResult] = useState<{
    key: string;
    store?: StoreDetail;
    savedAt?: string;
    error?: ApiError;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getStore(id, controller.signal).then(
      (store) => {
        rememberStore(store);
        setResult({ key, store });
      },
      (err: unknown) => {
        if (controller.signal.aborted) return;
        const cached = isOfflineError(err) ? readCachedStore(id) : null;
        if (cached) {
          setResult({ key, store: cached.store, savedAt: cached.savedAt });
          return;
        }
        setResult({
          key,
          error:
            err instanceof ApiError ? err : new ApiError(0, 'UNKNOWN', 'Something went wrong.'),
        });
      },
    );
    return () => controller.abort();
  }, [id, key]);

  const current = result?.key === key ? result : null;
  if (current?.store) return <StoreProfile store={current.store} savedAt={current.savedAt} />;

  return (
    <section className="stack">
      <h1>Store Profile</h1>
      {!current && (
        <p className="muted" role="status">
          Loading store…
        </p>
      )}
      {current?.error?.status === 404 && (
        <>
          <p>We couldn&apos;t find this store.</p>
          <Link to="/stores">Back to stores</Link>
        </>
      )}
      {current?.error && current.error.status !== 404 && (
        <div className="stack" role="alert">
          <p className="form-error">{current.error.message}</p>
          <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </Button>
        </div>
      )}
    </section>
  );
}
