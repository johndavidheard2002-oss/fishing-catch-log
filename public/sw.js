// Tide Mark SW — cache v3. HTML/API stay network-only. Claims clients so leftover
// home-screen tabs pick up the sign-in gate instead of a precached pre-login app.
const CACHE = "tide-mark-static-v3";

function isApiPath(pathname) {
  return pathname === "/api" || pathname.startsWith("/api/");
}

function isStaticAssetPath(pathname) {
  if (isApiPath(pathname)) return false;
  if (pathname === "/sw.js") return false;
  if (pathname.startsWith("/_next/static/")) return true;
  if (pathname.startsWith("/brand/")) return true;
  if (pathname.startsWith("/splash/")) return true;
  if (pathname.startsWith("/seed/")) return true;
  return /\.(png|jpe?g|svg|ico|webp|woff2?)$/i.test(pathname);
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
      .then(() =>
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) =>
          Promise.all(
            clients.map((client) => {
              if (typeof client.navigate === "function") return client.navigate(client.url);
              return undefined;
            }),
          ),
        ),
      ),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Photos, login cookies, and Turso-backed API calls stay on the network.
  if (isApiPath(url.pathname)) return;

  // HTML navigations are network-only. Do not invent an offline journal.
  if (event.request.mode === "navigate" || event.request.destination === "document") {
    return;
  }

  if (!isStaticAssetPath(url.pathname)) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      try {
        const response = await fetch(event.request);
        if (response.ok) {
          cache.put(event.request, response.clone());
        }
        return response;
      } catch (error) {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        throw error;
      }
    }),
  );
});
