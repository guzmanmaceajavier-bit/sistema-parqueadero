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
  const where = {};
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
  const data = {};
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

export const eliminarCliente = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const cliente = await prisma.cliente.findUnique({ where: { id: Number(id) } });
  if (!cliente) throw new AppError("Cliente no encontrado", 404);

  await prisma.$transaction(async (tx) => {
    const ingresos = await tx.ingreso.findMany({ where: { clienteId: Number(id), estado: "ACTIVO" }, select: { puestoId: true } });
    const mensualidades = await tx.mensualidad.findMany({ where: { clienteId: Number(id), estado: "ACTIVA" }, select: { puestoId: true } });
    const reservas = await tx.reserva.findMany({ where: { clienteId: Number(id), estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] } }, select: { puestoId: true } });
    const puestoIds = new Set([...ingresos, ...mensualidades, ...reservas].map(r => r.puestoId).filter(Boolean));
    for (const pid of puestoIds) {
      await tx.puesto.update({ where: { id: pid }, data: { estado: "LIBRE" } });
    }
    await tx.factura.deleteMany({ where: { ingreso: { clienteId: Number(id) } } });
    await tx.ingreso.deleteMany({ where: { clienteId: Number(id) } });
    await tx.mensualidad.deleteMany({ where: { clienteId: Number(id) } });
    await tx.reserva.deleteMany({ where: { clienteId: Number(id) } });
    await tx.ausencia.deleteMany({ where: { clienteId: Number(id) } });
    await tx.vehiculo.deleteMany({ where: { clienteId: Number(id) } });
    await tx.cliente.delete({ where: { id: Number(id) } });
  });

  await registrarMovimiento("CLIENTES", "ELIMINAR", `Cliente ${cliente.nombres} ${cliente.apellidos} eliminado`, req.usuario?.usuario || "admin");
  res.json({ ok: true, message: "Cliente eliminado" });
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

  const totalGastado = todosIngresos.reduce((sum, i) => sum + (i.factura?.valor || 0), 0);
  const totalVisitas = todosIngresos.length;
  const ultimaVisita = todosIngresos[0]?.fechaEntrada || null;
  const deudaPendiente = (cliente.vehiculos?.flatMap(v => v.mensualidades || []) || []).reduce((sum, m) => {
    const pagado = (m.facturas || []).filter(f => new Date(f.createdAt) >= new Date(m.fechaInicio)).reduce((s, f) => s + f.valor, 0);
    return sum + (m.estado !== "pagado" ? Math.max(0, (m.valor || 0) - pagado) : 0);
  }, 0);

  const pagos = [
    ...todosIngresos.filter(i => i.factura).map(i => ({
      id: i.factura.id,
      fecha: i.factura.createdAt || i.fechaEntrada,
      concepto: `Ingreso ${i.placa || ""}`.trim(),
      metodo: i.factura.metodoPago,
      valor: i.factura.valor || 0,
      tipo: "ingreso",
    })),
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

  // Optionally create a caja movement for the recarga
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
      errores.push({ ...c, error: err.message });
    }
  }

  await registrarMovimiento("CLIENTES", "IMPORTAR", `${creados.length} clientes importados, ${errores.length} errores`, req.usuario?.usuario || "admin");

  res.json({ ok: true, creados: creados.length, errores: errores.length, detalles: errores.slice(0, 10) });
});
