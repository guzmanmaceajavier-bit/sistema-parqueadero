import prisma from "../../config/prisma.js";
import { asyncHandler, AppError } from "../../middlewares/error.middleware.js";
import { paginate } from "../../utils/pagination.js";
import { registrarMovimiento } from "../../helpers/movimientos.js";

export const crearTarifa = asyncHandler(async (req, res) => {
  const {
    nombre, tipoVehiculo, modalidad, valor, minutosCortesia, minutosGratis,
    precioPrimeraHora, precioHoraAdicional, tarifaMaximaDiaria, descripcion,
  } = req.body;

  if (!nombre) throw new AppError("Nombre es requerido", 400);
  if (!tipoVehiculo) throw new AppError("Tipo de vehículo es requerido", 400);
  if (!modalidad) throw new AppError("Modalidad es requerida", 400);

  const val = Number(valor);
  if (!Number.isFinite(val) || val <= 0) {
    throw new AppError("Valor debe ser un número válido y positivo", 400);
  }
  if ((precioPrimeraHora == null) !== (precioHoraAdicional == null)) {
    throw new AppError("Configura juntos el precio de la primera hora y el de las horas adicionales.", 400);
  }

  const tarifa = await prisma.tarifa.create({
    data: {
      nombre,
      tipoVehiculo,
      modalidad: String(modalidad).trim().toLowerCase(),
      valor: val,
      minutosCortesia: minutosCortesia ?? 0,
      minutosGratis: minutosGratis ?? 0,
      precioPrimeraHora: precioPrimeraHora ?? null,
      precioHoraAdicional: precioHoraAdicional ?? null,
      tarifaMaximaDiaria: tarifaMaximaDiaria ?? null,
      descripcion,
    },
  });

  await registrarMovimiento("TARIFAS", "CREAR", `Tarifa creada: ${tarifa.nombre}`, req.usuario?.usuario || "admin");
  res.status(201).json({ ok: true, tarifa });
});

export const obtenerTarifas = asyncHandler(async (req, res) => {
  const { page, limit, q } = req.query;
  const where: any = {};

  if (q) {
    const query = String(q);
    where.OR = [
      { nombre: { contains: query, mode: "insensitive" } },
      { tipoVehiculo: { contains: query, mode: "insensitive" } },
      { modalidad: { contains: query, mode: "insensitive" } },
    ];
  }

  if (page) {
    const { data: tarifas, pagination } = await paginate(prisma, "tarifa", {
      page, limit, where, orderBy: { id: "desc" },
    });
    return res.json({ ok: true, tarifas, pagination });
  }

  const tarifas = await prisma.tarifa.findMany({ where, orderBy: { id: "desc" } });
  res.json({ ok: true, tarifas });
});

export const obtenerTarifa = asyncHandler(async (req, res) => {
  const tarifa = await prisma.tarifa.findUnique({ where: { id: Number(req.params.id) } });
  if (!tarifa) throw new AppError("Tarifa no encontrada", 404);
  res.json({ ok: true, tarifa });
});

export const actualizarTarifa = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    nombre, tipoVehiculo, modalidad, valor, minutosCortesia, minutosGratis,
    precioPrimeraHora, precioHoraAdicional, tarifaMaximaDiaria, descripcion, activa,
  } = req.body;

  const existe = await prisma.tarifa.findUnique({ where: { id: Number(id) } });
  if (!existe) throw new AppError("Tarifa no encontrada", 404);

  const primeraHoraFinal = precioPrimeraHora !== undefined ? precioPrimeraHora : existe.precioPrimeraHora;
  const horaAdicionalFinal = precioHoraAdicional !== undefined ? precioHoraAdicional : existe.precioHoraAdicional;
  if ((primeraHoraFinal == null) !== (horaAdicionalFinal == null)) {
    throw new AppError("Configura juntos el precio de la primera hora y el de las horas adicionales.", 400);
  }

  const data: any = {};
  if (nombre !== undefined) data.nombre = nombre;
  if (tipoVehiculo !== undefined) data.tipoVehiculo = tipoVehiculo;
  if (modalidad !== undefined) data.modalidad = String(modalidad).trim().toLowerCase();

  if (valor !== undefined) {
    const val = Number(valor);
    if (!Number.isFinite(val) || val <= 0) {
      throw new AppError("Valor debe ser un número válido y positivo", 400);
    }
    data.valor = val;
  }

  if (minutosCortesia !== undefined) data.minutosCortesia = Number(minutosCortesia);
  if (minutosGratis !== undefined) data.minutosGratis = Number(minutosGratis);
  if (precioPrimeraHora !== undefined) data.precioPrimeraHora = precioPrimeraHora;
  if (precioHoraAdicional !== undefined) data.precioHoraAdicional = precioHoraAdicional;
  if (tarifaMaximaDiaria !== undefined) data.tarifaMaximaDiaria = tarifaMaximaDiaria;
  if (descripcion !== undefined) data.descripcion = descripcion;
  if (activa !== undefined) data.activa = activa;

  const tarifa = await prisma.tarifa.update({ where: { id: Number(id) }, data });
  await registrarMovimiento("TARIFAS", "ACTUALIZAR", `Tarifa #${id}: ${tarifa.nombre}`, req.usuario?.usuario || "admin");
  res.json({ ok: true, tarifa });
});

export const eliminarTarifa = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existe = await prisma.tarifa.findUnique({ where: { id: Number(id) } });
  if (!existe) throw new AppError("Tarifa no encontrada", 404);

  const ingresos = await prisma.ingreso.count({ where: { tarifaId: Number(id) } });
  const facturas = await prisma.factura.count({ where: { tarifaId: Number(id) } });

  if (ingresos > 0 || facturas > 0) {
    await prisma.tarifa.update({ where: { id: Number(id) }, data: { activa: false } });
    await registrarMovimiento("TARIFAS", "DESACTIVAR", `Tarifa #${id}: ${existe.nombre} desactivada (tiene registros asociados)`, req.usuario?.usuario || "admin");
    return res.json({ ok: true, message: "Tarifa desactivada (tiene registros históricos asociados)" });
  }

  await prisma.tarifa.delete({ where: { id: Number(id) } });
  await registrarMovimiento("TARIFAS", "ELIMINAR", `Tarifa #${id}: ${existe.nombre}`, req.usuario?.usuario || "admin");
  res.json({ ok: true, message: "Tarifa eliminada" });
});
