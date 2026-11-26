import { Link, Outlet } from 'react-router-dom';
import AvatarMenu from '../components/AvatarMenu';
import BottomNav from '../components/BottomNav';

export default function AppShell() {
  return (
    <div className="app-shell">
      <header className="top-bar">
        <Link to="/discover" className="brand">
          CrateDig
        </Link>
        <AvatarMenu user={null} />
      </header>
      <main className="screen">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
