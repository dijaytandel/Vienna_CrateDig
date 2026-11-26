import { Link, useLocation } from 'react-router-dom';
import { listMyBroadcasts } from '../../api/broadcasts';
import Button from '../../components/ui/Button';
import { timeAgo } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';

export default function MerchantBroadcastsScreen() {
  const toast = (useLocation().state as { toast?: string } | null)?.toast;
  const history = useAsync((signal) => listMyBroadcasts(signal), []);

  return (
    <section className="stack">
      <div className="screen-header">
        <h1>Broadcasts</h1>
        <Link className="button-primary" to="/merchant/broadcasts/new">
          New broadcast
        </Link>
      </div>
      {toast && (
        <p className="toast" role="status">
          {toast}
        </p>
      )}
      {history.error && (
        <div className="stack" role="alert">
          <p className="form-error">{history.error}</p>
          <Button variant="secondary" onClick={history.reload}>
            Try again
          </Button>
        </div>
      )}
      {history.loading && !history.data && (
        <p className="muted" role="status">
          Loading…
        </p>
      )}
      {history.data && history.data.broadcasts.length === 0 && (
        <p className="muted">
          No broadcasts yet. Tell nearby collectors what just came in with your first one.
        </p>
      )}
      {history.data && history.data.broadcasts.length > 0 && (
        <ul className="card-list" aria-label="Past broadcasts">
          {history.data.broadcasts.map((b) => (
            <li key={b.broadcastId}>
              <Link className="broadcast-card" to={`/broadcasts/${b.broadcastId}`}>
                <span className="muted">
                  {timeAgo(b.postedAt)}
                  {b.featuredIds.length > 0 &&
                    ` · ${b.featuredIds.length} featured record${b.featuredIds.length === 1 ? '' : 's'}`}
                </span>
                <span className="broadcast-summary">{b.arrivalSummary}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
