import prisma from "../../config/prisma.js";
import { asyncHandler, AppError } from "../../middlewares/error.middleware.js";
import { paginate } from "../../utils/pagination.js";
import PDFDocument from "pdfkit";
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

  const doc = new PDFDocument({ margin: 40, size: "A4" });
  res.setHeader("Content-Disposition", `attachment; filename=${factura.numero}.pdf`);
  res.setHeader("Content-Type", "application/pdf");
  doc.pipe(res);

  const teal = "#0d9488";
  const slate = "#475569";
  const light = "#f1f5f9";

  doc.fontSize(18).font("Helvetica-Bold").fillColor(teal).text(config?.nombreParqueadero || "PARQUEADERO", { align: "center" });
  doc.fontSize(8).font("Helvetica").fillColor(slate);
  if (config?.nit) doc.text(`NIT: ${config.nit}`, { align: "center" });
  doc.text(`${config?.direccion || ""} ${config?.ciudad || ""}`.trim(), { align: "center" });
  if (config?.telefono) doc.text(`Tel: ${config.telefono}`, { align: "center" });
  doc.moveDown(0.5);

  doc.moveTo(40, doc.y).lineTo(552, doc.y).strokeColor("#e2e8f0").stroke();
  doc.moveDown(0.5);

  doc.fontSize(14).font("Helvetica-Bold").fillColor(teal).text("RECIBO DE PAGO", { align: "center" });
  doc.fontSize(8).font("Helvetica").fillColor(slate).text(`#${factura.numero}`, { align: "center" });
  doc.fontSize(8).fillColor("#94a3b8").text(new Date(factura.createdAt).toLocaleString("es-CO"), { align: "center" });
  doc.moveDown(0.5);

  doc.moveTo(40, doc.y).lineTo(552, doc.y).strokeColor("#e2e8f0").stroke();
  doc.moveDown(0.5);

  doc.fontSize(9).font("Helvetica-Bold").fillColor(slate).text("DATOS DEL CLIENTE", { underline: false });
  doc.moveDown(0.3);
  doc.fontSize(9).font("Helvetica").fillColor("#1e293b");
  doc.text(`${cliente.nombres || ""} ${cliente.apellidos || ""}`);
  if (cliente.documento) doc.fontSize(8).fillColor(slate).text(`Documento: ${cliente.documento}`);
  if (cliente.telefono) doc.fontSize(8).fillColor(slate).text(`Teléfono: ${cliente.telefono}`);
  doc.moveDown(0.5);

  doc.moveTo(40, doc.y).lineTo(552, doc.y).strokeColor("#e2e8f0").stroke();
  doc.moveDown(0.5);

  doc.fontSize(9).font("Helvetica-Bold").fillColor(slate).text("DETALLE DEL SERVICIO", { underline: false });
  doc.moveDown(0.3);

  const x1 = 40, x2 = 250, x3 = 552;
  const colW = x3 - x2;
  doc.fontSize(8.5).font("Helvetica").fillColor("#475569");

  const row = (label, value) => {
    doc.text(label, x1, doc.y, { width: x2 - x1 });
    doc.font("Helvetica-Bold").fillColor("#1e293b").text(String(value), x2, doc.y - doc.currentLineHeight(), { width: colW, align: "right" });
    doc.font("Helvetica").fillColor("#475569");
    doc.moveDown(0.4);
  };

  row("Vehículo", vehiculo.placa || "—");
  if (vehiculo.tipo) row("Tipo", vehiculo.tipo.charAt(0).toUpperCase() + vehiculo.tipo.slice(1));
  if (vehiculo.marca) row("Marca / Modelo", `${vehiculo.marca} ${vehiculo.modelo || ""}`);
  if (ref?.puesto?.codigo) row("Puesto", ref.puesto.codigo);

  if (factura.origen === "MENSUALIDAD") {
    if (ref?.fechaInicio) row("Vigencia desde", new Date(ref.fechaInicio).toLocaleDateString());
    if (ref?.fechaFin) row("Vigencia hasta", new Date(ref.fechaFin).toLocaleDateString());
  } else {
    if (entrada) row("Entrada", entrada.toLocaleString("es-CO"));
    if (salida) row("Salida", salida.toLocaleString("es-CO"));
    if (minutos > 0) {
      const tiempo = `${dias > 0 ? `${dias} día(s) ` : ""}${horas % 24 > 0 ? `${horas % 24} hora(s) ` : ""}${minutos % 60 > 0 ? `${minutos % 60} min` : ""}`;
      row("Tiempo", tiempo);
    }
  }

  doc.moveDown(0.3);
  doc.moveTo(40, doc.y).lineTo(552, doc.y).strokeColor("#e2e8f0").stroke();
  doc.moveDown(0.5);

  const pagoY = doc.y;
  doc.fontSize(9).font("Helvetica").fillColor(slate).text("Método de pago", x1, pagoY, { width: x2 - x1 });
  doc.font("Helvetica-Bold").fillColor("#1e293b").text((factura.metodoPago || "Efectivo").charAt(0).toUpperCase() + (factura.metodoPago || "Efectivo").slice(1), x2, pagoY, { width: colW, align: "right" });
  doc.moveDown(1.2);

  doc.moveTo(40, doc.y).lineTo(552, doc.y).strokeColor("#e2e8f0").stroke();
  doc.moveDown(0.3);

  doc.fontSize(16).font("Helvetica-Bold").fillColor(teal).text(`Total pagado: $${factura.valor.toLocaleString()}`, { align: "center" });
  doc.moveDown(1);

  doc.moveTo(40, doc.y).lineTo(552, doc.y).strokeColor("#e2e8f0").stroke();
  doc.moveDown(0.5);

  doc.fontSize(8).font("Helvetica-Oblique").fillColor("#94a3b8").text("Este documento certifica el pago realizado.", { align: "center" });
  doc.fontSize(8).fillColor("#94a3b8").text("Cualquier inquietud no dude en comunicarse con nosotros.", { align: "center" });
  doc.moveDown(0.3);
  doc.fontSize(9).font("Helvetica-Bold").fillColor(teal).text("¡Gracias por preferirnos!", { align: "center" });
  doc.fontSize(7).font("Helvetica-Oblique").fillColor("#cbd5e1").text("Su satisfacción es nuestra prioridad.", { align: "center" });

  doc.end();
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
    direccion: config?.direccion,
    telefono: config?.telefono,
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="recibo-${factura.numero}.pdf"`);
  res.send(pdf);
});
