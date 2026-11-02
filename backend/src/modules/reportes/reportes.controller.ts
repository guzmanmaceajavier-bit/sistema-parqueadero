import prisma from "../../config/prisma.js";
import { asyncHandler, AppError } from "../../middlewares/error.middleware.js";
import { obtenerPeriodoReporte, obtenerFechaClaveEnZona } from "../../utils/periodoReporte.js";
import { resumirEstadosPuestos } from "../../utils/puestos.js";

export const obtenerReporte = asyncHandler(async (req, res) => {
  const { fechaInicio, fechaFin } = req.query;
  const sucursalId = req.query.sucursalId === undefined ? undefined : Number(req.query.sucursalId);
  if (sucursalId !== undefined && (!Number.isSafeInteger(sucursalId) || sucursalId <= 0)) {
    throw new AppError("La sucursal seleccionada no es válida", 400);
  }

  let inicio: Date;
  let finExclusivo: Date;
  let zonaHoraria = "America/Bogota";
  try {
    const configuracion = await prisma.configuracion.findFirst({ select: { zonaHoraria: true } });
    zonaHoraria = configuracion?.zonaHoraria || "America/Bogota";
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: zonaHoraria }).format(new Date());
    } catch {
      zonaHoraria = "America/Bogota";
    }
    ({ inicio, finExclusivo } = obtenerPeriodoReporte(fechaInicio, fechaFin, new Date(), zonaHoraria));
  } catch (error) {
    throw new AppError(error instanceof Error ? error.message : "El período del reporte no es válido", 400);
  }

  const rango = { gte: inicio, lt: finExclusivo };
  const sf = sucursalId ? { sucursalId } : {};
  const psf = sucursalId ? { puesto: { sucursalId } } : {};

  const [facturas, gastos, ingresosPeriodo, puestos, ocupacionPorHora] = await Promise.all([
    prisma.factura.findMany({
      where: { createdAt: rango, ...sf },
      include: {
        ingreso: {
          select: {
            fechaEntrada: true,
            fechaSalida: true,
            tiempoMinutos: true,
            cliente: { select: { nombres: true, apellidos: true } },
            vehiculo: { select: { placa: true, tipo: true } },
          },
        },
        mensualidad: {
          select: {
            cliente: { select: { nombres: true, apellidos: true } },
            vehiculo: { select: { placa: true, tipo: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.gasto.findMany({
      where: { fecha: rango, ...sf },
      orderBy: { fecha: "asc" },
    }),
    prisma.ingreso.findMany({
      where: { fechaSalida: rango, estado: "FINALIZADO", ...psf },
      select: { id: true, fechaEntrada: true, fechaSalida: true, tiempoMinutos: true, valorPagado: true, vehiculo: { select: { placa: true, tipo: true } } },
      orderBy: { fechaSalida: "asc" },
    }),
    prisma.puesto.groupBy({ by: ["estado"], _count: true, where: { activo: true, ...sf } }),
    prisma.ingreso.findMany({
      where: { fechaEntrada: rango, ...psf },
      select: { fechaEntrada: true },
    }),
  ]);

  const resumenPuestos = resumirEstadosPuestos(puestos);

  const facturasPagadas = facturas.filter(f => f.metodoPago !== null);
  const totalIngresos = facturasPagadas.reduce((s, f) => s + f.valor, 0);
  const totalGastos = gastos.reduce((s, g) => s + g.valor, 0);
  const utilidad = totalIngresos - totalGastos;

  const ingresosPorDia = [];
  const claveInicio = obtenerFechaClaveEnZona(inicio, zonaHoraria);
  const claveFin = obtenerFechaClaveEnZona(finExclusivo, zonaHoraria);
  const iter = new Date(`${claveInicio}T00:00:00.000Z`);
  const finIter = new Date(`${claveFin}T00:00:00.000Z`);
  while (iter < finIter) {
    const key = iter.toISOString().slice(0, 10);
    const label = iter.toLocaleDateString("es-CO", { weekday: "short", day: "numeric", timeZone: "UTC" });
    const ing = facturasPagadas.filter(f => obtenerFechaClaveEnZona(f.createdAt, zonaHoraria) === key).reduce((s, f) => s + f.valor, 0);
    const gas = gastos.filter(g => obtenerFechaClaveEnZona(new Date(g.fecha), zonaHoraria) === key).reduce((s, g) => s + g.valor, 0);
    ingresosPorDia.push({ label, fecha: key, ingresos: ing, gastos: gas });
    iter.setUTCDate(iter.getUTCDate() + 1);
  }

  const horas = Array.from({ length: 24 }, (_, h) => ({
    hora: `${h.toString().padStart(2, "0")}:00`,
    count: ocupacionPorHora.filter(i => new Date(i.fechaEntrada).getHours() === h).length,
  }));

  const metodosPago = await prisma.factura.groupBy({
    by: ["metodoPago"],
    _count: true,
    _sum: { valor: true },
    where: { createdAt: rango, metodoPago: { not: null }, ...sf },
  });

  res.json({
    ok: true,
    resumen: {
      ingresos: totalIngresos,
      gastos: totalGastos,
      utilidad,
      facturas: facturas.length,
      ingresosCount: ingresosPeriodo.length,
      gastosCount: gastos.length,
      puestos: resumenPuestos,
    },
    ingresosPorDia,
    ocupacionPorHora: horas,
    facturas: facturas.map(f => ({
      id: f.id,
      numero: f.numero,
      valor: f.valor,
      metodoPago: f.metodoPago,
      estadoPago: f.metodoPago !== null ? "PAGADA" : "PENDIENTE",
      createdAt: f.createdAt,
      cliente: f.ingreso?.cliente
        ? `${f.ingreso.cliente.nombres} ${f.ingreso.cliente.apellidos}`
        : f.mensualidad?.cliente
          ? `${f.mensualidad.cliente.nombres} ${f.mensualidad.cliente.apellidos}`
          : null,
      placa: f.ingreso?.vehiculo?.placa || f.mensualidad?.vehiculo?.placa,
      tipoVehiculo: f.ingreso?.vehiculo?.tipo || f.mensualidad?.vehiculo?.tipo,
    })),
    gastos: gastos.map(g => ({
      id: g.id,
      concepto: g.concepto,
      categoria: g.categoria,
      valor: g.valor,
      fecha: g.fecha,
    })),
    metodosPago: metodosPago.reduce((acc, m) => ({ ...acc, [m.metodoPago || "otros"]: { count: m._count, total: m._sum.valor || 0 } }), {}),
  });
});
