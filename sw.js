const CACHE_NAME = 'tetris-pro-v2026.3'; // تغيير الإصدار لإجبار المتصفح على التحديث

// القائمة الأساسية المضمونة (تأكد من وجود هذه الملفات في المجلد الرئيسي)
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icon.svg'
];

// مرحلة التثبيت: محاولة حفظ الملفات مع معالجة الأخطاء لكل ملف على حدة
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Attempting to cache assets...');
      // استخدام map بدلاً من addAll مباشرة لتجنب فشل الكل بسبب ملف واحد
      return Promise.all(
        ASSETS_TO_CACHE.map(url => {
          return fetch(url).then(response => {
            if (!response.ok) throw new Error(`Request failed for ${url}`);
            return cache.put(url, response);
          }).catch(err => console.warn(`Skipping ${url}: ${err.message}`));
        })
      );
    })
  );
  self.skipWaiting();
});

// مرحلة التفعيل: تنظيف الكاش القديم
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// استراتيجية جلب البيانات (Cache First)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});