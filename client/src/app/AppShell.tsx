import { useEffect } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/context';
import AvatarMenu from '../components/AvatarMenu';
import BottomNav from '../components/BottomNav';
import { flushQueue } from '../offline/queue';

export default function AppShell() {
  const { user, session } = useAuth();
  // Writes queued while offline are sent on launch and whenever the connection returns.
  useEffect(() => {
    if (!session) return;
    const flush = () => {
      if (navigator.onLine) void flushQueue();
    };
    flush();
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, [session]);
  return (
    <div className="app-shell">
      <header className="top-bar">
        <Link to="/discover" className="brand">
          CrateDig
        </Link>
        <AvatarMenu user={user} />
      </header>
      <main className="screen">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
