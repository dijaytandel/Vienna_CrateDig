import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { listMerchantSightings, moderateSighting, type ModerationAction } from '../../api/merchant';
import { errorText } from '../../api/client';
import AlbumBadge from '../../components/ui/AlbumBadge';
import Button from '../../components/ui/Button';
import { conditionLabel, formatUsd, timeAgo } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';

export const UNDO_MS = 5000;

const DONE: Record<ModerationAction, string> = {
  confirm: 'Confirmed',
  flag: 'Flagged',
  mark_sold: 'Marked sold',
};

/** One-tap verification queue. Each action waits 5 s so it can be undone before it is sent. */
export default function MerchantSightingsScreen() {
  const queue = useAsync((signal) => listMerchantSightings(signal), []);
  const [done, setDone] = useState<Record<string, ModerationAction>>({});
  const [last, setLast] = useState<{ id: string; action: ModerationAction } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timers = useRef(new Map<string, { timer: number; send: () => void }>());

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const { timer, send } of pending.values()) {
        window.clearTimeout(timer);
        send();
      }
      pending.clear();
    };
  }, []);

  const act = (id: string, action: ModerationAction) => {
    setError(null);
    const send = () => {
      timers.current.delete(id);
      moderateSighting(id, action).catch((err) => {
        setDone(({ [id]: _, ...rest }) => rest);
        setError(`Couldn't save: ${errorText(err)}`);
      });
    };
    timers.current.set(id, { timer: window.setTimeout(send, UNDO_MS), send });
    setDone((d) => ({ ...d, [id]: action }));
    setLast({ id, action });
  };

  const undo = () => {
    if (!last) return;
    const pending = timers.current.get(last.id);
    if (pending) window.clearTimeout(pending.timer);
    timers.current.delete(last.id);
    setDone(({ [last.id]: _, ...rest }) => rest);
    setLast(null);
  };

  useEffect(() => {
    if (!last) return;
    const t = window.setTimeout(() => setLast(null), UNDO_MS);
    return () => window.clearTimeout(t);
  }, [last]);

  const rows = (queue.data?.sightings ?? [])
    .filter((s) => done[s.sightingId] !== 'flag' && done[s.sightingId] !== 'mark_sold')
    .map((s) => (done[s.sightingId] === 'confirm' ? { ...s, storeVerified: true } : s));
  const unconfirmed = rows.filter((s) => !s.storeVerified).length;

  return (
    <section className="stack">
      <div className="screen-header">
        <h1>Sighting Verification</h1>
        <Link to="/merchant">Dashboard</Link>
      </div>
      {queue.data && (
        <p className="muted">
          {unconfirmed} to review · {rows.length} active
        </p>
      )}
      {last && (
        <div className="toast toast-action" role="status">
          <span>{DONE[last.action]}</span>
          <button type="button" className="link-button" onClick={undo}>
            Undo
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {queue.error && (
        <div className="stack" role="alert">
          <p className="form-error">{queue.error}</p>
          <Button variant="secondary" onClick={queue.reload}>
            Try again
          </Button>
        </div>
      )}
      {queue.loading && !queue.data && (
        <p className="muted" role="status">
          Loading…
        </p>
      )}
      {queue.data && rows.length === 0 && (
        <p className="muted">No active sightings at your store right now.</p>
      )}
      {rows.length > 0 && (
        <ul className="card-list" aria-label="Sightings to verify">
          {rows.map((s) => {
            const label = `${s.record.albumTitle} by ${s.record.artistName}`;
            return (
              <li key={s.sightingId} className="queue-row">
                <Link to={`/sightings/${s.sightingId}`} className="queue-main">
                  <AlbumBadge
                    artistName={s.record.artistName}
                    albumTitle={s.record.albumTitle}
                    coverArtUrl={s.record.coverArtUrl}
                  />
                  <span className="stack-tight">
                    <strong>{s.record.albumTitle}</strong>
                    <span>{s.record.artistName}</span>
                    <span className="muted">
                      {formatUsd(s.priceUsd)} · {conditionLabel(s.conditionGrade)} ·{' '}
                      {s.reporter?.displayName ?? 'A collector'} · {timeAgo(s.sightingTimestamp)}
                    </span>
                  </span>
                </Link>
                <div className="queue-actions">
                  {s.storeVerified ? (
                    <span className="verified-label">✓ Confirmed</span>
                  ) : (
                    <Button
                      aria-label={`Confirm ${label}`}
                      onClick={() => act(s.sightingId, 'confirm')}
                    >
                      ✓ Confirm
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    aria-label={`Flag ${label}`}
                    onClick={() => act(s.sightingId, 'flag')}
                  >
                    Flag
                  </Button>
                  <Button
                    variant="secondary"
                    aria-label={`Mark ${label} sold`}
                    onClick={() => act(s.sightingId, 'mark_sold')}
                  >
                    Mark sold
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
