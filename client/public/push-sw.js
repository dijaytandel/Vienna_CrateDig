/* Web push handlers, imported by the generated service worker. */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  const url = typeof data.url === 'string' && data.url.startsWith('/') ? data.url : '/discover';
  event.waitUntil(
    self.registration.showNotification(data.title || 'CrateDig', {
      body: data.body || '',
      tag: data.tag,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/discover', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open && 'navigate' in open) return open.focus().then(() => open.navigate(url));
      return self.clients.openWindow(url);
    }),
  );
});
