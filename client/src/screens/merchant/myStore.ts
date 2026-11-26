import { listMyBroadcasts } from '../../api/broadcasts';
import { getStore } from '../../api/stores';

/** The verified manager's store with its recent broadcasts. */
export async function loadMyStore(signal?: AbortSignal) {
  const { storeId, broadcasts } = await listMyBroadcasts(signal);
  const store = await getStore(storeId, signal);
  return { store, broadcasts };
}

const PHONE = /^[2-9]\d{2}[2-9]\d{6}$/;

/** Null when the field is empty or a valid 10-digit U.S. number. */
export function phoneError(input: string) {
  const digits = input.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  return input.trim() === '' || PHONE.test(digits) ? null : 'Enter a 10-digit U.S. phone number';
}
