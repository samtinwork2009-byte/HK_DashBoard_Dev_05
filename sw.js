/* ============================================================
   sw.js — Service Worker for Hong Kong City Dashboard
   PWA: offline cache + background sync
   ============================================================ */

const CACHE_NAME = "hk-dashboard-v9";
const BASE_URL = new URL("./", self.location.href);
const assetUrl = (path) => new URL(path, BASE_URL).href;
const STATIC_URLS = [
  assetUrl(""),
  assetUrl("index.html"),
  assetUrl("css/tokens.css"),
  assetUrl("css/base.css"),
  assetUrl("js/core.js"),
  assetUrl("js/nowcast.js"),
  assetUrl("js/weather-detail.js"),
  assetUrl("js/station-panel.js"),
  assetUrl("js/weather.js"),
  assetUrl("js/transport.js"),
  assetUrl("js/health.js"),
  assetUrl("js/environment.js"),
  assetUrl("js/cctv.js"),
  assetUrl("js/bus.js"),
  assetUrl("js/tides.js"),
  assetUrl("js/parking.js"),
  assetUrl("js/ferry.js"),
  assetUrl("js/holidays.js"),
  assetUrl("js/climate.js"),
  assetUrl("js/beach.js"),
  assetUrl("js/finance.js"),
  assetUrl("js/waste.js"),
  assetUrl("js/map.js"),
  assetUrl("app.js"),
  assetUrl("manifest.json"),
  "https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js",
  "https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;700&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap",
];

function createCacheRequest(url) {
  try {
    const requestUrl = new URL(url);
    if (requestUrl.origin !== self.location.origin) {
      return new Request(url, { mode: "cors" });
    }
    return new Request(requestUrl.href);
  } catch (e) {
    // fallback to default string request
  }
  return url;
}

function createOfflineApiResponse(request) {
  const body = JSON.stringify({
    error: "offline",
    status: 503,
    url: request.url,
  });
  return new Response(body, {
    status: 503,
    statusText: "Service Unavailable",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-HK-Dashboard-Offline": "1",
    },
  });
}

/* ── Install: cache all static assets ───────────────────────── */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return Promise.allSettled(
          STATIC_URLS.map((url) => cache.add(createCacheRequest(url)).catch(() => {})),
        );
      })
      .then(() => self.skipWaiting()),
  );
});

/* ── Activate: clean old caches ─────────────────────────────── */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/* ── Fetch: cache-first for static, network-first for API ───── */
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET and unsupported scheme requests
  if (event.request.method !== "GET") return;
  if (!/^https?:$/.test(url.protocol)) return;

  // API calls: network-first with cache fallback
  const isAPI = [
    "data.weather.gov.hk",
    "rt.data.gov.hk",
    "data.etabus.gov.hk",
    "data.etagmb.gov.hk",
    "api.data.gov.hk",
    "www.news.gov.hk",
    "www.info.gov.hk",
    "datagovhk.blob.core.windows.net",
    "www.ha.org.hk",
    "tdcctv.data.one.gov.hk",
    "query1.finance.yahoo.com",
    "api.frankfurter.app",
  ].some((host) => url.hostname.includes(host));

  if (isAPI) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then((cached) => {
            if (cached) return cached;
            return new Response(
              JSON.stringify({
                error: "offline",
                status: 200,
                url: event.request.url,
                source: "hk-dashboard-service-worker-fallback",
              }),
              {
                status: 200,
                statusText: "OK",
                headers: {
                  "Content-Type": "application/json; charset=utf-8",
                  "Cache-Control": "no-store",
                  "X-HK-Dashboard-Offline": "1",
                },
              },
            );
          });
        }),
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          if (event.request.destination === "document") {
            return caches.match(assetUrl("index.html"));
          }
          return new Response("Service Unavailable", {
            status: 503,
            statusText: "Service Unavailable",
          });
        });
    }),
  );
});
