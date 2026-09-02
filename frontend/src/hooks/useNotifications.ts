import { useEffect, useState } from "react";

const VAPID_PUBLIC_KEY = process.env.REACT_APP_VAPID_KEY || "";

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(Notification.permission);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      navigator.serviceWorker.register("/sw.js").then(async (reg) => {
        const sub = await reg.pushManager.getSubscription();
        setSubscribed(!!sub);
      }).catch(() => {});
    }
  }, []);

  const requestPermission = async () => {
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      setSubscribed(true);
      try {
        const api = (await import("../services/api")).default;
        await api.post("/notificaciones/subscribir", { subscription: sub.toJSON() });
      } catch {}
    }
  };

  return { permission, subscribed, requestPermission };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}
