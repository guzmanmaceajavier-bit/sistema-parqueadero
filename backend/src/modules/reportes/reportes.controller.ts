import prisma from "../../config/prisma.js";
import { asyncHandler } from "../../middlewares/error.middleware.js";

export const obtenerReporte = asyncHandler(async (req, res) => {
  const { fechaInicio, fechaFin, tipo } = req.query;
  const sucursalId = req.query.sucursalId ? Number(req.query.sucursalId) : undefined;

  const inicio = fechaInicio ? new Date(fechaInicio) : new Date();
  const fin = fechaFin ? new Date(fechaFin + "T23:59:59") : new Date();
  if (!fechaInicio) inicio.setHours(0, 0, 0, 0);

  const sf = sucursalId ? { sucursalId } : {};
  const psf = sucursalId ? { puesto: { sucursalId } } : {};

  const [facturas, gastos, ingresosPeriodo, puestos, ocupacionPorHora] = await Promise.all([
    prisma.factura.findMany({
      where: { createdAt: { gte: inicio, lte: fin }, ...sf },
      include: { ingreso: { select: { fechaEntrada: true, fechaSalida: true, tiempoMinutos: true, cliente: { select: { nombres: true, apellidos: true } }, vehiculo: { select: { placa: true, tipo: true } } } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.gasto.findMany({
      where: { fecha: { gte: inicio, lte: fin }, ...sf },
      orderBy: { fecha: "asc" },
    }),
    prisma.ingreso.findMany({
      where: { fechaEntrada: { gte: inicio, lte: fin }, ...psf },
      select: { id: true, fechaEntrada: true, fechaSalida: true, tiempoMinutos: true, valorPagado: true, vehiculo: { select: { placa: true, tipo: true } } },
      orderBy: { fechaEntrada: "asc" },
    }),
    prisma.puesto.groupBy({ by: ["estado"], _count: true }),
    prisma.ingreso.findMany({
      where: { fechaEntrada: { gte: inicio, lte: fin }, ...psf },
      select: { fechaEntrada: true },
    }),
  ]);

  const totalPuestos = puestos.reduce((s, p) => s + p._count, 0);
  const puestosOcupados = puestos.find(p => p.estado === "OCUPADO")?._count || 0;

  const totalIngresos = facturas.reduce((s, f) => s + f.valor, 0);
  const totalGastos = gastos.reduce((s, g) => s + g.valor, 0);
  const utilidad = totalIngresos - totalGastos;

  const ingresosPorDia = [];
  const iter = new Date(inicio);
  while (iter <= fin) {
    const key = iter.toISOString().slice(0, 10);
    const label = iter.toLocaleDateString("es-CO", { weekday: "short", day: "numeric" });
    const ing = facturas.filter(f => f.createdAt.toISOString().slice(0, 10) === key).reduce((s, f) => s + f.valor, 0);
    const gas = gastos.filter(g => new Date(g.fecha).toISOString().slice(0, 10) === key).reduce((s, g) => s + g.valor, 0);
    ingresosPorDia.push({ label, fecha: key, ingresos: ing, gastos: gas });
    iter.setDate(iter.getDate() + 1);
  }

  const horas = Array.from({ length: 24 }, (_, h) => ({
    hora: `${h.toString().padStart(2, "0")}:00`,
    count: ocupacionPorHora.filter(i => new Date(i.fechaEntrada).getHours() === h).length,
  }));

  const metodosPago = await prisma.factura.groupBy({
    by: ["metodoPago"],
    _count: true,
    _sum: { valor: true },
    where: { createdAt: { gte: inicio, lte: fin }, ...sf },
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
      puestos: { total: totalPuestos, ocupados: puestosOcupados, libres: totalPuestos - puestosOcupados },
    },
    ingresosPorDia,
    ocupacionPorHora: horas,
    facturas: facturas.map(f => ({
      id: f.id,
      numero: f.numero,
      valor: f.valor,
      metodoPago: f.metodoPago,
      createdAt: f.createdAt,
      cliente: f.ingreso?.cliente ? `${f.ingreso.cliente.nombres} ${f.ingreso.cliente.apellidos}` : null,
      placa: f.ingreso?.vehiculo?.placa,
      tipoVehiculo: f.ingreso?.vehiculo?.tipo,
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
