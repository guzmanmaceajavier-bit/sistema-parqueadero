import prisma from "../../config/prisma.js";
import { asyncHandler, AppError } from "../../middlewares/error.middleware.js";
import { paginate } from "../../utils/pagination.js";
import { registrarMovimiento } from "../../helpers/movimientos.js";
import { generarNumeroFactura } from "../../services/facturaCounter.js";

export const crearAusencia = asyncHandler(async (req, res) => {
  const { clienteId, vehiculoId, fechaSalida, fechaRegreso, motivo, opcion } = req.body;
  if (!clienteId || !vehiculoId) throw new AppError("Cliente y vehículo son requeridos", 400);

  const [cliente, vehiculo] = await Promise.all([
    prisma.cliente.findUnique({ where: { id: Number(clienteId) } }),
    prisma.vehiculo.findUnique({ where: { id: Number(vehiculoId) } }),
  ]);
  if (!cliente) throw new AppError("Cliente no encontrado", 404);
  if (!vehiculo) throw new AppError("Vehículo no encontrado", 404);

  let numeroFactura = null;
  if (vehiculo) {
    const ingresoActivo = await prisma.ingreso.findFirst({
      where: { vehiculoId: Number(vehiculoId), estado: "ACTIVO" },
      include: { puesto: true, vehiculo: true },
    });
    if (ingresoActivo) numeroFactura = await generarNumeroFactura("FACT");
  }

  const ausencia = await prisma.$transaction(async (tx) => {
    const a = await tx.ausencia.create({
      data: {
        clienteId: Number(clienteId), vehiculoId: Number(vehiculoId),
        fechaSalida: fechaSalida ? new Date(fechaSalida) : new Date(), fechaRegreso: fechaRegreso ? new Date(fechaRegreso) : null, motivo, opcion: opcion || "HISTORIAL",
      },
      include: { cliente: true, vehiculo: true },
    });
    await tx.cliente.update({ where: { id: Number(clienteId) }, data: { estado: "AUSENTE" } });

    if (numeroFactura) {
      const ingresoActivo = await tx.ingreso.findFirst({
        where: { vehiculoId: Number(vehiculoId), estado: "ACTIVO" },
        include: { puesto: true, vehiculo: true },
      });
      if (ingresoActivo) {
        const ahora = new Date();
        const tiempoMinutos = Math.ceil((ahora - ingresoActivo.fechaEntrada) / (1000 * 60));
        const tarifa = await tx.tarifa.findFirst({
          where: { tipoVehiculo: ingresoActivo.vehiculo.tipo, activa: true },
          orderBy: { valor: "asc" },
        });
        let valorPagado = 0;
        if (tarifa) {
          const cortesia = tarifa.minutosCortesia || 0;
          const minutosFacturables = Math.max(0, tiempoMinutos - cortesia);
          const horas = Math.ceil(minutosFacturables / 60);
          valorPagado = horas * tarifa.valor;
        }
        await tx.factura.create({
          data: { numero: numeroFactura, ingresoId: ingresoActivo.id, origen: "INGRESO", valor: valorPagado, metodoPago: "efectivo" },
        });
        await tx.ingreso.update({
          where: { id: ingresoActivo.id },
          data: { fechaSalida: ahora, estado: "FINALIZADO", tiempoMinutos, valorPagado },
        });
        if (ingresoActivo.puestoId) {
          await tx.puesto.update({ where: { id: ingresoActivo.puestoId }, data: { estado: "AUSENCIA" } });
        }
      }
    } else {
      const mensualidad = await tx.mensualidad.findFirst({
        where: { vehiculoId: Number(vehiculoId), estado: "ACTIVA", puestoId: { not: null } },
      });
      if (mensualidad?.puestoId) {
        await tx.puesto.update({ where: { id: mensualidad.puestoId }, data: { estado: "AUSENCIA" } });
      }
    }
    return a;
  });

  await registrarMovimiento("AUSENCIAS", "CREAR", `Ausencia: ${cliente.nombres} ${cliente.apellidos}`, req.usuario?.usuario || "admin");
  if (numeroFactura) await registrarMovimiento("INGRESOS", "SALIDA", `Ausencia: ingreso finalizado, puesto liberado`, req.usuario?.usuario || "admin");
  res.status(201).json({ ok: true, ausencia });
});

export const obtenerAusencias = asyncHandler(async (req, res) => {
  const { page, limit, estado, clienteId, q } = req.query;
  const where = {};
  if (estado) where.estado = estado;
  if (clienteId) where.clienteId = Number(clienteId);
  if (q) {
    where.OR = [
      { cliente: { nombres: { contains: q, mode: "insensitive" } } },
      { cliente: { apellidos: { contains: q, mode: "insensitive" } } },
      { vehiculo: { placa: { contains: q, mode: "insensitive" } } },
      { motivo: { contains: q, mode: "insensitive" } },
    ];
  }

  const { data: ausencias, pagination } = await paginate(prisma, "ausencia", {
    page, limit, where,
    include: { cliente: true, vehiculo: true },
    orderBy: { fechaSalida: "desc" },
  });
  res.json({ ok: true, ausencias, pagination });
});

export const obtenerAusencia = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const ausencia = await prisma.ausencia.findUnique({
    where: { id: Number(id) },
    include: { cliente: true, vehiculo: true },
  });
  if (!ausencia) throw new AppError("Ausencia no encontrada", 404);
  res.json({ ok: true, ausencia });
});

export const actualizarAusencia = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { fechaSalida, fechaRegreso, motivo, opcion, estado } = req.body;

  const existente = await prisma.ausencia.findUnique({ where: { id: Number(id) } });
  if (!existente) throw new AppError("Ausencia no encontrada", 404);

  const data = {};
  if (fechaSalida) data.fechaSalida = new Date(fechaSalida);
  if (fechaRegreso !== undefined) data.fechaRegreso = fechaRegreso ? new Date(fechaRegreso) : null;
  if (motivo !== undefined) data.motivo = motivo;
  if (opcion) data.opcion = opcion;
  if (estado) data.estado = estado;

  const ausencia = await prisma.ausencia.update({
    where: { id: Number(id) }, data,
    include: { cliente: true, vehiculo: true },
  });
  res.json({ ok: true, ausencia });
});

export const finalizarAusencia = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existente = await prisma.ausencia.findUnique({
    where: { id: Number(id) },
    include: { cliente: true, vehiculo: true },
  });
  if (!existente) throw new AppError("Ausencia no encontrada", 404);

  let mensaje = "Ausencia finalizada";

  const ausencia = await prisma.$transaction(async (tx) => {
    const fechaRegreso = new Date();
    const diasAusente = existente.fechaRegreso
      ? Math.max(1, Math.ceil((existente.fechaRegreso.getTime() - existente.fechaSalida.getTime()) / 86400000))
      : Math.max(1, Math.ceil((fechaRegreso.getTime() - existente.fechaSalida.getTime()) / 86400000));

    const a = await tx.ausencia.update({
      where: { id: Number(id) },
      data: { estado: "FINALIZADA", fechaRegreso },
      include: { cliente: true, vehiculo: true },
    });
    await tx.cliente.update({ where: { id: a.clienteId }, data: { estado: "ACTIVO" } });

    const mensActiva = await tx.mensualidad.findFirst({
      where: { vehiculoId: a.vehiculoId, estado: "ACTIVA", puestoId: { not: null } },
    });
    const puestosAusencia = await tx.puesto.findMany({
      where: { estado: "AUSENCIA" },
      include: { ingresos: { where: { vehiculoId: a.vehiculoId }, take: 1 }, mensualidades: { where: { vehiculoId: a.vehiculoId }, take: 1 } },
    });
    for (const p of puestosAusencia) {
      if (p.ingresos.length > 0 || p.mensualidades.length > 0) {
        const nuevoEstado = mensActiva ? "OCUPADO" : "LIBRE";
        await tx.puesto.update({ where: { id: p.id }, data: { estado: nuevoEstado } });
      }
    }

    if (existente.opcion === "CONGELAR") {
      const mensualidades = await tx.mensualidad.findMany({
        where: { vehiculoId: a.vehiculoId, estado: "ACTIVA" },
      });
      for (const m of mensualidades) {
        const nuevaFechaFin = new Date(m.fechaFin.getTime() + diasAusente * 86400000);
        await tx.mensualidad.update({
          where: { id: m.id },
          data: { fechaFin: nuevaFechaFin },
        });
        mensaje = `Mensualidad congelada — nueva fecha fin: ${nuevaFechaFin.toLocaleDateString("es-CO")}`;
      }
    } else if (existente.opcion === "EXTENDER") {
      const mensualidades = await tx.mensualidad.findMany({
        where: { vehiculoId: a.vehiculoId, estado: "ACTIVA" },
      });
      for (const m of mensualidades) {
        const nuevaFechaFin = new Date(m.fechaFin.getTime() + diasAusente * 86400000);
        await tx.mensualidad.update({
          where: { id: m.id },
          data: { fechaFin: nuevaFechaFin },
        });
        mensaje = `Vencimiento extendido ${diasAusente} día(s) — nueva fecha fin: ${nuevaFechaFin.toLocaleDateString("es-CO")}`;
      }
    } else if (existente.opcion === "DESCONTAR") {
      const mensualidades = await tx.mensualidad.findMany({
        where: { vehiculoId: a.vehiculoId, estado: "ACTIVA" },
      });
      for (const m of mensualidades) {
        const valorDia = m.valor / 30;
        const descuento = Math.round(valorDia * diasAusente * 100) / 100;
        const nuevoValor = Math.max(0, m.valor - descuento);
        await tx.mensualidad.update({
          where: { id: m.id },
          data: { valor: nuevoValor },
        });
        mensaje = `Descontados $${descuento.toLocaleString()} — nuevo valor mensualidad: $${nuevoValor.toLocaleString()}`;
      }
    } else if (existente.opcion === "MANTENER") {
      mensaje = "Ausencia finalizada — cobro normal (sin cambios en mensualidad)";
    }

    if (mensActiva) {
      const ingresoExistente = await tx.ingreso.findFirst({ where: { vehiculoId: a.vehiculoId, estado: "ACTIVO" } });
      if (!ingresoExistente && mensActiva.puestoId) {
        await tx.ingreso.create({
          data: { clienteId: a.clienteId, vehiculoId: a.vehiculoId, puestoId: mensActiva.puestoId },
        });
        mensaje += " — Ingreso reactivado";
      }
    }

    return a;
  });

  await registrarMovimiento("AUSENCIAS", "FINALIZAR", `Ausencia #${id} finalizada — ${existente.cliente?.nombres} (${existente.opcion})`, req.usuario?.usuario || "admin");
  res.json({ ok: true, ausencia, mensaje });
});

export const eliminarAusencia = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existente = await prisma.ausencia.findUnique({ where: { id: Number(id) } });
  if (!existente) throw new AppError("Ausencia no encontrada", 404);

  await prisma.ausencia.delete({ where: { id: Number(id) } });
  await registrarMovimiento("AUSENCIAS", "ELIMINAR", `Ausencia eliminada`, req.usuario?.usuario || "admin");
  res.json({ ok: true, message: "Ausencia eliminada" });
});
