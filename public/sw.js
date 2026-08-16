// Service Worker de Ice-T. Manual (sin Workbox) para mantener el control
// explícito de qué se cachea: el objetivo es que la app abra y el
// vendedor pueda seguir registrando ventas (guardadas en IndexedDB, ver
// src/lib/offline) aunque se pierda la señal a medio reparto.
//
// Sube este número de versión cada vez que cambies este archivo para que
// los navegadores de los usuarios descarten el caché anterior.
const CACHE_VERSION = "v2";
const CACHE_NAME = `ice-t-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        PRECACHE_URLS.map((url) => cache.add(url).catch(() => undefined))
      )
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest" ||
    /\.(png|jpg|jpeg|svg|webp|ico|woff2?)$/.test(url.pathname)
  );
}

// Sólo se guardan respuestas propias y correctas. Antes se cacheaba
// cualquier cosa: un 500 momentáneo o el redirect a /login quedaban
// guardados y se seguían sirviendo offline como si fueran la página.
function isCacheable(response) {
  return response && response.ok && response.type === "basic" && !response.redirected;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // deja pasar Supabase y otros orígenes

  // Navegación (carga de página completa / refresh): network-first, con
  // caché de respaldo y offline.html como último recurso.
  //
  // NOTA: estas páginas se renderizan en el servidor CON los datos del
  // usuario que inició sesión. La Cache Storage es por origen, no por
  // usuario, así que en un teléfono compartido entre vendedores el
  // siguiente en entrar podría ver, sin conexión, la página cacheada del
  // anterior. Por eso la app manda CLEAR_CACHES al cerrar sesión (ver el
  // listener de 'message' más abajo).
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (isCacheable(response)) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || (await caches.match("/offline.html"));
        })
    );
    return;
  }

  // Assets estáticos: cache-first (son inmutables por hash de Next.js).
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (isCacheable(response)) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
          })
      )
    );
    return;
  }

  // Todo lo demás (API routes, RSC payloads, etc.) va directo a la red.
});

// La app envía este mensaje al cerrar sesión para que no queden páginas
// renderizadas con los datos del usuario anterior (teléfonos compartidos
// entre vendedores). Ver handleLogout en src/components/app-shell.tsx.
self.addEventListener("message", (event) => {
  if (event.data?.type !== "CLEAR_CACHES") return;

  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => {
        // Vuelve a dejar disponible lo mínimo para que la app arranque
        // offline en el siguiente inicio de sesión.
        return caches
          .open(CACHE_NAME)
          .then((cache) => Promise.all(PRECACHE_URLS.map((u) => cache.add(u).catch(() => undefined))));
      })
      .then(() => {
        event.source?.postMessage({ type: "CACHES_CLEARED" });
      })
  );
});

// Notificaciones push (recordatorios de reabasto). Ver
// supabase/functions/send-restock-reminders para quién las dispara.
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Ice-T", body: event.data.text() };
  }

  const title = payload.title || "Ice-T";
  const options = {
    body: payload.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: payload.url || "/clientes" },
    tag: payload.tag || undefined,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/clientes";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      const existing = clientsArr.find((c) => c.url.includes(targetUrl));
      if (existing) return existing.focus();
      return self.clients.openWindow(targetUrl);
    })
  );
});
