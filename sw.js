/* Voblox service worker — offline cache for the installed app */
var CACHE = "voblox-v71";
var ASSETS = [
  "index.html", "study.html", "dashboard.html", "craft.html",
  "styles.css", "world.css", "boss.css", "games.css", "craft.css", "manifest.webmanifest",
  "vendor/three.min.js", "src/version.js", "src/craft/craft.js",
  "src/content.js", "src/engine.js", "src/questions.js", "src/store.js",
  "src/profile.js", "src/sfx.js", "src/avatar.js", "src/bots.js", "src/items.js", "src/arcade.js",
  "src/app.js", "src/world.js", "src/boss.js", "src/dashboard.js",
  "src/quizshow.js", "src/memory.js", "src/hunt.js", "src/run.js", "src/whack.js",
  "src/hoops.js", "src/snake.js", "src/spell.js", "src/pickle.js", "src/fishing.js",
  "src/soccer.js", "src/karts.js", "src/obby.js", "src/towerd.js",
  "src/chessclub.js", "src/bjj.js", "src/chef.js", "src/pets.js", "src/empire.js", "src/books.js", "src/games.js",
  "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png", "icons/vobux.png"
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
// network-first: always try the latest from the network (so updates show on refresh),
// fall back to the cache only when offline.
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request).then(function (resp) {
      var copy = resp.clone();
      caches.open(CACHE).then(function (c) { try { c.put(e.request, copy); } catch (_) {} });
      return resp;
    }).catch(function () {
      return caches.match(e.request).then(function (r) { return r || caches.match("index.html"); });
    })
  );
});
