import { useEffect, useMemo, useState } from 'react';
import type { Origin } from '../api/stores';
import { useAuth } from '../auth/context';

const hasGps = () => typeof navigator !== 'undefined' && !!navigator.geolocation;
type Gps = { done: boolean; coords: { lat: number; lng: number } | null };

/**
 * The user's location for distance sorting: an explicit ZIP wins, then GPS,
 * then the saved ZIP. `origin` stays null while locating or when none is known.
 */
export function useCurrentOrigin(explicitZip: string | null = null) {
  const { preferences, status } = useAuth();
  const savedZip = preferences?.defaultZip ?? null;
  const [gps, setGps] = useState<Gps>(() => ({ done: !hasGps(), coords: null }));
  const needGps = !explicitZip && !gps.done;

  useEffect(() => {
    if (!needGps) return;
    let active = true;
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        active &&
        setGps({ done: true, coords: { lat: pos.coords.latitude, lng: pos.coords.longitude } }),
      () => active && setGps({ done: true, coords: null }),
      { timeout: 10_000, maximumAge: 300_000 },
    );
    return () => {
      active = false;
    };
  }, [needGps]);

  const origin = useMemo<Origin | null>(() => {
    if (explicitZip) return { zip: explicitZip };
    if (gps.coords) return gps.coords;
    if (gps.done && savedZip) return { zip: savedZip };
    return null;
  }, [explicitZip, gps, savedZip]);

  const locating = needGps || status === 'loading';
  return { origin, locating, gpsDenied: gps.done && !gps.coords, coords: gps.coords };
}

export const originKey = (o: Origin | null) =>
  !o ? 'none' : 'zip' in o ? o.zip : `${o.lat.toFixed(4)},${o.lng.toFixed(4)}`;
