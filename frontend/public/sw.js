self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(clients.claim()));

self.addEventListener("push", (e) => {
  let data = {};
  try { data = e.data?.json() || {}; } catch {}
  const title = data.title || "Parqueadero";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icon.png",
    badge: "/badge.png",
    vibrate: [200, 100, 200],
    data: { url: data.url || "/" },
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url || "/";
  e.waitUntil(clients.openWindow(url));
});
