import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { errorText } from '../../api/client';
import { updateMyStore } from '../../api/merchant';
import type { DayHours, DayKey, StoreDetail } from '../../api/stores';
import Button from '../../components/ui/Button';
import TagInput from '../../components/ui/TagInput';
import { useAsync } from '../../lib/useAsync';
import { DAYS } from '../stores/format';
import { loadMyStore, phoneError } from './myStore';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$|^24:00$/;
const DEFAULT_HOURS = { open: '11:00', close: '19:00' };

const websiteError = (v: string) =>
  v.trim() === '' || /^https?:\/\/\S+\.\S+/.test(v.trim())
    ? null
    : 'Website must start with http:// or https://';

export default function MerchantStoreScreen() {
  const mine = useAsync((signal) => loadMyStore(signal), []);
  if (mine.error) {
    return (
      <section className="stack" role="alert">
        <h1>Edit Store Profile</h1>
        <p className="form-error">{mine.error}</p>
        <Button variant="secondary" onClick={mine.reload}>
          Try again
        </Button>
      </section>
    );
  }
  if (!mine.data) {
    return (
      <section className="stack">
        <h1>Edit Store Profile</h1>
        <p className="muted" role="status">
          Loading…
        </p>
      </section>
    );
  }
  return <StoreForm store={mine.data.store} />;
}

function StoreForm({ store }: { store: StoreDetail }) {
  const [phone, setPhone] = useState(store.phone ?? '');
  const [website, setWebsite] = useState(store.websiteUrl ?? '');
  const [hours, setHours] = useState<Record<DayKey, DayHours>>(
    () =>
      Object.fromEntries(DAYS.map(({ key }) => [key, store.operatingHours[key] ?? null])) as Record<
        DayKey,
        DayHours
      >,
  );
  const [payments, setPayments] = useState(store.paymentMethods);
  const [tags, setTags] = useState(store.tags);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const phoneMsg = phoneError(phone);
  const webMsg = websiteError(website);
  const badHours = DAYS.some(({ key }) => {
    const h = hours[key];
    return h !== null && (!TIME.test(h.open) || !TIME.test(h.close));
  });
  const invalid = !!phoneMsg || !!webMsg || badHours;

  const setDay = (key: DayKey, h: DayHours) => {
    setSaved(false);
    setHours((all) => ({ ...all, [key]: h }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (invalid) return;
    setSaving(true);
    setError(null);
    try {
      await updateMyStore({
        phone: phone.trim() || null,
        websiteUrl: website.trim() || null,
        operatingHours: hours,
        paymentMethods: payments,
        tags,
      });
      setSaved(true);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="stack composer" onSubmit={submit} noValidate>
      <h1>Edit Store Profile</h1>
      <div className="card stack-tight">
        <strong>{store.businessName}</strong>
        <span className="muted">
          {store.streetAddress}, {store.city}, {store.state} {store.zip}
        </span>
        <span className="muted">
          Name, address and verification can only be changed by CrateDig support.
        </span>
      </div>

      <fieldset className="field plain stack-tight">
        <legend>Opening hours</legend>
        {DAYS.map(({ key, label }) => {
          const h = hours[key];
          return (
            <div key={key} className="hours-row">
              <span className="hours-day" aria-hidden="true">
                {label.slice(0, 3)}
              </span>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={h === null}
                  onChange={(e) => setDay(key, e.target.checked ? null : DEFAULT_HOURS)}
                />
                Closed
              </label>
              {h && (
                <>
                  <input
                    type="time"
                    aria-label={`${label} opens`}
                    value={h.open}
                    onChange={(e) => setDay(key, { ...h, open: e.target.value })}
                  />
                  <input
                    type="time"
                    aria-label={`${label} closes`}
                    value={h.close}
                    onChange={(e) => setDay(key, { ...h, close: e.target.value })}
                  />
                </>
              )}
            </div>
          );
        })}
        <p className="muted">A closing time before the opening time runs past midnight.</p>
      </fieldset>

      <div className="field">
        <label htmlFor="store-phone">Phone</label>
        <input
          id="store-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="(503) 555-0100"
          value={phone}
          aria-invalid={!!phoneMsg}
          aria-describedby={phoneMsg ? 'store-phone-error' : undefined}
          onChange={(e) => {
            setSaved(false);
            setPhone(e.target.value);
          }}
        />
        {phoneMsg && (
          <p id="store-phone-error" className="form-error">
            {phoneMsg}
          </p>
        )}
      </div>
      <div className="field">
        <label htmlFor="store-website">Website</label>
        <input
          id="store-website"
          type="url"
          inputMode="url"
          placeholder="https://"
          value={website}
          aria-invalid={!!webMsg}
          aria-describedby={webMsg ? 'store-website-error' : undefined}
          onChange={(e) => {
            setSaved(false);
            setWebsite(e.target.value);
          }}
        />
        {webMsg && (
          <p id="store-website-error" className="form-error">
            {webMsg}
          </p>
        )}
      </div>
      <TagInput
        label="Payment methods"
        value={payments}
        placeholder="Cash, Visa, Apple Pay…"
        onChange={(v) => {
          setSaved(false);
          setPayments(v.slice(0, 10));
        }}
      />
      <TagInput
        label="Specialties"
        value={tags}
        placeholder="Jazz, Used, Soul 45s…"
        onChange={(v) => {
          setSaved(false);
          setTags(v.slice(0, 10));
        }}
      />
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {saved && (
        <p className="toast" role="status">
          Saved. <Link to={`/stores/${store.storeId}`}>View your store page</Link>
        </p>
      )}
      <div className="action-bar">
        <Button type="submit" disabled={invalid || saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
