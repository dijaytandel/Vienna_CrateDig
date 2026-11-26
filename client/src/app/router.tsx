import { Navigate, type RouteObject } from 'react-router-dom';
import AppShell from './AppShell';
import { SCREEN_ROUTES, type ScreenRoute } from './routes';
import RequireAuth from '../auth/RequireAuth';
import PlaceholderScreen from '../components/PlaceholderScreen';
import NotFoundScreen from '../components/NotFoundScreen';
import DiscoverScreen from '../screens/DiscoverScreen';
import LoginScreen from '../screens/LoginScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SignupScreen from '../screens/SignupScreen';
import WelcomeScreen from '../screens/WelcomeScreen';

const SCREENS: Record<string, () => React.JSX.Element> = {
  '/discover': DiscoverScreen,
  '/login': LoginScreen,
  '/signup': SignupScreen,
  '/profile': ProfileScreen,
  '/welcome': WelcomeScreen,
};

function screenElement(screen: ScreenRoute) {
  const Screen = SCREENS[screen.path];
  const element = Screen ? <Screen /> : <PlaceholderScreen screen={screen} />;
  return screen.access === 'guest' ? (
    element
  ) : (
    <RequireAuth role={screen.access}>{element}</RequireAuth>
  );
}

export const APP_ROUTES: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/discover" replace /> },
      ...SCREEN_ROUTES.map((screen) => ({ path: screen.path, element: screenElement(screen) })),
      { path: '*', element: <NotFoundScreen /> },
    ],
  },
];
