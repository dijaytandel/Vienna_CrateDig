import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getStore, type StoreDetail } from '../api/stores';
import { useAuth, type Preferences, type PreferencesPatch } from '../auth/context';
import Button from '../components/ui/Button';
import { PillGroup } from '../components/ui/Pill';
import TagInput from '../components/ui/TagInput';
import BroadcastPushToggle from './BroadcastPushToggle';
import StoreClaimStatus from './StoreClaimStatus';

const RADII = (unit: string) =>
  [
    { value: 5, label: `5 ${unit}` },
    { value: 10, label: `10 ${unit}` },
    { value: 25, label: `25 ${unit}` },
  ] as const;
const UNITS = [
  { value: 'mi', label: 'Miles' },
  { value: 'km', label: 'Kilometers' },
] as const;
const GENRE_SUGGESTIONS = ['Jazz', 'Soul', 'Hip-Hop', 'Rock', 'Electronic', 'Funk', 'Reggae'];

export default function ProfileScreen() {
  const { user, preferences, signOut } = useAuth();
  const navigate = useNavigate();
  const error = (useLocation().state as { signOutError?: string } | null)?.signOutError;

  // Leave the protected page first, otherwise RequireAuth sends the guest to /login.
  const onSignOut = async () => {
    await navigate('/discover', { replace: true });
    const result = await signOut();
    if (result.error) navigate('/profile', { state: { signOutError: result.error } });
  };

  return (
    <section className="stack composer">
      <h1>Profile &amp; Preferences</h1>
      <p className="muted break-anywhere">{preferences?.email}</p>
      {user && preferences && (
        <PreferencesForm displayName={user.displayName} prefs={preferences} />
      )}
      {preferences && <FavoriteStores ids={preferences.favoriteStoreIds} />}
      <h2>Notifications</h2>
      <BroadcastPushToggle />
      <h2>Store managers</h2>
      <StoreClaimStatus />
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <Button variant="secondary" block onClick={onSignOut}>
        Sign out
      </Button>
    </section>
  );
}

function PreferencesForm({ displayName, prefs }: { displayName: string; prefs: Preferences }) {
  const { updatePreferences } = useAuth();
  const [name, setName] = useState(displayName);
  const [zip, setZip] = useState(prefs.defaultZip ?? '');
  const [radius, setRadius] = useState(prefs.radiusMiles);
  const [unit, setUnit] = useState(prefs.distanceUnit);
  const [genres, setGenres] = useState(prefs.genres);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const nameError = name.trim() === '' ? 'Enter a display name' : null;
  const zipError = zip === '' || /^\d{5}$/.test(zip) ? null : 'Enter a 5-digit ZIP code';
  const changed = () => setStatus(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (nameError || zipError) return;
    setBusy(true);
    // Only changed fields are sent, so an unchanged legacy value can't block other edits.
    const patch: PreferencesPatch = {};
    if (name.trim() !== displayName) patch.displayName = name.trim();
    if ((zip || null) !== prefs.defaultZip) patch.defaultZip = zip || null;
    if (radius !== prefs.radiusMiles) patch.radiusMiles = radius;
    if (unit !== prefs.distanceUnit) patch.distanceUnit = unit;
    if (genres.join('\n') !== prefs.genres.join('\n')) patch.genres = genres;
    const result = await updatePreferences(patch);
    setBusy(false);
    setStatus(result.error ? { ok: false, text: result.error } : { ok: true, text: 'Saved.' });
  };

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor="pref-name">Display name</label>
        <input
          id="pref-name"
          maxLength={60}
          autoComplete="nickname"
          value={name}
          aria-invalid={!!nameError}
          onChange={(e) => {
            changed();
            setName(e.target.value);
          }}
        />
        {nameError && <p className="form-error">{nameError}</p>}
      </div>
      <div className="field">
        <label htmlFor="pref-zip">Home ZIP</label>
        <input
          id="pref-zip"
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={5}
          placeholder="97205"
          value={zip}
          aria-invalid={!!zipError}
          aria-describedby="pref-zip-help"
          onChange={(e) => {
            changed();
            setZip(e.target.value.replace(/\D/g, '').slice(0, 5));
          }}
        />
        <p id="pref-zip-help" className={zipError ? 'form-error' : 'muted'}>
          {zipError ?? 'Used when location is off.'}
        </p>
      </div>
      <div className="field">
        <span>Default radius</span>
        <PillGroup
          label="Default radius"
          options={RADII(unit)}
          value={radius}
          onChange={(v) => {
            changed();
            setRadius(v);
          }}
        />
      </div>
      <div className="field">
        <span>Distance unit</span>
        <PillGroup
          label="Distance unit"
          options={UNITS}
          value={unit}
          onChange={(v) => {
            changed();
            setUnit(v);
          }}
        />
      </div>
      <TagInput
        label="Favorite genres"
        value={genres}
        placeholder={GENRE_SUGGESTIONS.slice(0, 3).join(', ') + '…'}
        onChange={(v) => {
          changed();
          setGenres(v.slice(0, 20));
        }}
      />
      {status && (
        <p role={status.ok ? 'status' : 'alert'} className={status.ok ? 'toast' : 'form-error'}>
          {status.text}
        </p>
      )}
      <div className="action-bar">
        <Button type="submit" disabled={busy || !!nameError || !!zipError}>
          {busy ? 'Saving…' : 'Save preferences'}
        </Button>
      </div>
    </form>
  );
}

function FavoriteStores({ ids }: { ids: string[] }) {
  const { toggleFavoriteStore } = useAuth();
  const [stores, setStores] = useState<Record<string, StoreDetail | null>>({});
  const [error, setError] = useState<string | null>(null);
  const key = ids.join(',');

  useEffect(() => {
    const controller = new AbortController();
    for (const id of key ? key.split(',') : []) {
      getStore(id, controller.signal).then(
        (s) => setStores((all) => ({ ...all, [id]: s })),
        () => setStores((all) => ({ ...all, [id]: null })),
      );
    }
    return () => controller.abort();
  }, [key]);

  // One removal at a time: each write replaces the whole favorites list.
  const [removing, setRemoving] = useState(false);
  const remove = async (id: string) => {
    setError(null);
    setRemoving(true);
    const result = await toggleFavoriteStore(id);
    setRemoving(false);
    if (result.error) setError(result.error);
  };

  return (
    <div className="stack-tight">
      <h2>Favorite stores</h2>
      {ids.length === 0 ? (
        <p className="muted">
          No favorites yet. Tap ☆ on a <Link to="/stores">store page</Link> to add one.
        </p>
      ) : (
        <ul className="plain-list" aria-label="Favorite stores">
          {ids.map((id) => {
            const name =
              stores[id]?.businessName ?? (stores[id] === null ? 'Unavailable store' : 'Loading…');
            return (
              <li key={id} className="toggle-row">
                <Link to={`/stores/${id}`}>{name}</Link>
                <Button
                  variant="secondary"
                  aria-label={`Remove ${name} from favorites`}
                  disabled={removing}
                  onClick={() => void remove(id)}
                >
                  Remove
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </div>
  );
}
