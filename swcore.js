// インストール処理
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

// 古いバージョンのキャッシュを削除
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => {
          return CACHE_NAME.split("-")[0] == key.split("-")[0];
        }).map((key) => {
          // 不要なキャッシュを削除
          return caches.delete(key);
        })
      );
    })
  );
});

// ファイルをキャッシュ
self.addEventListener("message", (event) => {
  if (event.data.type === "CACHE_URLS") {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.addAll(event.data.payload);
      })
    );
  }
});

// リソースフェッチ時のキャッシュロード処理
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      })
  );
});