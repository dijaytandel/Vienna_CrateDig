import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { listStores, type Origin, type Radius, type StoreList } from '../../api/stores';
import { useAuth } from '../../auth/context';
import Button from '../../components/ui/Button';
import { PillGroup } from '../../components/ui/Pill';
import { formatAddress } from './format';
import StoreIcon, { VerifiedCheck } from './StoreIcon';

const RADII: Radius[] = [5, 10, 25];

const isRadius = (n: number): n is Radius => (RADII as number[]).includes(n);
const isZip = (z: string | null): z is string => !!z && /^\d{5}$/.test(z);
const hasGps = () => typeof navigator !== 'undefined' && !!navigator.geolocation;

const originKey = (o: Origin) => ('zip' in o ? o.zip : `${o.lat.toFixed(4)},${o.lng.toFixed(4)}`);

function errorMessage(err: unknown, origin: Origin) {
  if (err instanceof ApiError && err.code === 'ZIP_NOT_FOUND' && 'zip' in origin) {
    return `We don't have a location for ZIP ${origin.zip}. Try a nearby ZIP code.`;
  }
  return err instanceof ApiError ? err.message : 'Something went wrong. Try again.';
}

type Gps = { done: boolean; coords: { lat: number; lng: number } | null };

export default function StoresScreen() {
  const { preferences } = useAuth();
  const unit = preferences?.distanceUnit ?? 'mi';
  // A searched ZIP and chosen radius live in the URL so Back from a store restores them.
  const [params, setParams] = useSearchParams();
  const zipParam = params.get('zip');
  const searchedZip = isZip(zipParam) ? zipParam : null;
  const radiusParam = Number(params.get('radius'));
  const radius: Radius = isRadius(radiusParam) ? radiusParam : (preferences?.radiusMiles ?? 10);
  const savedZip = preferences?.defaultZip ?? null;

  const [gps, setGps] = useState<Gps>(() => ({ done: !hasGps(), coords: null }));
  const [zipInput, setZipInput] = useState(searchedZip ?? '');
  const [zipError, setZipError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    data?: StoreList;
    error?: string;
  } | null>(null);

  // A searched ZIP wins; otherwise GPS, then the saved ZIP, then ask for one.
  const needGps = !searchedZip && !gps.done;
  useEffect(() => {
    if (!needGps) return;
    let active = true;
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        active &&
        setGps({ done: true, coords: { lat: pos.coords.latitude, lng: pos.coords.longitude } }),
      () => active && setGps({ done: true, coords: null }),
      { timeout: 10_000, maximumAge: 300_000 },
    );
    return () => {
      active = false;
    };
  }, [needGps]);

  const origin = useMemo<Origin | null>(() => {
    if (searchedZip) return { zip: searchedZip };
    if (gps.coords) return gps.coords;
    if (gps.done && savedZip) return { zip: savedZip };
    return null;
  }, [searchedZip, gps, savedZip]);
  const locating = needGps;
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

  const setParam = (name: string, value: string) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        next.set(name, value);
        return next;
      },
      { replace: true },
    );

  const onZip = (e: FormEvent) => {
    e.preventDefault();
    const zip = zipInput.trim();
    if (!isZip(zip)) {
      setZipError('Enter a 5-digit ZIP code.');
      return;
    }
    setZipError(null);
    setParam('zip', zip);
  };

  const current = result && result.key === key ? result : null;
  const loading = locating || (!!key && !current);

  return (
    <section className="stack">
      <h1>Record Stores</h1>
      <PillGroup
        label="Distance"
        options={RADII.map((r) => ({ value: r, label: `Within ${r} ${unit}` }))}
        value={radius}
        onChange={(r) => setParam('radius', String(r))}
      />

      <form className="zip-form" onSubmit={onZip} noValidate>
        <label className="field">
          {origin ? 'Search near a different ZIP' : 'Enter a ZIP code to find stores near you'}
          <input
            className="input"
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
          {locating ? 'Finding your location…' : 'Loading stores…'}
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
