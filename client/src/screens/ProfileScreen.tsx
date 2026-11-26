import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/context';
import Button from '../components/ui/Button';
import BroadcastPushToggle from './BroadcastPushToggle';
import StoreClaimStatus from './StoreClaimStatus';

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
    <section className="stack">
      <h1>Profile &amp; Preferences</h1>
      <dl className="details">
        <dt>Name</dt>
        <dd>{user?.displayName}</dd>
        <dt>Email</dt>
        <dd>{preferences?.email}</dd>
        <dt>Home ZIP</dt>
        <dd>{preferences?.defaultZip ?? 'Not set'}</dd>
        <dt>Search radius</dt>
        <dd>{preferences?.radiusMiles} mi</dd>
      </dl>
      <p className="muted">Editing preferences arrives with the preferences task.</p>
      <BroadcastPushToggle />
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
