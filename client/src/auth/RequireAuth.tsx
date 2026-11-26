import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context';
import { loginPath } from './next';

export default function RequireAuth({
  role = 'collector',
  children,
}: {
  role?: 'collector' | 'store_manager';
  children: ReactNode;
}) {
  const { status, session, user } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <p className="muted">Loading…</p>;
  if (!session) {
    return <Navigate to={loginPath(location.pathname + location.search)} replace />;
  }
  if (role === 'store_manager' && user?.role !== 'store_manager') {
    return <Navigate to="/merchant/verify" replace />;
  }
  return children;
}
