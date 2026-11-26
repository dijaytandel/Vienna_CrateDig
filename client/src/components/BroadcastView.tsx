import { Link } from 'react-router-dom';
import type { BroadcastDetail } from '../api/feed';
import { timeAgo } from '../lib/format';
import StoreIcon, { VerifiedCheck } from '../screens/stores/StoreIcon';
import AlbumBadge from './ui/AlbumBadge';

/** The body of `/broadcasts/:id`, also used as the composer's Preview. */
export default function BroadcastView({ broadcast: b }: { broadcast: BroadcastDetail }) {
  return (
    <>
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
    </>
  );
}
