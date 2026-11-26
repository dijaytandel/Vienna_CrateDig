import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/context';
import AvatarMenu from '../components/AvatarMenu';
import BottomNav from '../components/BottomNav';

export default function AppShell() {
  const { user } = useAuth();
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
