/* Voblox service worker — offline cache for the installed app */
var CACHE = "voblox-v3";
var ASSETS = [
  "index.html", "study.html", "dashboard.html",
  "styles.css", "world.css", "boss.css", "games.css", "manifest.webmanifest",
  "vendor/three.min.js",
  "src/content.js", "src/engine.js", "src/questions.js", "src/store.js",
  "src/app.js", "src/world.js", "src/boss.js", "src/dashboard.js",
  "src/quizshow.js", "src/memory.js", "src/games.js",
  "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png"
];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS).catch(function () {}); }));
  self.skipWaiting();
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
  }));
  self.clients.claim();
});
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  e.respondWith(caches.match(e.request).then(function (r) {
    return r || fetch(e.request).then(function (resp) {
      var copy = resp.clone();
      caches.open(CACHE).then(function (c) { try { c.put(e.request, copy); } catch (_) {} });
      return resp;
    }).catch(function () { return caches.match("index.html"); });
  }));
});
