import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/context';
import Button from '../components/ui/Button';

export default function ProfileScreen() {
  const { user, preferences, signOut } = useAuth();
  const navigate = useNavigate();

  const onSignOut = async () => {
    await signOut();
    navigate('/discover', { replace: true });
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
      <Button variant="secondary" block onClick={onSignOut}>
        Sign out
      </Button>
    </section>
  );
}
