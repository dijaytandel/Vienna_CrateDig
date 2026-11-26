import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { createBroadcast, listMyBroadcasts, saveCatalogRecord } from '../../api/broadcasts';
import type { CatalogResult } from '../../api/catalog';
import { ApiError, errorText } from '../../api/client';
import type { BroadcastDetail } from '../../api/feed';
import { getStore } from '../../api/stores';
import BroadcastView from '../../components/BroadcastView';
import CatalogResultButton from '../../components/CatalogResultButton';
import AlbumBadge from '../../components/ui/AlbumBadge';
import Button from '../../components/ui/Button';
import { photoUrlError } from '../../lib/httpsUrl';
import { useAsync } from '../../lib/useAsync';
import { useCatalogSearch } from '../../lib/useCatalogSearch';

export const SUMMARY_MAX = 500;
export const FEATURED_MAX = 10;

type Featured = BroadcastDetail['featured'][number];

export default function BroadcastComposerScreen() {
  const navigate = useNavigate();
  const store = useAsync(async (signal) => {
    const { storeId } = await listMyBroadcasts(signal);
    return getStore(storeId, signal);
  }, []);

  const [summary, setSummary] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [featured, setFeatured] = useState<Featured[]>([]);
  const [query, setQuery] = useState('');
  const catalog = useCatalogSearch(query);
  const [picking, setPicking] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = summary.trim();
  const photoError = photoUrlError(photoUrl);
  const summaryError = trimmed ? null : 'Describe what arrived.';
  const canSubmit = !summaryError && !photoError && summary.length <= SUMMARY_MAX;

  const pick = async (result: CatalogResult) => {
    if (featured.length >= FEATURED_MAX) return;
    setPicking(result.apiSourceId);
    setPickError(null);
    try {
      const saved = await saveCatalogRecord(result.apiSourceId);
      setFeatured((list) =>
        list.some((f) => f.recordId === saved.recordId) || list.length >= FEATURED_MAX
          ? list
          : [
              ...list,
              {
                recordId: saved.recordId,
                artistName: saved.artistName,
                albumTitle: saved.albumTitle,
                releaseYear: saved.releaseYear,
                genre: saved.genre,
                coverArtUrl: saved.coverArtUrl,
              },
            ],
      );
      setQuery('');
    } catch (err) {
      setPickError(errorText(err));
    } finally {
      setPicking(null);
    }
  };

  const onPreview = (e: FormEvent) => {
    e.preventDefault();
    if (canSubmit) setPreview(true);
  };

  const publish = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const created = await createBroadcast({
        arrivalSummary: trimmed,
        photoUrl: photoUrl.trim() || null,
        featuredIds: featured.map((f) => f.recordId),
      });
      navigate('/merchant/broadcasts', {
        replace: true,
        state: {
          toast: created.notified?.sent
            ? `Broadcast published. ${created.notified.sent} collector device${created.notified.sent === 1 ? '' : 's'} notified.`
            : 'Broadcast published.',
        },
      });
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 403
          ? 'Only the verified manager of a store can publish broadcasts.'
          : errorText(err),
      );
      setSubmitting(false);
    }
  };

  if (preview) {
    const s = store.data;
    const detail: BroadcastDetail = {
      broadcastId: 'preview',
      arrivalSummary: trimmed,
      photoUrl: photoUrl.trim() || null,
      postedAt: new Date().toISOString(),
      unit: 'mi',
      distance: null,
      store: {
        storeId: s?.storeId ?? '',
        businessName: s?.businessName ?? 'Your store',
        isVerified: s?.isVerified ?? true,
        streetAddress: s?.streetAddress ?? '',
        city: s?.city ?? '',
        state: s?.state ?? '',
        zip: s?.zip ?? '',
      },
      featured,
    };
    return (
      <section className="stack">
        <h1>Preview</h1>
        <p className="muted">This is how collectors will see your broadcast.</p>
        <div className="preview-frame" aria-label="Broadcast preview">
          <BroadcastView broadcast={detail} />
        </div>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="button-row">
          <Button variant="secondary" onClick={() => setPreview(false)} disabled={submitting}>
            Edit
          </Button>
          <Button onClick={publish} disabled={submitting}>
            {submitting ? 'Publishing…' : 'Publish'}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="stack composer">
      <h1>New Broadcast</h1>
      <form className="stack" onSubmit={onPreview} noValidate>
        <label className="field">
          What just arrived?
          <textarea
            className="input"
            rows={5}
            maxLength={SUMMARY_MAX}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            aria-describedby="summary-count"
            placeholder="200 fresh soul and funk 45s, a crate of '70s jazz LPs…"
          />
        </label>
        <p
          id="summary-count"
          className={summary.length >= SUMMARY_MAX ? 'counter counter-full' : 'counter muted'}
          aria-live="polite"
        >
          {summary.length}/{SUMMARY_MAX}
        </p>

        <label className="field">
          Photo link (optional)
          <input
            className="input"
            type="url"
            inputMode="url"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            placeholder="https://"
            aria-invalid={!!photoError}
          />
        </label>
        {photoError && <p className="form-error">{photoError}</p>}

        <fieldset className="field plain stack-tight">
          <legend>
            Featured records ({featured.length}/{FEATURED_MAX})
          </legend>
          {featured.length > 0 && (
            <ul className="card-list" aria-label="Featured records">
              {featured.map((f) => (
                <li key={f.recordId} className="store-card">
                  <AlbumBadge
                    artistName={f.artistName}
                    albumTitle={f.albumTitle}
                    coverArtUrl={f.coverArtUrl}
                  />
                  <span className="store-card-body">
                    <span className="store-card-name">{f.albumTitle}</span>
                    <span className="muted">{f.artistName}</span>
                  </span>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setFeatured((list) => list.filter((x) => x.recordId !== f.recordId))
                    }
                    aria-label={`Remove ${f.albumTitle}`}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {featured.length < FEATURED_MAX ? (
            <label className="field">
              Find a record to feature
              <input
                className="input"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Artist or album"
              />
            </label>
          ) : (
            <p className="muted">You can feature up to {FEATURED_MAX} records.</p>
          )}
          {catalog.searching && (
            <p className="muted" role="status">
              Searching…
            </p>
          )}
          {(catalog.error || pickError) && (
            <p role="alert" className="form-error">
              {catalog.error ?? pickError}
            </p>
          )}
          {catalog.results.length > 0 && featured.length < FEATURED_MAX && (
            <ul className="card-list" aria-label="Catalog results">
              {catalog.results.slice(0, 8).map((r) => (
                <li key={r.apiSourceId}>
                  <CatalogResultButton
                    result={r}
                    onSelect={() => {
                      if (!picking) void pick(r);
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        {summaryError && summary.length > 0 && <p className="form-error">{summaryError}</p>}
        <div className="action-bar">
          <Button type="submit" block disabled={!canSubmit}>
            Preview
          </Button>
        </div>
      </form>
    </section>
  );
}
