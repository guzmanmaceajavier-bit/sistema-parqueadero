import prisma from "../../config/prisma.js";
import { asyncHandler, AppError } from "../../middlewares/error.middleware.js";
import { resumirEstadosPuestos } from "../../utils/puestos.js";
import { desplazarDiasEnZona, inicioDiaActualEnZona, inicioMesEnZona, inicioSemanaEnZona, inicioAnioEnZona, obtenerFechaClaveEnZona, obtenerHoraEnZona } from "../../utils/periodoReporte.js";

export const obtenerDashboard = asyncHandler(async (req, res) => {
  const filtro = req.query.filtro || "hoy";
  if (!["hoy", "semana", "mes"].includes(String(filtro))) {
    throw new AppError("El período del dashboard no es válido", 400);
  }
  const sucursalId = req.query.sucursalId === undefined ? undefined : Number(req.query.sucursalId);
  if (sucursalId !== undefined && (!Number.isSafeInteger(sucursalId) || sucursalId <= 0)) {
    throw new AppError("La sucursal seleccionada no es válida", 400);
  }

  const ahora = new Date();
  const configuracion = await prisma.configuracion.findFirst({ select: { zonaHoraria: true } });
  let zonaHoraria = configuracion?.zonaHoraria || "America/Bogota";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zonaHoraria }).format(ahora);
  } catch {
    zonaHoraria = "America/Bogota";
  }

  const hoy = inicioDiaActualEnZona(ahora, zonaHoraria);
  const manana = desplazarDiasEnZona(hoy, 1, zonaHoraria);
  const inicioSemanaActual = inicioSemanaEnZona(hoy, zonaHoraria);
  const principioMesActual = inicioMesEnZona(hoy, zonaHoraria);
  const principioAnio = inicioAnioEnZona(hoy, zonaHoraria);

  let inicioSemana: Date;
  let principioMes: Date;
  let sieteDiasAtras: Date;
  let finSemana: Date;

  if (filtro === "mes") {
    principioMes = principioMesActual;
    inicioSemana = principioMes;
    sieteDiasAtras = principioMes;
    finSemana = inicioMesEnZona(desplazarDiasEnZona(principioMes, 32, zonaHoraria), zonaHoraria);
  } else if (filtro === "semana") {
    inicioSemana = inicioSemanaActual;
    principioMes = inicioSemana;
    sieteDiasAtras = inicioSemana;
    finSemana = desplazarDiasEnZona(inicioSemana, 7, zonaHoraria);
  } else {
    inicioSemana = inicioSemanaActual;
    principioMes = principioMesActual;
    sieteDiasAtras = desplazarDiasEnZona(hoy, -7, zonaHoraria);
    finSemana = desplazarDiasEnZona(hoy, 7, zonaHoraria);
  }

  const sucursalFilter = sucursalId ? { sucursalId } : {};
  const puestoSucursalFilter = sucursalId ? { puesto: { sucursalId } } : {};
  const mensualidadVigenteFilter = {
    estado: "ACTIVA",
    fechaInicio: { lte: ahora },
    fechaFin: { gte: ahora },
    ...sucursalFilter,
  };

  const [
    puestos,
    ingresosActivos, ingresosHoy,
    facturasPeriodo, facturasMes, facturasSemana,
    gastosPeriodo,
    mensualidades,
    clientes,
    totalVehiculos,
    vehiculosPorTipo,
    movimientosRecientes,
    ausenciasActivas,
    topVehiculos,
    cajaActiva,
    reservas,
    mensualidadesVencidas, mensualidadesProximas,
    facturas7d, gastos7d, metodosPago, facturasPorMes,
  ] = await Promise.all([

    prisma.puesto.groupBy({ by: ["estado"], _count: true, where: { activo: true, ...sucursalFilter } }),

    prisma.ingreso.count({ where: { estado: "ACTIVO", ...puestoSucursalFilter } }),
    prisma.ingreso.count({ where: { createdAt: { gte: hoy, lt: manana }, ...puestoSucursalFilter } }),

    prisma.factura.aggregate({ _sum: { valor: true }, where: { metodoPago: { not: null }, createdAt: { gte: hoy, lt: manana }, ...sucursalFilter } }),
    prisma.factura.aggregate({ _sum: { valor: true }, where: { metodoPago: { not: null }, createdAt: { gte: principioMes, lt: manana }, ...sucursalFilter } }),
    prisma.factura.aggregate({ _sum: { valor: true }, where: { metodoPago: { not: null }, createdAt: { gte: inicioSemana, lt: manana }, ...sucursalFilter } }),

    prisma.gasto.aggregate({ _sum: { valor: true }, where: { fecha: { gte: hoy, lt: manana }, ...sucursalFilter } }),

    prisma.mensualidad.groupBy({ by: ["estado"], _count: true, where: mensualidadVigenteFilter }),

    prisma.cliente.groupBy({ by: ["estado"], _count: true, where: sucursalId ? { vehiculos: { some: { sucursalId } } } : {} }),

    prisma.vehiculo.count({ where: sucursalFilter }),

    prisma.vehiculo.groupBy({ by: ["tipo"], _count: true, where: sucursalFilter }),

    prisma.movimiento.findMany({ where: sucursalFilter, orderBy: { id: "desc" }, take: 20 }),
    prisma.ausencia.count({ where: { estado: "ACTIVA", ...sucursalFilter } }),

    sucursalId
      ? prisma.$queryRawUnsafe(
          `SELECT v.placa, v.tipo, v.color, c.nombres as cliente, COUNT(*) as total
           FROM "Ingreso" i
           JOIN "Vehiculo" v ON v.id = i."vehiculoId"
           LEFT JOIN "Cliente" c ON c.id = v."clienteId"
           LEFT JOIN "Puesto" p ON p.id = i."puestoId"
           WHERE i.estado = 'FINALIZADO' AND p."sucursalId" = $1
           GROUP BY v.id, c.nombres ORDER BY total DESC LIMIT 8`,
          sucursalId
        ).catch(() => [])
      : prisma.$queryRawUnsafe(
          `SELECT v.placa, v.tipo, v.color, c.nombres as cliente, COUNT(*) as total
           FROM "Ingreso" i
           JOIN "Vehiculo" v ON v.id = i."vehiculoId"
           LEFT JOIN "Cliente" c ON c.id = v."clienteId"
           WHERE i.estado = 'FINALIZADO'
           GROUP BY v.id, c.nombres ORDER BY total DESC LIMIT 8`
        ).catch(() => []),
    prisma.caja.findFirst({ where: { estado: "ABIERTA", ...sucursalFilter }, select: { id: true, apertura: true, createdAt: true } }),

    prisma.reserva.groupBy({ by: ["estado"], _count: true, where: { fechaInicio: { gte: hoy, lt: manana }, ...sucursalFilter } }),

    prisma.mensualidad.count({ where: { fechaFin: { lt: hoy }, estado: "ACTIVA", ...sucursalFilter } }),
    prisma.mensualidad.count({ where: { ...mensualidadVigenteFilter, fechaFin: { gte: ahora, lt: finSemana } } }),

    prisma.factura.findMany({ where: { metodoPago: { not: null }, createdAt: { gte: sieteDiasAtras, lt: manana }, ...sucursalFilter }, select: { valor: true, createdAt: true }, orderBy: { createdAt: "asc" } }),
    prisma.gasto.findMany({ where: { fecha: { gte: sieteDiasAtras, lt: manana }, ...sucursalFilter }, select: { valor: true, fecha: true }, orderBy: { fecha: "asc" } }),
    prisma.factura.groupBy({ by: ["metodoPago"], _count: true, _sum: { valor: true }, where: { metodoPago: { not: null }, createdAt: { gte: inicioSemana, lt: manana }, ...sucursalFilter } }),
    prisma.factura.findMany({ where: { metodoPago: { not: null }, createdAt: { gte: principioAnio, lt: manana }, ...sucursalFilter }, select: { valor: true, createdAt: true }, orderBy: { createdAt: "asc" } }),
  ]);

  const resumenPuestos = resumirEstadosPuestos(puestos);
  const totalPuestos = resumenPuestos.total;
  const puestosLibres = resumenPuestos.libres;
  const puestosOcupados = resumenPuestos.ocupados;
  const puestosReservados = resumenPuestos.reservados;
  const puestosMantenimiento = resumenPuestos.mantenimiento;
  const puestosAusencia = resumenPuestos.ausencias;
  const ocupacion = totalPuestos > 0 ? Math.round((puestosOcupados / totalPuestos) * 100) : 0;

  const mensualidadActiva = mensualidades.find(m => m.estado === "ACTIVA");
  const mensualidadesActivas = mensualidadActiva?._count || 0;

  const clientesMap = Object.fromEntries(clientes.map(c => [c.estado, c._count]));
  const totalClientes = clientes.reduce((s, c) => s + c._count, 0);
  const clientesActivos = clientesMap["ACTIVO"] || 0;
  const clientesMorosos = clientesMap["MOROSO"] || 0;

  const reservasMap = Object.fromEntries(reservas.map(r => [r.estado, r._count]));
  const reservasPendientes = (reservasMap["PENDIENTE"] || 0) + (reservasMap["CONFIRMADA"] || 0);
  const reservasActivas = reservasMap["ACTIVA"] || 0;
  const reservasHoy = reservas.reduce((s, r) => s + r._count, 0);

  const ingresosDia = facturasPeriodo._sum.valor || 0;
  const ingresosSemana = facturasSemana._sum.valor || 0;
  const ingresosMes = facturasMes._sum.valor || 0;
  const gastosDia = gastosPeriodo._sum.valor || 0;

  const ingresos7Dias = [];
  for (let i = 6; i >= 0; i--) {
    const d = desplazarDiasEnZona(hoy, -i, zonaHoraria);
    const key = obtenerFechaClaveEnZona(d, zonaHoraria);
    const label = new Date(`${key}T00:00:00.000Z`).toLocaleDateString("es-CO", { weekday: "short", day: "numeric", timeZone: "UTC" });
    const total = facturas7d
      .filter(f => obtenerFechaClaveEnZona(f.createdAt, zonaHoraria) === key)
      .reduce((s, f) => s + f.valor, 0);
    ingresos7Dias.push({ label, total, dia: key });
  }

  const gastos7Dias = [];
  for (let i = 6; i >= 0; i--) {
    const d = desplazarDiasEnZona(hoy, -i, zonaHoraria);
    const key = obtenerFechaClaveEnZona(d, zonaHoraria);
    const label = new Date(`${key}T00:00:00.000Z`).toLocaleDateString("es-CO", { weekday: "short", day: "numeric", timeZone: "UTC" });
    const total = gastos7d
      .filter(g => obtenerFechaClaveEnZona(g.fecha, zonaHoraria) === key)
      .reduce((s, g) => s + g.valor, 0);
    gastos7Dias.push({ label, total, dia: key });
  }

  const metodosPagoData = metodosPago.reduce((acc, m) => {
    acc[m.metodoPago || "otros"] = { count: m._count, total: m._sum.valor || 0 };
    return acc;
  }, {});

  const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const ingresosMensuales = meses.map((_, i) => {
    const total = facturasPorMes
      .filter(f => Number(obtenerFechaClaveEnZona(f.createdAt, zonaHoraria).slice(5, 7)) === i + 1)
      .reduce((s, f) => s + f.valor, 0);
    return { mes: meses[i], total };
  });

  const ingresosHoyRegistros = await prisma.ingreso.findMany({
    where: { fechaEntrada: { gte: hoy, lt: manana }, ...puestoSucursalFilter },
    select: { fechaEntrada: true },
    orderBy: { fechaEntrada: "asc" },
  });
  const ingresosPorHora = Array.from({ length: 24 }, (_, h) => ({
    hora: `${h.toString().padStart(2, "0")}:00`,
    count: ingresosHoyRegistros.filter(i => obtenerHoraEnZona(new Date(i.fechaEntrada), zonaHoraria) === h).length,
  }));

  res.json({
    ok: true,
    totalPuestos, puestosLibres, puestosOcupados, puestosReservados, puestosMantenimiento, puestosAusencia,
    ingresosActivos, ingresosHoy,
    ingresosDia, ingresosSemana, ingresosMes,
    gastosDia, utilidadDia: ingresosDia - gastosDia,
    mensualidadesActivas, mensualidadesVencidas, mensualidadesProximas,
    totalClientes, clientesMorosos, clientesActivos, totalVehiculos,
    ocupacion,
    vehiculosPorTipo: vehiculosPorTipo.reduce((acc, v) => ({ ...acc, [v.tipo || "sin_tipo"]: v._count }), {}),
    movimientos: movimientosRecientes,
    ausenciasActivas,
    topVehiculos,
    cajaAbierta: !!cajaActiva,
    cajaMontoInicial: cajaActiva?.apertura || 0,
    cajaDesde: cajaActiva?.createdAt || null,
    reservasPendientes, reservasActivas, reservasHoy,
    ingresos7Dias, gastos7Dias,
    metodosPago: metodosPagoData,
    ingresosMensuales,
    ingresosPorHora,
  });
});
