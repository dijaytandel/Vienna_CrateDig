import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { getSighting, STATUS_LABELS } from '../../api/sightings';
import { useAuth } from '../../auth/context';
import { useProtectedAction } from '../../auth/useProtectedAction';
import AlbumBadge from '../../components/ui/AlbumBadge';
import Button from '../../components/ui/Button';
import { conditionLabel, formatDate, formatUsd, timeAgo } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import { originKey, useCurrentOrigin } from '../../lib/useCurrentOrigin';
import { VerifiedCheck } from '../stores/StoreIcon';

export default function SightingScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = (location.state as { toast?: string } | null)?.toast;
  const { preferences } = useAuth();
  const protect = useProtectedAction();
  const unit = preferences?.distanceUnit ?? 'mi';
  const { origin, locating } = useCurrentOrigin();
  const sighting = useAsync(locating ? null : (signal) => getSighting(id, origin, unit, signal), [
    id,
    originKey(origin),
    unit,
    locating,
  ]);
  const s = sighting.data;

  if (!s) {
    return sighting.error ? (
      <section className="stack">
        <h1>Sighting</h1>
        <p role="alert" className="form-error">
          {sighting.error}
        </p>
        <Button variant="secondary" onClick={sighting.reload}>
          Try again
        </Button>
      </section>
    ) : (
      <p className="muted" role="status">
        Loading sighting…
      </p>
    );
  }

  const attributes =
    s.specialAttributes
      ?.split(',')
      .map((a) => a.trim())
      .filter(Boolean) ?? [];
  const reportAgain = `/report?recordId=${encodeURIComponent(s.record.recordId)}&storeId=${encodeURIComponent(s.store.storeId)}`;

  return (
    <section className="stack">
      {toast && (
        <p role="status" className="toast">
          {toast}
        </p>
      )}
      <div className="store-header">
        <AlbumBadge
          artistName={s.record.artistName}
          albumTitle={s.record.albumTitle}
          coverArtUrl={s.record.coverArtUrl}
          size={96}
        />
        <div>
          <h1>{s.record.albumTitle}</h1>
          <p className="muted">{s.record.artistName}</p>
        </div>
      </div>
      <ul className="chip-list" aria-label="Status">
        <li className={`chip status-${s.status}`}>{STATUS_LABELS[s.status]}</li>
        {s.storeVerified && (
          <li className="chip chip-accent">
            <VerifiedCheck /> Verified by store
          </li>
        )}
      </ul>
      <dl className="details">
        <dt>Price</dt>
        <dd className="price">{formatUsd(s.priceUsd)}</dd>
        <dt>Condition</dt>
        <dd>{conditionLabel(s.conditionGrade)}</dd>
        <dt>Store</dt>
        <dd>
          <Link to={`/stores/${s.store.storeId}`}>{s.store.businessName}</Link>
          {s.store.isVerified && <VerifiedCheck />}
          {s.distance != null && (
            <span className="muted">
              {' '}
              · {s.distance.toFixed(1)} {s.unit ?? unit}
            </span>
          )}
        </dd>
        {attributes.length > 0 && (
          <>
            <dt>Attributes</dt>
            <dd>
              <ul className="tag-list">
                {attributes.map((a) => (
                  <li key={a} className="chip">
                    {a}
                  </li>
                ))}
              </ul>
            </dd>
          </>
        )}
        <dt>Reported</dt>
        <dd>
          {timeAgo(s.sightingTimestamp)}
          {s.reporter ? ` by ${s.reporter.displayName}` : ''}
        </dd>
        <dt>Archives</dt>
        <dd>{formatDate(s.archiveDate)}</dd>
      </dl>
      <div className="button-row">
        <Link className="button-secondary" to={`/albums/${s.record.recordId}`}>
          Album details
        </Link>
        <Link className="button-secondary" to={`/stores/${s.store.storeId}`}>
          Store profile
        </Link>
      </div>
      <div className="action-bar">
        <Button block onClick={() => protect(() => navigate(reportAgain), reportAgain)}>
          Report it again
        </Button>
      </div>
    </section>
  );
}
