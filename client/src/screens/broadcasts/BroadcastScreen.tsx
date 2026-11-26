import { useParams } from 'react-router-dom';
import { getBroadcast } from '../../api/feed';
import { useAuth } from '../../auth/context';
import BroadcastView from '../../components/BroadcastView';
import Button from '../../components/ui/Button';
import { useAsync } from '../../lib/useAsync';
import { originKey, useCurrentOrigin } from '../../lib/useCurrentOrigin';

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
      <BroadcastView broadcast={b} />
    </section>
  );
}
