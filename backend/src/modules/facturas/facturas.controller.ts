import prisma from "../../config/prisma.js";
import { asyncHandler, AppError } from "../../middlewares/error.middleware.js";
import { paginate } from "../../utils/pagination.js";
import { generarTicketPDF } from "../../services/ticket.service.js";
import { resolverSucursalPermitida } from "../../utils/sucursalAccess.js";
import { registrarMovimiento } from "../../helpers/movimientos.js";

/**
 * D1 — Anular una factura con contrapartida y auditoría.
 * - No se elimina: se marca `anulada`.
 * - Se revierte el movimiento de caja ligado (si la caja está abierta) o se crea
 *   un movimiento de ajuste en la caja abierta actual (si la original está cerrada).
 * - Se devuelve al cliente el saldo que se hubiera consumido (si aplica).
 * - Se recalcula el estado del puesto no; el ingreso no se toca.
 */
export const anularFactura = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const motivo = typeof req.body?.motivo === "string" ? req.body.motivo.trim() : "";
  if (motivo.length < 3) throw new AppError("Debes indicar un motivo de anulación (mínimo 3 caracteres)", 400);
  const sucursalId = resolverSucursalPermitida(req.usuario, req.query.sucursalId);

  const factura = await prisma.factura.findFirst({
    where: { id: Number(id), ...(sucursalId ? { sucursalId } : {}) },
    include: { cajaMovimientos: { include: { caja: true } }, mensualidad: true, ingreso: true },
  });
  if (!factura) throw new AppError("Factura no encontrada", 404);
  if (factura.anulada) throw new AppError("Esta factura ya está anulada", 409);

  const usuario = req.usuario?.usuario || "admin";
  const ahora = new Date();

  await prisma.$transaction(async (tx) => {
    // Serializa la anulación con cierres de caja y evita anular dos veces la misma factura.
    await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124019)) AS advisory_lock`;
    const facturaActual = await tx.factura.findUnique({
      where: { id: factura.id },
      select: { anulada: true },
    });
    if (!facturaActual || facturaActual.anulada) {
      throw new AppError("Esta factura ya fue anulada por otra operación", 409);
    }

    await tx.factura.update({
      where: { id: factura.id },
      data: { anulada: true, anuladaEn: ahora, anuladoPor: usuario, motivoAnulacion: motivo },
    });

    // Reverso en caja
    if (factura.metodoPago) {
      const movOriginal = factura.cajaMovimientos[0];
      const cajaOriginalAbierta = movOriginal?.caja?.estado === "ABIERTA";
      if (movOriginal && cajaOriginalAbierta) {
        // Se anula el movimiento original (soft) — los totales lo excluyen.
        await tx.cajaMovimiento.update({
          where: { id: movOriginal.id },
          data: { anulado: true, anuladoEn: ahora, anuladoPor: usuario, motivoAnulacion: `Anulado por factura ${factura.numero}` },
        });
      } else {
        // La caja original está cerrada o no existe: se registra el reverso en la caja abierta actual.
        const cajaActual = await tx.caja.findFirst({ where: { estado: "ABIERTA", sucursalId: factura.sucursalId ?? sucursalId ?? null } });
        if (!cajaActual) {
          throw new AppError("No hay una caja abierta en esta sucursal para registrar el reverso. Abre la caja y vuelve a anular la factura.", 409);
        }
        await tx.cajaMovimiento.create({
          data: {
            cajaId: cajaActual.id,
            tipo: "EGRESO",
            concepto: `Ajuste por anulación factura ${factura.numero} (motivo: ${motivo})`,
            monto: factura.valor,
            metodoPago: factura.metodoPago,
            facturaId: null,
          },
        });
      }
    }

    // Devolver únicamente el consumo asociado a ESTA factura.
    // El bloqueo del cliente y la comprobación de devolución hacen la operación idempotente.
    if (factura.ingresoId) {
      const ingreso = await tx.ingreso.findUnique({
        where: { id: factura.ingresoId },
        select: { clienteId: true },
      });
      if (ingreso?.clienteId) {
        await tx.$queryRaw`SELECT "id" FROM "Cliente" WHERE "id" = ${ingreso.clienteId} FOR UPDATE`;
        const referenciaFactura = `factura ${factura.numero}`;
        const [consumos, devolucionExistente] = await Promise.all([
          tx.clienteSaldoMovimiento.findMany({
            where: {
              clienteId: ingreso.clienteId,
              tipo: "CONSUMO",
              concepto: { contains: referenciaFactura },
            },
          }),
          tx.clienteSaldoMovimiento.findFirst({
            where: {
              clienteId: ingreso.clienteId,
              tipo: "DEVOLUCION",
              concepto: { contains: `anulación de factura ${factura.numero}` },
            },
            select: { id: true },
          }),
        ]);
        const consumido = consumos.reduce((s, movimiento) => s + movimiento.monto, 0);
        if (consumido > 0 && !devolucionExistente) {
          const saldoAntes = await tx.cliente.findUnique({
            where: { id: ingreso.clienteId },
            select: { saldo: true },
          });
          const saldoPrevio = saldoAntes?.saldo ?? 0;
          await tx.cliente.update({
            where: { id: ingreso.clienteId },
            data: { saldo: { increment: consumido } },
          });
          await tx.clienteSaldoMovimiento.create({
            data: {
              clienteId: ingreso.clienteId,
              tipo: "DEVOLUCION",
              monto: consumido,
              saldoAntes: saldoPrevio,
              saldoDespues: saldoPrevio + consumido,
              concepto: `Devolución de saldo por anulación de factura ${factura.numero}`,
              usuario,
            },
          });
        }
        // Los consumos históricos anteriores a esta referencia no se devuelven
        // automáticamente: no se puede demostrar a qué factura pertenecían.
      }
    }

    // D1-c: revertir renovación automática si la factura saldó una mensualidad.
    if (factura.mensualidadId && factura.origen === "MENSUALIDAD" && factura.mensualidad) {
      const m = factura.mensualidad;
      // Si el período fue renovado (fechaInicio posterior al pago), se marca VENCIDA para revisión.
      if (new Date(m.fechaInicio) >= new Date(factura.createdAt)) {
        await tx.mensualidad.update({ where: { id: m.id }, data: { estado: "VENCIDA" } });
      }
    }
  });

  await registrarMovimiento("FACTURACION", "ANULAR", `Factura ${factura.numero} anulada — $${factura.valor}. Motivo: ${motivo}`, usuario);
  res.json({ ok: true, message: "Factura anulada con contrapartida y auditoría" });
});

export const obtenerFacturas = asyncHandler(async (req, res) => {
  const { page, limit, q, desde, hasta, origen } = req.query;
  const sucursalId = resolverSucursalPermitida(req.usuario, req.query.sucursalId);
  const where: any = sucursalId ? { OR: [{ mensualidad: { sucursalId } }, { mensualidad: { vehiculo: { sucursalId } } }, { ingreso: { vehiculo: { sucursalId } } }] } : {};
  if (desde || hasta) {
    where.createdAt = {};
    if (desde) where.createdAt.gte = new Date(String(desde));
    if (hasta) where.createdAt.lte = new Date(String(hasta));
  }
  if (origen) where.origen = origen;
  if (q) {
    const queryText = String(q);
    const filtroTexto = [
      { numero: { contains: queryText, mode: "insensitive" } },
      { ingreso: { cliente: { nombres: { contains: q, mode: "insensitive" } } } },
      { ingreso: { cliente: { apellidos: { contains: q, mode: "insensitive" } } } },
      { ingreso: { vehiculo: { placa: { contains: q, mode: "insensitive" } } } },
      { mensualidad: { cliente: { nombres: { contains: q, mode: "insensitive" } } } },
      { mensualidad: { cliente: { apellidos: { contains: q, mode: "insensitive" } } } },
      { mensualidad: { vehiculo: { placa: { contains: q, mode: "insensitive" } } } },
    ];
    where.AND = [...(where.OR ? [{ OR: where.OR }] : []), { OR: filtroTexto }];
    delete where.OR;
  }
  const { data: facturas, pagination } = await paginate(prisma, "factura", {
    page, limit, where,
    include: { ingreso: { include: { cliente: true, vehiculo: true, puesto: true } }, mensualidad: { include: { cliente: true, vehiculo: true } } },
    orderBy: { id: "desc" },
  });
  res.json({ ok: true, facturas, pagination });
});

export const obtenerFactura = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const sucursalId = resolverSucursalPermitida(req.usuario, req.query.sucursalId);
  const [factura, config] = await Promise.all([
    prisma.factura.findFirst({
      where: { id: Number(id), ...(sucursalId ? { OR: [{ mensualidad: { sucursalId } }, { mensualidad: { vehiculo: { sucursalId } } }, { ingreso: { vehiculo: { sucursalId } } }] } : {}) },
      include: { ingreso: { include: { cliente: true, vehiculo: true, puesto: true } }, mensualidad: { include: { cliente: true, vehiculo: true } } },
    }),
    prisma.configuracion.findFirst(),
  ]);
  if (!factura) throw new AppError("Factura no encontrada", 404);
  res.json({ ok: true, factura, config });
});

export const descargarFacturaPDF = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const sucursalId = resolverSucursalPermitida(req.usuario, req.query.sucursalId);
  const [factura, config] = await Promise.all([
    prisma.factura.findFirst({
      where: { id: Number(id), ...(sucursalId ? { OR: [{ mensualidad: { sucursalId } }, { mensualidad: { vehiculo: { sucursalId } } }, { ingreso: { vehiculo: { sucursalId } } }] } : {}) },
      include: { ingreso: { include: { cliente: true, vehiculo: true, puesto: true } }, mensualidad: { include: { cliente: true, vehiculo: true } } },
    }),
    prisma.configuracion.findFirst(),
  ]);
  if (!factura) throw new AppError("Factura no encontrada", 404);

  const ref: any = factura.origen === "MENSUALIDAD" ? factura.mensualidad : factura.ingreso;
  const cliente: any = ref?.cliente || {};
  const vehiculo: any = ref?.vehiculo || {};
  const entrada = ref?.fechaEntrada ? new Date(ref.fechaEntrada) : null;
  const salida = ref?.fechaSalida ? new Date(ref.fechaSalida) : null;
  const minutos = ref?.tiempoMinutos || (salida && entrada ? Math.ceil((salida.getTime() - entrada.getTime()) / 60000) : 0);
  const horas = Math.floor(minutos / 60);
  const dias = Math.floor(horas / 24);
  const tiempoStr = minutos > 0
    ? `${dias > 0 ? `${dias} día(s) ` : ""}${horas % 24 > 0 ? `${horas % 24} hora(s) ` : ""}${minutos % 60 > 0 ? `${minutos % 60} min` : ""}`
    : "";

  const pdf = await generarTicketPDF({
    titulo: "RECIBO DE PAGO",
    tipo: "salida",
    folio: factura.numero,
    placa: vehiculo.placa || "\u2014",
    cliente: `${cliente.nombres || ""} ${cliente.apellidos || ""}`.trim(),
    clienteDoc: cliente.documento || "",
    clienteTelefono: cliente.telefono || "",
    vehiculo: vehiculo.tipo
      ? `${vehiculo.marca ? `${vehiculo.marca} ${vehiculo.modelo || ""}`.trim() : vehiculo.tipo.charAt(0).toUpperCase() + vehiculo.tipo.slice(1)}`
      : vehiculo.marca
        ? `${vehiculo.marca} ${vehiculo.modelo || ""}`.trim()
        : "",
    vehiculoTipo: vehiculo.tipo || "",
    vehiculoMarca: vehiculo.marca || "",
    vehiculoModelo: vehiculo.modelo || "",
    ingreso: entrada ? entrada.toLocaleString("es-CO") : "",
    salida: salida ? salida.toLocaleString("es-CO") : "",
    tiempo: tiempoStr,
    total: factura.valor || 0,
    metodoPago: factura.metodoPago || "",
    puesto: ref?.puesto?.codigo || "",
    parqueadero: config?.nombreParqueadero || "Parqueadero",
    nit: config?.nit || "",
    direccion: config?.direccion || "",
    ciudad: config?.ciudad || "",
    telefono: config?.telefono || "",
    correo: config?.correo || "",
    pieFactura: config?.pieFactura || "",
    colorPrincipal: config?.colorPrincipal || "",
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=${factura.numero}.pdf`);
  res.send(pdf);
});

export const enviarWhatsapp = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const sucursalId = resolverSucursalPermitida(req.usuario, req.query.sucursalId);
  const [factura, config] = await Promise.all([
    prisma.factura.findFirst({
      where: { id: Number(id), ...(sucursalId ? { OR: [{ sucursalId }, { mensualidad: { sucursalId } }, { ingreso: { vehiculo: { sucursalId } } }] } : {}) },
      include: { ingreso: { include: { cliente: true, vehiculo: true } }, mensualidad: { include: { cliente: true, vehiculo: true } } },
    }),
    prisma.configuracion.findFirst(),
  ]);
  if (!factura) throw new AppError("Factura no encontrada", 404);

  const ref: any = factura.origen === "MENSUALIDAD" ? factura.mensualidad : factura.ingreso;
  const telefono = ref?.cliente?.telefono;
  if (!telefono) throw new AppError("Cliente sin teléfono", 400);

  const vehiculo: any = ref?.vehiculo || {};
  const entrada = ref?.fechaEntrada ? new Date(ref.fechaEntrada).toLocaleString("es-CO") : "";
  const salida = ref?.fechaSalida ? new Date(ref.fechaSalida).toLocaleString("es-CO") : "";
  const nombreParqueadero = config?.nombreParqueadero || "Parqueadero";
  const mensaje = [
    `*${nombreParqueadero}*`,
    "",
    `🧾 *Recibo de Pago*`,
    `No. ${factura.numero}`,
    `Fecha: ${new Date(factura.createdAt).toLocaleString("es-CO")}`,
    "",
    `👤 ${ref?.cliente?.nombres || ""} ${ref?.cliente?.apellidos || ""}`,
    `🚗 ${vehiculo.placa || ""} ${vehiculo.tipo ? `(${vehiculo.tipo})` : ""}`,
    entrada ? `📅 Entrada: ${entrada}` : "",
    salida ? `📅 Salida: ${salida}` : "",
    ref?.puesto?.codigo ? `🅿️ Puesto: ${ref.puesto.codigo}` : "",
    "",
    `💰 *Total: $${factura.valor.toLocaleString()}*`,
    `💳 ${factura.metodoPago || "Efectivo"}`,
    "",
    "_Este documento certifica el pago realizado._",
    "_¡Gracias por preferirnos!_",
  ].filter(Boolean).join("\n");
  const codigoPais = config?.whatsapp ? "" : "57";
  const url = config?.whatsapp
    ? `https://wa.me/${config.whatsapp}?text=${encodeURIComponent(mensaje)}`
    : `https://wa.me/${codigoPais}${telefono}?text=${encodeURIComponent(mensaje)}`;
  res.json({ ok: true, url });
});

export const reciboSalida = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const sucursalId = resolverSucursalPermitida(req.usuario, req.query.sucursalId);
  const factura = await prisma.factura.findFirst({
    where: { id: Number(id), ...(sucursalId ? { OR: [{ sucursalId }, { mensualidad: { sucursalId } }, { ingreso: { vehiculo: { sucursalId } } }] } : {}) },
    include: { ingreso: { include: { vehiculo: { include: { cliente: true } }, puesto: true } } },
  });
  if (!factura) throw new AppError('Factura no encontrada', 404);

  const ing = factura.ingreso;
  if (!ing) throw new AppError("La factura no tiene un ingreso asociado", 404);
  const diffMs = ing.fechaSalida
    ? new Date(ing.fechaSalida).getTime() - new Date(ing.fechaEntrada).getTime()
    : 0;
  const horas = Math.floor(diffMs / 3600000);
  const mins = Math.floor((diffMs % 3600000) / 60000);
  const tiempo = `${horas}h ${mins}min`;

  const config = await prisma.configuracion.findFirst();
  const pdf = await generarTicketPDF({
    titulo: 'FACTURA DE SALIDA',
    tipo: 'salida',
    folio: factura.numero,
    placa: ing?.vehiculo?.placa || '\u2014',
    cliente: [ing?.vehiculo?.cliente?.nombres, ing?.vehiculo?.cliente?.apellidos].filter(Boolean).join(' ') || '',
    vehiculo: `${ing?.vehiculo?.marca || ''} ${ing?.vehiculo?.modelo || ''}`.trim() || ing?.vehiculo?.tipo || '',
    ingreso: new Date(ing.fechaEntrada).toLocaleString('es-CO'),
    salida: ing?.fechaSalida ? new Date(ing.fechaSalida).toLocaleString('es-CO') : '',
    tiempo,
    total: factura.valor || 0,
    metodoPago: factura.metodoPago || '',
    puesto: ing?.puesto?.codigo || '',
    parqueadero: config?.nombreParqueadero || 'Parqueadero',
    nit: config?.nit || '',
    direccion: config?.direccion || '',
    ciudad: config?.ciudad || '',
    telefono: config?.telefono || '',
    correo: config?.correo || '',
    pieFactura: config?.pieFactura || '',
    colorPrincipal: config?.colorPrincipal || '',
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="recibo-${factura.numero}.pdf"`);
  res.send(pdf);
});
