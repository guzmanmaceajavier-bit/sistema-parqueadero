import prisma from "../../config/prisma.js";
import { asyncHandler, AppError } from "../../middlewares/error.middleware.js";
import { paginate } from "../../utils/pagination.js";
import { registrarMovimiento } from "../../helpers/movimientos.js";
import { resolverSucursalPermitida } from "../../utils/sucursalAccess.js";
import { normalizarMonto } from "../../utils/dinero.js";

function validarMontoTarifa(valor: unknown, etiqueta: string, obligatorio = false): number | null {
  if (valor == null || valor === "") {
    if (obligatorio) throw new AppError(`${etiqueta} es requerido`, 400);
    return null;
  }
  const monto = normalizarMonto(valor);
  if (monto === null || monto < 0 || (obligatorio && monto === 0)) {
    throw new AppError(`${etiqueta} debe ser un importe válido con máximo dos decimales`, 400);
  }
  return monto;
}

export const crearTarifa = asyncHandler(async (req, res) => {
  const {
    nombre, tipoVehiculo, modalidad, valor, minutosCortesia, minutosGratis,
    precioPrimeraHora, precioHoraAdicional, tarifaMaximaDiaria, descripcion,
  } = req.body;
  const sucursalId = resolverSucursalPermitida(req.usuario, req.body.sucursalId);

  if (typeof nombre !== "string" || !nombre.trim()) throw new AppError("Nombre es requerido", 400);
  if (typeof tipoVehiculo !== "string" || !tipoVehiculo.trim()) throw new AppError("Tipo de vehículo es requerido", 400);
  if (typeof modalidad !== "string" || !modalidad.trim()) throw new AppError("Modalidad es requerida", 400);

  const val = validarMontoTarifa(valor, "El valor de la tarifa", true)!;
  const primeraHora = validarMontoTarifa(precioPrimeraHora, "El precio de la primera hora");
  const horaAdicional = validarMontoTarifa(precioHoraAdicional, "El precio de la hora adicional");
  const maximoDiario = validarMontoTarifa(tarifaMaximaDiaria, "La tarifa máxima diaria");
  if ((primeraHora == null) !== (horaAdicional == null)) {
    throw new AppError("Configura juntos el precio de la primera hora y el de las horas adicionales.", 400);
  }

  const modalidadNormalizada = modalidad.trim().toLowerCase();
  const tipos = tipoVehiculo.split(",").map((t: string) => t.trim()).filter(Boolean);
  if (!tipos.length) throw new AppError("Selecciona al menos un tipo de vehículo", 400);
  const duplicada = await prisma.tarifa.findFirst({
    where: { activa: true, modalidad: modalidadNormalizada, tipoVehiculo: { in: tipos }, sucursalId: sucursalId ?? null },
  });
  if (duplicada) {
    throw new AppError(
      `Ya existe una tarifa activa para "${modalidadNormalizada}" y ese tipo de vehículo (${duplicada.nombre}). Desactívala o edítala en lugar de crear otra.`,
      409,
    );
  }

  const tarifa = await prisma.tarifa.create({
    data: {
      nombre: nombre.trim(),
      tipoVehiculo: tipos.join(","),
      modalidad: modalidadNormalizada,
      valor: val,
      minutosCortesia: minutosCortesia ?? 0,
      minutosGratis: minutosGratis ?? 0,
      precioPrimeraHora: primeraHora,
      precioHoraAdicional: horaAdicional,
      tarifaMaximaDiaria: maximoDiario,
      descripcion,
      sucursalId: sucursalId ?? null,
    },
  });

  await registrarMovimiento("TARIFAS", "CREAR", `Tarifa creada: ${tarifa.nombre}`, req.usuario?.usuario || "admin");
  res.status(201).json({ ok: true, tarifa });
});

export const obtenerTarifas = asyncHandler(async (req, res) => {
  const { page, limit, q } = req.query;
  const sucursalId = resolverSucursalPermitida(req.usuario, req.query.sucursalId);
  const where: any = sucursalId ? { OR: [{ sucursalId }, { sucursalId: null }] } : {};

  if (q) {
    const query = String(q);
    const filtroTexto = [
      { nombre: { contains: query, mode: "insensitive" } },
      { tipoVehiculo: { contains: query, mode: "insensitive" } },
      { modalidad: { contains: query, mode: "insensitive" } },
    ];
    where.AND = [...(where.OR ? [{ OR: where.OR }] : []), { OR: filtroTexto }];
    delete where.OR;
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
  const sucursalId = resolverSucursalPermitida(req.usuario, req.query.sucursalId);
  const tarifa = await prisma.tarifa.findFirst({ where: { id: Number(req.params.id), ...(sucursalId ? { OR: [{ sucursalId }, { sucursalId: null }] } : {}) } });
  if (!tarifa) throw new AppError("Tarifa no encontrada", 404);
  res.json({ ok: true, tarifa });
});

export const actualizarTarifa = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const sucursalId = resolverSucursalPermitida(req.usuario, req.query.sucursalId);
  const {
    nombre, tipoVehiculo, modalidad, valor, minutosCortesia, minutosGratis,
    precioPrimeraHora, precioHoraAdicional, tarifaMaximaDiaria, descripcion, activa,
  } = req.body;

  const existe = await prisma.tarifa.findFirst({ where: { id: Number(id), ...(sucursalId ? { sucursalId } : {}) } });
  if (!existe) throw new AppError("Tarifa no encontrada", 404);

  const data: any = {};
  const nombreFinal = nombre !== undefined ? nombre : existe.nombre;
  const tipoFinal = tipoVehiculo !== undefined ? tipoVehiculo : existe.tipoVehiculo;
  const modalidadFinal = modalidad !== undefined ? String(modalidad).trim().toLowerCase() : existe.modalidad;
  const activaFinal = activa !== undefined ? activa : existe.activa;
  if (typeof nombreFinal !== "string" || !nombreFinal.trim()) throw new AppError("Nombre es requerido", 400);
  if (typeof tipoFinal !== "string" || !tipoFinal.trim()) throw new AppError("Tipo de vehículo es requerido", 400);
  if (typeof modalidadFinal !== "string" || !modalidadFinal.trim()) throw new AppError("Modalidad es requerida", 400);
  if (typeof activaFinal !== "boolean") throw new AppError("El estado de la tarifa no es válido", 400);

  if (nombre !== undefined) data.nombre = nombreFinal.trim();
  if (tipoVehiculo !== undefined) data.tipoVehiculo = tipoFinal.trim();
  if (modalidad !== undefined) data.modalidad = modalidadFinal;

  if (valor !== undefined) data.valor = validarMontoTarifa(valor, "El valor de la tarifa", true);
  if (minutosCortesia !== undefined) {
    const n = Number(minutosCortesia);
    if (!Number.isSafeInteger(n) || n < 0) throw new AppError("Los minutos de cortesía deben ser un entero no negativo", 400);
    data.minutosCortesia = n;
  }
  if (minutosGratis !== undefined) {
    const n = Number(minutosGratis);
    if (!Number.isSafeInteger(n) || n < 0) throw new AppError("Los minutos gratis deben ser un entero no negativo", 400);
    data.minutosGratis = n;
  }
  if (precioPrimeraHora !== undefined) data.precioPrimeraHora = validarMontoTarifa(precioPrimeraHora, "El precio de la primera hora");
  if (precioHoraAdicional !== undefined) data.precioHoraAdicional = validarMontoTarifa(precioHoraAdicional, "El precio de la hora adicional");
  if (tarifaMaximaDiaria !== undefined) data.tarifaMaximaDiaria = validarMontoTarifa(tarifaMaximaDiaria, "La tarifa máxima diaria");
  if (descripcion !== undefined) data.descripcion = descripcion;
  if (activa !== undefined) data.activa = activa;

  const primeraHoraFinal = data.precioPrimeraHora !== undefined ? data.precioPrimeraHora : existe.precioPrimeraHora;
  const horaAdicionalFinal = data.precioHoraAdicional !== undefined ? data.precioHoraAdicional : existe.precioHoraAdicional;
  if ((primeraHoraFinal == null) !== (horaAdicionalFinal == null)) {
    throw new AppError("Configura juntos el precio de la primera hora y el de las horas adicionales.", 400);
  }

  const tipos = tipoFinal.split(",").map((t: string) => t.trim()).filter(Boolean);
  if (!tipos.length) throw new AppError("Selecciona al menos un tipo de vehículo", 400);
  if (activaFinal) {
    const duplicada = await prisma.tarifa.findFirst({
      where: {
        id: { not: Number(id) }, activa: true, modalidad: modalidadFinal,
        tipoVehiculo: { in: tipos }, sucursalId: existe.sucursalId ?? null,
      },
    });
    if (duplicada) throw new AppError(`Ya existe una tarifa activa para "${modalidadFinal}" y ese tipo de vehículo (${duplicada.nombre}).`, 409);
  }

  if (Object.keys(data).length === 0) throw new AppError("No hay cambios válidos para guardar", 400);
  const tarifa = await prisma.tarifa.update({ where: { id: Number(id) }, data });
  await registrarMovimiento("TARIFAS", "ACTUALIZAR", `Tarifa #${id}: ${tarifa.nombre}`, req.usuario?.usuario || "admin");
  res.json({ ok: true, tarifa });
});

export const eliminarTarifa = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const sucursalId = resolverSucursalPermitida(req.usuario, req.query.sucursalId);
  const tarifa = await prisma.tarifa.findFirst({ where: { id: Number(id), ...(sucursalId ? { sucursalId } : {}) } });
  if (!tarifa) throw new AppError("Tarifa no encontrada", 404);

  // Las facturas históricas no guardan tarifaId; por eso no se elimina físicamente
  // una tarifa que pudo haber intervenido en cobros anteriores.
  const vehiculosAsignados = await prisma.vehiculo.count({ where: { tarifaId: Number(id) } });
  const desactivada = await prisma.tarifa.update({
    where: { id: Number(id) },
    data: { activa: false },
  });

  await registrarMovimiento(
    "TARIFAS",
    "DESACTIVAR",
    `Tarifa #${id}: ${tarifa.nombre} desactivada; ${vehiculosAsignados} vehículo(s) aún la tienen asignada`,
    req.usuario?.usuario || "admin",
  );

  res.json({
    ok: true,
    tarifa: desactivada,
    message: vehiculosAsignados > 0
      ? "Tarifa desactivada. Los vehículos asignados deben recibir otra tarifa antes de nuevos cobros."
      : "Tarifa desactivada para conservar el historial de configuración.",
  });
});
