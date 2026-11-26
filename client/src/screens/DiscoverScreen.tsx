import { SCREEN_ROUTES } from '../app/routes';
import { useAuth } from '../auth/context';
import PlaceholderScreen from '../components/PlaceholderScreen';

const screen = SCREEN_ROUTES.find((r) => r.path === '/discover')!;

export default function DiscoverScreen() {
  const { preferences } = useAuth();
  return (
    <>
      <PlaceholderScreen screen={screen} />
      {preferences && (
        <p className="muted" data-testid="discover-filters">
          Within {preferences.radiusMiles} mi
          {preferences.defaultZip && ` of ${preferences.defaultZip}`}
          {preferences.genres.length > 0 && ` · ${preferences.genres.join(', ')}`}
        </p>
      )}
    </>
  );
}
