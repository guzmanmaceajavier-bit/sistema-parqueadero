import prisma from "../../config/prisma.js";
import { asyncHandler, AppError } from "../../middlewares/error.middleware.js";
import { paginate } from "../../utils/pagination.js";
import { registrarMovimiento } from "../../helpers/movimientos.js";
import { resolverSucursalPermitida } from "../../utils/sucursalAccess.js";
import { redondearDinero, sumarDinero, restarDinero } from "../../utils/dinero.js";

export const crearCliente = asyncHandler(async (req, res) => {
  let { nombres, apellidos, documento, telefono, direccion, email, observaciones, estado, deseaReservar } = req.body;
  if (!nombres || !apellidos || !documento) throw new AppError("Nombres, apellidos y documento son requeridos", 400);

  documento = documento.trim();
  const existe = await prisma.cliente.findUnique({ where: { documento } });
  if (existe) throw new AppError("El documento ya está registrado", 400);

  const sucursalId = resolverSucursalPermitida(req.usuario, req.body.sucursalId);
  const deseaReservarFinal = deseaReservar ?? false;
  const cliente = await prisma.cliente.create({
    data: { nombres, apellidos, documento, telefono, direccion, email, observaciones, estado: estado || "ACTIVO", deseaReservar: deseaReservarFinal },
  });

  if (deseaReservarFinal) {
    const vehiculo = await prisma.vehiculo.findFirst({ where: { clienteId: cliente.id }, orderBy: { id: "asc" } });
    await prisma.reserva.create({
      data: { clienteId: cliente.id, vehiculoId: vehiculo?.id ?? null, puestoId: null, fechaInicio: new Date(), sucursalId: sucursalId ?? null },
    }).catch(() => {});
  }

  await registrarMovimiento("CLIENTES", "CREAR", `Cliente creado: ${cliente.nombres} ${cliente.apellidos}`, req.usuario?.usuario || "admin");
  res.status(201).json({ ok: true, message: "Cliente creado correctamente", cliente });
});

export const obtenerClientes = asyncHandler(async (req, res) => {
  const { page, limit, estado, q, deseaReservar } = req.query;
  // D7 — el cliente es global, pero cada sede solo ve los clientes con los que
  // tiene relación (operaciones en esa sede). El administrador ve todos.
  const sucursalId = resolverSucursalPermitida(req.usuario, req.query.sucursalId);
  const where: any = {};
  const filtroSucursal = sucursalId
    ? [
        { vehiculos: { some: { sucursalId } } },
        { ingresos: { some: { vehiculo: { sucursalId } } } },
        { mensualidades: { some: { sucursalId } } },
        { reservas: { some: { sucursalId } } },
        { ausencias: { some: { sucursalId } } },
      ]
    : null;
  if (estado) where.estado = estado;
  if (deseaReservar === "true") where.deseaReservar = true;
  if (q) {
    where.AND = [
      ...(filtroSucursal ? [{ OR: filtroSucursal }] : []),
      {
        OR: [
          { nombres: { contains: q, mode: "insensitive" } },
          { apellidos: { contains: q, mode: "insensitive" } },
          { documento: { contains: q, mode: "insensitive" } },
          { telefono: { contains: q, mode: "insensitive" } },
          { vehiculos: { some: { placa: { contains: q, mode: "insensitive" } } } },
        ],
      },
    ];
  } else if (filtroSucursal) {
    where.OR = filtroSucursal;
  }

  const { data: clientes, pagination } = await paginate(prisma, "cliente", {
    page, limit, where, include: {
      vehiculos: { where: sucursalId ? { sucursalId } : undefined },
      reservas: { where: { estado: "ACTIVA", ...(sucursalId ? { sucursalId } : {}) } },
    }, orderBy: { id: "desc" },
  });

  const hoy = new Date();
  const clienteIds = clientes.map(c => c.id);
  const vencidas = await prisma.mensualidad.findMany({
    where: { clienteId: { in: clienteIds }, fechaFin: { lt: hoy }, estado: "ACTIVA", ...(sucursalId ? { sucursalId } : {}) },
    select: { clienteId: true },
    distinct: ["clienteId"],
  });
  const vencidosSet = new Set(vencidas.map(v => v.clienteId));

  // Una consulta de listado no debe modificar fichas globales: el estado de
  // vencimiento se devuelve como indicador calculado para esta sucursal.

  const activas = await prisma.mensualidad.findMany({
    where: { clienteId: { in: clienteIds }, fechaFin: { gte: hoy }, estado: "ACTIVA", ...(sucursalId ? { sucursalId } : {}) },
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
  const sucursalId = resolverSucursalPermitida(req.usuario, req.query.sucursalId);
  const cliente = await prisma.cliente.findFirst({
    where: {
      id: Number(id),
      ...(sucursalId ? { OR: [
        { vehiculos: { some: { sucursalId } } },
        { ingresos: { some: { vehiculo: { sucursalId } } } },
        { mensualidades: { some: { sucursalId } } },
        { reservas: { some: { sucursalId } } },
        { ausencias: { some: { sucursalId } } },
      ] } : {}),
    },
    include: {
      vehiculos: {
        where: sucursalId ? { sucursalId } : undefined,
        select: { id: true, placa: true, marca: true, modelo: true, tipo: true, estado: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
      mensualidades: {
        where: sucursalId ? { sucursalId } : undefined,
        include: { vehiculo: true, plan: true, puesto: true },
        orderBy: { fechaInicio: "desc" },
        take: 50,
      },
      reservas: {
        where: sucursalId ? { sucursalId } : undefined,
        include: { vehiculo: { select: { id: true, placa: true } }, puesto: { select: { id: true, codigo: true } } },
        orderBy: { fechaInicio: "desc" },
        take: 50,
      },
      ausencias: {
        where: sucursalId ? { sucursalId } : undefined,
        include: { vehiculo: { select: { id: true, placa: true } }, puesto: { select: { id: true, codigo: true } }, mensualidad: { select: { id: true, fechaInicio: true, fechaFin: true, valor: true } } },
        orderBy: { fechaSalida: "desc" },
        take: 50,
      },
      ingresos: {
        where: sucursalId ? { vehiculo: { sucursalId } } : {},
        include: { vehiculo: { select: { id: true, placa: true } }, puesto: { select: { id: true, codigo: true } } },
        orderBy: { fechaEntrada: "desc" },
        take: 50,
      },
    },
  });
  if (!cliente) throw new AppError("Cliente no encontrado", 404);
  res.json({
    ok: true,
    cliente,
    historial: {
      vehiculos: cliente.vehiculos,
      ingresos: cliente.ingresos,
      mensualidades: cliente.mensualidades,
      reservas: cliente.reservas,
      ausencias: cliente.ausencias,
    },
  });
});

export const actualizarCliente = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const sucursalId = resolverSucursalPermitida(req.usuario, req.body.sucursalId ?? req.query.sucursalId);
  const existe = await prisma.cliente.findFirst({
    where: {
      id: Number(id),
      ...(sucursalId ? { OR: [
        { vehiculos: { some: { sucursalId } } },
        { ingresos: { some: { vehiculo: { sucursalId } } } },
        { mensualidades: { some: { sucursalId } } },
        { reservas: { some: { sucursalId } } },
        { ausencias: { some: { sucursalId } } },
      ] } : {}),
    },
  });
  if (!existe) throw new AppError("Cliente no encontrado en esta sucursal", 404);

  const { nombres, apellidos, telefono, direccion, email, observaciones, estado, deseaReservar, bloqueado, saldo } = req.body;
  const esAdmin = req.usuario?.rol === "admin";
  const data: any = {};
  if (nombres) data.nombres = nombres;
  if (apellidos) data.apellidos = apellidos;
  if (telefono !== undefined) data.telefono = telefono;
  if (direccion !== undefined) data.direccion = direccion;
  if (email !== undefined) data.email = email;
  if (observaciones !== undefined) data.observaciones = observaciones;
  if (estado) data.estado = estado;
  if (deseaReservar !== undefined) data.deseaReservar = deseaReservar;
  // Campos financieros y de bloqueo: solo el administrador puede modificarlos.
  if (bloqueado !== undefined) {
    if (!esAdmin) throw new AppError("Solo un administrador puede bloquear o desbloquear clientes", 403);
    data.bloqueado = bloqueado;
  }
  if (saldo !== undefined) {
    throw new AppError(
      "El saldo no se modifica desde la ficha del cliente. Registra una recarga, consumo, devolución o ajuste para conservar el historial financiero.",
      409,
    );
  }

  const cliente = await prisma.cliente.update({ where: { id: Number(id) }, data });

  if (deseaReservar === true) {
    const existente = await prisma.reserva.findFirst({
      where: { clienteId: Number(id), estado: { in: ["PENDIENTE", "CONFIRMADA"] }, ...(sucursalId ? { sucursalId } : {}) },
    });
    if (!existente) {
      const vehiculo = await prisma.vehiculo.findFirst({
        where: { clienteId: Number(id), ...(sucursalId ? { sucursalId } : {}) },
        orderBy: { id: "asc" },
      });
      await prisma.reserva.create({
        data: { clienteId: Number(id), vehiculoId: vehiculo?.id ?? null, puestoId: null, fechaInicio: new Date(), sucursalId: sucursalId ?? null },
      });
    }
  } else if (deseaReservar === false) {
    await prisma.reserva.updateMany({
      where: { clienteId: Number(id), estado: { in: ["PENDIENTE", "CONFIRMADA"] }, ...(sucursalId ? { sucursalId } : {}) },
      data: { estado: "CANCELADA" },
    });
  }

  await registrarMovimiento(
    "CLIENTES",
    "ACTUALIZAR",
    `Ficha del cliente ${cliente.nombres} ${cliente.apellidos} actualizada`,
    req.usuario?.usuario || "admin",
  );
  res.json({ ok: true, message: "Cliente actualizado", cliente });
});

/**
 * Consulta los bloqueos activos de un cliente (sin modificar nada).
 * Sirve para informar al operador qué debe resolverse antes de cerrar la cuenta.
 */
export const obtenerBloqueosCliente = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const sucursalId = resolverSucursalPermitida(req.usuario, req.query.sucursalId);
  const alcance = sucursalId ? { OR: [
    { vehiculos: { some: { sucursalId } } },
    { ingresos: { some: { vehiculo: { sucursalId } } } },
    { mensualidades: { some: { sucursalId } } },
    { reservas: { some: { sucursalId } } },
    { ausencias: { some: { sucursalId } } },
  ] } : {};
  const cliente = await prisma.cliente.findFirst({ where: { id: Number(id), ...alcance } });
  if (!cliente) throw new AppError("Cliente no encontrado en esta sucursal", 404);

  const [ingresos, mensualidades, reservas] = await Promise.all([
    prisma.ingreso.findMany({
      where: { clienteId: Number(id), estado: "ACTIVO", ...(sucursalId ? { vehiculo: { sucursalId } } : {}) },
      select: { id: true, puesto: { select: { codigo: true } }, vehiculo: { select: { placa: true } }, fechaEntrada: true },
    }),
    prisma.mensualidad.findMany({
      where: { clienteId: Number(id), estado: "ACTIVA", ...(sucursalId ? { sucursalId } : {}) },
      select: { id: true, plan: { select: { nombre: true } }, vehiculo: { select: { placa: true } }, fechaFin: true },
    }),
    prisma.reserva.findMany({
      where: { clienteId: Number(id), estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] }, ...(sucursalId ? { sucursalId } : {}) },
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
  const sucursalId = resolverSucursalPermitida(req.usuario, req.query.sucursalId);
  // La ficha del cliente y sus vehículos pueden relacionarse con varias sedes.
  // El cierre es una acción global y se reserva al administrador global.
  if (sucursalId) throw new AppError("El cierre de la cuenta completa debe realizarlo el administrador global", 403);
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

      // Liberar los puestos asociados a esas mensualidades Y reservas si quedaron sin ocupantes.
      const [puestosMensualidad, puestosReserva] = await Promise.all([
        tx.mensualidad.findMany({ where: { clienteId: Number(id), puestoId: { not: null } }, select: { puestoId: true } }),
        tx.reserva.findMany({ where: { clienteId: Number(id), puestoId: { not: null } }, select: { puestoId: true } }),
      ]);
      const puestosAfectados = [...new Set([...puestosMensualidad, ...puestosReserva].map(p => p.puestoId).filter((v): v is number => v !== null))];
      for (const puestoId of puestosAfectados) {
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
  const sucursalId = resolverSucursalPermitida(req.usuario, req.query.sucursalId);
  const cliente = await prisma.cliente.findFirst({
    where: {
      id: Number(id),
      ...(sucursalId ? { OR: [
        { vehiculos: { some: { sucursalId } } },
        { ingresos: { some: { vehiculo: { sucursalId } } } },
        { mensualidades: { some: { sucursalId } } },
        { reservas: { some: { sucursalId } } },
        { ausencias: { some: { sucursalId } } },
      ] } : {}),
    },
    include: {
      vehiculos: {
        where: sucursalId ? { sucursalId } : undefined,
        include: {
          ingresos: {
            include: { facturas: true, puesto: true },
            orderBy: { fechaEntrada: "desc" },
            take: 50,
          },
          mensualidades: {
            where: sucursalId ? { sucursalId } : undefined,
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

  // Las facturas anuladas no representan ingresos ni pagos efectivos.
  const totalGastado = redondearDinero(todosIngresos.reduce((sum, i) => sumarDinero(
    sum,
    ...(i.facturas || []).filter(f => !f.anulada).map(factura => factura.valor || 0),
  ), 0));
  const totalVisitas = todosIngresos.length;
  const ultimaVisita = todosIngresos[0]?.fechaEntrada || null;
  const deudaPendiente = (cliente.vehiculos?.flatMap(v => v.mensualidades || []) || []).reduce((sum, m) => {
    // Solo las mensualidades ACTIVA/VENCIDA representan deuda; las CANCELADA no.
    if (!["ACTIVA", "VENCIDA"].includes(m.estado)) return sum;
    const pagado = (m.facturas || []).filter(f => !f.anulada && f.metodoPago != null && new Date(f.createdAt) >= new Date(m.fechaInicio)).reduce((s, f) => s + f.valor, 0);
    return sumarDinero(sum, Math.max(0, restarDinero(m.valor || 0, pagado)));
  }, 0);

  const pagos = [
    ...todosIngresos.flatMap(i => (i.facturas || []).filter(factura => !factura.anulada).map(factura => ({
      id: factura.id,
      fecha: factura.createdAt || i.fechaEntrada,
      concepto: `Ingreso ${i.placa || ""}`.trim(),
      metodo: factura.metodoPago,
      valor: factura.valor || 0,
      tipo: "ingreso",
    }))),
    ...(cliente.vehiculos?.flatMap(v => v.mensualidades?.filter(m => m.facturas?.some(f => !f.anulada)).flatMap(m => (m.facturas || []).filter(f => !f.anulada).map(f => ({
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

  const montoIngresado = Number(monto);
  if (!Number.isFinite(montoIngresado) || montoIngresado <= 0) {
    throw new AppError("El monto debe ser un número válido mayor a 0", 400);
  }
  const montoNormalizado = redondearDinero(montoIngresado);
  if (montoNormalizado <= 0) throw new AppError("El monto debe ser al menos 0,01", 400);

  const sucursalId = resolverSucursalPermitida(req.usuario, req.body.sucursalId);
  const existe = await prisma.cliente.findFirst({
    where: {
      id: Number(id),
      ...(sucursalId ? { OR: [
        { vehiculos: { some: { sucursalId } } },
        { ingresos: { some: { vehiculo: { sucursalId } } } },
        { mensualidades: { some: { sucursalId } } },
        { reservas: { some: { sucursalId } } },
        { ausencias: { some: { sucursalId } } },
      ] } : {}),
    },
  });
  if (!existe) throw new AppError("Cliente no encontrado en esta sucursal", 404);

  // Saldo y caja se registran en una sola transacción: sin caja abierta
  // no se acredita dinero que no haya quedado contabilizado.
  const cliente = await prisma.$transaction(async (tx) => {
    // Orden global de bloqueos: caja primero y cliente después.
    // Las salidas y anulaciones usan el mismo orden para evitar deadlocks.
    await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124019)) AS advisory_lock`;
    await tx.$queryRaw`SELECT "id" FROM "Cliente" WHERE "id" = ${Number(id)} FOR UPDATE`;
    const cajaAbierta = await tx.caja.findFirst({
      where: { estado: "ABIERTA", sucursalId: sucursalId ?? null },
    });
    if (!cajaAbierta) {
      throw new AppError("No hay una caja abierta en esta sucursal. Abre la caja antes de registrar una recarga.", 409);
    }

    const saldoAntes = await tx.cliente.findUnique({
      where: { id: Number(id) },
      select: { saldo: true },
    });
    if (!saldoAntes) throw new AppError("Cliente no encontrado", 404);
    const saldoPrevio = redondearDinero(saldoAntes.saldo ?? 0);

    const actualizado = await tx.cliente.update({
      where: { id: Number(id) },
      data: { saldo: { increment: montoNormalizado } },
    });

    await tx.clienteSaldoMovimiento.create({
      data: {
        clienteId: Number(id),
        tipo: "RECARGA",
        monto: montoNormalizado,
        saldoAntes: saldoPrevio,
        saldoDespues: sumarDinero(saldoPrevio, montoNormalizado),
        concepto: "Recarga de saldo",
        usuario: req.usuario?.usuario || "admin",
      },
    });

    await tx.cajaMovimiento.create({
      data: {
        cajaId: cajaAbierta.id,
        tipo: "INGRESO",
        concepto: `Recarga de saldo — ${existe.nombres} ${existe.apellidos}`,
        monto: montoNormalizado,
        metodoPago: req.body.metodoPago || "efectivo",
      },
    });

    return actualizado;
  });

  await registrarMovimiento("CLIENTES", "RECARGAR", `Saldo recargado a ${existe.nombres} ${existe.apellidos} por ${montoNormalizado}`, req.usuario?.usuario || "admin");

  res.json({ ok: true, message: "Saldo recargado correctamente", cliente });
});

/**
 * Ajuste contable del saldo. No representa entrada ni salida de efectivo:
 * por eso no mueve caja, pero siempre deja saldo anterior/nuevo y motivo.
 * Solo el administrador puede ejecutarlo.
 */
export const ajustarSaldo = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const diferenciaIngresada = Number(req.body?.monto);
  const diferencia = Number.isFinite(diferenciaIngresada) ? redondearDinero(diferenciaIngresada) : diferenciaIngresada;
  const motivo = typeof req.body?.motivo === "string" ? req.body.motivo.trim() : "";
  if (!Number.isSafeInteger(id) || id <= 0) throw new AppError("Cliente no válido", 400);
  if (!Number.isFinite(diferencia) || diferencia === 0) throw new AppError("El ajuste debe ser un valor numérico distinto de cero", 400);
  if (motivo.length < 3 || motivo.length > 255) throw new AppError("Indica un motivo de ajuste entre 3 y 255 caracteres", 400);

  const sucursalId = resolverSucursalPermitida(req.usuario, req.body?.sucursalId ?? req.query?.sucursalId);
  const clienteVisible = await prisma.cliente.findFirst({
    where: {
      id,
      ...(sucursalId ? { OR: [
        { vehiculos: { some: { sucursalId } } },
        { ingresos: { some: { vehiculo: { sucursalId } } } },
        { mensualidades: { some: { sucursalId } } },
        { reservas: { some: { sucursalId } } },
        { ausencias: { some: { sucursalId } } },
      ] } : {}),
    },
    select: { id: true },
  });
  if (!clienteVisible) throw new AppError("Cliente no encontrado en esta sucursal", 404);

  const resultado = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Cliente" WHERE "id" = ${id} FOR UPDATE`;
    const cliente = await tx.cliente.findUnique({ where: { id }, select: { id: true, nombres: true, apellidos: true, saldo: true } });
    if (!cliente) throw new AppError("Cliente no encontrado", 404);
    const saldoAntes = redondearDinero(cliente.saldo ?? 0);
    const saldoDespues = sumarDinero(saldoAntes, diferencia);
    if (saldoDespues < 0) throw new AppError("El ajuste no puede dejar el saldo del cliente por debajo de cero", 409);

    const actualizado = await tx.cliente.update({ where: { id }, data: { saldo: saldoDespues } });
    await tx.clienteSaldoMovimiento.create({
      data: {
        clienteId: id,
        tipo: "AJUSTE",
        monto: redondearDinero(Math.abs(diferencia)),
        saldoAntes,
        saldoDespues,
        concepto: motivo,
        usuario: req.usuario?.usuario || "admin",
      },
    });
    return { cliente: actualizado, saldoAntes, saldoDespues };
  });

  await registrarMovimiento(
    "CLIENTES",
    "AJUSTAR_SALDO",
    `Ajuste de saldo a ${resultado.cliente.nombres} ${resultado.cliente.apellidos}: ${resultado.saldoAntes} → ${resultado.saldoDespues}. Motivo: ${motivo}`,
    req.usuario?.usuario || "admin",
  );
  res.json({ ok: true, message: "Ajuste registrado en el historial financiero", ...resultado });
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

      const creadosVehiculo: string[] = [];
      const erroresVehiculo: string[] = [];
      if (c.placa) {
        const placaNorm = String(c.placa).trim().toUpperCase().replace(/[\s-]+/g, "");
        try {
          const dup = await prisma.vehiculo.findUnique({ where: { placa: placaNorm } });
          if (dup) {
            erroresVehiculo.push(`Placa ${placaNorm} ya existe (otro cliente); el cliente se creó sin vehículo`);
          } else {
            await prisma.vehiculo.create({
              data: { placa: placaNorm, marca: c.marca?.trim() || null, tipo: c.tipo?.trim() || null, color: c.color?.trim() || null, clienteId: cliente.id },
            });
            creadosVehiculo.push(placaNorm);
          }
        } catch (e) {
          erroresVehiculo.push(`Placa ${placaNorm}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      creados.push(cliente);
      // Se reportan también los vehículos que no se pudieron crear (antes se silenciaban).
      if (erroresVehiculo.length) errores.push({ ...c, error: erroresVehiculo.join("; ") });
    } catch (err) {
      errores.push({ ...c, error: err instanceof Error ? err.message : String(err) });
    }
  }

  await registrarMovimiento("CLIENTES", "IMPORTAR", `${creados.length} clientes importados, ${errores.length} errores`, req.usuario?.usuario || "admin");

  res.json({ ok: true, creados: creados.length, errores: errores.length, detalles: errores.slice(0, 10) });
});
