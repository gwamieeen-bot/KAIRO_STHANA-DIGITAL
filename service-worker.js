// Naikkan angka versi ini (v6 -> v7 dst) setiap habis edit file, supaya pengunjung dapat versi terbaru.
const CACHE_NAME = "kairo-sthana-v11";
const APP_ASSETS = [
  "./", "./index.html", "./style.css", "./script.js", "./living-story.js",
  "./world-engine.js", "./elders.js", "./admin.js", "./config.js", "./photos.js", "./achievements.js", "./member.js", "./photos.css", "./manifest.json",
  "./assets/kairo-logo.png", "./assets/kairo-logo-square.png",
  "./assets/timeline-robot-mascot.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // Satu file gagal (misal gambar belum ada) tidak lagi menggagalkan semuanya.
      .then(cache => Promise.allSettled(APP_ASSETS.map(url => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Ambil dari internet dulu; kalau offline baru pakai cache. Jadi hasil edit langsung muncul.
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || !request.url.startsWith(self.location.origin)) return;
  event.respondWith(
    fetch(request).then(response => {
      if (response && response.status === 200) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      }
      return response;
    }).catch(() =>
      caches.match(request).then(cached =>
        cached || (request.mode === "navigate" ? caches.match("./index.html") : new Response("Offline", { status: 503 }))
      )
    )
  );
});
