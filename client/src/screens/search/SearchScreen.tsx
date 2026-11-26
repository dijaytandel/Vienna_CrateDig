import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError, errorText } from '../../api/client';
import { searchSightings, type SearchResponse } from '../../api/search';
import type { Origin, Radius } from '../../api/stores';
import { useAuth } from '../../auth/context';
import AlbumBadge from '../../components/ui/AlbumBadge';
import Button from '../../components/ui/Button';
import { PillGroup } from '../../components/ui/Pill';
import { conditionLabel, formatUsd } from '../../lib/format';
import { isZip, readGuestZip, saveGuestZip } from '../../lib/guestZip';
import { originKey, useCurrentOrigin } from '../../lib/useCurrentOrigin';
import { VerifiedCheck } from '../stores/StoreIcon';

const RADII: Radius[] = [5, 10, 25];
const isRadius = (n: number): n is Radius => (RADII as number[]).includes(n);

function errorMessage(err: unknown, origin: Origin) {
  if (err instanceof ApiError && err.code === 'ZIP_NOT_FOUND' && 'zip' in origin) {
    return `We don't have a location for ZIP ${origin.zip}. Try a nearby ZIP code.`;
  }
  return errorText(err);
}

export default function SearchScreen() {
  const { session, preferences } = useAuth();
  const unit = preferences?.distanceUnit ?? 'mi';
  // Query, filters and a typed ZIP live in the URL so Back from a result restores them.
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const genre = params.get('genre') ?? '';
  const radiusParam = Number(params.get('radius'));
  const radius: Radius = isRadius(radiusParam) ? radiusParam : (preferences?.radiusMiles ?? 10);
  const zipParam = params.get('zip');
  const [guestZip, setGuestZip] = useState(readGuestZip);

  const located = useCurrentOrigin(isZip(zipParam) ? zipParam : null);
  // Guests have no saved ZIP, so the one they typed last time stands in for it.
  const origin: Origin | null =
    located.origin ?? (!session && located.gpsDenied && guestZip ? { zip: guestZip } : null);
  const needZip = !origin && !located.locating;

  const [text, setText] = useState(q);
  const [zipInput, setZipInput] = useState(isZip(zipParam) ? zipParam : '');
  const [zipError, setZipError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: SearchResponse; error?: string }>();

  const setParam = (name: string, value: string) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        if (value) next.set(name, value);
        else next.delete(name);
        return next;
      },
      { replace: true },
    );

  useEffect(() => {
    if (text.trim() === q.trim()) return;
    const timer = setTimeout(() => setParam('q', text.trim()), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, q]);

  const key = origin ? `${originKey(origin)}|${q}|${genre}|${radius}|${unit}|${attempt}` : null;
  useEffect(() => {
    if (!origin || !key) return;
    const controller = new AbortController();
    searchSightings({ q, genre, radius, unit, origin }, controller.signal).then(
      (data) => setResult({ key, data }),
      (err: unknown) => {
        if (!controller.signal.aborted) setResult({ key, error: errorMessage(err, origin) });
      },
    );
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const onZip = (e: FormEvent) => {
    e.preventDefault();
    const zip = zipInput.trim();
    if (!isZip(zip)) {
      setZipError('Enter a 5-digit ZIP code.');
      return;
    }
    setZipError(null);
    if (!session) {
      saveGuestZip(zip);
      setGuestZip(zip);
    }
    setParam('zip', zip);
  };

  const current = result && result.key === key ? result : null;
  const loading = located.locating || (!!key && !current);
  const genres = current?.data?.genres ?? [];
  const genreOptions = genre && !genres.includes(genre) ? [genre, ...genres] : genres;
  const results = current?.data?.results;

  return (
    <section className="stack">
      <h1>Search</h1>
      <label className="field">
        Artist, album or genre
        <input
          className="input"
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Kind of Blue"
          enterKeyHint="search"
        />
      </label>
      <PillGroup
        label="Distance"
        options={RADII.map((r) => ({ value: r, label: `${r} ${unit}` }))}
        value={radius}
        onChange={(r) => setParam('radius', String(r))}
      />
      <label className="field">
        Genre
        <select className="input" value={genre} onChange={(e) => setParam('genre', e.target.value)}>
          <option value="">All genres</option>
          {genreOptions.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </label>

      {(needZip || isZip(zipParam) || (origin && 'zip' in origin)) && (
        <form className="zip-form" onSubmit={onZip} noValidate>
          <label className="field">
            {origin
              ? 'Search near a different ZIP'
              : 'Enter your 5-digit ZIP code to search nearby'}
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
            Use ZIP
          </Button>
          {zipError && (
            <p role="alert" className="form-error">
              {zipError}
            </p>
          )}
        </form>
      )}

      {loading && (
        <p className="muted" role="status">
          {located.locating ? 'Finding your location…' : 'Searching…'}
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

      {results && !loading && (
        <p className="muted" role="status">
          {results.length} {results.length === 1 ? 'copy' : 'copies'} within {radius} {unit}
          {origin && 'zip' in origin ? ` of ${origin.zip}` : ''}
        </p>
      )}

      {results && results.length === 0 && !loading && (
        <div className="notice stack-tight">
          <p>Nobody has spotted {q ? `“${q}”` : 'a match'} nearby yet.</p>
          <div className="button-row">
            {radius < 25 && (
              <Button variant="secondary" onClick={() => setParam('radius', '25')}>
                Widen to 25 {unit}
              </Button>
            )}
            <Link
              className="button-secondary"
              to={`/crate/add?list=want_list${q ? `&q=${encodeURIComponent(q)}` : ''}`}
            >
              Add to Want List
            </Link>
          </div>
        </div>
      )}

      {results && results.length > 0 && (
        <ul className="card-list">
          {results.map((r) => (
            <li key={r.sightingId}>
              <Link className="sighting-card" to={`/sightings/${r.sightingId}`}>
                <AlbumBadge
                  artistName={r.record.artistName}
                  albumTitle={r.record.albumTitle}
                  coverArtUrl={r.record.coverArtUrl}
                />
                <span className="store-card-body">
                  <span className="store-card-name">{r.record.albumTitle}</span>
                  <span className="muted">{r.record.artistName}</span>
                  <span className="muted">
                    {r.store.businessName} · {r.distance.toFixed(1)} {unit}
                  </span>
                  <span className="muted">
                    {conditionLabel(r.conditionGrade)}
                    {r.storeVerified && (
                      <>
                        {' · '}
                        <VerifiedCheck /> Verified by store
                      </>
                    )}
                  </span>
                </span>
                <span className="store-card-distance">{formatUsd(r.priceUsd)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
