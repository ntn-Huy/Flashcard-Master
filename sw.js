// Service worker cho GitHub Pages - học offline.
// Mọi file của website (cùng tên miền): ưu tiên mạng để luôn mới, mất mạng thì dùng bản đã lưu.
// Khi sửa code/CSS: đổi số phiên bản ở dòng dưới VÀ số "?v=" trong index.html (xem README).
const CACHE = 'flashcard-v5';
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './css/tailwind.css?v=5', './css/app.css?v=5',
  './js/app.js?v=5', './js/features.js?v=5',
  './vendor/confetti.browser.js?v=5',
  './vendor/fontawesome/css/all.min.css?v=5',
  './vendor/fontawesome/webfonts/fa-solid-900.woff2',
  './vendor/fontawesome/webfonts/fa-regular-400.woff2',
  './vendor/xlsx.full.min.js?v=5',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png'
];

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

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return; // chỉ xử lý file của chính website
  const timeout = new Promise((_, rej) => setTimeout(rej, 5000));
  e.respondWith(
    Promise.race([fetch(req, { cache: 'no-cache' }), timeout])
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
  );
});
