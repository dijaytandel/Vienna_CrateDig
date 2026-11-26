import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './context';
import { loginPath } from './next';

/** Runs the action for signed-in users; sends guests to log in and back here. */
export function useProtectedAction() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(
    (action: () => void) => {
      if (session) action();
      else navigate(loginPath(location.pathname + location.search));
    },
    [session, navigate, location.pathname, location.search],
  );
}
