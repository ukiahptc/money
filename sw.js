/* 오프라인용 서비스 워커. 네트워크 우선, 실패하면 캐시.
 * 파일을 고치면 CACHE 버전을 올려야 옛 캐시가 지워진다. */
const CACHE = 'money-v16';
const FILES = [
  './', './index.html', './css/style.css', './manifest.json',
  './js/utils.js', './js/storage.js', './js/loan.js', './js/ledger.js', './js/budget.js', './js/backup.js', './js/cash.js', './js/invest.js', './js/stocks.js', './js/plan.js',
  './js/views/loan-view.js', './js/views/ledger-view.js', './js/views/budget-view.js', './js/views/dashboard-view.js', './js/views/setup-view.js', './js/views/assets-view.js',
  './js/app.js', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).origin !== self.location.origin) return; // 시세 API 등 외부 요청은 건드리지 않음
  e.respondWith(
    fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }) // HTTP 캐시를 재검증해서 새 파일을 바로 받음
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
