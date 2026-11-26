import { useEffect } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/context';
import AvatarMenu from '../components/AvatarMenu';
import BottomNav from '../components/BottomNav';
import Button from '../components/ui/Button';
import { useOnline } from '../lib/useOnline';
import { discardFailed, flushQueue } from '../offline/queue';
import { useQueueCounts } from '../offline/useQueue';

export default function AppShell() {
  const { user, session } = useAuth();
  // Writes queued while offline are sent on launch and whenever the connection returns.
  useEffect(() => {
    if (!session) return;
    const flush = () => {
      if (navigator.onLine) void flushQueue(session.user.id);
    };
    flush();
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, [session]);
  const online = useOnline();
  const { pending, failed } = useQueueCounts(session?.user.id ?? null);
  const changes = (n: number) => (n === 1 ? '1 change' : `${n} changes`);
  return (
    <div className="app-shell">
      <header className="top-bar">
        <Link to="/discover" className="brand">
          CrateDig
        </Link>
        <AvatarMenu user={user} />
      </header>
      {!online && (
        <p className="offline-banner" role="status">
          You&apos;re offline. My Crate and recently viewed stores still open
          {pending > 0 ? `; ${changes(pending)} will sync when you reconnect.` : '.'}
        </p>
      )}
      {online && failed > 0 && (
        <div className="offline-banner" role="alert">
          <span>
            {changes(failed)} made offline couldn&apos;t be saved. Check My Crate and try again.
          </span>
          <Button variant="secondary" onClick={() => session && discardFailed(session.user.id)}>
            Dismiss
          </Button>
        </div>
      )}
      <main className="screen">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
