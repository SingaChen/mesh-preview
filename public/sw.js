// Vite stamps the CACHE suffix at build time with a content hash of dist/.
// Bump note: ring 1 still starts at F0…F6. The decrease anchor is the stitch on the -R1 chart, so sheet row 8 is F← on F6…F18. The ⬇ stays at column 19; sheet row 10 then racks the back bed B→ so the empty needle sits at the left fold. After the increase, the short knit ends at F19 on sheet row 14 column 19. The facing B18 is not on that course. F19 is also the flip on row 15. After the rack that stitch is B18. Ring 1 knits sit on the course column: column 19 is B18 and column 18 is F18, with no empty cell, including the longer course on sheet row 20. Ring 2 continues on course columns from sheet row 33 (F0, F1). After the back decrease, 22R ends on B16 and the chain stays on those needles through 32R B6…B1, with beds F0…F18 / B1…B18. The increase keeps the stitch on F−1. Sheet 41 starts F−1…F4, F6…F18 / B1…B18. Sheet 42 racks the front +1 so F−1 sits on F0, sheet 43 flips F19 onto B19, and sheet 44 racks the back onto 0…18. Sheet 45 is F0…F18 / B0…B18. Step3 row 40 (sheet 48) draws F← on F13…F18. Sheet 49 flips B18 onto F18 and sheet 50 racks the back onto 1…18. Sheet 51 starts at F13, and column 18 is empty between F18 and B18. Step3 row 69 stacks F10 onto the marker F11. The rack leaves that seat at F10, so step3 row 70 (sheet 95) starts at F9 and ends at F7, on F0…F14 / B1…B14. The same outward step starts sheet 45 (step3 row 37) at F5 after the front +1 rack, sheet 84 (step3 row 64) at B8, and sheet 88 (step3 row 66) at B9. Step3 row 71 moves F11…F14 (sheet 96). Sheet 97 moves F12…F15. Those transfers leave F7 where sheet 95 stopped, so sheet 98 starts on F7 and knits the +R2 on F10. Sheet 99 flips F16 onto B16. Sheet 100 moves only that coil, B16 to B15. The far-right 分布 column is the F/B window at the start of each row. Header −5…37. Bind stays 121. 160 rows. A -Rn marker is n one-needle passes, then the existing settle. Step3 row 75 is -R2: sheet 103 moves B12…B1, sheet 104 moves B13…B2, then the occupied pair settles to F0…F14 / B1…B14. Row 84 lands on F0…F12 / B0…B12. Row 86 moves B2…B0 and does not settle. Step3 row 87 (sheet 123) knits B2 then B1. Sheet 124 moves only B1 onto B2, because the bed starts at B1. Balance leaves F0…F11 / B0…B11. Sheet 128 knits the next -R1 on B0. Sheet 129 records F0…F11 / B0…B11, and later 分布 cells are blank.
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
