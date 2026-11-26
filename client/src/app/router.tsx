import { Navigate, type RouteObject } from 'react-router-dom';
import AppShell from './AppShell';
import { SCREEN_ROUTES, type ScreenRoute } from './routes';
import RequireAuth from '../auth/RequireAuth';
import PlaceholderScreen from '../components/PlaceholderScreen';
import NotFoundScreen from '../components/NotFoundScreen';
import AlbumScreen from '../screens/albums/AlbumScreen';
import AddRecordScreen from '../screens/crate/AddRecordScreen';
import CrateItemScreen from '../screens/crate/CrateItemScreen';
import CrateScreen from '../screens/crate/CrateScreen';
import BroadcastScreen from '../screens/broadcasts/BroadcastScreen';
import BroadcastComposerScreen from '../screens/merchant/BroadcastComposerScreen';
import MerchantBroadcastsScreen from '../screens/merchant/MerchantBroadcastsScreen';
import MerchantDashboardScreen from '../screens/merchant/MerchantDashboardScreen';
import MerchantSightingsScreen from '../screens/merchant/MerchantSightingsScreen';
import MerchantStoreScreen from '../screens/merchant/MerchantStoreScreen';
import MerchantVerifyScreen from '../screens/merchant/MerchantVerifyScreen';
import DiscoverScreen from '../screens/DiscoverScreen';
import LoginScreen from '../screens/LoginScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ReportScreen from '../screens/report/ReportScreen';
import SearchScreen from '../screens/search/SearchScreen';
import SightingScreen from '../screens/sightings/SightingScreen';
import SignupScreen from '../screens/SignupScreen';
import StoreProfileScreen from '../screens/stores/StoreProfileScreen';
import StoresScreen from '../screens/stores/StoresScreen';
import WelcomeScreen from '../screens/WelcomeScreen';

const SCREENS: Record<string, () => React.JSX.Element> = {
  '/discover': DiscoverScreen,
  '/broadcasts/:id': BroadcastScreen,
  '/login': LoginScreen,
  '/signup': SignupScreen,
  '/profile': ProfileScreen,
  '/welcome': WelcomeScreen,
  '/stores': StoresScreen,
  '/stores/:id': StoreProfileScreen,
  '/crate': CrateScreen,
  '/crate/add': AddRecordScreen,
  '/crate/items/:id': CrateItemScreen,
  '/albums/:id': AlbumScreen,
  '/report': ReportScreen,
  '/search': SearchScreen,
  '/sightings/:id': SightingScreen,
  '/merchant': MerchantDashboardScreen,
  '/merchant/sightings': MerchantSightingsScreen,
  '/merchant/store': MerchantStoreScreen,
  '/merchant/verify': MerchantVerifyScreen,
  '/merchant/broadcasts': MerchantBroadcastsScreen,
  '/merchant/broadcasts/new': BroadcastComposerScreen,
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
