import { Link } from 'react-router-dom';
import { listMerchantSightings } from '../../api/merchant';
import Button from '../../components/ui/Button';
import { timeAgo } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import StoreIcon, { VerifiedCheck } from '../stores/StoreIcon';
import { loadMyStore } from './myStore';

export default function MerchantDashboardScreen() {
  const data = useAsync(async (signal) => {
    const [mine, queue] = await Promise.all([loadMyStore(signal), listMerchantSightings(signal)]);
    return { ...mine, pending: queue.sightings.filter((s) => !s.storeVerified).length };
  }, []);

  if (data.error) {
    return (
      <section className="stack" role="alert">
        <h1>Merchant Dashboard</h1>
        <p className="form-error">{data.error}</p>
        <Button variant="secondary" onClick={data.reload}>
          Try again
        </Button>
      </section>
    );
  }
  if (!data.data) {
    return (
      <section className="stack">
        <h1>Merchant Dashboard</h1>
        <p className="muted" role="status">
          Loading…
        </p>
      </section>
    );
  }
  const { store, broadcasts, pending } = data.data;
  return (
    <section className="stack merchant-dashboard">
      <h1>Merchant Dashboard</h1>
      <div className="store-header">
        <StoreIcon name={store.businessName} />
        <div>
          <h2>{store.businessName}</h2>
          <p className="verified-label">
            <VerifiedCheck /> Verified store
          </p>
        </div>
      </div>
      <div className="dashboard-cards">
        <article className="card stack-tight" aria-labelledby="pending-heading">
          <h2 id="pending-heading">Pending sightings</h2>
          <p className="big-number">{pending}</p>
          <p className="muted">{pending === 1 ? 'sighting needs' : 'sightings need'} your review</p>
          <Link className="button-primary" to="/merchant/sightings">
            Review
          </Link>
        </article>
        <article className="card stack-tight" aria-labelledby="broadcasts-heading">
          <h2 id="broadcasts-heading">Recent broadcasts</h2>
          {broadcasts.length === 0 ? (
            <p className="muted">Nothing posted yet.</p>
          ) : (
            <ul className="plain-list">
              {broadcasts.slice(0, 3).map((b) => (
                <li key={b.broadcastId}>
                  <Link to={`/broadcasts/${b.broadcastId}`}>{b.arrivalSummary}</Link>{' '}
                  <span className="muted">· {timeAgo(b.postedAt)}</span>
                </li>
              ))}
            </ul>
          )}
          <Link className="button-primary" to="/merchant/broadcasts/new">
            + New broadcast
          </Link>
          <Link to="/merchant/broadcasts">All broadcasts</Link>
        </article>
      </div>
      <Link className="button-secondary" to="/merchant/store">
        Edit store profile
      </Link>
      <Link to={`/stores/${store.storeId}`}>View public store page</Link>
    </section>
  );
}
