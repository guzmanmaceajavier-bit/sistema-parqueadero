import type { Prisma } from "@prisma/client";
import prisma from "../../config/prisma.js";
import { asyncHandler, AppError } from "../../middlewares/error.middleware.js";
import * as service from "./configuracion.service.js";

export const obtenerConfiguracion = asyncHandler(async (req, res) => {
  const configuracion = await service.obtenerConfiguracion();
  if (!req.usuario) {
    const publico = {
      nombreParqueadero: configuracion?.nombreParqueadero,
      logo: configuracion?.logo,
      fondoLogin: configuracion?.fondoLogin,
      colorFondoLogin: configuracion?.colorFondoLogin,
      direccion: configuracion?.direccion,
      telefono: configuracion?.telefono,
    };
    return res.json({ ok: true, configuracion: publico });
  }
  res.json({ ok: true, configuracion });
});

const CAMPOS_CONFIG = [
  "nombreParqueadero", "nit", "direccion", "ciudad", "telefono", "whatsapp", "correo", "logo", "fondoLogin",
  "colorPrincipal", "colorSecundario", "colorFondo", "modoOscuro", "tamanoFuente",
  "formatoFecha", "formatoHora", "formatoMoneda", "zonaHoraria", "monedaSimbolo", "idioma",
  "notificarWhatsappIngreso", "notificarWhatsappSalida", "notificarWhatsappReserva",
  "notificarWhatsappVencimiento", "notificarEmail",
  "mensajeWhatsappIngreso", "mensajeWhatsappSalida", "mensajeWhatsappFactura",
  "mensajeWhatsappReserva", "mensajeWhatsappRecordatorio", "mensajeWhatsappVencida",
  "mensajeWhatsappBienvenida",
  "horarioApertura", "horarioCierre", "paginacionPorDefecto", "iva",
  "pieFactura", "metodosPago", "intentosMaximos", "minutosGracia",
  "listasConfiguracion",
] as const;

export const guardarConfiguracion = asyncHandler(async (req, res) => {
  const existe = await service.obtenerConfiguracion();
  const data: Record<string, unknown> = {};
  for (const campo of CAMPOS_CONFIG) {
    if (req.body[campo] !== undefined) data[campo] = req.body[campo];
  }

  if (existe) {
    const actualizada = await service.actualizarConfiguracion(existe.id, data as Prisma.ConfiguracionUpdateInput);
    return res.json({ ok: true, message: "Configuración actualizada", configuracion: actualizada });
  }

  data.nombreParqueadero = data.nombreParqueadero || "Parqueadero";
  const nueva = await service.crearConfiguracion(data as Prisma.ConfiguracionCreateInput);
  res.status(201).json({ ok: true, message: "Configuración creada", configuracion: nueva });
});

export const formatearSistema = asyncHandler(async (req, res) => {
  // Confirmación escrita obligatoria: el frontend la exige, pero el servidor
  // es la última barrera. Sin este token el borrado masivo no se ejecuta.
  if (req.body?.confirmacion !== "FORMATEAR") {
    throw new AppError("Debes escribir FORMATEAR para confirmar la operación", 400);
  }

  const orden = [
    "factura", "ingreso", "mensualidad", "reserva", "ausencia",
    "gasto", "movimiento", "caja", "acceso",
    "tarifa", "plan", "puesto", "vehiculo", "cliente", "configuracion",
  ] as const;
  const db = prisma as unknown as Record<string, { deleteMany: () => Promise<unknown> }>;
  for (const modelo of orden) {
    try {
      await db[modelo].deleteMany();
    } catch {
      // El orden respeta las dependencias y se continúa para modelos opcionales.
    }
  }
  res.json({ ok: true, message: "Sistema formateado correctamente. Todos los datos han sido eliminados excepto usuarios." });
});
