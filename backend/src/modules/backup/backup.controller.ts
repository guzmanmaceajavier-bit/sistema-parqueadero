import prisma from "../../config/prisma.js";
import { asyncHandler } from "../../middlewares/error.middleware.js";

export const generarBackup = asyncHandler(async (req, res) => {
  const [usuarios, clientes, vehiculos, puestos, tarifas, planes, configuracion] = await Promise.all([
    prisma.usuario.findMany({ select: { id: true, nombre: true, usuario: true, correo: true, rol: true, createdAt: true } }),
    prisma.cliente.findMany(),
    prisma.vehiculo.findMany(),
    prisma.puesto.findMany(),
    prisma.tarifa.findMany(),
    prisma.plan.findMany(),
    prisma.configuracion.findMany(),
  ]);

  const backup = {
    version: "1.0",
    fecha: new Date().toISOString(),
    data: { usuarios, clientes, vehiculos, puestos, tarifas, planes, configuracion },
  };

  res.json({ ok: true, backup });
});

export const restaurarBackup = asyncHandler(async (req, res) => {
  const { data } = req.body;
  if (!data) throw new AppError("No hay datos para restaurar", 400);

  const resultados = [];
  const modelos = ["configuracion", "planes", "tarifas", "puestos", "vehiculos", "clientes", "usuarios"];

  for (const modelo of modelos) {
    if (data[modelo]?.length > 0) {
      for (const item of data[modelo]) {
        try {
          await prisma[modelo].upsert({
            where: { id: item.id },
            create: item,
            update: item,
          });
          resultados.push(`${modelo}: ${item.id} OK`);
        } catch (e) {
          resultados.push(`${modelo}: ${item.id} ERROR - ${e.message}`);
        }
      }
    }
  }

  res.json({ ok: true, message: "Restauración completada", resultados });
});
