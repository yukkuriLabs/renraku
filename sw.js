/* ==========================================================================
 * サービスワーカー(通知 + オフライン対応)
 * 重要: 先頭の OneSignal 行は削除しないこと(プッシュ通知に必須)
 * ========================================================================== */
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

var CACHE = 'gakkou-v2';
var ASSETS = ['./', './index.html', './manifest.json', './icon-192.png',
              './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return Promise.allSettled(ASSETS.map(function (u) { return cache.add(u); }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch (e) { return; }

  /* Google(データ)・OneSignal(CDN)には触れない = 常に最新が取れる */
  if (url.origin !== self.location.origin) return;

  /* ページ遷移: ネット優先、ダメならキャッシュ */
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(function (r) {
        var copy = r.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () {});
        return r;
      }).catch(function () {
        return caches.match(req).then(function (m) { return m || caches.match('./index.html'); });
      })
    );
    return;
  }

  /* 画像・マニフェスト等: キャッシュ優先 + 背景更新 */
  event.respondWith(
    caches.match(req).then(function (cached) {
      var network = fetch(req).then(function (r) {
        if (r && r.ok) {
          var copy = r.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () {});
        }
        return r;
      }).catch(function () { return cached; });
      return cached || network;
    })
  );
});
