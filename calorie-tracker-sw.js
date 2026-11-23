// Service worker لتطبيق عداد العجز اليومي
// يخزن واجهة التطبيق (app shell) عشان تشتغل من غير نت.
// طلبات Gemini API بتفضل محتاجة نت (network-only).
const CACHE = "caldef-shell-v8";
const SHELL = ["./", "./index.html", "./manifest.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("caldef-shell-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = e.request.url;
  // Gemini API أو أي طلب غير GET: شبكة مباشرة من غير كاش
  if (e.request.method !== "GET" || url.includes("generativelanguage.googleapis.com")) return;
  // صفحات التنقل: جرب الشبكة الأول وحدّث الكاش، ولو مفيش نت ارجع للكاش
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => { c.put(e.request, copy); c.put("./", res.clone()); });
          return res;
        })
        .catch(() =>
          caches.match(e.request)
            .then((r) => r || caches.match("./"))
            .then((r) => r || caches.match("./calorie-tracker.html"))
        )
    );
    return;
  }
  // باقي الموارد: كاش أولًا ثم شبكة
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return res;
    }))
  );
});
