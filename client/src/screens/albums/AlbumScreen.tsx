import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError, errorText } from '../../api/client';
import { listCrate, type ListType } from '../../api/crate';
import { getRecord } from '../../api/records';
import { useAuth } from '../../auth/context';
import { useProtectedAction } from '../../auth/useProtectedAction';
import AlbumBadge from '../../components/ui/AlbumBadge';
import Button from '../../components/ui/Button';
import { addItem } from '../../offline/crateWrites';
import { conditionLabel, formatUsd, newId, timeAgo } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import { originKey, useCurrentOrigin } from '../../lib/useCurrentOrigin';
import { VerifiedCheck } from '../stores/StoreIcon';

export default function AlbumScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { session, preferences } = useAuth();
  const protect = useProtectedAction();
  const unit = preferences?.distanceUnit ?? 'mi';
  const { origin, locating } = useCurrentOrigin();
  const record = useAsync(locating ? null : (signal) => getRecord(id, origin, unit, signal), [
    id,
    originKey(origin),
    unit,
    locating,
  ]);
  const userId = session?.user.id ?? null;
  const crate = useAsync(userId ? (signal) => listCrate({ recordId: id }, signal) : null, [
    id,
    userId,
  ]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState(false);

  const r = record.data;
  if (!r) {
    return record.error ? (
      <section className="stack">
        <h1>Album Details</h1>
        <p role="alert" className="form-error">
          {record.error}
        </p>
        <Button variant="secondary" onClick={record.reload}>
          Try again
        </Button>
      </section>
    ) : (
      <p className="muted" role="status">
        Loading album…
      </p>
    );
  }

  const items = userId ? (crate.data?.items ?? []) : [];
  const owned = items.some((i) => i.listType === 'collection');
  const wanted = items.some((i) => i.listType === 'want_list');

  const add = (listType: ListType, force = false) =>
    protect(async () => {
      setBusy(true);
      setMessage(null);
      setDuplicate(false);
      try {
        const { item, queued } = await addItem(
          userId,
          { recordId: r.recordId, listType, force },
          {
            recordId: r.recordId,
            apiSourceId: r.apiSourceId,
            artistName: r.artistName,
            albumTitle: r.albumTitle,
            songTitle: r.songTitle,
            recordLabel: r.recordLabel,
            releaseYear: r.releaseYear,
            genre: r.genre,
            coverArtUrl: r.coverArtUrl,
          },
          newId(),
        );
        crate.setData((prev) => ({ items: [...(prev?.items ?? []), item] }));
        const added =
          listType === 'collection' ? 'Added to your Collection.' : 'Added to your Want List.';
        setMessage(queued ? `${added} It will sync when you're back online.` : added);
      } catch (err) {
        if (err instanceof ApiError && err.code === 'ALREADY_OWNED') setDuplicate(true);
        else setMessage(errorText(err));
      } finally {
        setBusy(false);
      }
    });

  return (
    <section className="stack">
      <div className="store-header">
        <AlbumBadge
          artistName={r.artistName}
          albumTitle={r.albumTitle}
          coverArtUrl={r.coverArtUrl}
          size={96}
        />
        <div>
          <h1>{r.albumTitle}</h1>
          <p className="muted">{r.artistName}</p>
        </div>
      </div>
      {(owned || wanted) && (
        <ul className="chip-list" aria-label="In your crate">
          {owned && <li className="chip chip-accent">In your Collection</li>}
          {wanted && <li className="chip chip-accent">On your Want List</li>}
        </ul>
      )}
      <dl className="details">
        <dt>Artist</dt>
        <dd>{r.artistName}</dd>
        {r.releaseYear && (
          <>
            <dt>Released</dt>
            <dd>{r.releaseYear}</dd>
          </>
        )}
        {r.recordLabel && (
          <>
            <dt>Label</dt>
            <dd>{r.recordLabel}</dd>
          </>
        )}
        {r.songTitle && (
          <>
            <dt>Key track</dt>
            <dd>{r.songTitle}</dd>
          </>
        )}
        {r.genre && (
          <>
            <dt>Genre</dt>
            <dd>{r.genre}</dd>
          </>
        )}
        <dt>Catalog ID</dt>
        <dd>{r.apiSourceId}</dd>
      </dl>

      <div className="stack-tight">
        <h2>Nearby sightings</h2>
        {r.activeSightings.length === 0 ? (
          <p className="muted">No active sightings. Spot it in a store? Report it.</p>
        ) : (
          <ul className="card-list">
            {r.activeSightings.map((s) => (
              <li key={s.sightingId}>
                <Link className="store-card" to={`/sightings/${s.sightingId}`}>
                  <span className="store-card-body">
                    <span className="store-card-name">
                      {s.store.businessName}
                      {s.storeVerified && <VerifiedCheck />}
                    </span>
                    <span className="muted">
                      {conditionLabel(s.conditionGrade)} · {timeAgo(s.sightingTimestamp)}
                    </span>
                  </span>
                  <span className="store-card-distance">
                    {formatUsd(s.priceUsd)}
                    {s.distance != null && (
                      <span className="muted block">
                        {s.distance.toFixed(1)} {unit}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {message && (
        <p role="status" className="toast">
          {message}
        </p>
      )}
      {duplicate && (
        <div role="alertdialog" aria-label="Already in your Collection" className="notice">
          <p>You already own this record. Add another copy?</p>
          <div className="button-row">
            <Button variant="secondary" onClick={() => setDuplicate(false)}>
              Cancel
            </Button>
            <Button onClick={() => add('collection', true)} disabled={busy}>
              Add anyway
            </Button>
          </div>
        </div>
      )}
      {!session && <p className="muted">Log in to save this record or report a sighting.</p>}
      <div className="action-bar">
        <div className="button-row">
          <Button variant="secondary" disabled={busy} onClick={() => add('collection')}>
            Add to Collection
          </Button>
          <Button variant="secondary" disabled={busy || wanted} onClick={() => add('want_list')}>
            Add to Want List
          </Button>
        </div>
        <Button
          block
          onClick={() =>
            protect(() => navigate(`/report?recordId=${encodeURIComponent(r.recordId)}`))
          }
        >
          Report sighting
        </Button>
      </div>
    </section>
  );
}
