import { useEffect, useState } from "react";
import { Search, Download, MessageCircle, Eye, FileText, X, Truck } from "lucide-react";
import api from "../services/api";
import Pagination from "../components/Pagination";
import ExportButton from "../components/ExportButton";
import { formatCurrency, formatDate, formatDateTime } from "../utils/formatters";

function IconReceipt() {
  return <FileText className="w-4 h-4" />;
}

function IconSearch() {
  return <Search className="w-5 h-5 text-slate-400" />;
}

function IconDownload() {
  return <Download className="w-4 h-4" />;
}

function IconWhatsApp() {
  return <MessageCircle className="w-4 h-4" />;
}

function IconEye() {
  return <Eye className="w-4 h-4" />;
}

export default function Facturas() {
  const [facturas, setFacturas] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [facturaDetalle, setFacturaDetalle] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});

  const cargarFacturas = async (p = 1) => {
    try {
      const res = await api.get("/facturas", { params: { page: p } });
      setFacturas(res.data.facturas || []);
      setPagination(res.data.pagination || {});
    } catch {}
  };

  useEffect(() => { cargarFacturas(page); }, [page]);

  const filtrados = facturas.filter(f => {
    const r = f.origen === "MENSUALIDAD" ? f.mensualidad : f.ingreso;
    return `${f.numero} ${f.origen} ${r?.cliente?.nombres || ""} ${r?.cliente?.apellidos || ""} ${r?.vehiculo?.placa || ""}`
      .toLowerCase().includes(busqueda.toLowerCase());
  });

  const formatValor = (v) => formatCurrency(v);

  const descargarPDF = async (id) => {
    try {
      const res = await api.get(`/facturas/pdf/${id}`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `factura-${id}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) { console.log(error); }
  };

  const enviarWhatsApp = async (id) => {
    try {
      const res = await api.get(`/facturas/whatsapp/${id}`);
      if (res.data.url) window.open(res.data.url, "_blank");
    } catch (error) { console.log(error); }
  };

  const verDetalle = async (id) => {
    try {
      const res = await api.get(`/facturas/${id}`);
      setFacturaDetalle({ ...res.data.factura, _config: res.data.config || {} });
    } catch (error) { console.log(error); }
  };

  return (
    <div className="min-h-screen bg-page dark:bg-slate-900 p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">Facturas</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Historial de facturación generada automáticamente</p>
        </div>
        <ExportButton data={filtrados.map(f => { const r = f.origen === "MENSUALIDAD" ? f.mensualidad : f.ingreso; return { Factura: `#${f.numero}`, Origen: f.origen === "MENSUALIDAD" ? "Tarifa Fija" : "Ingreso", Cliente: `${r?.cliente?.nombres || ""} ${r?.cliente?.apellidos || ""}`.trim(), Placa: r?.vehiculo?.placa || "", Metodo: (f.metodoPago || "efectivo").charAt(0).toUpperCase() + (f.metodoPago || "efectivo").slice(1), Total: `$${(f.valor || 0).toLocaleString()}` }; })} filename="facturas" title="Facturas" columns={[{ key: 'Factura', label: 'Factura' }, { key: 'Origen', label: 'Origen' }, { key: 'Cliente', label: 'Cliente' }, { key: 'Placa', label: 'Placa' }, { key: 'Metodo', label: 'Método Pago' }, { key: 'Total', label: 'Total' }]} />
      </div>

      <div className="p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 dark:bg-slate-800 mb-5">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center"><IconSearch /></div>
          <input type="text" placeholder="Buscar por número, cliente o placa..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-slate-50 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400" />
        </div>
      </div>

      <div className="rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-800 dark:bg-slate-700">
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-300 uppercase">Factura</th>
                <th className="px-4 py-3.5 text-center text-xs font-semibold text-slate-300 uppercase">Origen</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-300 uppercase">Cliente</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-300 uppercase">Vehículo</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-slate-300 uppercase">Total</th>
                <th className="px-4 py-3.5 text-center text-xs font-semibold text-slate-300 uppercase">Método</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-slate-300 uppercase">Fecha</th>
                <th className="px-4 py-3.5 text-center text-xs font-semibold text-slate-300 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {filtrados.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-16 text-center"><p className="text-slate-400 dark:text-slate-500 text-sm">No hay facturas generadas</p></td></tr>
              ) : (
                filtrados.map((f) => {
                  const r = f.origen === "MENSUALIDAD" ? f.mensualidad : f.ingreso;
                  return (
                  <tr key={f.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3.5">
                      <span className="font-mono text-sm font-bold text-teal-700 dark:text-teal-400">{f.numero}</span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${f.origen === "MENSUALIDAD" ? "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400" : "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"}`}>
                        {f.origen === "MENSUALIDAD" ? "MENSUALIDAD" : "INGRESO"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-slate-800 dark:text-white">
                      {r?.cliente?.nombres || ""} {r?.cliente?.apellidos || ""}
                    </td>
                    <td className="px-4 py-3.5 text-sm font-mono text-slate-600 dark:text-slate-400">{r?.vehiculo?.placa || "—"}</td>
                    <td className="px-4 py-3.5 text-sm font-bold text-slate-800 dark:text-white text-right">{formatValor(f.valor)}</td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium capitalize ${f.metodoPago === "efectivo" ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400" : f.metodoPago === "tarjeta" ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400" : f.metodoPago === "transferencia" ? "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"}`}>
                        {f.metodoPago || "efectivo"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-slate-500 dark:text-slate-400 text-right">{new Date(f.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => verDetalle(f.id)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 rounded-lg" title="Ver detalle">
                          <IconEye /> Ver
                        </button>
                        <button onClick={() => descargarPDF(f.id)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-900/40 border border-teal-200 dark:border-teal-800 rounded-lg" title="Descargar PDF">
                          <IconDownload /> PDF
                        </button>
                        <button onClick={() => window.open(`/api/facturas/${f.id}/recibo`, '_blank')} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 rounded-lg" title="Ticket de salida">
                          Recibo
                        </button>
                        <button onClick={() => enviarWhatsApp(f.id)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800 rounded-lg" title="Enviar por WhatsApp">
                          <IconWhatsApp />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={pagination.page || 1} totalPages={pagination.totalPages || 1} total={pagination.total || 0} onPageChange={setPage} />
      </div>

      {facturaDetalle && (() => {
        const f = facturaDetalle;
        const cfg = f._config || {};
        const ref = f.origen === "MENSUALIDAD" ? f.mensualidad : f.ingreso;
        const cli = ref?.cliente || {};
        const veh = ref?.vehiculo || {};
        const entrada = ref?.fechaEntrada ? new Date(ref.fechaEntrada) : null;
        const salida = ref?.fechaSalida ? new Date(ref.fechaSalida) : null;
        const minutos = ref?.tiempoMinutos || (salida && entrada ? Math.ceil((salida - entrada) / 60000) : 0);
        const horas = Math.floor(minutos / 60);
        const dias = Math.floor(horas / 24);
        const restoHoras = horas % 24;
        const esNoche = entrada && (entrada.getHours() >= 18 || entrada.getHours() < 6);
        const esMes = f.origen === "MENSUALIDAD";
        return (
        <div className="fixed inset-0 z-50 flex justify-center items-start pt-6 pb-6 px-4 overflow-y-auto">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setFacturaDetalle(null)} />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-700 overflow-hidden animate-modal-in">
            <div className="absolute top-4 right-4 z-10">
              <button onClick={() => setFacturaDetalle(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-400"><X className="w-5 h-5" /></button>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6">
              <div className="text-center border-b border-dashed border-slate-200 dark:border-slate-700 pb-4 mb-4">
                <div className="w-16 h-16 rounded-2xl bg-teal-600 flex items-center justify-center mx-auto mb-3 shadow-lg">
                  <Truck className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">{cfg?.nombreParqueadero || "PARQUEADERO"}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">{cfg?.nit ? `NIT: ${cfg.nit}` : ""}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{`${cfg?.direccion || ""} ${cfg?.ciudad || ""}`.trim()}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{cfg?.telefono ? `Tel: ${cfg.telefono}` : ""}</p>
                {cfg?.horarioApertura && cfg?.horarioCierre ? (
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Horario: {cfg.horarioApertura} - {cfg.horarioCierre}</p>
                ) : null}
              </div>

              <div className="text-center mb-4">
                <h3 className="text-lg font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wider">Recibo de Pago</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-mono mt-0.5">#{f.numero}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">{formatDateTime(f.createdAt)}</p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4 mb-4 space-y-2">
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                  <span className="text-slate-400 dark:text-slate-500">Cliente</span>
                  <span className="font-medium text-slate-800 dark:text-white text-right">{cli.nombres || ""} {cli.apellidos || ""}</span>
                  {cli.documento && <><span className="text-slate-400 dark:text-slate-500">Documento</span><span className="text-slate-600 dark:text-slate-400 text-right">{cli.documento}</span></>}
                  {cli.telefono && <><span className="text-slate-400 dark:text-slate-500">Teléfono</span><span className="text-slate-600 dark:text-slate-400 text-right">{cli.telefono}</span></>}
                </div>
              </div>

              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden mb-4">
                <div className="bg-slate-800 dark:bg-slate-700 px-4 py-2">
                  <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">Detalle del Servicio</p>
                </div>
                <div className="p-4 space-y-2.5 text-sm">
                  <div className="grid grid-cols-2 gap-x-3">
                    <span className="text-slate-400 dark:text-slate-500">Vehículo</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-white text-right">{veh.placa || "—"}</span>
                  </div>
                  {veh.tipo && <div className="grid grid-cols-2 gap-x-3"><span className="text-slate-400 dark:text-slate-500">Tipo</span><span className="capitalize text-slate-700 dark:text-slate-300 text-right">{veh.tipo}</span></div>}
                  {veh.marca && <div className="grid grid-cols-2 gap-x-3"><span className="text-slate-400 dark:text-slate-500">Marca / Modelo</span><span className="text-slate-700 dark:text-slate-300 text-right">{veh.marca} {veh.modelo || ""}</span></div>}
                  {ref?.puesto?.codigo && <div className="grid grid-cols-2 gap-x-3"><span className="text-slate-400 dark:text-slate-500">Puesto</span><span className="font-mono font-semibold text-slate-700 dark:text-slate-300 text-right">{ref.puesto.codigo}</span></div>}
                  <div className="border-t border-dashed border-slate-200 dark:border-slate-700 pt-2.5" />
                  {entrada && <div className="grid grid-cols-2 gap-x-3"><span className="text-slate-400 dark:text-slate-500">Entrada</span><span className="text-slate-700 dark:text-slate-300 text-right">{formatDateTime(entrada)}</span></div>}
                  {salida && <div className="grid grid-cols-2 gap-x-3"><span className="text-slate-400 dark:text-slate-500">Salida</span><span className="text-slate-700 dark:text-slate-300 text-right">{formatDateTime(salida)}</span></div>}
                  {esMes && ref?.fechaInicio && <div className="grid grid-cols-2 gap-x-3"><span className="text-slate-400 dark:text-slate-500">Vigencia desde</span><span className="text-slate-700 dark:text-slate-300 text-right">{formatDate(ref.fechaInicio)}</span></div>}
                  {esMes && ref?.fechaFin && <div className="grid grid-cols-2 gap-x-3"><span className="text-slate-400 dark:text-slate-500">Vigencia hasta</span><span className="text-slate-700 dark:text-slate-300 text-right">{formatDate(ref.fechaFin)}</span></div>}
                  {!esMes && minutos > 0 && (
                    <div className="grid grid-cols-2 gap-x-3">
                      <span className="text-slate-400 dark:text-slate-500">Tiempo</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300 text-right">
                        {dias > 0 ? `${dias} día(s) ` : ""}{restoHoras > 0 ? `${restoHoras} hora(s) ` : ""}{minutos % 60 > 0 ? `${minutos % 60} min` : ""}
                        {esNoche ? " (nocturno)" : ""}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4 mb-4">
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm items-center">
                  <span className="text-slate-400 dark:text-slate-500">Método de pago</span>
                  <span className="font-medium capitalize text-slate-800 dark:text-white text-right">{f.metodoPago || "Efectivo"}</span>
                </div>
                {cfg.iva ? (
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm items-center mt-2">
                    <span className="text-slate-400 dark:text-slate-500">IVA</span>
                    <span className="font-medium text-slate-800 dark:text-white text-right">{cfg.iva}%</span>
                  </div>
                ) : null}
                <div className="border-t border-dashed border-slate-200 dark:border-slate-700 my-2" />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-400 dark:text-slate-500 uppercase tracking-wide font-medium">Total pagado</span>
                  <span className="text-2xl font-bold text-teal-700 dark:text-teal-400">{formatValor(f.valor)}</span>
                </div>
              </div>

              <div className="text-center text-xs text-slate-400 dark:text-slate-500 space-y-1 border-t border-dashed border-slate-200 dark:border-slate-700 pt-3">
                {cfg.pieFactura ? (
                  cfg.pieFactura.split("\n").map((line, i) => <p key={i}>{line}</p>)
                ) : (
                  <>
                    <p>Este documento certifica el pago realizado.</p>
                    <p>Cualquier inquietud no dude en comunicarse con nosotros.</p>
                    <p className="font-medium text-teal-600 dark:text-teal-400">¡Gracias por preferirnos!</p>
                    <p className="text-[10px] text-slate-300 dark:text-slate-500 italic">Su satisfacción es nuestra prioridad.</p>
                  </>
                )}
              </div>
            </div>

            <div className="flex gap-2 px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
              <button onClick={() => setFacturaDetalle(null)} className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-600">Cerrar</button>
              <button onClick={() => descargarPDF(f.id)} className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-teal-600 rounded-xl hover:bg-teal-700 inline-flex items-center justify-center gap-2">
                <Download className="w-4 h-4" />
                PDF
              </button>
              <button onClick={() => enviarWhatsApp(f.id)} className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 inline-flex items-center justify-center gap-2">
                <MessageCircle className="w-4 h-4" />
                WhatsApp
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      <style>{`
        @keyframes modal-in { from { opacity: 0; transform: translateY(16px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .animate-modal-in { animation: modal-in 0.25s ease-out; }
      `}</style>
    </div>
  );
}
