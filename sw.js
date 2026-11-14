// Service worker: приложение открывается и работает без интернета.
// При изменении файлов увеличь версию — старый кеш удалится автоматически.
const CACHE = "pet-diary-v2.0.3";

const ASSETS = [
  "./",
  "index.html",
  "css/style.css",
  "js/utils.js",
  "js/store.js",
  "js/sprites.js",
  "js/sound.js",
  "js/charts.js",
  "js/ui.js",
  "js/views/home.js",
  "js/views/journal.js",
  "js/views/health.js",
  "js/views/money.js",
  "js/views/stats.js",
  "js/views/settings.js",
  "js/app.js",
  "manifest.webmanifest",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Свои файлы: сначала сеть (чтобы обновления приходили сразу), при офлайне — кеш.
// Шрифты Google: сначала кеш, они не меняются.
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
            return response;
          })
      )
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request, { ignoreSearch: true }).then((cached) => cached || caches.match("index.html")))
  );
});

// Клик по уведомлению открывает дневник
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      const client = clients.find((c) => "focus" in c);
      return client ? client.focus() : self.clients.openWindow("./#health");
    })
  );
});
