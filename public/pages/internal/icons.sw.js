const CACHE_NAME = "favicon-cache-v2";

// Install SW
self.addEventListener("install", (event) => {
  console.log("[SW] Installing favicon service worker…");
  self.skipWaiting();
});

// Activate SW
self.addEventListener("activate", (event) => {
  console.log("[SW] Activated");
  event.waitUntil(self.clients.claim());
});

// Listen for messages (upload / remove custom icons)
self.addEventListener("message", async (event) => {
  const { type, url, file } = event.data;

  switch (type) {
    case "uploadIcon":
      if (url && file) {
        await saveCustomIcon(url, file);
        console.log(`[SW] Custom icon saved for ${url}`);
      }
      break;

    case "removeIcon":
      if (url) {
        await removeCustomIcon(url);
        console.log(`[SW] Custom icon removed for ${url}`);
      }
      break;

    default:
      console.warn("[SW] Unknown message type:", type);
  }
});

// Fetch handler for icons
self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);

  if (requestUrl.pathname.startsWith("/internal/icons/")) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        // Check cache first (includes custom icons)
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        // Otherwise, fetch from network and cache
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse.ok) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          console.error("[SW] Failed to fetch icon:", err);
          return new Response("Icon not found", { status: 404 });
        }
      })
    );
  }
});

/* ---------- Helpers ---------- */

// Save custom icon
async function saveCustomIcon(url, file) {
  const cache = await caches.open(CACHE_NAME);

  // Convert File/Blob to Response
  const arrayBuffer = await file.arrayBuffer();
  const response = new Response(arrayBuffer, {
    headers: { "Content-Type": file.type || "image/png" },
  });

  await cache.put(url, response);
}

// Remove custom icon
async function removeCustomIcon(url) {
  const cache = await caches.open(CACHE_NAME);
  await cache.delete(url);
}
