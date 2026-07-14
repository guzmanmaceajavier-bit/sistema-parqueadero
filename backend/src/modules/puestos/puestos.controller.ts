import prisma from "../../config/prisma.js";
import { asyncHandler, AppError } from "../../middlewares/error.middleware.js";
import { paginate } from "../../utils/pagination.js";

async function siguienteNumeroPuesto(prefijo = "Puesto") {
  const pattern = `${prefijo} `;
  const existentes = await prisma.puesto.findMany({
    where: { codigo: { startsWith: pattern } },
    select: { codigo: true },
  });
  const nums = new Set(
    existentes.map(p => {
      const m = p.codigo.match(new RegExp(`^${prefijo} (\\d+)$`));
      return m ? parseInt(m[1], 10) : null;
    }).filter(Boolean)
  );
  let n = 1;
  while (nums.has(n)) n++;
  return n;
}

export const crearPuesto = asyncHandler(async (req, res) => {
  let { codigo, tipoPuesto, zona } = req.body;
  if (!codigo) {
    const n = await siguienteNumeroPuesto();
    codigo = `Puesto ${n}`;
  }
  const existe = await prisma.puesto.findUnique({ where: { codigo } });
  if (existe) throw new AppError("El puesto ya existe", 400);

  const puesto = await prisma.puesto.create({ data: { codigo, tipoPuesto, zona: zona || null } });
  res.status(201).json({ ok: true, puesto });
});

export const crearPuestosMasivos = asyncHandler(async (req, res) => {
  let { prefijo, cantidad, tipoPuesto, zona } = req.body;
  if (!cantidad) throw new AppError("cantidad es requerido", 400);
  if (!prefijo) prefijo = "Puesto";

  const pattern = `${prefijo} `;
  const existentes = await prisma.puesto.findMany({
    where: { codigo: { startsWith: pattern } },
    select: { codigo: true },
  });
  const nums = new Set(
    existentes.map(p => {
      const m = p.codigo.match(new RegExp(`^${prefijo} (\\d+)$`));
      return m ? parseInt(m[1], 10) : null;
    }).filter(Boolean)
  );

  const puestos = [];
  let n = 1;
  while (puestos.length < cantidad) {
    if (!nums.has(n)) {
      puestos.push({ codigo: `${prefijo} ${n}`, tipoPuesto: tipoPuesto || "carro", zona: zona || null });
    }
    n++;
  }

  const result = await prisma.puesto.createMany({ data: puestos, skipDuplicates: true });
  const omitidos = cantidad - result.count;
  const msg = omitidos > 0
    ? `${result.count} puestos creados, ${omitidos} omitidos (códigos duplicados)`
    : `${result.count} puestos creados`;
  res.status(201).json({ ok: true, message: msg, creados: result.count, omitidos });
});

export const obtenerPuestos = asyncHandler(async (req, res) => {
  const { page, limit, estado, q, all } = req.query;
  const where = {};
  if (estado) where.estado = estado;
  if (q) {
    where.OR = [
      { codigo: { contains: q, mode: "insensitive" } },
      { tipoPuesto: { contains: q, mode: "insensitive" } },
      { zona: { contains: q, mode: "insensitive" } },
    ];
  }

  if (all) {
    const puestos = await prisma.puesto.findMany({
      where,
      orderBy: { codigo: "asc" },
      include: {
        ingresos: {
          where: { estado: "ACTIVO" },
          include: {
            vehiculo: { select: { id: true, placa: true, marca: true, modelo: true, color: true, tipo: true } },
          },
        },
      },
    });
    const mapped = puestos.map((p) => ({
      ...p,
      ingresoActual: p.ingresos?.[0] || null,
      ingresos: undefined,
    }));
    return res.json({ ok: true, puestos: mapped });
  }

  const includePuesto = {
    ingresos: {
      where: { estado: "ACTIVO" },
      include: {
        cliente: { select: { id: true, nombres: true, apellidos: true, documento: true, telefono: true, email: true } },
        vehiculo: { select: { id: true, placa: true, marca: true, modelo: true, color: true, tipo: true } },
      },
    },
    mensualidades: {
      where: { estado: "ACTIVA" },
      include: {
        cliente: { select: { id: true, nombres: true, apellidos: true, documento: true, telefono: true, email: true } },
        vehiculo: { select: { id: true, placa: true, marca: true, modelo: true, color: true, tipo: true } },
        plan: { select: { id: true, nombre: true, duracionDias: true, valor: true } },
      },
    },
    reservas: {
      where: { estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] } },
      include: {
        cliente: { select: { id: true, nombres: true, apellidos: true, documento: true, telefono: true } },
        vehiculo: { select: { id: true, placa: true, marca: true, modelo: true, tipo: true } },
      },
      orderBy: { fechaInicio: "asc" },
    },
  };
  const { data: puestos, pagination } = await paginate(prisma, "puesto", {
    page, limit, where, orderBy: { codigo: "asc" }, include: includePuesto,
  });

  res.json({ ok: true, puestos, pagination });
});

export const obtenerPuesto = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const puesto = await prisma.puesto.findUnique({
    where: { id: Number(id) },
    include: {
      ingresos: { where: { estado: "ACTIVO" }, include: { cliente: { select: { id: true, nombres: true, apellidos: true, documento: true, telefono: true, email: true } }, vehiculo: { select: { id: true, placa: true, marca: true, modelo: true, color: true, tipo: true } } } },
      mensualidades: { where: { estado: "ACTIVA" }, include: { cliente: { select: { id: true, nombres: true, apellidos: true, documento: true, telefono: true, email: true } }, vehiculo: { select: { id: true, placa: true, marca: true, modelo: true, color: true, tipo: true } }, plan: { select: { id: true, nombre: true, duracionDias: true, valor: true } } } },
      reservas: { where: { estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] } }, include: { cliente: { select: { id: true, nombres: true, apellidos: true, documento: true, telefono: true } }, vehiculo: { select: { id: true, placa: true, marca: true, modelo: true, tipo: true } } }, orderBy: { fechaInicio: "asc" } },
    },
  });
  if (!puesto) throw new AppError("Puesto no encontrado", 404);
  res.json({ ok: true, puesto });
});

export const actualizarPuesto = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { codigo, estado, tipoPuesto, observacion, zona, activo } = req.body;
  const puesto = await prisma.puesto.findUnique({ where: { id: Number(id) } });
  if (!puesto) throw new AppError("Puesto no encontrado", 404);

  if (estado && ["LIBRE", "MANTENIMIENTO"].includes(estado) && !["LIBRE", "MANTENIMIENTO"].includes(puesto.estado)) {
    const [ingresos, mensualidades, reservas] = await Promise.all([
      prisma.ingreso.count({ where: { puestoId: Number(id), estado: "ACTIVO" } }),
      prisma.mensualidad.count({ where: { puestoId: Number(id), estado: "ACTIVA" } }),
      prisma.reserva.count({ where: { puestoId: Number(id), estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] } } }),
    ]);
    const ocupantes = [];
    if (ingresos > 0) ocupantes.push(`${ingresos} ingreso(s) activo(s)`);
    if (mensualidades > 0) ocupantes.push(`${mensualidades} plan(es) activo(s)`);
    if (reservas > 0) ocupantes.push(`${reservas} reserva(s) activa(s)`);
    if (ocupantes.length > 0) {
      throw new AppError(`No se puede cambiar a ${estado}: el puesto tiene ${ocupantes.join(", ")}`, 400);
    }
  }

  if (activo === false && puesto.activo !== false) {
    const [ingresos, mensualidades, reservas] = await Promise.all([
      prisma.ingreso.count({ where: { puestoId: Number(id), estado: "ACTIVO" } }),
      prisma.mensualidad.count({ where: { puestoId: Number(id), estado: "ACTIVA" } }),
      prisma.reserva.count({ where: { puestoId: Number(id), estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] } } }),
    ]);
    if (ingresos + mensualidades + reservas > 0) {
      throw new AppError("No se puede desactivar: el puesto tiene ingresos, mensualidades o reservas activas", 400);
    }
  }

  const data = {};
  if (codigo !== undefined) data.codigo = codigo;
  if (estado !== undefined) data.estado = estado;
  if (tipoPuesto !== undefined) data.tipoPuesto = tipoPuesto;
  if (observacion !== undefined) data.observacion = observacion;
  if (zona !== undefined) data.zona = zona;
  if (activo !== undefined) data.activo = activo;

  const actualizado = await prisma.puesto.update({ where: { id: Number(id) }, data });
  res.json({ ok: true, puesto: actualizado });
});

export const eliminarPuesto = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existe = await prisma.puesto.findUnique({ where: { id: Number(id) } });
  if (!existe) throw new AppError("Puesto no encontrado", 404);

  await prisma.$transaction(async (tx) => {
    await tx.factura.deleteMany({ where: { ingreso: { puestoId: Number(id) } } });
    await tx.ingreso.deleteMany({ where: { puestoId: Number(id) } });
    await tx.mensualidad.deleteMany({ where: { puestoId: Number(id) } });
    await tx.reserva.deleteMany({ where: { puestoId: Number(id) } });
    await tx.puesto.delete({ where: { id: Number(id) } });
  });

  res.json({ ok: true, message: "Puesto eliminado" });
});

export const togglePuesto = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const puesto = await prisma.puesto.findUnique({ where: { id: Number(id) } });
  if (!puesto) throw new AppError("Puesto no encontrado", 404);

  if (puesto.estado === "LIBRE") {
    const actualizado = await prisma.puesto.update({ where: { id: Number(id) }, data: { estado: "OCUPADO" } });
    return res.json({ ok: true, puesto: actualizado });
  }

  if (puesto.estado === "OCUPADO") {
    const ingresosActivos = await prisma.ingreso.count({ where: { puestoId: Number(id), estado: "ACTIVO" } });
    if (ingresosActivos > 0) throw new AppError("No se puede liberar: el puesto tiene ingresos activos", 400);
    const actualizado = await prisma.puesto.update({ where: { id: Number(id) }, data: { estado: "LIBRE" } });
    return res.json({ ok: true, puesto: actualizado });
  }

  throw new AppError("Solo se puede alternar entre LIBRE y OCUPADO", 400);
});
