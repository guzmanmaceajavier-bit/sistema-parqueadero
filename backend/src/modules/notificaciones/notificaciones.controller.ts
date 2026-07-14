import prisma from "../../config/prisma.js";
import { asyncHandler, AppError } from "../../middlewares/error.middleware.js";

export const subscribir = asyncHandler(async (req, res) => {
  const { subscription } = req.body;
  if (!subscription) throw new AppError("Subscription es requerida", 400);
  const existente = await prisma.pushSubscription.findFirst({ where: { usuarioId: req.usuario.id } });
  if (existente) {
    await prisma.pushSubscription.update({ where: { id: existente.id }, data: { subscription } });
  } else {
    await prisma.pushSubscription.create({ data: { usuarioId: req.usuario.id, subscription } });
  }
  res.json({ ok: true });
});

export const enviarNotificacion = asyncHandler(async (req, res) => {
  const { title, body, url } = req.body;
  if (!title) throw new AppError("Title requerido", 400);
  const subs = await prisma.pushSubscription.findMany();
  const webpush = await import("web-push");
  webpush.setVapidDetails("mailto:admin@parqueadero.com", process.env.VAPID_PUBLIC_KEY || "", process.env.VAPID_PRIVATE_KEY || "");
  const results = await Promise.allSettled(
    subs.map((s) => webpush.sendNotification(s.subscription, JSON.stringify({ title, body, url })).catch(() => {}))
  );
  res.json({ ok: true, enviadas: results.filter((r) => r.status === "fulfilled").length });
});
