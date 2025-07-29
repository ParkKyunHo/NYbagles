const CACHE_NAME = 'bagel-shop-v1'
const urlsToCache = [
  '/',
  '/offline.html'
]

// 설치 이벤트
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  )
})

// 활성화 이벤트
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
})

// Fetch 이벤트 - 네트워크 우선, 캐시 폴백
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.open(CACHE_NAME)
            .then((cache) => {
              return cache.match('/offline.html')
            })
        })
    )
  } else {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // 응답 복사
          const responseToCache = response.clone()
          
          caches.open(CACHE_NAME)
            .then((cache) => {
              // 정적 리소스만 캐시
              if (event.request.url.includes('/icons/') || 
                  event.request.url.includes('/_next/static/')) {
                cache.put(event.request, responseToCache)
              }
            })
          
          return response
        })
        .catch(() => {
          return caches.match(event.request)
        })
    )
  }
})