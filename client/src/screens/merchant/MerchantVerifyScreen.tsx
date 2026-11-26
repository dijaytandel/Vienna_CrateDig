import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { errorText } from '../../api/client';
import {
  CLAIM_LABELS,
  getMyClaim,
  listClaimableStores,
  submitClaim,
  type StoreClaim,
} from '../../api/verification';
import Button from '../../components/ui/Button';
import { useAsync } from '../../lib/useAsync';

const STATUS_TEXT: Record<StoreClaim['status'], string> = {
  pending: 'CrateDig staff are checking your business license.',
  verified: 'You are the verified manager. Reload the app if the Merchant menu is not showing yet.',
  rejected: 'We could not verify this license. You can apply again with a different link.',
};

const licenseError = (v: string) => {
  const t = v.trim();
  if (t === '') return null;
  try {
    return new URL(t).protocol === 'https:' ? null : 'License link must start with https://';
  } catch {
    return 'License link must start with https://';
  }
};

export default function MerchantVerifyScreen() {
  const data = useAsync(async (signal) => {
    const [mine, list] = await Promise.all([getMyClaim(signal), listClaimableStores(signal)]);
    return { claim: mine.claim, stores: list.stores };
  }, []);
  const [submitted, setSubmitted] = useState<StoreClaim | null>(null);
  const claim = submitted ?? data.data?.claim ?? null;

  return (
    <section className="stack composer">
      <h1>Verify as Store Manager</h1>
      <p className="muted">
        Store managers confirm sightings, post new-arrival broadcasts and keep their listing up to
        date. Apply with a link to your business license; CrateDig staff review every claim.
      </p>
      {data.error && (
        <div className="stack" role="alert">
          <p className="form-error">{data.error}</p>
          <Button variant="secondary" onClick={data.reload}>
            Try again
          </Button>
        </div>
      )}
      {data.loading && !data.data && (
        <p className="muted" role="status">
          Loading…
        </p>
      )}
      {claim && (
        <div className="card stack-tight" aria-labelledby="claim-heading">
          <h2 id="claim-heading">Your application</h2>
          <p>
            <strong>{claim.businessName}</strong>{' '}
            <span className="muted">
              · {claim.city}, {claim.state}
            </span>
          </p>
          <p>
            Status:{' '}
            <strong className={`claim-${claim.status}`}>{CLAIM_LABELS[claim.status]}</strong>
          </p>
          <p className="muted">{STATUS_TEXT[claim.status]}</p>
          {claim.status === 'verified' && <Link to="/merchant">Go to the merchant dashboard</Link>}
        </div>
      )}
      {data.data && claim?.status !== 'verified' && (
        <ClaimForm
          stores={data.data.stores}
          current={claim}
          onSubmitted={(c) => {
            setSubmitted(c);
          }}
        />
      )}
    </section>
  );
}

function ClaimForm({
  stores,
  current,
  onSubmitted,
}: {
  stores: { storeId: string; businessName: string; city: string; state: string }[];
  current: StoreClaim | null;
  onSubmitted: (claim: StoreClaim) => void;
}) {
  const [storeId, setStoreId] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urlMsg = licenseError(url);
  const ready = storeId !== '' && url.trim() !== '' && !urlMsg;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      onSubmitted((await submitClaim(storeId, url.trim())).claim);
      setStoreId('');
      setUrl('');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <h2>{current ? 'Apply again' : 'Apply'}</h2>
      {current?.status === 'pending' && (
        <p className="muted">Applying for a different store replaces your pending application.</p>
      )}
      <div className="field">
        <label htmlFor="claim-store">Store</label>
        <select
          id="claim-store"
          className="input"
          value={storeId}
          onChange={(e) => setStoreId(e.target.value)}
        >
          <option value="">Choose your store…</option>
          {stores.map((s) => (
            <option key={s.storeId} value={s.storeId}>
              {s.businessName} — {s.city}, {s.state}
            </option>
          ))}
        </select>
        {stores.length === 0 && (
          <p className="muted">Every listed store is already verified or under review.</p>
        )}
      </div>
      <div className="field">
        <label htmlFor="claim-url">Business license URL</label>
        <input
          className="input"
          id="claim-url"
          type="url"
          inputMode="url"
          placeholder="https://"
          value={url}
          aria-invalid={!!urlMsg}
          aria-describedby={urlMsg ? 'claim-url-error' : 'claim-url-help'}
          onChange={(e) => setUrl(e.target.value)}
        />
        {urlMsg ? (
          <p id="claim-url-error" className="form-error">
            {urlMsg}
          </p>
        ) : (
          <p id="claim-url-help" className="muted">
            A link to your license on your state or city registry, or a shared document.
          </p>
        )}
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="action-bar">
        <Button type="submit" disabled={!ready || busy}>
          {busy ? 'Submitting…' : 'Submit for review'}
        </Button>
      </div>
    </form>
  );
}
