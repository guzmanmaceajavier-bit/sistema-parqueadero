import PDFDocument from 'pdfkit';

interface TicketData {
  titulo: string;
  tipo: 'entrada' | 'salida';
  folio: string;
  placa: string;
  cliente?: string;
  vehiculo?: string;
  ingreso: string;
  salida?: string;
  tiempo?: string;
  total?: number;
  metodoPago?: string;
  puesto?: string;
  parqueadero: string;
  direccion?: string;
  telefono?: string;
}

export function generarTicketPDF(data: TicketData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [80, 300], margin: 5 });
    const buffers: Buffer[] = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const font = 'Helvetica';
    const bold = 'Helvetica-Bold';

    doc.fontSize(10).font(bold).text(data.parqueadero, { align: 'center' });
    if (data.direccion) doc.fontSize(6).font(font).text(data.direccion, { align: 'center' });
    if (data.telefono) doc.fontSize(6).font(font).text(`Tel: ${data.telefono}`, { align: 'center' });
    doc.moveDown(0.3);

    doc.fontSize(8).text('\u2500'.repeat(18), { align: 'center' });
    doc.moveDown(0.3);

    doc.fontSize(9).font(bold).text(data.titulo, { align: 'center' });
    doc.moveDown(0.3);

    doc.fontSize(7).font(font);
    const lines = [
      `Folio: ${data.folio}`,
      `Placa: ${data.placa}`,
      `Veh\u00edculo: ${data.vehiculo || '\u2014'}`,
      `Cliente: ${data.cliente || '\u2014'}`,
      `Puesto: ${data.puesto || '\u2014'}`,
      `Ingreso: ${data.ingreso}`,
    ];
    if (data.tipo === 'salida') {
      if (data.salida) lines.push(`Salida: ${data.salida}`);
      if (data.tiempo) lines.push(`Tiempo: ${data.tiempo}`);
      lines.push('');
      lines.push(`Total: $${data.total?.toFixed(2) || '0.00'}`);
      if (data.metodoPago) lines.push(`Pago: ${data.metodoPago}`);
    }
    lines.forEach((l) => doc.text(l, { align: 'left' }));

    doc.moveDown(0.3);
    doc.fontSize(8).text('\u2500'.repeat(18), { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(6).font(font).text('Gracias por su preferencia', { align: 'center' });

    doc.end();
  });
}
