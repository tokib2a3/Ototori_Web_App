const CACHE_NAME = "app-v3.0.2";
const APP_FILES = [
  "/ototori/assets/player.html",
  "/ototori/assets/common.css",
  "/ototori/assets/app.css",
  "/ototori/assets/index.js",
  "/ototori/assets/main.js"
]
const NETWORK_FIRST = [
  "./list.json"
]

// インストール処理
self.addEventListener("install", (e) => {
  // console.log("[Service Worker] Install");
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // console.log("[Service Worker] Caching all: app shell and content");
      return cache.addAll(APP_FILES);
    }),
  );
});

// 古いバージョンのキャッシュを削除
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => {
          return key.split("-")[0] == "app" && key != CACHE_NAME;
        }).map((key) => {
          // 不要なキャッシュを削除
          return caches.delete(key);
        })
      );
    })
  );
});

// リソースフェッチ時のキャッシュロード処理
self.addEventListener("fetch", (e) => {
  const isAppFile = APP_FILES.some((url) => { return new URL(url, location.href).href == new URL(e.request.url, location.href).href });
  // const isTopPage = new URL(e.request.url, location.href).href == new URL("./", location.href).href;
  const isJsdelivrFile = new URL(e.request.url, location.href).host == "cdn.jsdelivr.net";
  const isFontFile = new URL(e.request.url, location.href).host == "fonts.googleapis.com" || new URL(e.request.url, location.href).host == "fonts.gstatic.com";
  // if (isAppFile || isTopPage || isJsdelivrFile || isFontFile) {
  if (isAppFile || isJsdelivrFile || isFontFile) {
    // キャッシュ優先
    e.respondWith(
      caches.match(e.request).then((r) => {
        // console.log("[Service Worker] Fetching resource: " + e.request.url);
        return (
          r ||
          fetch(e.request).then((response) => {
            return caches.open(CACHE_NAME).then((cache) => {
              // console.log("[Service Worker] Caching new resource: " + e.request.url);
              cache.put(e.request, response.clone());
              return response;
            });
          })
        );
      }),
    );
  } else if (NETWORK_FIRST.some((url) => { return new URL(url, location.href).href == new URL(e.request.url, location.href).href })) {
    // ネットワーク優先
    e.respondWith(
      fetch(e.request).then((response) => {
        // console.log("[Service Worker] Fetching resource: " + e.request.url);
        return caches.open(CACHE_NAME).then((cache) => {
          // console.log("[Service Worker] Caching new resource: " + e.request.url);
          cache.put(e.request, response.clone());
          return response;
        });
      }).catch(() => {        
        // console.log("[Service Worker] Caching new resource: " + e.request.url);
        return caches.match(e.request);
      }),
    );
  } else {
    // それ以外はキャッシュ優先で取得するだけ
    e.respondWith(
      caches.match(e.request).then((r) => {
        // console.log("[Service Worker] Fetching resource: " + e.request.url);
        return r || fetch(e.request);
      }),
    );
  }
});
