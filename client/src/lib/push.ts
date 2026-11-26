import { deletePushSubscription, getPushPublicKey, savePushSubscription } from '../api/broadcasts';

const READY_TIMEOUT_MS = 10_000;

export const pushSupported = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

/** iOS only offers web push to a PWA added to the Home Screen. */
export const needsHomeScreenInstall = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) &&
  !window.matchMedia?.('(display-mode: standalone)').matches;

function base64UrlToBytes(value: string) {
  const padded = (value + '='.repeat((4 - (value.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

async function registration() {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('Notifications need the installed app. Reload and try again.')),
        READY_TIMEOUT_MS,
      ),
    ),
  ]);
}

export async function currentPushSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/** Asks for permission (only ever from the Profile toggle) and registers this device. */
export async function enableBroadcastPush() {
  if (!pushSupported()) throw new Error('This browser does not support notifications.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notifications are blocked. Allow them for CrateDig in your browser settings.');
  }
  const [{ publicKey }, reg] = await Promise.all([getPushPublicKey(), registration()]);
  const subscription =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToBytes(publicKey),
    }));
  await savePushSubscription(subscription.toJSON());
}

export async function disableBroadcastPush() {
  const subscription = await currentPushSubscription();
  if (!subscription) return;
  await deletePushSubscription(subscription.endpoint);
  await subscription.unsubscribe();
}
