// Service worker cho GitHub Pages - học offline.
// Cùng origin (index.html, data/*): ưu tiên mạng để luôn mới, mất mạng dùng bản đã lưu.
// CDN (Tailwind, FontAwesome, SheetJS...): dùng bản đã lưu và cập nhật ngầm.
const CACHE = 'flashcard-v4';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const put = (req, res) => {
  if (res && (res.ok || res.type === 'opaque')) {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy));
  }
  return res;
};

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const sameOrigin = new URL(req.url).origin === self.location.origin;

  if (sameOrigin) {
    const timeout = new Promise((_, rej) => setTimeout(rej, 5000));
    e.respondWith(
      Promise.race([fetch(req, { cache: 'no-cache' }), timeout])
        .then((res) => put(req, res))
        .catch(() => caches.match(req).then((r) => r || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
    );
  } else {
    e.respondWith(
      caches.match(req).then((cached) => {
        const net = fetch(req).then((res) => put(req, res)).catch(() => cached);
        return cached || net;
      })
    );
  }
});
