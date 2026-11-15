import prisma from "../../config/prisma.js";
import { asyncHandler } from "../../middlewares/error.middleware.js";
import { resolverSucursalPermitida } from "../../utils/sucursalAccess.js";

export const obtenerAlertas = asyncHandler(async (req, res) => {
  const sucursalId = resolverSucursalPermitida(req.usuario, req.query.sucursalId);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const dentroDe7Dias = new Date(hoy.getTime() + 7 * 86400000);
  const hace8Horas = new Date(Date.now() - 8 * 3600000);
  const sucursal = sucursalId ? { sucursalId } : {};
  const ingresoSucursal = sucursalId ? { vehiculo: { sucursalId } } : {};
  const clienteSucursal = sucursalId
    ? { OR: [
        { vehiculos: { some: { sucursalId } } },
        { ingresos: { some: { vehiculo: { sucursalId } } } },
        { mensualidades: { some: { sucursalId } } },
        { reservas: { some: { sucursalId } } },
        { ausencias: { some: { sucursalId } } },
      ] }
    : {};

  const [
    morosos,
    mensualidadesProximas,
    mensualidadesVencidas,
    vehiculosProlongados,
    reservasProximas,
    cajaActiva,
    ausenciasActivas,
    facturasPendientes,
  ] = await Promise.all([
    prisma.cliente.findMany({
      where: { estado: "MOROSO", ...clienteSucursal },
      select: { id: true, nombres: true, apellidos: true, telefono: true },
      take: 100,
    }),
    prisma.mensualidad.findMany({
      where: { fechaFin: { gte: hoy, lte: dentroDe7Dias }, estado: "ACTIVA", ...sucursal },
      include: { cliente: { select: { nombres: true, apellidos: true } } },
      orderBy: { fechaFin: "asc" },
      take: 100,
    }),
    prisma.mensualidad.findMany({
      where: {
        OR: [
          { estado: "VENCIDA" },
          { estado: "ACTIVA", fechaFin: { lt: hoy } },
        ],
        ...sucursal,
      },
      include: { cliente: { select: { nombres: true, apellidos: true } } },
      orderBy: { fechaFin: "asc" },
      take: 100,
    }),
    prisma.ingreso.findMany({
      where: { estado: "ACTIVO", fechaEntrada: { lte: hace8Horas }, ...ingresoSucursal },
      include: { vehiculo: { select: { placa: true } }, cliente: { select: { nombres: true, apellidos: true } } },
      orderBy: { fechaEntrada: "asc" },
      take: 100,
    }),
    prisma.reserva.findMany({
      where: { estado: { in: ["PENDIENTE", "CONFIRMADA"] }, fechaInicio: { gte: hoy, lte: dentroDe7Dias }, ...sucursal },
      include: { cliente: { select: { nombres: true, apellidos: true } }, puesto: { select: { codigo: true } } },
      orderBy: { fechaInicio: "asc" },
      take: 100,
    }),
    prisma.caja.findFirst({ where: { estado: "ABIERTA", ...sucursal } }),
    prisma.ausencia.count({ where: { estado: "ACTIVA", ...sucursal } }),
    prisma.factura.findMany({
      where: { metodoPago: null, anulada: false, ...sucursal },
      select: {
        id: true,
        numero: true,
        valor: true,
        createdAt: true,
        ingreso: { select: { cliente: { select: { nombres: true, apellidos: true } }, vehiculo: { select: { placa: true } } } },
        mensualidad: { select: { cliente: { select: { nombres: true, apellidos: true } }, vehiculo: { select: { placa: true } } } },
      },
      orderBy: { createdAt: "asc" },
      take: 100,
    }),
  ]);

  const alertas: Array<{ tipo: string; icono: string; titulo: string; descripcion: string; enlace: string }> = [];
  const totalDeudaPendiente = facturasPendientes.reduce((total, factura) => total + Number(factura.valor), 0);

  if (morosos.length > 0) {
    alertas.push({
      tipo: "peligro",
      icono: "usuario",
      titulo: `${morosos.length} cliente(s) moroso(s)`,
      descripcion: morosos.slice(0, 3).map(m => `${m.nombres} ${m.apellidos}`).join(", "),
      enlace: "/clientes",
    });
  }

  if (facturasPendientes.length > 0) {
    alertas.push({
      tipo: "peligro",
      icono: "dinero",
      titulo: `${facturasPendientes.length} factura(s) pendiente(s) · ${totalDeudaPendiente.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })}`,
      descripcion: facturasPendientes.slice(0, 3).map(f => {
        const cliente = f.ingreso?.cliente || f.mensualidad?.cliente;
        const placa = f.ingreso?.vehiculo?.placa || f.mensualidad?.vehiculo?.placa || "sin vehículo";
        return `${f.numero} · ${cliente ? `${cliente.nombres} ${cliente.apellidos}` : "Cliente"} · ${placa}`;
      }).join("; "),
      enlace: "/facturas",
    });
  }

  if (mensualidadesVencidas.length > 0) {
    alertas.push({
      tipo: "peligro",
      icono: "calendario",
      titulo: `${mensualidadesVencidas.length} mensualidad(es) vencida(s)`,
      descripcion: mensualidadesVencidas.slice(0, 3).map(m => `${m.cliente.nombres} ${m.cliente.apellidos} (venció ${new Date(m.fechaFin).toLocaleDateString("es-CO")})`).join(", "),
      enlace: "/mensualidades",
    });
  }

  if (mensualidadesProximas.length > 0) {
    alertas.push({
      tipo: "advertencia",
      icono: "reloj",
      titulo: `${mensualidadesProximas.length} mensualidad(es) por vencer`,
      descripcion: mensualidadesProximas.slice(0, 3).map(m => `${m.cliente.nombres} ${m.cliente.apellidos} (vence ${new Date(m.fechaFin).toLocaleDateString("es-CO")})`).join(", "),
      enlace: "/mensualidades",
    });
  }

  if (vehiculosProlongados.length > 0) {
    alertas.push({
      tipo: "advertencia",
      icono: "vehiculo",
      titulo: `${vehiculosProlongados.length} vehículo(s) con +8h estacionados`,
      descripcion: vehiculosProlongados.slice(0, 3).map(v => `${v.vehiculo.placa} - ${v.cliente.nombres}`).join(", "),
      enlace: "/ingresos",
    });
  }

  if (reservasProximas.length > 0) {
    alertas.push({
      tipo: "info",
      icono: "reserva",
      titulo: `${reservasProximas.length} reserva(s) próxima(s)`,
      descripcion: reservasProximas.slice(0, 3).map(r => `${r.cliente.nombres} → ${r.puesto?.codigo || "sin puesto"} (${new Date(r.fechaInicio).toLocaleString("es-CO")})`).join(", "),
      enlace: "/reservas",
    });
  }

  if (!cajaActiva) {
    alertas.push({
      tipo: "info",
      icono: "caja",
      titulo: "Caja cerrada",
      descripcion: "No hay una caja abierta en esta sucursal. Abra la caja para registrar operaciones.",
      enlace: "/caja",
    });
  }

  if (ausenciasActivas > 0) {
    alertas.push({
      tipo: "info",
      icono: "ausencia",
      titulo: `${ausenciasActivas} ausencia(s) activa(s)`,
      descripcion: "Hay clientes registrados como ausentes temporalmente.",
      enlace: "/ausencias",
    });
  }

  res.json({
    ok: true,
    alertas,
    total: alertas.length,
    resumen: {
      facturasPendientes: facturasPendientes.length,
      valorFacturasPendientes: totalDeudaPendiente,
      mensualidadesVencidas: mensualidadesVencidas.length,
      mensualidadesPorVencer: mensualidadesProximas.length,
    },
  });
});
