import PDFDocument from 'pdfkit';

interface TicketData {
  titulo: string;
  tipo: 'entrada' | 'salida';
  folio: string;
  placa: string;
  cliente?: string;
  clienteDoc?: string;
  clienteTelefono?: string;
  vehiculo?: string;
  vehiculoTipo?: string;
  vehiculoMarca?: string;
  vehiculoModelo?: string;
  ingreso: string;
  salida?: string;
  tiempo?: string;
  total?: number;
  iva?: number;
  metodoPago?: string;
  puesto?: string;
  parqueadero: string;
  nit?: string;
  direccion?: string;
  ciudad?: string;
  telefono?: string;
  correo?: string;
  pieFactura?: string;
  colorPrincipal?: string;
  logoBase64?: string;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

function lighten(hex: string, factor: number): string {
  const { r, g, b } = hexToRgb(hex);
  const lr = Math.round(r + (255 - r) * factor);
  const lg = Math.round(g + (255 - g) * factor);
  const lb = Math.round(b + (255 - b) * factor);
  return `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`;
}

function darken(hex: string, factor: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `#${Math.round(r * (1 - factor)).toString(16).padStart(2, '0')}${Math.round(g * (1 - factor)).toString(16).padStart(2, '0')}${Math.round(b * (1 - factor)).toString(16).padStart(2, '0')}`;
}

export function generarTicketPDF(data: TicketData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'letter', margin: 0 });
    const buffers: Buffer[] = [];
    doc.on('data', (c: Buffer) => buffers.push(c));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const W = doc.page.width;
    const M = 40;
    const cW = W - M * 2;
    let y = 0;

    const PRIMARY = data.colorPrincipal || '#0d9488';
    const PRIMARY_DARK = darken(PRIMARY, 0.2);
    const PRIMARY_LIGHT = lighten(PRIMARY, 0.9);
    const DARK = '#0f172a';
    const GRAY = '#64748b';
    const GRAY_L = '#94a3b8';
    const WHITE = '#ffffff';
    const BORDER = '#e2e8f0';
    const BG = '#f8fafc';

    // ═══════════════════════════════════════
    //  HEADER
    // ═══════════════════════════════════════
    // Accent bar top
    doc.rect(0, 0, W, 4).fill(PRIMARY);

    // Dark header
    doc.rect(0, 4, W, 70).fill(DARK);

    // Logo or initials
    if (data.logoBase64) {
      try {
        const imgData = Buffer.from(data.logoBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        doc.image(imgData, M, 16, { width: 40, height: 40, fit: 'contain' });
      } catch {
        doc.rect(M, 16, 40, 40).fill(PRIMARY);
        doc.font('Helvetica-Bold').fontSize(16).fillColor(WHITE)
          .text(data.parqueadero.charAt(0).toUpperCase(), M, 24, { width: 40, align: 'center' });
      }
    } else {
      doc.rect(M, 16, 40, 40).fill(PRIMARY);
      doc.font('Helvetica-Bold').fontSize(16).fillColor(WHITE)
        .text(data.parqueadero.charAt(0).toUpperCase(), M, 24, { width: 40, align: 'center' });
    }

    // Business name + details
    const textX = M + 52;
    doc.font('Helvetica-Bold').fontSize(18).fillColor(WHITE)
      .text(data.parqueadero.toUpperCase(), textX, 18, { width: 300 });
    doc.font('Helvetica').fontSize(8).fillColor(GRAY_L)
      .text('Sistema de Gestión de Parqueadero', textX, 38);

    const infoLines: string[] = [];
    if (data.nit) infoLines.push(`NIT: ${data.nit}`);
    const dir = [data.direccion, data.ciudad].filter(Boolean).join(', ');
    if (dir) infoLines.push(dir);
    if (data.telefono) infoLines.push(`Tel: ${data.telefono}`);
    if (data.correo) infoLines.push(data.correo);
    doc.font('Helvetica').fontSize(7).fillColor(GRAY_L)
      .text(infoLines.join('  ·  '), textX, 50, { width: 320 });

    // Document type badge
    const tipoLabel = data.tipo === 'entrada' ? 'TICKET DE ENTRADA' : 'FACTURA DE SALIDA';
    const badgeW = 155;
    const badgeX = W - M - badgeW;
    doc.roundedRect(badgeX, 16, badgeW, 44, 4).fill(PRIMARY);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(WHITE)
      .text(tipoLabel, badgeX + 10, 22, { width: badgeW - 20, align: 'center' });
    doc.font('Helvetica-Bold').fontSize(11).fillColor(WHITE)
      .text(`N° ${data.folio}`, badgeX + 10, 36, { width: badgeW - 20, align: 'center' });
    doc.font('Helvetica').fontSize(7).fillColor(lighten(PRIMARY, 0.5))
      .text(data.ingreso, badgeX + 10, 52, { width: badgeW - 20, align: 'center' });

    y = 84;

    // ═══════════════════════════════════════
    //  CLIENT DATA (if exists)
    // ═══════════════════════════════════════
    if (data.cliente) {
      doc.roundedRect(M, y, cW, 52, 4).fill(WHITE);
      doc.roundedRect(M, y, cW, 52, 4).lineWidth(0.5).stroke(BORDER);

      // Left accent bar
      doc.rect(M, y + 4, 3, 44).fill(PRIMARY);

      doc.font('Helvetica-Bold').fontSize(7).fillColor(PRIMARY)
        .text('CLIENTE', M + 14, y + 8);
      doc.font('Helvetica-Bold').fontSize(11).fillColor(DARK)
        .text(data.cliente, M + 14, y + 20);

      const clientInfo: string[] = [];
      if (data.clienteDoc) clientInfo.push(`Doc: ${data.clienteDoc}`);
      if (data.clienteTelefono) clientInfo.push(`Tel: ${data.clienteTelefono}`);
      if (clientInfo.length) {
        doc.font('Helvetica').fontSize(7).fillColor(GRAY)
          .text(clientInfo.join('  ·  '), M + 14, y + 36);
      }

      y += 64;
    }

    // ═══════════════════════════════════════
    //  DETALLE TABLE
    // ═══════════════════════════════════════
    doc.roundedRect(M, y, cW, 22, 4).fill(PRIMARY);
    // Fix rounded top corners
    doc.rect(M, y + 10, cW, 12).fill(PRIMARY);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(WHITE)
      .text('DETALLE DEL SERVICIO', M + 14, y + 7);

    y += 22;

    const rows: Array<{ label: string; value: string; bold?: boolean }> = [
      { label: 'Vehículo', value: data.placa || '—', bold: true },
    ];
    if (data.vehiculoTipo) rows.push({ label: 'Tipo', value: data.vehiculoTipo });
    if (data.vehiculoMarca || data.vehiculoModelo) {
      rows.push({ label: 'Marca / Modelo', value: `${data.vehiculoMarca || ''} ${data.vehiculoModelo || ''}`.trim() || data.vehiculo || '—' });
    }
    if (data.puesto) rows.push({ label: 'Puesto', value: data.puesto });
    rows.push({ label: 'Entrada', value: data.ingreso });
    if (data.salida) rows.push({ label: 'Salida', value: data.salida });
    if (data.tiempo) rows.push({ label: 'Tiempo', value: data.tiempo, bold: true });
    if (data.metodoPago) rows.push({ label: 'Método de pago', value: data.metodoPago.charAt(0).toUpperCase() + data.metodoPago.slice(1) });

    const rowH = 22;
    const tableH = rows.length * rowH + 6;

    doc.rect(M, y, cW, tableH).fill(WHITE);
    doc.rect(M, y, cW, tableH).lineWidth(0.5).stroke(BORDER);

    rows.forEach((row, i) => {
      const ry = y + 3 + i * rowH;

      if (i % 2 === 1) {
        doc.save();
        doc.rect(M + 1, ry - 1, cW - 2, rowH).fill(BG);
        doc.restore();
      }

      if (i > 0) {
        doc.save().moveTo(M + 14, ry - 1).lineTo(M + cW - 14, ry - 1).lineWidth(0.3).stroke(BORDER).restore();
      }

      // Dot
      doc.circle(M + 16, ry + 5, 2.5).fill(PRIMARY);

      doc.font('Helvetica').fontSize(8).fillColor(GRAY)
        .text(row.label, M + 26, ry + 1);

      doc.font(row.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).fillColor(DARK)
        .text(row.value, M + 180, ry + 1, { width: cW - 200, align: 'right' });
    });

    y += tableH + 14;

    // ═══════════════════════════════════════
    //  TOTAL
    // ═══════════════════════════════════════
    const tH = 60;
    doc.roundedRect(M, y, cW, tH, 4).fill(PRIMARY_LIGHT);
    doc.roundedRect(M, y, cW, tH, 4).lineWidth(0.5).stroke(PRIMARY);

    doc.rect(M, y + 4, 4, tH - 8).fill(PRIMARY);

    doc.font('Helvetica').fontSize(8).fillColor(GRAY)
      .text('TOTAL PAGADO', M + 16, y + 12);
    doc.font('Helvetica-Bold').fontSize(24).fillColor(DARK)
      .text(`$${(data.total || 0).toLocaleString()}`, M + 16, y + 24);

    if (data.iva && data.iva > 0) {
      const subtotal = (data.total || 0) / (1 + data.iva / 100);
      const ivaVal = (data.total || 0) - subtotal;
      doc.font('Helvetica').fontSize(7).fillColor(GRAY)
        .text(`Base: $${Math.round(subtotal).toLocaleString()}  |  IVA ${data.iva}%: $${Math.round(ivaVal).toLocaleString()}`, M + 16, y + 48);
    }

    // Payment badge
    if (data.tipo === 'salida') {
      const badgeW = 150;
      const badgeX = M + cW - badgeW - 14;
      doc.roundedRect(badgeX, y + 18, badgeW, 24, 12).fill(PRIMARY);
      doc.font('Helvetica-Bold').fontSize(7).fillColor(WHITE)
        .text('✓ Pago realizado con éxito', badgeX, y + 25, { width: badgeW, align: 'center' });
    }

    y += tH + 14;

    // ═══════════════════════════════════════
    //  CERTIFICATION + PIE DE FACTURA
    // ═══════════════════════════════════════
    doc.font('Helvetica').fontSize(7).fillColor(GRAY)
      .text('Este documento certifica el pago realizado.', M, y, { width: cW, align: 'center' });
    y += 12;
    doc.text('Cualquier inquietud no dude en comunicarse con nosotros.', M, y, { width: cW, align: 'center' });
    y += 16;

    // Separator
    const lineW = 60;
    doc.save().moveTo(M + cW / 2 - lineW / 2, y).lineTo(M + cW / 2 + lineW / 2, y).lineWidth(0.5).stroke(PRIMARY).restore();
    y += 10;

    doc.font('Helvetica-Bold').fontSize(10).fillColor(PRIMARY)
      .text('¡Gracias por preferirnos!', M, y, { width: cW, align: 'center' });
    y += 14;
    doc.font('Helvetica').fontSize(7).fillColor(GRAY)
      .text('Su satisfacción es nuestra prioridad.', M, y, { width: cW, align: 'center' });
    y += 16;

    // Pie de factura
    if (data.pieFactura) {
      doc.font('Helvetica').fontSize(6).fillColor(GRAY_L)
        .text(data.pieFactura, M, y, { width: cW, align: 'center' });
      y += 14;
    }

    // ═══════════════════════════════════════
    //  FOOTER
    // ═══════════════════════════════════════
    const fH = 32;
    doc.rect(0, y, W, fH).fill(DARK);

    const fy = y + 9;
    const colW = cW / 3;

    doc.font('Helvetica-Bold').fontSize(6).fillColor(WHITE)
      .text(data.parqueadero, M, fy, { width: colW });
    doc.font('Helvetica').fontSize(5).fillColor(GRAY_L)
      .text(dir || 'Servicio seguro y confiable', M, fy + 10, { width: colW });

    doc.font('Helvetica-Bold').fontSize(6).fillColor(WHITE)
      .text('Contacto', M + colW, fy, { width: colW, align: 'center' });
    doc.font('Helvetica').fontSize(5).fillColor(GRAY_L)
      .text(data.telefono || '—', M + colW, fy + 10, { width: colW, align: 'center' });

    doc.font('Helvetica-Bold').fontSize(6).fillColor(WHITE)
      .text('Correo', M + colW * 2, fy, { width: colW, align: 'right' });
    doc.font('Helvetica').fontSize(5).fillColor(GRAY_L)
      .text(data.correo || '—', M + colW * 2, fy + 10, { width: colW, align: 'right' });

    doc.end();
  });
}
