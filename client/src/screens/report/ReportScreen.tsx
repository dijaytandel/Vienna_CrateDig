import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { CatalogResult } from '../../api/catalog';
import { errorText, isOfflineError } from '../../api/client';
import type { ConditionGrade } from '../../api/crate';
import { getRecord } from '../../api/records';
import { nearestStore, reportSighting, type NewSighting } from '../../api/sightings';
import { listStores, type StoreListItem } from '../../api/stores';
import { useAuth } from '../../auth/context';
import CatalogResultButton from '../../components/CatalogResultButton';
import AlbumBadge from '../../components/ui/AlbumBadge';
import Button from '../../components/ui/Button';
import { Pill } from '../../components/ui/Pill';
import TagInput from '../../components/ui/TagInput';
import { ATTRIBUTE_SUGGESTIONS, CONDITIONS, newId, parseUsd } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import { useCatalogSearch } from '../../lib/useCatalogSearch';
import { originKey, useCurrentOrigin } from '../../lib/useCurrentOrigin';
import { enqueue } from '../../offline/queue';

type Picked = Pick<CatalogResult, 'artistName' | 'albumTitle' | 'coverArtUrl' | 'releaseYear'> & {
  apiSourceId?: string;
  recordId?: string;
};

const STEPS = ['Album', 'Store', 'Condition', 'Price', 'Attributes'] as const;

export default function ReportScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { preferences } = useAuth();
  const unit = preferences?.distanceUnit ?? 'mi';
  const prefRecordId = params.get('recordId');
  const prefStoreId = params.get('storeId');

  const [step, setStep] = useState(0);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Picked | null>(null);
  const [storeChoice, setStoreId] = useState<string | null>(prefStoreId);
  const [dropPrefill, setDropPrefill] = useState(false);
  const [condition, setCondition] = useState<ConditionGrade | null>(null);
  const [price, setPrice] = useState('');
  const [attributes, setAttributes] = useState<string[]>([]);
  const [zip, setZip] = useState<string | null>(null);
  const [zipInput, setZipInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [clientRef] = useState(newId);

  const prefill = useAsync(
    prefRecordId ? (signal) => getRecord(prefRecordId, null, unit, signal) : null,
    [prefRecordId],
  );
  const prefilled: Picked | null = prefill.data
    ? { ...prefill.data, recordId: prefill.data.recordId }
    : null;
  const album = picked ?? (dropPrefill ? null : prefilled);

  const search = useCatalogSearch(album ? '' : query);
  const { origin, locating, coords } = useCurrentOrigin(zip);
  const stores = useAsync(origin ? (signal) => listStores(origin, 25, unit, signal) : null, [
    originKey(origin),
    unit,
  ]);
  const nearest = useAsync(
    coords && !zip ? (signal) => nearestStore(coords.lat, coords.lng, signal) : null,
    [coords?.lat, coords?.lng, zip],
  );

  const options = useMemo<StoreListItem[]>(() => {
    const list = stores.data?.stores ?? [];
    const n = nearest.data?.store;
    return n && !list.some((s) => s.storeId === n.storeId) ? [n, ...list] : list;
  }, [stores.data, nearest.data]);

  // GPS pre-selects the nearest verified store; the dropdown can still override it.
  const nearestId = nearest.data?.store.storeId;
  const chosenId = storeChoice ?? nearestId ?? '';
  // Only a store the collector can see in the dropdown counts as selected.
  const storeId = options.some((s) => s.storeId === chosenId) ? chosenId : '';

  const priceUsd = price.trim() === '' ? null : parseUsd(price);
  const priceError = Number.isNaN(priceUsd) ? 'Enter a dollar amount like 24.99' : null;
  const canSubmit = !!album && !!storeId && !!condition && !priceError;
  const ready = [!!album, !!storeId, !!condition, !priceError, true];

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!album || !condition || !canSubmit) return;
    const body: NewSighting = {
      ...(album.recordId ? { recordId: album.recordId } : { apiSourceId: album.apiSourceId }),
      storeId,
      conditionGrade: condition,
      priceUsd,
      specialAttributes: attributes,
    };
    setBusy(true);
    setError(null);
    try {
      const created = await reportSighting(body, clientRef);
      navigate(`/sightings/${created.sightingId}`, {
        replace: true,
        state: { toast: 'Thanks! Your sighting is live on Discover.' },
      });
    } catch (err) {
      if (isOfflineError(err)) {
        enqueue({ kind: 'report_sighting', body, idempotencyKey: clientRef });
        navigate('/discover', {
          replace: true,
          state: { toast: "You're offline — your sighting will be sent when you reconnect." },
        });
      } else {
        setError(errorText(err));
      }
    } finally {
      setBusy(false);
    }
  };

  const onZip = (e: FormEvent) => {
    e.preventDefault();
    if (/^\d{5}$/.test(zipInput)) {
      setZip(zipInput);
      setStoreId('');
    }
  };

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <h1>Report a Sighting</h1>
      <ol className="stepper" aria-label="Steps">
        {STEPS.map((label, i) => (
          <li key={label}>
            <button
              type="button"
              className={i === step ? 'step step-current' : 'step'}
              aria-current={i === step ? 'step' : undefined}
              disabled={i > 0 && !ready.slice(0, i).every(Boolean)}
              onClick={() => setStep(i)}
            >
              <span aria-hidden="true">{i + 1}</span> {label}
            </button>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <section className="stack" aria-label="Album">
          {album ? (
            <div className="store-header">
              <AlbumBadge
                artistName={album.artistName}
                albumTitle={album.albumTitle}
                coverArtUrl={album.coverArtUrl}
                size={64}
              />
              <div className="grow">
                <p className="store-card-name">{album.albumTitle}</p>
                <p className="muted">
                  {album.artistName}
                  {album.releaseYear ? ` · ${album.releaseYear}` : ''}
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setPicked(null);
                  setDropPrefill(true);
                }}
              >
                Change
              </Button>
            </div>
          ) : prefRecordId && !dropPrefill && !prefill.error && !prefill.data ? (
            <p className="muted" role="status">
              Loading album…
            </p>
          ) : (
            <>
              <label className="field">
                Album or artist
                <input
                  className="input"
                  type="search"
                  value={query}
                  autoFocus
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Type at least 2 characters"
                />
              </label>
              {search.searching && <p className="muted">Searching…</p>}
              {search.error && <p className="form-error">{search.error}</p>}
              <ul className="card-list" aria-label="Catalog results">
                {search.results.map((r) => (
                  <li key={r.apiSourceId}>
                    <CatalogResultButton
                      result={r}
                      onSelect={() => {
                        setPicked(r);
                        setStep(1);
                      }}
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {step === 1 && (
        <section className="stack" aria-label="Store">
          {locating && <p className="muted">Finding stores near you…</p>}
          {!locating && !origin && (
            <p className="muted">Location is off. Enter a ZIP to list stores by distance.</p>
          )}
          {nearestId && storeId === nearestId && (
            <p className="muted" role="status">
              Nearest store selected from your location.
            </p>
          )}
          <label className="field">
            Store
            <select className="input" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
              <option value="">Choose a store</option>
              {options.map((s) => (
                <option key={s.storeId} value={s.storeId}>
                  {s.businessName} — {s.distance.toFixed(1)} {unit}
                  {s.isVerified ? '' : ' (unverified)'}
                </option>
              ))}
            </select>
          </label>
          {stores.error && <p className="form-error">{stores.error}</p>}
          <div className="zip-form">
            <label className="field">
              {origin ? 'Stores near a different ZIP' : 'ZIP code'}
              <input
                className="input"
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={5}
                value={zipInput}
                onChange={(e) => setZipInput(e.target.value)}
              />
            </label>
            <Button type="button" variant="secondary" onClick={onZip}>
              Use ZIP
            </Button>
          </div>
        </section>
      )}

      {step === 2 && (
        <fieldset className="field plain">
          <legend>Condition</legend>
          <div className="tag-list">
            {CONDITIONS.map((c) => (
              <Pill
                key={c.value}
                type="button"
                selected={condition === c.value}
                aria-pressed={condition === c.value}
                onClick={() => {
                  setCondition(c.value);
                  setStep(3);
                }}
              >
                {c.label}
              </Pill>
            ))}
          </div>
        </fieldset>
      )}

      {step === 3 && (
        <label className="field">
          Price (USD, optional)
          <span className="input-prefix">
            <span aria-hidden="true">$</span>
            <input
              className="input"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="24.99"
              aria-invalid={!!priceError}
            />
          </span>
          {priceError && <span className="form-error">{priceError}</span>}
        </label>
      )}

      {step === 4 && (
        <section className="stack" aria-label="Special attributes">
          <TagInput
            label="Special attributes (optional)"
            value={attributes}
            onChange={(t) => setAttributes(t.slice(0, 10))}
            placeholder="Type and press Enter"
          />
          <div className="tag-list" aria-label="Suggested attributes">
            {ATTRIBUTE_SUGGESTIONS.filter((a) => !attributes.includes(a)).map((a) => (
              <Pill
                key={a}
                type="button"
                onClick={() => setAttributes([...attributes, a].slice(0, 10))}
              >
                + {a}
              </Pill>
            ))}
          </div>
        </section>
      )}

      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}

      <div className="action-bar">
        {step > 0 && (
          <Button type="button" variant="secondary" onClick={() => setStep(step - 1)}>
            Back
          </Button>
        )}
        {step < STEPS.length - 1 && !(step >= 2 && canSubmit) && (
          <Button type="button" disabled={!ready[step]} onClick={() => setStep(step + 1)}>
            Next
          </Button>
        )}
        {step >= 2 && canSubmit && (
          <>
            {step < STEPS.length - 1 && (
              <Button type="button" variant="secondary" onClick={() => setStep(step + 1)}>
                Next
              </Button>
            )}
            <Button type="submit" disabled={busy}>
              {busy ? 'Submitting…' : 'Submit sighting'}
            </Button>
          </>
        )}
      </div>
    </form>
  );
}
