const CACHE = "localabor-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./offline-charts.js",
  "./onboarding.js"
];

self.addEventListener("install", e => {
  // Cache new assets but stay in "waiting" state — the app will
  // explicitly send SKIP_WAITING when the user clicks "Update".
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener("activate", e => {
  // Purge any old caches from previous installs.
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// The app posts { type: "SKIP_WAITING" } when the user taps "Update Now".
// This moves the waiting SW into active state; the app then reloads.
self.addEventListener("message", e => {
  if (e.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", e => {
  // Never serve version.json from cache — it must always be fresh.
  if (e.request.url.includes("version.json")) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
