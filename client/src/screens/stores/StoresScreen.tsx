import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { listStores, type Origin, type Radius, type StoreList } from '../../api/stores';
import { useAuth } from '../../auth/context';
import Button from '../../components/ui/Button';
import { PillGroup } from '../../components/ui/Pill';
import { formatAddress } from './format';
import StoreIcon, { VerifiedCheck } from './StoreIcon';

const RADII: Radius[] = [5, 10, 25];

type Located = { origin: Origin | null; locating: boolean };

function initialLocation(defaultZip: string | null | undefined): Located {
  if (typeof navigator !== 'undefined' && navigator.geolocation) {
    return { origin: null, locating: true };
  }
  return { origin: defaultZip ? { zip: defaultZip } : null, locating: false };
}

const originKey = (o: Origin) => ('zip' in o ? o.zip : `${o.lat.toFixed(4)},${o.lng.toFixed(4)}`);

function errorMessage(err: unknown, origin: Origin) {
  if (err instanceof ApiError && err.code === 'ZIP_NOT_FOUND' && 'zip' in origin) {
    return `We don't have a location for ZIP ${origin.zip}. Try a nearby ZIP code.`;
  }
  return err instanceof ApiError ? err.message : 'Something went wrong. Try again.';
}

export default function StoresScreen() {
  const { preferences } = useAuth();
  const unit = preferences?.distanceUnit ?? 'mi';
  const [radius, setRadius] = useState<Radius>(preferences?.radiusMiles ?? 10);
  const [location, setLocation] = useState<Located>(() => initialLocation(preferences?.defaultZip));
  const [zipInput, setZipInput] = useState('');
  const [zipError, setZipError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    data?: StoreList;
    error?: string;
  } | null>(null);

  // GPS first; fall back to the saved ZIP, then ask for one.
  useEffect(() => {
    if (!location.locating) return;
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setLocation({
          origin: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          locating: false,
        }),
      () =>
        setLocation({
          origin: preferences?.defaultZip ? { zip: preferences.defaultZip } : null,
          locating: false,
        }),
      { timeout: 10_000, maximumAge: 300_000 },
    );
  }, [location.locating, preferences?.defaultZip]);

  const { origin } = location;
  const key = origin ? `${originKey(origin)}|${radius}|${unit}|${attempt}` : null;

  useEffect(() => {
    if (!origin || !key) return;
    const controller = new AbortController();
    listStores(origin, radius, unit, controller.signal).then(
      (data) => setResult({ key, data }),
      (err: unknown) => {
        if (!controller.signal.aborted) setResult({ key, error: errorMessage(err, origin) });
      },
    );
    return () => controller.abort();
  }, [key, origin, radius, unit]);

  const onZip = (e: FormEvent) => {
    e.preventDefault();
    const zip = zipInput.trim();
    if (!/^\d{5}$/.test(zip)) {
      setZipError('Enter a 5-digit ZIP code.');
      return;
    }
    setZipError(null);
    setLocation({ origin: { zip }, locating: false });
  };

  const current = result && result.key === key ? result : null;
  const loading = location.locating || (!!key && !current);

  return (
    <section className="stack">
      <h1>Record Stores</h1>
      <PillGroup
        label="Distance"
        options={RADII.map((r) => ({ value: r, label: `Within ${r} ${unit}` }))}
        value={radius}
        onChange={setRadius}
      />

      <form className="zip-form" onSubmit={onZip} noValidate>
        <label className="field">
          {origin ? 'Search near a different ZIP' : 'Enter a ZIP code to find stores near you'}
          <input
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={5}
            value={zipInput}
            onChange={(e) => setZipInput(e.target.value)}
            aria-invalid={!!zipError}
          />
        </label>
        <Button type="submit" variant="secondary">
          Search
        </Button>
        {zipError && (
          <p role="alert" className="form-error">
            {zipError}
          </p>
        )}
      </form>

      {origin && !loading && current?.data && (
        <p className="muted">
          {current.data.stores.length} {current.data.stores.length === 1 ? 'store' : 'stores'}{' '}
          {'zip' in origin ? `near ${origin.zip}` : 'near you'}
        </p>
      )}

      {loading && (
        <p className="muted" role="status">
          {location.locating ? 'Finding your location…' : 'Loading stores…'}
        </p>
      )}

      {current?.error && (
        <div className="stack" role="alert">
          <p className="form-error">{current.error}</p>
          <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </Button>
        </div>
      )}

      {current?.data && current.data.stores.length === 0 && (
        <p className="muted">
          No stores within {radius} {unit}.{' '}
          {radius < 25 ? 'Try a wider distance.' : 'Try a different ZIP code.'}
        </p>
      )}

      {current?.data && current.data.stores.length > 0 && (
        <ul className="card-list">
          {current.data.stores.map((s) => (
            <li key={s.storeId}>
              <Link className="store-card" to={`/stores/${s.storeId}`}>
                <StoreIcon name={s.businessName} />
                <span className="store-card-body">
                  <span className="store-card-name">
                    {s.businessName}
                    {s.isVerified && <VerifiedCheck />}
                  </span>
                  <span className="muted">{formatAddress(s)}</span>
                </span>
                <span className="store-card-distance">
                  {s.distance.toFixed(1)} {unit}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
