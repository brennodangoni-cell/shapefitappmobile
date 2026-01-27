// Service Worker para PWA ShapeFIT
const CACHE_NAME = 'shapefit-v8'; // Versão do cache atualizada para forçar a atualização
const urlsToCache = [
  '/',
  '/index.html',
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
        // ✅ Usar addAll com tratamento de erro para não falhar se algum arquivo não existir
        return cache.addAll(urlsToCache).catch(err => {
          console.warn('Alguns arquivos não foram cacheados:', err);
          // Continuar mesmo se alguns arquivos falharem
          return Promise.resolve();
        });
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
                 url.pathname === '/' ||
                 url.pathname.endsWith('/') ||
                 url.pathname.endsWith('.php');
  
  // ✅ Para index.html ou /, SEMPRE buscar do network primeiro
  const isIndexPage = url.pathname === '/' || url.pathname === '/index.html';
  
  if (isHTML) {
    // Para HTML: SEMPRE buscar do network, NUNCA do cache
    event.respondWith(
      fetch(event.request, { 
        cache: 'no-store',
        credentials: 'same-origin',
        mode: 'cors'
      })
        .then(response => {
          // ✅ Verificar se a resposta é válida antes de retornar
          if (!response || response.status === 0 || response.status >= 500) {
            throw new Error('Resposta inválida');
          }
          // ✅ Para index.html, garantir que não seja cached
          if (isIndexPage) {
            const headers = new Headers(response.headers);
            headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            headers.set('Pragma', 'no-cache');
            headers.set('Expires', '0');
            return new Response(response.body, {
              status: response.status,
              statusText: response.statusText,
              headers: headers
            });
          }
          // Retorna resposta do network sem cachear
          return response;
        })
        .catch(() => {
          // ✅ Se falhar, tentar buscar do cache como fallback (apenas se não for index)
          if (!isIndexPage) {
            return caches.match(event.request)
              .then(cachedResponse => {
                if (cachedResponse) {
                  return cachedResponse;
                }
              });
          }
          // Para index.html, não usar cache - deixar o erro propagar
          throw new Error('Não foi possível carregar a página');
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

