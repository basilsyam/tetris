const CACHE_NAME = 'tetris-pro-v2026';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './fonts.css',
  './icon.svg',
  // إضافة مجلد الخطوط الذي تم إنشاؤه بواسطة سكريبت الـ PowerShell
  './fonts/cairo.woff2', 
  './fonts/digital-7.woff'
];

// مرحلة التثبيت: حفظ كل الملفات في الذاكرة التخزينية (Cache)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Caching all assets for offline play...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// مرحلة التفعيل: حذف الكاش القديم إذا وجد
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// استراتيجية "Cache First": ابحث في الكاش أولاً، إذا لم يوجد اذهب للإنترنت
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).catch(() => {
        // في حال فشل الإنترنت تماماً وعدم وجود الملف في الكاش
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});