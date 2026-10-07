/**
 * SERVICE WORKER OFFLINE & PWA - LIFESURF PDV (FASE 12)
 * Garante instalação nativa no celular, carregamento ultra-rápido do App Shell e suporte a Push Notifications em background.
 */

const CACHE_NAME = "lifesurf-pwa-v2.1";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/favicon.svg"
];

// 1. Instalação e pré-cache do App Shell básico
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// 2. Ativação e limpeza de versões anteriores de cache
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Interceptação de requisições (Cache-first para estáticos locais, bypass total para APIs externas)
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Não interceptar requisições para Google, Firebase ou qualquer domínio externo
  if (
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("firebaseio.com") ||
    url.hostname.includes("google.com") ||
    url.hostname !== self.location.hostname ||
    request.method !== "GET"
  ) {
    return;
  }

  // Navegação de páginas (SPA): Network first com fallback limpo para /index.html
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match("/index.html");
        return cached || (await caches.match("/")) || new Response("LifeSurf Offline", {
          status: 200,
          headers: { "Content-Type": "text/html" }
        });
      })
    );
    return;
  }

  // Assets estáticos locais
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === "basic") {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return new Response("", { status: 408, statusText: "Offline Timeout" });
        });
    })
  );
});

// 4. Recebimento de Push Notification em segundo plano (Firebase FCM / WebPush)
self.addEventListener("push", (event) => {
  let title = "LifeSurf PDV";
  let body = "Você recebeu uma nova atualização no sistema.";
  let data = {};

  if (event.data) {
    try {
      const payload = event.data.json();
      if (payload.notification) {
        title = payload.notification.title || title;
        body = payload.notification.body || body;
      }
      data = payload.data || {};
    } catch (e) {
      body = event.data.text() || body;
    }
  }

  const options = {
    body,
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    vibrate: [200, 100, 200],
    data
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// 5. Clique na notificação recebida
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || "/pedidos";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if (client.url.includes(urlToOpen) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
