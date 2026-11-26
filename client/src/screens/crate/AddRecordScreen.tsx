import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, errorText } from '../../api/client';
import type { CatalogResult } from '../../api/catalog';
import CatalogResultButton from '../../components/CatalogResultButton';
import { addCrateItem, type ListType } from '../../api/crate';
import AlbumBadge from '../../components/ui/AlbumBadge';
import Button from '../../components/ui/Button';
import { PillGroup } from '../../components/ui/Pill';
import { newId, parseUsd } from '../../lib/format';
import { useCatalogSearch } from '../../lib/useCatalogSearch';
import { emptyFields, type FieldValues } from './fields';
import RecordFields from './RecordFields';

const LISTS = [
  { value: 'collection', label: 'Collection' },
  { value: 'want_list', label: 'Want List' },
] as const;

export default function AddRecordScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [listType, setListType] = useState<ListType>(
    params.get('list') === 'want_list' ? 'want_list' : 'collection',
  );
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<CatalogResult | null>(null);
  const [fields, setFields] = useState<FieldValues>(emptyFields);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState(false);
  const [key] = useState(newId);
  const { results, error: searchError, searching } = useCatalogSearch(query);

  const price = parseUsd(fields.price);
  const priceError = Number.isNaN(price) ? 'Enter a dollar amount like 24.99' : null;

  const save = async (force = false) => {
    if (!selected || priceError) return;
    setSaving(true);
    setError(null);
    try {
      await addCrateItem(
        {
          apiSourceId: selected.apiSourceId,
          listType,
          conditionGrade: fields.conditionGrade,
          specialAttributes: fields.specialAttributes,
          purchasePriceUsd: listType === 'collection' ? price : null,
          userNotes: fields.userNotes.trim() || null,
          force,
        },
        force ? `${key.slice(0, -1)}f` : key,
      );
      try {
        localStorage.setItem('cratedig.crateTab', listType);
      } catch {
        // best-effort
      }
      navigate('/crate', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ALREADY_OWNED') setDuplicate(true);
      else setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void save();
  };

  if (selected) {
    return (
      <form className="stack" onSubmit={onSubmit} noValidate>
        <h1>Add a Record</h1>
        <div className="store-header">
          <AlbumBadge
            artistName={selected.artistName}
            albumTitle={selected.albumTitle}
            coverArtUrl={selected.coverArtUrl}
            size={64}
          />
          <div>
            <p className="store-card-name">{selected.albumTitle}</p>
            <p className="muted">
              {selected.artistName}
              {selected.releaseYear ? ` · ${selected.releaseYear}` : ''}
            </p>
          </div>
        </div>
        <Button type="button" variant="secondary" onClick={() => setSelected(null)}>
          Choose a different record
        </Button>
        <PillGroup label="Add to" options={LISTS} value={listType} onChange={setListType} />
        <RecordFields
          values={fields}
          onChange={setFields}
          priceLabel={
            listType === 'collection' ? 'Price paid (USD)' : 'Target price (USD, optional)'
          }
          priceError={priceError}
        />
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        {duplicate && (
          <div role="alertdialog" aria-label="Already in your Collection" className="notice">
            <p>You already own this record. Add another copy?</p>
            <div className="button-row">
              <Button type="button" variant="secondary" onClick={() => setDuplicate(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void save(true)} disabled={saving}>
                Add anyway
              </Button>
            </div>
          </div>
        )}
        <div className="action-bar">
          <Button type="submit" block disabled={saving || duplicate}>
            {saving
              ? 'Saving…'
              : `Save to ${listType === 'collection' ? 'Collection' : 'Want List'}`}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <section className="stack">
      <h1>Add a Record</h1>
      <label className="field">
        Search the catalog
        <input
          className="input"
          type="search"
          autoFocus
          placeholder="Artist or album"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {query.trim().length < 2 && <p className="muted">Type at least 2 characters.</p>}
      {searching && (
        <p className="muted" role="status">
          Searching…
        </p>
      )}
      {searchError && (
        <p role="alert" className="form-error">
          {searchError}
        </p>
      )}
      {!searching && query.trim().length >= 2 && !searchError && results.length === 0 && (
        <p className="muted">No vinyl releases match “{query.trim()}”.</p>
      )}
      <ul className="card-list" aria-label="Catalog results">
        {results.map((r) => (
          <li key={r.apiSourceId}>
            <CatalogResultButton
              result={r}
              onSelect={() => {
                setSelected(r);
                setFields(emptyFields);
                setDuplicate(false);
              }}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
