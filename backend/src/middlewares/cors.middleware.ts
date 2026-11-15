import type { RequestHandler } from "express";

/**
 * CORS con lista explícita y rechazo real de orígenes no autorizados.
 * No confía en subdominios, comodines ni coincidencias parciales.
 * Las peticiones sin Origin siguen disponibles para clientes no navegador.
 */
export function corsSeguro(originsRaw = "", nodeEnv = "development"): RequestHandler {
  const origins = originsRaw.split(",").map(origin => origin.trim()).filter(Boolean);

  return (req, res, next) => {
    const origin = req.headers.origin;
    const allowed = !origin
      || origins.includes(origin)
      || (nodeEnv !== "production" && origins.length === 0);

    res.header("Vary", "Origin");

    if (!allowed) {
      return res.status(403).json({
        ok: false,
        message: "Origen no autorizado",
      });
    }

    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Methods", "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-CSRF-Token");

    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }

    return next();
  };
}
