const GUEST_ZIP_KEY = 'cratedig.guestZip';

export const isZip = (z: string | null | undefined): z is string => !!z && /^\d{5}$/.test(z);

/** The ZIP a guest typed last time, kept on this device only. */
export function readGuestZip() {
  try {
    const zip = localStorage.getItem(GUEST_ZIP_KEY);
    return isZip(zip) ? zip : null;
  } catch {
    return null;
  }
}

export function saveGuestZip(zip: string) {
  try {
    localStorage.setItem(GUEST_ZIP_KEY, zip);
  } catch {
    // Private mode: the ZIP still works for this visit.
  }
}
