import { Link, Outlet } from 'react-router-dom';
import BottomNav from '../components/BottomNav';

export default function AppShell() {
  return (
    <div className="app-shell">
      <header className="top-bar">
        <Link to="/discover" className="brand">
          CrateDig
        </Link>
        <Link to="/login" className="avatar-slot">
          Log in
        </Link>
      </header>
      <main className="screen">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
