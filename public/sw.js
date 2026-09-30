// Vite stamps the CACHE suffix at build time with a content hash of dist/.
// Bump note: ring 1 still starts at F0…F6. The decrease anchor is the stitch on the -R1 chart, so sheet row 8 is F← on F6…F18. The ⬇ stays at column 19; sheet row 10 then racks the back bed B→ so the empty needle sits at the left fold. After the increase, the short knit ends at F19 on sheet row 14 column 19. The facing B18 is not on that course. F19 is also the flip on row 15. After the rack that stitch is B18. Ring 1 knits sit on the course column: column 19 is B18 and column 18 is F18, with no empty cell, including the longer course on sheet row 20. Ring 2 continues on course columns from sheet row 33 (F0, F1). After the back decrease, 22R ends on B16 and the chain stays on those needles through 32R B6…B1, with beds F0…F18 / B1…B18. The increase racks F−1 back to F0, flips F19, then racks the back bed from B1…B19. Header −5…37. Bind stays 121. 129 rows. From step3 row 40 the phys sheet has no needle.
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
