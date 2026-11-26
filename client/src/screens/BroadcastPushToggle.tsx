import { useEffect, useState } from 'react';
import { errorText } from '../api/client';
import {
  currentPushSubscription,
  disableBroadcastPush,
  enableBroadcastPush,
  needsHomeScreenInstall,
  pushSupported,
} from '../lib/push';

/** The only place CrateDig asks for notification permission. Reflects this device. */
export default function BroadcastPushToggle() {
  const supported = pushSupported();
  const [on, setOn] = useState<boolean | null>(supported ? null : false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supported) return;
    let live = true;
    currentPushSubscription().then(
      (sub) => live && setOn(!!sub && Notification.permission === 'granted'),
      () => live && setOn(false),
    );
    return () => {
      live = false;
    };
  }, [supported]);

  const toggle = async (next: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await (next ? enableBroadcastPush() : disableBroadcastPush());
      setOn(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack-tight">
      <label className="toggle-row">
        <span>
          Store broadcast notifications
          <span className="muted" style={{ display: 'block', fontSize: '0.875rem' }}>
            New arrivals from favorite stores and stores within your search radius.
          </span>
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={!!on}
          disabled={!supported || busy || on === null}
          onChange={(e) => void toggle(e.target.checked)}
        />
      </label>
      {!supported && (
        <p className="muted">
          {needsHomeScreenInstall()
            ? 'On iPhone and iPad, add CrateDig to your Home Screen first, then turn this on there.'
            : "This browser doesn't support notifications."}
        </p>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </div>
  );
}
