/* Forever CashFlow - SW complémentaire : gestion des clics sur notifications natives */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/prospects';
  event.waitUntil((async () => {
    const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientList) {
      await client.focus();
      client.postMessage({ type: 'NOTIF_CLICK', url });
      return;
    }
    if (self.clients.openWindow) {
      await self.clients.openWindow(url);
    }
  })());
});
