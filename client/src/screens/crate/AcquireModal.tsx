import { useMemo, useState } from 'react';
import { errorText } from '../../api/client';
import { acquireCrateItem, type CrateItem } from '../../api/crate';
import { getRecord } from '../../api/records';
import { useAuth } from '../../auth/context';
import Button from '../../components/ui/Button';
import { formatUsd, parseUsd } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import { originKey, useCurrentOrigin } from '../../lib/useCurrentOrigin';

const ELSEWHERE = 'elsewhere';

export interface AcquireOutcome {
  item: CrateItem;
  message: string;
}

/** "Where did you get it?" — picks the store whose sightings close on acquire. */
export default function AcquireModal({
  item,
  onClose,
  onDone,
  acquire = acquireCrateItem,
}: {
  item: CrateItem;
  onClose: () => void;
  onDone: (outcome: AcquireOutcome) => void;
  acquire?: typeof acquireCrateItem;
}) {
  const { preferences } = useAuth();
  const unit = preferences?.distanceUnit ?? 'mi';
  const { origin, locating } = useCurrentOrigin();
  const { data, loading } = useAsync(
    locating ? null : (signal) => getRecord(item.record.recordId, origin, unit, signal),
    [item.record.recordId, originKey(origin), unit, locating],
  );

  // One option per store: its nearest/cheapest active sighting, nearest store first.
  const stores = useMemo(() => {
    const byStore = new Map<string, NonNullable<typeof data>['activeSightings'][number]>();
    for (const s of data?.activeSightings ?? []) {
      const prev = byStore.get(s.store.storeId);
      if (!prev || (s.priceUsd ?? Infinity) < (prev.priceUsd ?? Infinity))
        byStore.set(s.store.storeId, s);
    }
    return [...byStore.values()].sort(
      (a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity),
    );
  }, [data]);

  const [choice, setChoice] = useState<string | null>(null);
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = (value: string) => {
    setChoice(value);
    const sighting = stores.find((s) => s.store.storeId === value);
    setPrice(sighting?.priceUsd != null ? sighting.priceUsd.toFixed(2) : '');
  };

  const parsed = parseUsd(price);
  const priceError = Number.isNaN(parsed) ? 'Enter a dollar amount like 24.99' : null;

  const confirm = async () => {
    if (!choice || priceError) return;
    setSaving(true);
    setError(null);
    const storeId = choice === ELSEWHERE ? null : choice;
    try {
      const res = await acquire(item.crateItemId, { storeId, purchasePriceUsd: parsed });
      const store = stores.find((s) => s.store.storeId === storeId)?.store.businessName;
      onDone({
        item: res.item,
        message: store
          ? `Moved to Collection — marked sold out at ${store}.`
          : 'Moved to Collection.',
      });
    } catch (err) {
      setError(errorText(err));
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal stack"
        role="dialog"
        aria-modal="true"
        aria-labelledby="acquire-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="acquire-title">Where did you get it?</h2>
        <p className="muted">
          {item.record.albumTitle} — {item.record.artistName}
        </p>
        {(loading || locating) && (
          <p className="muted" role="status">
            Finding stores with this record…
          </p>
        )}
        <fieldset className="field plain">
          <legend className="visually-hidden">Store</legend>
          <ul className="card-list">
            {stores.map((s) => (
              <li key={s.store.storeId}>
                <label className="store-card radio-card">
                  <input
                    type="radio"
                    name="store"
                    checked={choice === s.store.storeId}
                    onChange={() => pick(s.store.storeId)}
                  />
                  <span className="store-card-body">
                    <span className="store-card-name">{s.store.businessName}</span>
                    <span className="muted">
                      {s.distance != null ? `${s.distance.toFixed(1)} ${unit} · ` : ''}
                      {formatUsd(s.priceUsd)}
                    </span>
                  </span>
                </label>
              </li>
            ))}
            <li>
              <label className="store-card radio-card">
                <input
                  type="radio"
                  name="store"
                  checked={choice === ELSEWHERE}
                  onChange={() => pick(ELSEWHERE)}
                />
                <span className="store-card-body">
                  <span className="store-card-name">Acquired elsewhere</span>
                  <span className="muted">No store sightings change</span>
                </span>
              </label>
            </li>
          </ul>
        </fieldset>
        <label className="field">
          Price paid (USD, optional)
          <input
            className="input"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            aria-invalid={!!priceError}
          />
          {priceError && <span className="form-error">{priceError}</span>}
        </label>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="button-row">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void confirm()} disabled={!choice || saving || !!priceError}>
            {saving ? 'Saving…' : 'Confirm'}
          </Button>
        </div>
      </div>
    </div>
  );
}
