/// <reference lib="webworker" />

declare var self: ServiceWorkerGlobalScope;
export {};

interface PushPayload {
  title: string;
  body: string;
  url: string;
}

self.addEventListener("push", (event) => {
  if (!event.data) return;
  const { title, body, url } = event.data.json() as PushPayload;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/favicon.svg",
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const { url } = event.notification.data as { url: string };
  event.waitUntil(self.clients.openWindow(url));
});
