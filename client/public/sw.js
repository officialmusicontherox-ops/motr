/**
 * MOTR service worker.
 *
 * Its job is installability, not caching. Android only treats a site as a
 * real installable app — one it mints a signed WebAPK for, that appears in
 * the app drawer like anything else — when a service worker with a fetch
 * handler is present. Without one the browser can offer at best a bookmark
 * shortcut, which is the shakier path and the one that produces odd
 * "unknown source" prompts on some phones.
 *
 * Deliberately caches nothing on the network path. This app is a live feed
 * of tracks, votes and balances; serving yesterday's HTML or a stale API
 * response would create exactly the class of bug that costs hours to find.
 * The only thing kept offline is a page explaining there's no connection.
 */

const OFFLINE_URL = "/offline.html";
const CACHE = "motr-offline-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" })))
  );
  // Take over immediately rather than waiting for every tab to close.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only page loads are handled. Audio, API calls and assets go straight to
  // the network untouched — intercepting them would risk stale music under
  // an artist's name, which is the last thing this app needs.
  if (request.mode !== "navigate") return;

  event.respondWith(
    fetch(request).catch(async () => {
      const cache = await caches.open(CACHE);
      const offline = await cache.match(OFFLINE_URL);
      return (
        offline ??
        new Response("You're offline.", {
          status: 503,
          headers: { "content-type": "text/plain" },
        })
      );
    })
  );
});
