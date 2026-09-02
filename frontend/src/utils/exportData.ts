import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";

function sanitizeCsvValue(val: string): string {
  if (/^[=+\-@\t\r]/.test(val)) {
    return `'${val}`;
  }
  return val;
}

export function exportToCsv(data: Array<Record<string, unknown>>, filename = "export.csv", columns?: Array<{ key: string; label: string } | string>) {
  if (!data || data.length === 0) return;
  const keys = columns || Object.keys(data[0]);
  const headers = keys.map((k) => (typeof k === "object" ? k.label : k));
  const csvRows = [headers.join(",")];
  for (const row of data) {
    const values = keys.map((k) => {
      const key = typeof k === "object" ? k.key : k;
      const val = String(row[key] ?? "");
      const sanitized = sanitizeCsvValue(val);
      return sanitized.includes(",") || sanitized.includes('"') || sanitized.includes("\n")
        ? `"${sanitized.replace(/"/g, '""')}"`
        : sanitized;
    });
    csvRows.push(values.join(","));
  }
  const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.replace(/\.\w+$/, "") + ".csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function exportToExcel(data: Array<Record<string, unknown>>, filename = "export.xlsx", columns?: Array<{ key: string; label: string } | string>) {
  if (!data || data.length === 0) return;
  const keys = columns || Object.keys(data[0]);
  const rows = data.map((row) => {
    const obj: Record<string, string> = {};
    keys.forEach((k) => {
      const key = typeof k === "object" ? k.key : k;
      const label = typeof k === "object" ? k.label : k;
      obj[label] = String(row[key] ?? "");
    });
    return obj;
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  const colWidths = keys.map((k) => {
    const label = typeof k === "object" ? k.label : k;
    const max = Math.max(
      label.length * 2,
      ...data.map((r) => {
        const key = typeof k === "object" ? k.key : k;
        return String(r[key] ?? "").length * 1.5;
      })
    );
    return { wch: Math.min(Math.max(max, 10), 40) };
  });
  ws["!cols"] = colWidths;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Datos");
  XLSX.writeFile(wb, filename.replace(/\.\w+$/, "") + ".xlsx");
}

export function exportToPdf(data: Array<Record<string, unknown>>, filename = "export.pdf", columns?: Array<{ key: string; label: string } | string>, title = "Reporte") {
  if (!data || data.length === 0) return;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const keys = columns || Object.keys(data[0]);
  const headers = keys.map((k) => (typeof k === "object" ? k.label : k));
  const rows = data.map((row) =>
    keys.map((k) => {
      const key = typeof k === "object" ? k.key : k;
      return String(row[key] ?? "");
    })
  );
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(title, pageWidth / 2, 15, { align: "center" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Generado: ${new Date().toLocaleString("es-CO")}`, pageWidth / 2, 22, { align: "center" });
  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 28,
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [13, 148, 136], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [241, 245, 249] },
    margin: { top: 28 },
    didDrawPage: (data) => {
      doc.setFontSize(6);
      doc.setFont("helvetica", "italic");
      doc.text(
        `Página ${doc.internal.getCurrentPageInfo().pageNumber}`,
        pageWidth - 10,
        doc.internal.pageSize.getHeight() - 5,
        { align: "right" }
      );
    },
  });
  doc.save(filename.replace(/\.\w+$/, "") + ".pdf");
}
