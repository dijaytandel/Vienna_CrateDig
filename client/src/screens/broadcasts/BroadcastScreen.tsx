import { Link, useParams } from 'react-router-dom';
import { getBroadcast } from '../../api/feed';
import { useAuth } from '../../auth/context';
import AlbumBadge from '../../components/ui/AlbumBadge';
import Button from '../../components/ui/Button';
import { timeAgo } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import { originKey, useCurrentOrigin } from '../../lib/useCurrentOrigin';
import StoreIcon, { VerifiedCheck } from '../stores/StoreIcon';

export default function BroadcastScreen() {
  const { id = '' } = useParams();
  const { preferences } = useAuth();
  const unit = preferences?.distanceUnit ?? 'mi';
  const { origin, locating } = useCurrentOrigin();
  const broadcast = useAsync(locating ? null : (signal) => getBroadcast(id, origin, unit, signal), [
    id,
    originKey(origin),
    unit,
    locating,
  ]);

  if (broadcast.error) {
    return (
      <section className="stack">
        <h1>Store Broadcast</h1>
        <p role="alert" className="form-error">
          {broadcast.error}
        </p>
        <Button variant="secondary" onClick={broadcast.reload}>
          Try again
        </Button>
      </section>
    );
  }
  const b = broadcast.data;
  if (!b) {
    return (
      <section className="stack">
        <h1>Store Broadcast</h1>
        <p className="muted" role="status">
          Loading…
        </p>
      </section>
    );
  }

  return (
    <section className="stack">
      <h1>Store Broadcast</h1>
      <div className="feed-card-head">
        <StoreIcon name={b.store.businessName} />
        <div className="store-card-body">
          <span className="store-card-name">
            {b.store.businessName} {b.store.isVerified && <VerifiedCheck />}
          </span>
          <span className="muted">
            {b.store.streetAddress}, {b.store.city}, {b.store.state}
            {b.distance != null && ` · ${b.distance.toFixed(1)} ${b.unit}`}
          </span>
          <span className="muted">{timeAgo(b.postedAt)}</span>
        </div>
      </div>
      <p className="broadcast-summary">{b.arrivalSummary}</p>
      {b.photoUrl && (
        <a href={b.photoUrl} target="_blank" rel="noopener noreferrer">
          View photo
        </a>
      )}
      {b.featured.length > 0 && (
        <>
          <h2>Featured records</h2>
          <ul className="card-list">
            {b.featured.map((r) => (
              <li key={r.recordId}>
                <Link className="sighting-card" to={`/albums/${r.recordId}`}>
                  <AlbumBadge
                    artistName={r.artistName}
                    albumTitle={r.albumTitle}
                    coverArtUrl={r.coverArtUrl}
                  />
                  <span className="store-card-body">
                    <span className="store-card-name">{r.albumTitle}</span>
                    <span className="muted">
                      {r.artistName}
                      {r.releaseYear && ` · ${r.releaseYear}`}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      <Link className="button-primary button-block" to={`/stores/${b.store.storeId}`}>
        Visit store profile
      </Link>
    </section>
  );
}
