// Service Worker para PWA ShapeFIT
const CACHE_NAME = 'shapefit-v7'; // Versão do cache atualizada para forçar a atualização
const urlsToCache = [
  '/assets/css/style.css',
  '/assets/js/script.js',
  '/assets/js/banner-carousel.js',
  '/assets/images/icon-192x192.png',
  '/assets/images/icon-512x512.png'
];

// Install event - cache resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache aberto');
        return cache.addAll(urlsToCache);
      })
  );
  // Força ativação imediata do novo service worker
  self.skipWaiting();
});

// Fetch event - network first para HTML, cache first para assets
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const isHTML = event.request.headers.get('accept')?.includes('text/html') || 
                 url.pathname.endsWith('.html') || 
                 url.pathname.endsWith('/') ||
                 url.pathname.endsWith('.php');
  
  if (isHTML) {
    // Para HTML: SEMPRE buscar do network, NUNCA do cache
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(response => {
          // Retorna resposta do network sem cachear
          return response;
        })
        .catch(() => {
          // Se falhar completamente, retorna erro
          return new Response('Erro ao carregar página. Verifique sua conexão.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
          });
        })
    );
  } else {
    // Para assets: cache first, depois network
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          return response || fetch(event.request);
        })
    );
  }
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deletando cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Força controle imediato de todas as páginas
  return self.clients.claim();
});

