import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { errorText } from '../../api/client';
import { deleteCrateItem, getCrateItem, updateCrateItem, type CrateItem } from '../../api/crate';
import AlbumBadge from '../../components/ui/AlbumBadge';
import Button from '../../components/ui/Button';
import { formatDate, formatUsd, parseUsd } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import AcquireModal from './AcquireModal';
import type { FieldValues } from './fields';
import RecordFields from './RecordFields';

const toFields = (i: CrateItem): FieldValues => ({
  conditionGrade: i.conditionGrade,
  specialAttributes: i.specialAttributes,
  price: i.purchasePriceUsd == null ? '' : i.purchasePriceUsd.toFixed(2),
  userNotes: i.userNotes ?? '',
});

export default function CrateItemScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const {
    data: item,
    loading,
    error,
    setData,
  } = useAsync((signal) => getCrateItem(id, signal), [id]);
  const [fields, setFields] = useState<FieldValues | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [acquiring, setAcquiring] = useState(false);

  if (loading && !item) {
    return (
      <p className="muted" role="status">
        Loading…
      </p>
    );
  }
  if (!item) {
    return (
      <section className="stack">
        <h1>Crate Item</h1>
        <p role="alert" className="form-error">
          {error ?? 'This item is not in your crate.'}
        </p>
        <Link to="/crate">Back to My Crate</Link>
      </section>
    );
  }

  const values = fields ?? toFields(item);
  const price = parseUsd(values.price);
  const priceError = Number.isNaN(price) ? 'Enter a dollar amount like 24.99' : null;
  const r = item.record;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (priceError) return;
    setSaving(true);
    setActionError(null);
    try {
      const updated = await updateCrateItem(item.crateItemId, {
        conditionGrade: values.conditionGrade,
        specialAttributes: values.specialAttributes,
        purchasePriceUsd: price,
        userNotes: values.userNotes.trim() || null,
      });
      setData(updated);
      setFields(null);
      setMessage('Saved.');
    } catch (err) {
      setActionError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await deleteCrateItem(item.crateItemId);
      navigate('/crate', { replace: true });
    } catch (err) {
      setActionError(errorText(err));
      setConfirmDelete(false);
    }
  };

  return (
    <form className="stack" onSubmit={save} noValidate>
      <div className="store-header">
        <AlbumBadge
          artistName={r.artistName}
          albumTitle={r.albumTitle}
          coverArtUrl={r.coverArtUrl}
          size={72}
        />
        <div>
          <h1>{r.albumTitle}</h1>
          <p className="muted">{r.artistName}</p>
        </div>
      </div>
      {message && (
        <p role="status" className="toast">
          {message}
        </p>
      )}
      <dl className="details">
        <dt>List</dt>
        <dd>{item.listType === 'collection' ? 'Collection' : 'Want List'}</dd>
        {r.releaseYear && (
          <>
            <dt>Released</dt>
            <dd>{r.releaseYear}</dd>
          </>
        )}
        {r.recordLabel && (
          <>
            <dt>Label</dt>
            <dd>{r.recordLabel}</dd>
          </>
        )}
        {r.genre && (
          <>
            <dt>Genre</dt>
            <dd>{r.genre}</dd>
          </>
        )}
        <dt>Catalog ID</dt>
        <dd>{r.apiSourceId}</dd>
        <dt>Added</dt>
        <dd>{formatDate(item.createdAt)}</dd>
        {item.acquiredAt && (
          <>
            <dt>Acquired</dt>
            <dd>
              {formatDate(item.acquiredAt)}
              {item.purchasedStore ? ` at ${item.purchasedStore.businessName}` : ''}
              {item.purchasePriceUsd != null ? ` for ${formatUsd(item.purchasePriceUsd)}` : ''}
            </dd>
          </>
        )}
      </dl>
      <Link to={`/albums/${r.recordId}`}>Album details and nearby sightings</Link>

      <RecordFields
        values={values}
        onChange={setFields}
        priceLabel={item.listType === 'collection' ? 'Price paid (USD)' : 'Target price (USD)'}
        priceError={priceError}
      />
      {actionError && (
        <p role="alert" className="form-error">
          {actionError}
        </p>
      )}

      {confirmDelete ? (
        <div role="alertdialog" aria-label="Delete this record?" className="notice">
          <p>Remove {r.albumTitle} from your crate?</p>
          <div className="button-row">
            <Button type="button" variant="secondary" onClick={() => setConfirmDelete(false)}>
              Keep it
            </Button>
            <Button type="button" onClick={() => void remove()}>
              Delete
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="secondary" onClick={() => setConfirmDelete(true)}>
          Delete from crate
        </Button>
      )}

      <div className="action-bar">
        {item.listType === 'want_list' && (
          <Button type="button" block onClick={() => setAcquiring(true)}>
            Mark as acquired
          </Button>
        )}
        <Button
          type="submit"
          variant={item.listType === 'want_list' ? 'secondary' : 'primary'}
          block
          disabled={saving || !fields}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>

      {acquiring && (
        <AcquireModal
          item={item}
          onClose={() => setAcquiring(false)}
          onDone={({ item: updated, message: text }) => {
            setData(updated);
            setFields(null);
            setAcquiring(false);
            setMessage(text);
          }}
        />
      )}
    </form>
  );
}
