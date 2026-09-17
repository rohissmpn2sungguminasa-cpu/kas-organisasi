/*
  Service Worker - Kas Rohis
  Tugas utamanya dua:
  1. Membuat situs memenuhi syarat install penuh (WebAPK) di Android,
     sehingga bar "ketuk untuk menyalin URL" tidak muncul lagi.
  2. Menyimpan tampilan dasar agar aplikasi tetap terbuka saat sinyal hilang.

  PENTING: naikkan angka CACHE_VERSION setiap kali kamu mengubah
  index.html / CSS / JS, supaya pengguna mendapat versi terbaru.
*/

const CACHE_VERSION = "kas-rohis-v1";

// Hanya file milik sendiri. Jangan masukkan URL Google Apps Script di sini.
const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      // addAll gagal total kalau satu file saja 404, jadi tiap file ditangani sendiri
      Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch((err) =>
            console.warn("[SW] Lewati precache:", url, err)
          )
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Hanya tangani GET. POST ke Apps Script dibiarkan lewat apa adanya.
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Data keuangan harus selalu segar: jangan pernah di-cache.
  if (
    url.hostname.includes("script.google.com") ||
    url.hostname.includes("googleusercontent.com")
  ) {
    return;
  }

  // Halaman (navigasi): coba jaringan dulu, fallback ke cache saat offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match("/index.html").then(
          (cached) =>
            cached ||
            new Response(
              "<h3 style='font-family:sans-serif;padding:24px'>Tidak ada koneksi. Coba lagi setelah internet tersambung.</h3>",
              { headers: { "Content-Type": "text/html; charset=utf-8" } }
            )
        )
      )
    );
    return;
  }

  // Aset lain (CSS, JS, font, ikon): pakai cache dulu, lalu perbarui diam-diam.
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
});
