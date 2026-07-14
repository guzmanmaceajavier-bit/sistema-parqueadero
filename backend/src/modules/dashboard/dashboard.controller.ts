import prisma from "../../config/prisma.js";
import { asyncHandler } from "../../middlewares/error.middleware.js";

export const obtenerDashboard = asyncHandler(async (req, res) => {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const filtro = req.query.filtro || "hoy";
  const sucursalId = req.query.sucursalId ? Number(req.query.sucursalId) : undefined;

  let inicioSemana, principioMes, sieteDiasAtras, principioAnio, finSemana;

  if (filtro === "mes") {
    principioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    inicioSemana = principioMes;
    sieteDiasAtras = principioMes;
    finSemana = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59);
  } else if (filtro === "semana") {
    inicioSemana = new Date(hoy);
    inicioSemana.setDate(hoy.getDate() - hoy.getDay());
    principioMes = inicioSemana;
    sieteDiasAtras = inicioSemana;
    finSemana = new Date(hoy.getTime() + 7 * 86400000);
  } else {
    inicioSemana = new Date(hoy);
    inicioSemana.setDate(hoy.getDate() - hoy.getDay());
    principioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    sieteDiasAtras = new Date(hoy.getTime() - 7 * 86400000);
    finSemana = new Date(hoy.getTime() + 7 * 86400000);
  }

  const sucursalFilter = sucursalId ? { sucursalId } : {};
  const puestoSucursalFilter = sucursalId ? { puesto: { sucursalId } } : {};

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

    prisma.puesto.groupBy({ by: ["estado"], _count: true }),

    prisma.ingreso.count({ where: { estado: "ACTIVO", ...puestoSucursalFilter } }),
    prisma.ingreso.count({ where: { createdAt: { gte: hoy }, ...puestoSucursalFilter } }),

    prisma.factura.aggregate({ _sum: { valor: true }, where: { createdAt: { gte: hoy }, ...sucursalFilter } }),
    prisma.factura.aggregate({ _sum: { valor: true }, where: { createdAt: { gte: principioMes }, ...sucursalFilter } }),
    prisma.factura.aggregate({ _sum: { valor: true }, where: { createdAt: { gte: inicioSemana }, ...sucursalFilter } }),

    prisma.gasto.aggregate({ _sum: { valor: true }, where: { fecha: { gte: hoy }, ...sucursalFilter } }),

    prisma.mensualidad.groupBy({ by: ["estado"], _count: true, where: { estado: "ACTIVA", ...sucursalFilter } }),

    prisma.cliente.groupBy({ by: ["estado"], _count: true }),

    prisma.vehiculo.count(),

    prisma.vehiculo.groupBy({ by: ["tipo"], _count: true }),

    prisma.movimiento.findMany({ where: sucursalFilter, orderBy: { id: "desc" }, take: 20 }),
    prisma.ausencia.count({ where: { estado: "ACTIVA", ...sucursalFilter } }),

    prisma.$queryRawUnsafe(`
      SELECT v.placa, v.tipo, v.color, c.nombres as cliente, COUNT(*) as total
      FROM Ingreso i
      JOIN Vehiculo v ON v.id = i.vehiculoId
      LEFT JOIN Cliente c ON c.id = v.clienteId
      LEFT JOIN Puesto p ON p.id = i.puestoId
      WHERE i.estado = 'FINALIZADO'
      ${sucursalId ? `AND p.sucursalId = ${sucursalId}` : ""}
      GROUP BY v.id
      ORDER BY total DESC
      LIMIT 8
    `).catch(() => []) || [],
    prisma.caja.findFirst({ where: { estado: "ABIERTA", ...sucursalFilter }, select: { id: true, apertura: true, createdAt: true } }),

    prisma.reserva.groupBy({ by: ["estado"], _count: true, where: { createdAt: { gte: hoy }, ...sucursalFilter } }),

    prisma.mensualidad.count({ where: { fechaFin: { lt: hoy }, estado: "ACTIVA", ...sucursalFilter } }),
    prisma.mensualidad.count({ where: { fechaFin: { gte: hoy, lte: finSemana }, estado: "ACTIVA", ...sucursalFilter } }),

    prisma.factura.findMany({ where: { createdAt: { gte: sieteDiasAtras }, ...sucursalFilter }, select: { valor: true, createdAt: true }, orderBy: { createdAt: "asc" } }),
    prisma.gasto.findMany({ where: { fecha: { gte: sieteDiasAtras }, ...sucursalFilter }, select: { valor: true, fecha: true }, orderBy: { fecha: "asc" } }),
    prisma.factura.groupBy({ by: ["metodoPago"], _count: true, _sum: { valor: true }, where: sucursalFilter }),
    prisma.factura.findMany({ where: { createdAt: { gte: principioAnio || new Date(hoy.getFullYear(), 0, 1) }, ...sucursalFilter }, select: { valor: true, createdAt: true }, orderBy: { createdAt: "asc" } }),
  ]);

  const puestosMap = Object.fromEntries(puestos.map(p => [p.estado, p._count]));
  const totalPuestos = puestos.reduce((s, p) => s + p._count, 0);
  const puestosLibres = puestosMap["LIBRE"] || 0;
  const puestosOcupados = puestosMap["OCUPADO"] || 0;
  const puestosReservados = puestosMap["RESERVADO"] || 0;
  const puestosMantenimiento = puestosMap["MANTENIMIENTO"] || 0;
  const puestosAusencia = puestosMap["AUSENCIA"] || 0;
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
    const d = new Date(hoy.getTime() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("es-CO", { weekday: "short", day: "numeric" });
    const total = facturas7d
      .filter(f => f.createdAt.toISOString().slice(0, 10) === key)
      .reduce((s, f) => s + f.valor, 0);
    ingresos7Dias.push({ label, total, dia: key });
  }

  const gastos7Dias = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(hoy.getTime() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("es-CO", { weekday: "short", day: "numeric" });
    const total = gastos7d
      .filter(g => g.fecha.toISOString().slice(0, 10) === key)
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
      .filter(f => f.createdAt.getMonth() === i)
      .reduce((s, f) => s + f.valor, 0);
    return { mes: meses[i], total };
  });

  const ingresosHoyRegistros = await prisma.ingreso.findMany({
    where: { fechaEntrada: { gte: hoy }, ...puestoSucursalFilter },
    select: { fechaEntrada: true },
    orderBy: { fechaEntrada: "asc" },
  });
  const ingresosPorHora = Array.from({ length: 24 }, (_, h) => ({
    hora: `${h.toString().padStart(2, "0")}:00`,
    count: ingresosHoyRegistros.filter(i => new Date(i.fechaEntrada).getHours() === h).length,
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
