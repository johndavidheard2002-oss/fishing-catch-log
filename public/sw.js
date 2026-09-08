// Tide Mark SW — cache v6. Static assets, journal GETs, and HTML/RSC stay
// network-first with a cache fallback so Calendar List/Grid/detail and Log
// still open from what is already on this phone. Auth and billing stay live.
const CACHE = "tide-mark-static-v6";

function isApiPath(pathname) {
  return pathname === "/api" || pathname.startsWith("/api/");
}

function isAuthApiPath(pathname) {
  return (
    pathname === "/api/auth" ||
    pathname.startsWith("/api/auth/") ||
    pathname === "/api/entitlement" ||
    pathname.startsWith("/api/entitlement/")
  );
}

function isJournalGetPath(pathname) {
  if (isAuthApiPath(pathname)) return false;
  if (pathname === "/api/me") return true;
  if (pathname === "/api/catches" || pathname.startsWith("/api/catches/")) return true;
  if (pathname === "/api/bait-spots" || pathname.startsWith("/api/bait-spots/")) return true;
  if (pathname === "/api/calendar-notes" || pathname.startsWith("/api/calendar-notes/")) return true;
  if (pathname.startsWith("/api/media/")) return true;
  return false;
}

function isStaticAssetPath(pathname) {
  if (isApiPath(pathname)) return false;
  if (pathname === "/sw.js") return false;
  if (pathname.startsWith("/_next/static/")) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname.startsWith("/brand/")) return true;
  if (pathname.startsWith("/splash/")) return true;
  if (pathname.startsWith("/seed/")) return true;
  return /\.(png|jpe?g|svg|ico|webp|woff2?|css|js)$/i.test(pathname);
}

function isShellPath(pathname) {
  if (isApiPath(pathname)) return false;
  if (pathname === "/sw.js") return false;
  if (pathname === "/signin" || pathname.startsWith("/signin/")) return false;
  return true;
}

function shouldCache(request, pathname) {
  if (request.method !== "GET") return false;
  if (isAuthApiPath(pathname)) return false;
  if (isJournalGetPath(pathname)) return true;
  if (isStaticAssetPath(pathname)) return true;
  if (request.mode === "navigate" || request.destination === "document") return isShellPath(pathname);
  if (request.headers.get("rsc") === "1" || request.headers.get("Next-Router-Prefetch") === "1") {
    return isShellPath(pathname);
  }
  if (pathname.startsWith("/_next/")) return true;
  return isShellPath(pathname) && !isApiPath(pathname);
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  const url = new URL(request.url);
  try {
    const response = await fetch(request);
    if (response.ok && shouldCache(request, url.pathname)) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === "navigate" || request.destination === "document") {
      const fallback =
        (await cache.match("/catch/view")) ||
        (await cache.match("/calendar")) ||
        (await cache.match("/log")) ||
        (await cache.match("/"));
      if (fallback) return fallback;
    }
    throw error;
  }
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === "/sw.js") return;
  if (isAuthApiPath(url.pathname)) return;

  const navigate = event.request.mode === "navigate" || event.request.destination === "document";
  if (isApiPath(url.pathname) && !isJournalGetPath(url.pathname)) return;
  if (!navigate && !isJournalGetPath(url.pathname) && !isStaticAssetPath(url.pathname) && !isShellPath(url.pathname)) {
    return;
  }

  event.respondWith(networkFirst(event.request));
});
