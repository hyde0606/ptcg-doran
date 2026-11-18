// 알림 전용 서비스 워커 (화면 저장·캐시는 하지 않음): 푸시를 받으면 알림을 띄우고, 누르면 그 판으로
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || '닌포케카', {
    body: d.body || '', tag: d.tag || 'npcg', renotify: true, lang: 'ko',
    icon: '/icons/icon-192.png', data: { url: d.url || '/#lobby' },
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || '/#lobby', self.location.origin).href;
  e.waitUntil((async () => {
    const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const c = cs.find(x => new URL(x.url).origin === self.location.origin);
    if (c) { c.postMessage({ t: 'go', url }); return c.focus(); }
    return self.clients.openWindow(url);
  })());
});
