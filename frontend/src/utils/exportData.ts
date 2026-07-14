import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";

export function exportToCsv(data, filename = "export.csv", columns) {
  if (!data || data.length === 0) return;
  const keys = columns || Object.keys(data[0]);
  const headers = keys.map((k) => (typeof k === "object" ? k.label : k));
  const csvRows = [headers.join(",")];
  for (const row of data) {
    const values = keys.map((k) => {
      const key = typeof k === "object" ? k.key : k;
      const val = row[key]?.toString() || "";
      return val.includes(",") || val.includes('"') || val.includes("\n")
        ? `"${val.replace(/"/g, '""')}"`
        : val;
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

export function exportToExcel(data, filename = "export.xlsx", columns) {
  if (!data || data.length === 0) return;
  const keys = columns || Object.keys(data[0]);
  const rows = data.map((row) => {
    const obj = {};
    keys.forEach((k) => {
      const key = typeof k === "object" ? k.key : k;
      const label = typeof k === "object" ? k.label : k;
      obj[label] = row[key]?.toString() || "";
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
        return (r[key]?.toString() || "").length * 1.5;
      })
    );
    return { wch: Math.min(Math.max(max, 10), 40) };
  });
  ws["!cols"] = colWidths;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Datos");
  XLSX.writeFile(wb, filename.replace(/\.\w+$/, "") + ".xlsx");
}

export function exportToPdf(data, filename = "export.pdf", columns, title = "Reporte") {
  if (!data || data.length === 0) return;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const keys = columns || Object.keys(data[0]);
  const headers = keys.map((k) => (typeof k === "object" ? k.label : k));
  const rows = data.map((row) =>
    keys.map((k) => {
      const key = typeof k === "object" ? k.key : k;
      return row[key]?.toString() || "";
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
