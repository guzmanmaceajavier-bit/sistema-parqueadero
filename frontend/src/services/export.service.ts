import * as XLSX from 'xlsx';

export function exportarExcel(data: Record<string, unknown>[], nombreArchivo: string, columnas?: string[]) {
  const datos = columnas ? data.map((d) => {
    const obj = {};
    columnas.forEach((c) => obj[c] = d[c]);
    return obj;
  }) : data;
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(datos);
  XLSX.utils.book_append_sheet(wb, ws, 'Datos');
  XLSX.writeFile(wb, `${nombreArchivo}.xlsx`);
}
