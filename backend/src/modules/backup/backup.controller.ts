import prisma from "../../config/prisma.js";
import { asyncHandler, AppError } from "../../middlewares/error.middleware.js";

export const generarBackup = asyncHandler(async (req, res) => {
  const [usuarios, clientes, vehiculos, puestos, tarifas, planes, configuracion, ingresos, mensualidades, reservas, facturas, caja, movimientos, gastos] = await Promise.all([
    prisma.usuario.findMany({ select: { id: true, nombre: true, usuario: true, correo: true, rol: true, password: true, estado: true, bloqueadoHasta: true, tokenVersion: true, createdAt: true } }),
    prisma.cliente.findMany({ include: { vehiculos: true, ingresos: true, mensualidades: true, reservas: true, ausencias: true } }),
    prisma.vehiculo.findMany({ include: { ingresos: true, mensualidades: true, reservas: true, ausencias: true } }),
    prisma.puesto.findMany({ include: { ingresos: true, mensualidades: true, reservas: true } }),
    prisma.tarifa.findMany(),
    prisma.plan.findMany(),
    prisma.configuracion.findMany(),
    prisma.ingreso.findMany({ include: { cliente: true, vehiculo: true, puesto: true, facturas: true } }),
    prisma.mensualidad.findMany({ include: { cliente: true, vehiculo: true, plan: true, puesto: true, facturas: true } }),
    prisma.reserva.findMany({ include: { cliente: true, vehiculo: true, puesto: true, ingreso: true } }),
    prisma.factura.findMany({ include: { ingreso: true, mensualidad: true, cajaMovimientos: true } }),
    prisma.caja.findMany({ include: { movimientos: true, usuario: true } }),
    prisma.cajaMovimiento.findMany({ include: { factura: true, gasto: true } }),
    prisma.gasto.findMany(),
  ]);

  const backup = {
    version: "1.1",
    fecha: new Date().toISOString(),
    data: { usuarios, clientes, vehiculos, puestos, tarifas, planes, configuracion, ingresos, mensualidades, reservas, facturas, caja, movimientos, gastos },
  };

  res.json({ ok: true, backup });
});

const RELACIONES: Record<string, string[]> = {
  atributos: [],
  clientes: ["vehiculos", "ingresos", "mensualidades", "reservas", "ausencias"],
  vehiculos: ["cliente", "sucursal", "plan", "tarifa", "ingresos", "mensualidades", "reservas", "ausencias"],
  puestos: ["sucursal", "ingresos", "mensualidades", "reservas"],
  ingresos: ["cliente", "vehiculo", "puesto", "facturas", "reserva"],
  mensualidades: ["cliente", "vehiculo", "plan", "puesto", "facturas", "sucursal"],
  reservas: ["cliente", "vehiculo", "puesto", "ingreso", "sucursal"],
  facturas: ["ingreso", "mensualidad", "cajaMovimientos", "sucursal"],
  caja: ["movimientos", "usuario", "sucursal"],
  movimientos: ["factura", "gasto", "caja"],
  gastos: ["cajaMovimientos", "sucursal"],
};

function prepararRegistro(modelo: string, item: any) {
  if (!item || typeof item !== "object") return null;
  const limpio = { ...item };
  for (const rel of RELACIONES[modelo] || []) {
    delete limpio[rel];
  }
  return limpio;
}

export const restaurarBackup = asyncHandler(async (req, res) => {
  const { data } = req.body;
  if (!data) throw new AppError("No hay datos para restaurar", 400);

  const modelos = ["configuracion", "planes", "tarifas", "puestos", "vehiculos", "clientes", "usuarios", "ingresos", "mensualidades", "reservas", "facturas", "caja", "movimientos", "gastos"];
  const omitidas: Record<string, number> = {};

  await prisma.$transaction(async (tx) => {
    for (const modelo of modelos) {
      if (data[modelo]?.length > 0) {
        for (const item of data[modelo]) {
          const registro = prepararRegistro(modelo, item);
          if (!registro) continue;
          const { id, ...rest } = registro;
          if (id === undefined || id === null) {
            omitidas[modelo] = (omitidas[modelo] || 0) + 1;
            continue;
          }
          const delegate = (tx as any)[modelo];
          await delegate.upsert({
            where: { id: Number(id) },
            create: { id: Number(id), ...rest },
            update: rest,
          });
        }
      }
    }
  });

  const resumen = Object.entries(omitidas).map(([m, n]) => `${m}: ${n} omitido(s)`).join(", ");
  res.json({ ok: true, message: `Restauración completada.${resumen ? ` Registros sin id omitidos — ${resumen}` : ""}` });
});
