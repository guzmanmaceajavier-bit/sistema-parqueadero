import prisma from "../../config/prisma.js";
import { asyncHandler, AppError } from "../../middlewares/error.middleware.js";
import { paginate } from "../../utils/pagination.js";
import { generarTicketPDF } from "../../services/ticket.service.js";

export const obtenerFacturas = asyncHandler(async (req, res) => {
  const { page, limit, q, desde, hasta, origen } = req.query;
  const where = {};
  if (desde || hasta) {
    where.createdAt = {};
    if (desde) where.createdAt.gte = new Date(desde);
    if (hasta) where.createdAt.lte = new Date(hasta);
  }
  if (origen) where.origen = origen;
  if (q) {
    where.OR = [
      { numero: { contains: q, mode: "insensitive" } },
      { ingreso: { cliente: { nombres: { contains: q, mode: "insensitive" } } } },
      { ingreso: { cliente: { apellidos: { contains: q, mode: "insensitive" } } } },
      { ingreso: { vehiculo: { placa: { contains: q, mode: "insensitive" } } } },
      { mensualidad: { cliente: { nombres: { contains: q, mode: "insensitive" } } } },
      { mensualidad: { cliente: { apellidos: { contains: q, mode: "insensitive" } } } },
      { mensualidad: { vehiculo: { placa: { contains: q, mode: "insensitive" } } } },
    ];
  }
  const { data: facturas, pagination } = await paginate(prisma, "factura", {
    page, limit, where,
    include: { ingreso: { include: { cliente: true, vehiculo: true, puesto: true } }, mensualidad: { include: { cliente: true, vehiculo: true } } },
    orderBy: { id: "desc" },
  });
  res.json({ ok: true, facturas, pagination });
});

export const obtenerFactura = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [factura, config] = await Promise.all([
    prisma.factura.findUnique({
      where: { id: Number(id) },
      include: { ingreso: { include: { cliente: true, vehiculo: true, puesto: true } }, mensualidad: { include: { cliente: true, vehiculo: true } } },
    }),
    prisma.configuracion.findFirst(),
  ]);
  if (!factura) throw new AppError("Factura no encontrada", 404);
  res.json({ ok: true, factura, config });
});

export const descargarFacturaPDF = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [factura, config] = await Promise.all([
    prisma.factura.findUnique({
      where: { id: Number(id) },
      include: { ingreso: { include: { cliente: true, vehiculo: true, puesto: true } }, mensualidad: { include: { cliente: true, vehiculo: true } } },
    }),
    prisma.configuracion.findFirst(),
  ]);
  if (!factura) throw new AppError("Factura no encontrada", 404);

  const ref = factura.origen === "MENSUALIDAD" ? factura.mensualidad : factura.ingreso;
  const cliente = ref?.cliente || {};
  const vehiculo = ref?.vehiculo || {};
  const entrada = ref?.fechaEntrada ? new Date(ref.fechaEntrada) : null;
  const salida = ref?.fechaSalida ? new Date(ref.fechaSalida) : null;
  const minutos = ref?.tiempoMinutos || (salida && entrada ? Math.ceil((salida - entrada) / 60000) : 0);
  const horas = Math.floor(minutos / 60);
  const dias = Math.floor(horas / 24);
  const tiempoStr = minutos > 0
    ? `${dias > 0 ? `${dias} día(s) ` : ""}${horas % 24 > 0 ? `${horas % 24} hora(s) ` : ""}${minutos % 60 > 0 ? `${minutos % 60} min` : ""}`
    : "";

  const pdf = await generarTicketPDF({
    titulo: "RECIBO DE PAGO",
    tipo: "salida",
    folio: factura.numero,
    placa: vehiculo.placa || "\u2014",
    cliente: `${cliente.nombres || ""} ${cliente.apellidos || ""}`.trim(),
    clienteDoc: cliente.documento || "",
    clienteTelefono: cliente.telefono || "",
    vehiculo: vehiculo.tipo
      ? `${vehiculo.marca ? `${vehiculo.marca} ${vehiculo.modelo || ""}`.trim() : vehiculo.tipo.charAt(0).toUpperCase() + vehiculo.tipo.slice(1)}`
      : vehiculo.marca
        ? `${vehiculo.marca} ${vehiculo.modelo || ""}`.trim()
        : "",
    vehiculoTipo: vehiculo.tipo || "",
    vehiculoMarca: vehiculo.marca || "",
    vehiculoModelo: vehiculo.modelo || "",
    ingreso: entrada ? entrada.toLocaleString("es-CO") : "",
    salida: salida ? salida.toLocaleString("es-CO") : "",
    tiempo: tiempoStr,
    total: factura.valor || 0,
    metodoPago: factura.metodoPago || "",
    puesto: ref?.puesto?.codigo || "",
    parqueadero: config?.nombreParqueadero || "Parqueadero",
    nit: config?.nit || "",
    direccion: config?.direccion || "",
    ciudad: config?.ciudad || "",
    telefono: config?.telefono || "",
    correo: config?.correo || "",
    pieFactura: config?.pieFactura || "",
    colorPrincipal: config?.colorPrincipal || "",
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=${factura.numero}.pdf`);
  res.send(pdf);
});

export const enviarWhatsapp = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [factura, config] = await Promise.all([
    prisma.factura.findUnique({
      where: { id: Number(id) },
      include: { ingreso: { include: { cliente: true, vehiculo: true } }, mensualidad: { include: { cliente: true, vehiculo: true } } },
    }),
    prisma.configuracion.findFirst(),
  ]);
  if (!factura) throw new AppError("Factura no encontrada", 404);

  const ref = factura.origen === "MENSUALIDAD" ? factura.mensualidad : factura.ingreso;
  const telefono = ref?.cliente?.telefono;
  if (!telefono) throw new AppError("Cliente sin teléfono", 400);

  const vehiculo = ref?.vehiculo || {};
  const entrada = ref?.fechaEntrada ? new Date(ref.fechaEntrada).toLocaleString("es-CO") : "";
  const salida = ref?.fechaSalida ? new Date(ref.fechaSalida).toLocaleString("es-CO") : "";
  const nombreParqueadero = config?.nombreParqueadero || "Parqueadero";
  const mensaje = [
    `*${nombreParqueadero}*`,
    "",
    `🧾 *Recibo de Pago*`,
    `No. ${factura.numero}`,
    `Fecha: ${new Date(factura.createdAt).toLocaleString("es-CO")}`,
    "",
    `👤 ${ref?.cliente?.nombres || ""} ${ref?.cliente?.apellidos || ""}`,
    `🚗 ${vehiculo.placa || ""} ${vehiculo.tipo ? `(${vehiculo.tipo})` : ""}`,
    entrada ? `📅 Entrada: ${entrada}` : "",
    salida ? `📅 Salida: ${salida}` : "",
    ref?.puesto?.codigo ? `🅿️ Puesto: ${ref.puesto.codigo}` : "",
    "",
    `💰 *Total: $${factura.valor.toLocaleString()}*`,
    `💳 ${factura.metodoPago || "Efectivo"}`,
    "",
    "_Este documento certifica el pago realizado._",
    "_¡Gracias por preferirnos!_",
  ].filter(Boolean).join("\n");
  const codigoPais = config?.whatsapp ? "" : "57";
  const url = config?.whatsapp
    ? `https://wa.me/${config.whatsapp}?text=${encodeURIComponent(mensaje)}`
    : `https://wa.me/${codigoPais}${telefono}?text=${encodeURIComponent(mensaje)}`;
  res.json({ ok: true, url });
});

export const reciboSalida = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const factura = await prisma.factura.findUnique({
    where: { id: Number(id) },
    include: { ingreso: { include: { vehiculo: { include: { cliente: true } }, puesto: true } } },
  });
  if (!factura) throw new AppError('Factura no encontrada', 404);

  const ing = factura.ingreso;
  const diffMs = ing?.fechaSalida
    ? new Date(ing.fechaSalida).getTime() - new Date(ing.fechaEntrada).getTime()
    : 0;
  const horas = Math.floor(diffMs / 3600000);
  const mins = Math.floor((diffMs % 3600000) / 60000);
  const tiempo = `${horas}h ${mins}min`;

  const config = await prisma.configuracion.findFirst();
  const pdf = await generarTicketPDF({
    titulo: 'FACTURA DE SALIDA',
    tipo: 'salida',
    folio: factura.numero,
    placa: ing?.vehiculo?.placa || '\u2014',
    cliente: [ing?.vehiculo?.cliente?.nombres, ing?.vehiculo?.cliente?.apellidos].filter(Boolean).join(' ') || '',
    vehiculo: `${ing?.vehiculo?.marca || ''} ${ing?.vehiculo?.modelo || ''}`.trim() || ing?.vehiculo?.tipo || '',
    ingreso: new Date(ing.fechaEntrada).toLocaleString('es-CO'),
    salida: ing?.fechaSalida ? new Date(ing.fechaSalida).toLocaleString('es-CO') : '',
    tiempo,
    total: factura.valor || 0,
    metodoPago: factura.metodoPago || '',
    puesto: ing?.puesto?.codigo || '',
    parqueadero: config?.nombreParqueadero || 'Parqueadero',
    nit: config?.nit || '',
    direccion: config?.direccion || '',
    ciudad: config?.ciudad || '',
    telefono: config?.telefono || '',
    correo: config?.correo || '',
    pieFactura: config?.pieFactura || '',
    colorPrincipal: config?.colorPrincipal || '',
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="recibo-${factura.numero}.pdf"`);
  res.send(pdf);
});
