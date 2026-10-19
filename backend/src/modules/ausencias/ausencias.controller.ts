import prisma from "../../config/prisma.js";
import { asyncHandler, AppError } from "../../middlewares/error.middleware.js";
import { paginate } from "../../utils/pagination.js";
import { registrarMovimiento } from "../../helpers/movimientos.js";
import { generarNumeroFactura } from "../../services/facturaCounter.js";

export const crearAusencia = asyncHandler(async (req, res) => {
  const { clienteId, vehiculoId, fechaSalida, fechaRegreso, motivo, opcion } = req.body;
  if (!clienteId || !vehiculoId) throw new AppError("Cliente y vehículo son requeridos", 400);

  const cid = Number(clienteId);
  const vid = Number(vehiculoId);

  const [cliente, vehiculo] = await Promise.all([
    prisma.cliente.findUnique({ where: { id: cid } }),
    prisma.vehiculo.findUnique({ where: { id: vid } }),
  ]);
  if (!cliente) throw new AppError("Cliente no encontrado", 404);
  if (!vehiculo) throw new AppError("Vehículo no encontrado", 404);
  if (vehiculo.clienteId !== cid) throw new AppError("El vehículo no pertenece al cliente seleccionado", 400);

  const ingresoActivo = await prisma.ingreso.findFirst({
    where: { vehiculoId: vid, estado: "ACTIVO" },
    include: { puesto: true, vehiculo: true },
  });

  const ausencia = await prisma.$transaction(async (tx) => {
    const a = await tx.ausencia.create({
      data: {
        clienteId: cid, vehiculoId: vid,
        fechaSalida: fechaSalida ? new Date(fechaSalida) : new Date(), fechaRegreso: fechaRegreso ? new Date(fechaRegreso) : null, motivo, opcion: opcion || "HISTORIAL",
      },
      include: { cliente: true, vehiculo: true },
    });

    if (ingresoActivo) {
      const ahora = new Date();
      const tiempoMinutos = Math.ceil((ahora - ingresoActivo.fechaEntrada.getTime()) / (1000 * 60));
      const cajaAbierta = await tx.caja.findFirst({ where: { estado: "ABIERTA" } });
      if (!cajaAbierta) throw new AppError("No hay caja abierta para registrar la salida por ausencia", 400);

      const numeroFactura = await generarNumeroFactura("FACT");
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

    return a;
  });

  await registrarMovimiento("AUSENCIAS", "CREAR", `Ausencia: ${cliente.nombres} ${cliente.apellidos}`, req.usuario?.usuario || "admin");
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
  if (existente.estado === "FINALIZADA") throw new AppError("La ausencia ya está finalizada", 400);

  let mensaje = "Ausencia finalizada";

  const ausencia = await prisma.$transaction(async (tx) => {
    const fechaRegreso = new Date();
    const diasAusente = Math.max(1, Math.ceil((fechaRegreso.getTime() - existente.fechaSalida.getTime()) / 86400000));

    const a = await tx.ausencia.update({
      where: { id: Number(id) },
      data: { estado: "FINALIZADA", fechaRegreso },
      include: { cliente: true, vehiculo: true },
    });

    const otrasAusenciasActivas = await tx.ausencia.count({
      where: { clienteId: a.clienteId, estado: "ACTIVA", id: { not: Number(id) } },
    });
    if (otrasAusenciasActivas === 0) {
      await tx.cliente.update({ where: { id: a.clienteId }, data: { estado: "ACTIVO" } });
    }

    const ingresoAusencia = await tx.ingreso.findFirst({
      where: { vehiculoId: a.vehiculoId, estado: "FINALIZADO", fechaSalida: { gte: existente.fechaSalida } },
      orderBy: { fechaSalida: "desc" },
    });
    if (ingresoAusencia?.puestoId) {
      const ingresoActivoPuesto = await tx.ingreso.count({ where: { puestoId: ingresoAusencia.puestoId, estado: "ACTIVO" } });
      const mensualidadActivaPuesto = await tx.mensualidad.count({ where: { puestoId: ingresoAusencia.puestoId, estado: "ACTIVA" } });
      const reservaActivaPuesto = await tx.reserva.count({ where: { puestoId: ingresoAusencia.puestoId, estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] } } });
      const nuevoEstado = (ingresoActivoPuesto > 0 || mensualidadActivaPuesto > 0 || reservaActivaPuesto > 0) ? "OCUPADO" : "LIBRE";
      await tx.puesto.update({ where: { id: ingresoAusencia.puestoId }, data: { estado: nuevoEstado } });
    }

    if (existente.opcion === "CONGELAR") {
      const mensualidades = await tx.mensualidad.findMany({ where: { vehiculoId: a.vehiculoId, estado: "ACTIVA" } });
      for (const m of mensualidades) {
        const nuevaFechaFin = new Date(m.fechaFin.getTime() + diasAusente * 86400000);
        await tx.mensualidad.update({ where: { id: m.id }, data: { fechaFin: nuevaFechaFin } });
        mensaje = `Mensualidad congelada — nueva fecha fin: ${nuevaFechaFin.toLocaleDateString("es-CO")}`;
      }
    } else if (existente.opcion === "EXTENDER") {
      const mensualidades = await tx.mensualidad.findMany({ where: { vehiculoId: a.vehiculoId, estado: "ACTIVA" } });
      for (const m of mensualidades) {
        const nuevaFechaFin = new Date(m.fechaFin.getTime() + diasAusente * 86400000);
        await tx.mensualidad.update({ where: { id: m.id }, data: { fechaFin: nuevaFechaFin } });
        mensaje = `Vencimiento extendido ${diasAusente} día(s) — nueva fecha fin: ${nuevaFechaFin.toLocaleDateString("es-CO")}`;
      }
    } else if (existente.opcion === "DESCONTAR") {
      const mensualidades = await tx.mensualidad.findMany({ where: { vehiculoId: a.vehiculoId, estado: "ACTIVA" } });
      for (const m of mensualidades) {
        const valorDia = m.valor / 30;
        const descuento = Math.round(valorDia * diasAusente * 100) / 100;
        const nuevoValor = Math.max(0, m.valor - descuento);
        await tx.mensualidad.update({ where: { id: m.id }, data: { valor: nuevoValor } });
        mensaje = `Descontados $${descuento.toLocaleString()} — nuevo valor mensualidad: $${nuevoValor.toLocaleString()}`;
      }
    } else if (existente.opcion === "MANTENER") {
      mensaje = "Ausencia finalizada — cobro normal (sin cambios en mensualidad)";
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
