import prisma from "../../config/prisma.js";
import { asyncHandler, AppError } from "../../middlewares/error.middleware.js";
import { paginate } from "../../utils/pagination.js";
import { registrarMovimiento } from "../../helpers/movimientos.js";

export const crearCliente = asyncHandler(async (req, res) => {
  let { nombres, apellidos, documento, telefono, direccion, email, observaciones, estado, deseaReservar } = req.body;
  if (!nombres || !apellidos || !documento) throw new AppError("Nombres, apellidos y documento son requeridos", 400);

  documento = documento.trim();
  const existe = await prisma.cliente.findUnique({ where: { documento } });
  if (existe) throw new AppError("El documento ya está registrado", 400);

  const deseaReservarFinal = deseaReservar ?? false;
  const cliente = await prisma.cliente.create({
    data: { nombres, apellidos, documento, telefono, direccion, email, observaciones, estado: estado || "ACTIVO", deseaReservar: deseaReservarFinal },
  });

  if (deseaReservarFinal) {
    const vehiculo = await prisma.vehiculo.findFirst({ where: { clienteId: cliente.id }, orderBy: { id: "asc" } });
    await prisma.reserva.create({
      data: { clienteId: cliente.id, vehiculoId: vehiculo?.id ?? null, puestoId: null, fechaInicio: new Date() },
    }).catch(() => {});
  }

  await registrarMovimiento("CLIENTES", "CREAR", `Cliente creado: ${cliente.nombres} ${cliente.apellidos}`, req.usuario?.usuario || "admin");
  res.status(201).json({ ok: true, message: "Cliente creado correctamente", cliente });
});

export const obtenerClientes = asyncHandler(async (req, res) => {
  const { page, limit, estado, q, deseaReservar } = req.query;
  const where: any = {};
  if (estado) where.estado = estado;
  if (deseaReservar === "true") where.deseaReservar = true;
  if (q) {
    where.OR = [
      { nombres: { contains: q, mode: "insensitive" } },
      { apellidos: { contains: q, mode: "insensitive" } },
      { documento: { contains: q, mode: "insensitive" } },
      { telefono: { contains: q, mode: "insensitive" } },
      { vehiculos: { some: { placa: { contains: q, mode: "insensitive" } } } },
    ];
  }

  const { data: clientes, pagination } = await paginate(prisma, "cliente", {
    page, limit, where, include: { vehiculos: true, reservas: { where: { estado: "ACTIVA" } } }, orderBy: { id: "desc" },
  });

  const hoy = new Date();
  const clienteIds = clientes.map(c => c.id);
  const vencidas = await prisma.mensualidad.findMany({
    where: { clienteId: { in: clienteIds }, fechaFin: { lt: hoy }, estado: "ACTIVA" },
    select: { clienteId: true },
    distinct: ["clienteId"],
  });
  const vencidosSet = new Set(vencidas.map(v => v.clienteId));

  if (vencidosSet.size > 0) {
    await prisma.cliente.updateMany({
      where: { id: { in: [...vencidosSet] }, estado: { notIn: ["VENCIDO", "MOROSO"] } },
      data: { estado: "VENCIDO" },
    });
  }

  const activas = await prisma.mensualidad.findMany({
    where: { clienteId: { in: clienteIds }, fechaFin: { gte: hoy }, estado: "ACTIVA" },
    select: { clienteId: true, plan: { select: { nombre: true } } },
  });
  const planMap = new Map<number, string>();
  activas.forEach(a => {
    if (!planMap.has(a.clienteId)) planMap.set(a.clienteId, a.plan?.nombre || "Plan");
  });

  let enriched = clientes.map(c => ({
    ...c,
    tieneVencida: vencidosSet.has(c.id),
    tienePlanActivo: planMap.has(c.id),
    planNombre: planMap.get(c.id) || null,
  }));

  if (req.query.tienePlan === "true") enriched = enriched.filter(c => c.tienePlanActivo);
  if (req.query.tienePlan === "false") enriched = enriched.filter(c => !c.tienePlanActivo);
  if (req.query.tieneReserva === "true") enriched = enriched.filter(c => c.reservas?.length > 0);
  if (req.query.tieneReserva === "false") enriched = enriched.filter(c => !(c.reservas?.length > 0));
  if (req.query.tieneVehiculo === "true") enriched = enriched.filter(c => c.vehiculos?.length > 0);
  if (req.query.tieneVehiculo === "false") enriched = enriched.filter(c => !(c.vehiculos?.length > 0));

  res.json({ ok: true, clientes: enriched, pagination });
});

export const obtenerCliente = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const cliente = await prisma.cliente.findUnique({
    where: { id: Number(id) },
    include: { vehiculos: true, mensualidades: { include: { vehiculo: true, plan: true, puesto: true } }, reservas: true, ausencias: true, ingresos: { where: { estado: "ACTIVO" }, take: 1 } },
  });
  if (!cliente) throw new AppError("Cliente no encontrado", 404);
  res.json({ ok: true, cliente });
});

export const actualizarCliente = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existe = await prisma.cliente.findUnique({ where: { id: Number(id) } });
  if (!existe) throw new AppError("Cliente no encontrado", 404);

  const { nombres, apellidos, telefono, direccion, email, observaciones, estado, deseaReservar, bloqueado, saldo } = req.body;
  const data: any = {};
  if (nombres) data.nombres = nombres;
  if (apellidos) data.apellidos = apellidos;
  if (telefono !== undefined) data.telefono = telefono;
  if (direccion !== undefined) data.direccion = direccion;
  if (email !== undefined) data.email = email;
  if (observaciones !== undefined) data.observaciones = observaciones;
  if (estado) data.estado = estado;
  if (deseaReservar !== undefined) data.deseaReservar = deseaReservar;
  if (bloqueado !== undefined) data.bloqueado = bloqueado;
  if (saldo !== undefined) data.saldo = Number(saldo);

  const cliente = await prisma.cliente.update({ where: { id: Number(id) }, data });

  if (deseaReservar === true) {
    const existente = await prisma.reserva.findFirst({
      where: { clienteId: Number(id), estado: { in: ["PENDIENTE", "CONFIRMADA"] } },
    });
    if (!existente) {
      const vehiculo = await prisma.vehiculo.findFirst({ where: { clienteId: Number(id) }, orderBy: { id: "asc" } });
      await prisma.reserva.create({
        data: { clienteId: Number(id), vehiculoId: vehiculo?.id ?? null, puestoId: null, fechaInicio: new Date() },
      }).catch(() => {});
    }
  } else if (deseaReservar === false) {
    await prisma.reserva.updateMany({
      where: { clienteId: Number(id), estado: { in: ["PENDIENTE", "CONFIRMADA"] } },
      data: { estado: "CANCELADA" },
    });
  }

  res.json({ ok: true, message: "Cliente actualizado", cliente });
});

/**
 * Consulta los bloqueos activos de un cliente (sin modificar nada).
 * Sirve para informar al operador qué debe resolverse antes de cerrar la cuenta.
 */
export const obtenerBloqueosCliente = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const cliente = await prisma.cliente.findUnique({ where: { id: Number(id) } });
  if (!cliente) throw new AppError("Cliente no encontrado", 404);

  const [ingresos, mensualidades, reservas] = await Promise.all([
    prisma.ingreso.findMany({
      where: { clienteId: Number(id), estado: "ACTIVO" },
      select: { id: true, puesto: { select: { codigo: true } }, vehiculo: { select: { placa: true } }, fechaEntrada: true },
    }),
    prisma.mensualidad.findMany({
      where: { clienteId: Number(id), estado: "ACTIVA" },
      select: { id: true, plan: { select: { nombre: true } }, vehiculo: { select: { placa: true } }, fechaFin: true },
    }),
    prisma.reserva.findMany({
      where: { clienteId: Number(id), estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] } },
      select: { id: true, estado: true, fechaInicio: true, puesto: { select: { codigo: true } }, vehiculo: { select: { placa: true } } },
    }),
  ]);

  res.json({
    ok: true,
    puedeCerrar: ingresos.length === 0 && mensualidades.length === 0 && reservas.length === 0,
    ingresos, mensualidades, reservas,
  });
});

export const eliminarCliente = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const forzar = req.body?.forzar === true || req.query?.forzar === "true";
  const cliente = await prisma.cliente.findUnique({ where: { id: Number(id) } });
  if (!cliente) throw new AppError("Cliente no encontrado", 404);

  const [ingresosActivos, mensualidadesActivas, reservasActivas] = await Promise.all([
    prisma.ingreso.count({ where: { clienteId: Number(id), estado: "ACTIVO" } }),
    prisma.mensualidad.count({ where: { clienteId: Number(id), estado: "ACTIVA" } }),
    prisma.reserva.count({ where: { clienteId: Number(id), estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] } } }),
  ]);

  // Un vehículo que está DENTRO del parqueadero nunca se puede cerrar sin cobrar.
  if (ingresosActivos > 0) {
    throw new AppError("El cliente tiene un vehículo dentro del parqueadero. Registre la salida (con cobro) antes de cerrar la cuenta.", 400);
  }

  const pendientes = [];
  if (mensualidadesActivas > 0) pendientes.push(`${mensualidadesActivas} mensualidad(es)`);
  if (reservasActivas > 0) pendientes.push(`${reservasActivas} reserva(s)`);

  // Mensualidades y reservas sí se pueden cancelar automáticamente al cerrar la cuenta.
  if (pendientes.length > 0 && !forzar) {
    throw new AppError(
      `Para cerrar la cuenta debe cancelar: ${pendientes.join(" y ")}. Confirme el cierre para cancelarlas automáticamente.`,
      409,
    );
  }

  const resultado = await prisma.$transaction(async (tx) => {
    let canceladas = { mensualidades: 0, reservas: 0 };

    if (forzar) {
      const ms = await tx.mensualidad.updateMany({
        where: { clienteId: Number(id), estado: "ACTIVA" },
        data: { estado: "CANCELADA" },
      });
      const rs = await tx.reserva.updateMany({
        where: { clienteId: Number(id), estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] } },
        data: { estado: "CANCELADA" },
      });
      canceladas = { mensualidades: ms.count, reservas: rs.count };

      // Liberar los puestos asociados a esas mensualidades/reservas si quedaron sin ocupantes.
      const puestosAfectados = await tx.mensualidad.findMany({
        where: { clienteId: Number(id), puestoId: { not: null } },
        select: { puestoId: true },
        distinct: ["puestoId"],
      });
      for (const { puestoId } of puestosAfectados) {
        if (!puestoId) continue;
        const [ing, men, res] = await Promise.all([
          tx.ingreso.count({ where: { puestoId, estado: "ACTIVO" } }),
          tx.mensualidad.count({ where: { puestoId, estado: "ACTIVA" } }),
          tx.reserva.count({ where: { puestoId, estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] } } }),
        ]);
        if (ing === 0 && men === 0 && res === 0) {
          await tx.puesto.update({ where: { id: puestoId }, data: { estado: "LIBRE" } });
        }
      }
    }

    await tx.cliente.update({
      where: { id: Number(id) },
      data: { estado: "RETIRADO", bloqueado: true, deseaReservar: false },
    });
    await tx.vehiculo.updateMany({ where: { clienteId: Number(id) }, data: { estado: false, bloqueado: true } });

    return canceladas;
  });

  const detalle = [
    resultado.mensualidades ? `${resultado.mensualidades} mensualidad(es) cancelada(s)` : null,
    resultado.reservas ? `${resultado.reservas} reserva(s) cancelada(s)` : null,
  ].filter(Boolean).join(", ");

  await registrarMovimiento(
    "CLIENTES",
    "RETIRAR",
    `Cliente ${cliente.nombres} ${cliente.apellidos} retirado${detalle ? ` (${detalle})` : ""}. Historial conservado.`,
    req.usuario?.usuario || "admin",
  );
  res.json({
    ok: true,
    message: `Cliente retirado.${detalle ? ` ${detalle}.` : ""} Historial conservado.`,
  });
});

export const perfilCliente = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const cliente = await prisma.cliente.findUnique({
    where: { id: Number(id) },
    include: {
      vehiculos: {
        include: {
          ingresos: {
            include: { facturas: true, puesto: true },
            orderBy: { fechaEntrada: "desc" },
            take: 50,
          },
          mensualidades: {
            include: { plan: true, facturas: true },
            orderBy: { createdAt: "desc" },
            take: 20,
          },
        },
      },
    },
  });
  if (!cliente) throw new AppError("Cliente no encontrado", 404);

  const todosIngresos = cliente.vehiculos.flatMap(v => v.ingresos?.map(i => ({ ...i, placa: v.placa, vehiculoId: v.id, marca: v.marca, modelo: v.modelo })) || []);
  todosIngresos.sort((a, b) => new Date(b.fechaEntrada).getTime() - new Date(a.fechaEntrada).getTime());

  const totalGastado = todosIngresos.reduce((sum, i) => sum + (i.facturas || []).reduce((subtotal, factura) => subtotal + (factura.valor || 0), 0), 0);
  const totalVisitas = todosIngresos.length;
  const ultimaVisita = todosIngresos[0]?.fechaEntrada || null;
  const deudaPendiente = (cliente.vehiculos?.flatMap(v => v.mensualidades || []) || []).reduce((sum, m) => {
    const pagado = (m.facturas || []).filter(f => new Date(f.createdAt) >= new Date(m.fechaInicio)).reduce((s, f) => s + f.valor, 0);
    return sum + (m.estado !== "pagado" ? Math.max(0, (m.valor || 0) - pagado) : 0);
  }, 0);

  const pagos = [
    ...todosIngresos.flatMap(i => (i.facturas || []).map(factura => ({
      id: factura.id,
      fecha: factura.createdAt || i.fechaEntrada,
      concepto: `Ingreso ${i.placa || ""}`.trim(),
      metodo: factura.metodoPago,
      valor: factura.valor || 0,
      tipo: "ingreso",
    }))),
    ...(cliente.vehiculos?.flatMap(v => v.mensualidades?.filter(m => m.facturas?.length > 0).flatMap(m => (m.facturas || []).map(f => ({
      id: f.id,
      fecha: f.createdAt,
      concepto: `Mensualidad ${v.placa} - ${m.plan?.nombre || ""}`.trim(),
      metodo: f.metodoPago,
      valor: f.valor || 0,
      tipo: "mensualidad",
    }))) || []) || []),
  ];
  pagos.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  res.json({
    ok: true,
    cliente: {
      ...cliente,
      totalGastado,
      totalVisitas,
      ultimaVisita,
      deudaPendiente,
      historial: todosIngresos.slice(0, 50),
      mensualidades: cliente.vehiculos.flatMap(v => v.mensualidades?.map(m => ({ ...m, placa: v.placa })) || []).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 20),
      pagos,
    },
  });
});

export const recargarSaldo = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { monto } = req.body;

  if (!monto || Number(monto) <= 0) throw new AppError("Monto debe ser mayor a 0", 400);

  const existe = await prisma.cliente.findUnique({ where: { id: Number(id) } });
  if (!existe) throw new AppError("Cliente no encontrado", 404);

  const cliente = await prisma.cliente.update({
    where: { id: Number(id) },
    data: { saldo: { increment: Number(monto) } },
  });

  // opcional: crear el movimiento de caja de la recarga
  const cajaAbierta = await prisma.caja.findFirst({ where: { estado: "ABIERTA" } });
  if (cajaAbierta) {
    await prisma.cajaMovimiento.create({
      data: {
        cajaId: cajaAbierta.id,
        tipo: "INGRESO",
        concepto: `Recarga de saldo — ${existe.nombres} ${existe.apellidos}`,
        monto: Number(monto),
        metodoPago: req.body.metodoPago || "efectivo",
      },
    });
  }

  await registrarMovimiento("CLIENTES", "RECARGAR", `Saldo recargado a ${existe.nombres} ${existe.apellidos} por $${Number(monto)}`, req.usuario?.usuario || "admin");

  res.json({ ok: true, message: "Saldo recargado correctamente", cliente });
});

export const importarClientes = asyncHandler(async (req, res) => {
  const { clientes } = req.body;
  if (!Array.isArray(clientes) || clientes.length === 0) throw new AppError("Envíe un array de clientes", 400);

  const creados = [];
  const errores = [];

  for (const c of clientes) {
    try {
      if (!c.nombres || !c.apellidos || !c.documento) {
        errores.push({ ...c, error: "Faltan campos requeridos (nombres, apellidos, documento)" });
        continue;
      }
      const doc = String(c.documento).trim();
      const existe = await prisma.cliente.findUnique({ where: { documento: doc } });
      if (existe) {
        errores.push({ ...c, error: `Documento ${doc} ya registrado` });
        continue;
      }
      const cliente = await prisma.cliente.create({
        data: {
          nombres: c.nombres.trim(),
          apellidos: c.apellidos.trim(),
          documento: doc,
          telefono: c.telefono?.trim() || null,
          email: c.email?.trim() || null,
          direccion: c.direccion?.trim() || null,
          observaciones: c.observaciones?.trim() || null,
          estado: c.estado || "ACTIVO",
        },
      });

      if (c.placa) {
        await prisma.vehiculo.create({
          data: { placa: String(c.placa).trim().toUpperCase(), marca: c.marca?.trim() || null, tipo: c.tipo?.trim() || null, color: c.color?.trim() || null, clienteId: cliente.id },
        }).catch(() => {});
      }

      creados.push(cliente);
    } catch (err) {
      errores.push({ ...c, error: err instanceof Error ? err.message : String(err) });
    }
  }

  await registrarMovimiento("CLIENTES", "IMPORTAR", `${creados.length} clientes importados, ${errores.length} errores`, req.usuario?.usuario || "admin");

  res.json({ ok: true, creados: creados.length, errores: errores.length, detalles: errores.slice(0, 10) });
});
