import { Navigate, type RouteObject } from 'react-router-dom';
import AppShell from './AppShell';
import { SCREEN_ROUTES } from './routes';
import PlaceholderScreen from '../components/PlaceholderScreen';
import NotFoundScreen from '../components/NotFoundScreen';

export const APP_ROUTES: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/discover" replace /> },
      ...SCREEN_ROUTES.map((screen) => ({
        path: screen.path,
        element: <PlaceholderScreen screen={screen} />,
      })),
      { path: '*', element: <NotFoundScreen /> },
    ],
  },
];
