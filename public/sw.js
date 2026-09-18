// Vite stamps the CACHE suffix at build time with a content hash of dist/.
// Bump note: ring-scoped hang col_shift sample (121 display rows, 89 knit segments, needles −4…36; each faces_ring starts @0).
const CACHE = "mesh-preview-v2-__SW_CACHE_ID__";

function isNavigation(request) {
  return request.mode === "navigate" || request.destination === "document";
}

function isHashedAsset(url) {
  return /\/assets\/[^/?#]+-[A-Za-z0-9_-]{8}\.[a-z0-9]+$/i.test(url.pathname);
}

function isSampleOrMutableData(url) {
  const path = url.pathname;
  if (path.includes("/sample/")) return true;
  if (/\.(xls|xlsx|obj|json)$/i.test(path)) return true;
  return false;
}

function shouldBypassHttpCache(request, url) {
  if (isNavigation(request)) return true;
  if (isSampleOrMutableData(url)) return true;
  if (/(?:^|\/)index\.html$/i.test(url.pathname)) return true;
  return !isHashedAsset(url);
}

async function networkFirst(request, cache, { bypassHttpCache }) {
  try {
    const fresh = await fetch(bypassHttpCache ? new Request(request, { cache: "reload" }) : request);
    if (fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirstHashed(request, cache) {
  const cached = await cache.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  if (fresh.ok) cache.put(request, fresh.clone());
  return fresh;
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== CACHE && k.startsWith("mesh-preview-"))
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith("/sw.js")) return;

  event.respondWith(
    caches.open(CACHE).then((cache) => {
      if (isHashedAsset(url) && !isSampleOrMutableData(url) && !isNavigation(req)) {
        return cacheFirstHashed(req, cache);
      }
      return networkFirst(req, cache, { bypassHttpCache: shouldBypassHttpCache(req, url) });
    }),
  );
});
