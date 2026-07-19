/* Kabelbereitschaft – Service Worker (AP5)
 * Ohne Third-Party-Libs. Cache-Strategien:
 *  - Navigationen (GET, HTML): network-first -> Cache -> /offline
 *  - Statische Assets (/_next/static, /icons, Bilder): stale-while-revalidate
 * Sicherheit: nur SAME-ORIGIN GET wird gecacht. Supabase (cross-origin),
 * /api/* und /auth/* werden NIE gecacht (keine Tokens/Session im Cache).
 * Cache-Invalidierung über CACHE_VERSION (alte Caches werden bei activate gelöscht).
 */
const CACHE_VERSION = "kb-v1";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const PAGES_CACHE = `${CACHE_VERSION}-pages`;
const ASSETS_CACHE = `${CACHE_VERSION}-assets`;
const OFFLINE_URL = "/offline";
const SHELL_ASSETS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL_ASSETS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k)),
      ),
    ).then(() => self.clients.claim()),
  );
});

// Erlaubt der Seite, ein sofortiges Update auszulösen.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/branding/") ||
    /\.(?:css|js|woff2?|png|jpg|jpeg|gif|webp|svg|ico)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // Mutationen nie abfangen/cachen
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) return; // cross-origin (Supabase) unangetastet
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return; // nie cachen

  // Navigationen: network-first, dann Cache, dann Offline-Seite.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(PAGES_CACHE);
          cache.put(req, fresh.clone());
          return fresh;
        } catch {
          const cached = await caches.match(req);
          return cached || (await caches.match(OFFLINE_URL));
        }
      })(),
    );
    return;
  }

  // Statische Assets: stale-while-revalidate.
  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(ASSETS_CACHE);
        const cached = await cache.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res && res.status === 200) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })(),
    );
  }
});
