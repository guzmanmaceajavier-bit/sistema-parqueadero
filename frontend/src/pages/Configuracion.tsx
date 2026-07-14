import { useEffect, useState, useCallback } from "react";
import api from "../services/api";
import Toast from "../components/Toast";
import Select from "../components/ui/Select";
import { useConfig } from "../context/ConfigContext";
import { syncFormatterConfig } from "../utils/formatters";

const inputClass = "w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all duration-200 bg-white dark:bg-slate-700";
const labelClass = "block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5";

export default function Configuracion() {
  const { recargarConfig } = useConfig();
  const [form, setForm] = useState({
    nombreParqueadero: "", nit: "", direccion: "", ciudad: "", telefono: "", whatsapp: "", correo: "", logo: "", fondoLogin: "",
    colorFondoLogin: "#f0fdf4", colorPrincipal: "#0d9488", colorSecundario: "#14b8a6", colorFondo: "#f8fafc", modoOscuro: false, tamanoFuente: "medium",
    formatoFecha: "DD/MM/YYYY", formatoHora: "24h", formatoMoneda: "COP", zonaHoraria: "America/Bogota", monedaSimbolo: "$", idioma: "es",
    notificarWhatsappIngreso: false, notificarWhatsappSalida: false, notificarWhatsappReserva: false, notificarWhatsappVencimiento: false, notificarEmail: false,
    mensajeWhatsappIngreso: "", mensajeWhatsappSalida: "", mensajeWhatsappFactura: "", mensajeWhatsappReserva: "", mensajeWhatsappRecordatorio: "", mensajeWhatsappVencida: "", mensajeWhatsappBienvenida: "",
    horarioApertura: "06:00", horarioCierre: "22:00", paginacionPorDefecto: 15, iva: 0, minutosGracia: 0,
    pieFactura: "", metodosPago: "efectivo,tarjeta,transferencia", intentosMaximos: 10,
  });
  const [cargando, setCargando] = useState(false);
  const [toast, setToast] = useState({ mensaje: "", tipo: "" });
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [subiendoFondo, setSubiendoFondo] = useState(false);
  const [tab, setTab] = useState("info");
  const [modificado, setModificado] = useState(false);

  const mostrarToast = useCallback((mensaje, tipo = "success") => setToast({ mensaje, tipo }), []);

  const cargarConfig = async () => {
    try {
      const res = await api.get("/configuracion");
      if (res.data.configuracion) {
        setForm(prev => {
          const data = {};
          for (const [key, val] of Object.entries(res.data.configuracion)) {
            if (val !== null && val !== undefined) data[key] = val;
          }
          return { ...prev, ...data };
        });
      }
    } catch { }
  };

  useEffect(() => { cargarConfig(); }, []);

  const CAMPOS_NUMERICOS = ["paginacionPorDefecto", "iva", "intentosMaximos"];

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let val = type === "checkbox" ? checked : value;
    if (CAMPOS_NUMERICOS.includes(name)) val = Number(val);
    setForm(prev => ({ ...prev, [name]: val }));
    setModificado(true);
  };

  const guardarConfig = async () => {
    setCargando(true);
    try {
      const payload = { ...form };
      payload.paginacionPorDefecto = Number(payload.paginacionPorDefecto);
      payload.iva = Number(payload.iva);
      payload.intentosMaximos = Number(payload.intentosMaximos);
      await api.post("/configuracion", payload);
      syncFormatterConfig(payload);
      recargarConfig();
      setModificado(false);
      mostrarToast("Configuración guardada correctamente", "success");
    } catch (e) {
      const msg = e.response?.data?.error || e.response?.data?.message || "Error al guardar configuración";
      mostrarToast(msg, "error");
    } finally {
      setCargando(false);
    }
  };

  const handleUploadLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubiendoLogo(true);
    try {
      const fd = new FormData();
      fd.append("logo", file);
      const res = await api.post("/configuracion/upload-logo", fd);
      setForm(prev => ({ ...prev, logo: res.data.logo }));
      setModificado(true);
      mostrarToast("Logo subido correctamente", "success");
    } catch {
      mostrarToast("Error al subir logo", "error");
    } finally {
      setSubiendoLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    try {
      await api.delete("/configuracion/logo");
      setForm(prev => ({ ...prev, logo: "" }));
      setModificado(true);
      mostrarToast("Logo eliminado", "success");
    } catch {
      mostrarToast("Error al eliminar logo", "error");
    }
  };

  const handleUploadFondo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubiendoFondo(true);
    try {
      const fd = new FormData();
      fd.append("fondo", file);
      const res = await api.post("/configuracion/upload-fondo", fd);
      setForm(prev => ({ ...prev, fondoLogin: res.data.fondoLogin }));
      setModificado(true);
      mostrarToast("Fondo de login subido correctamente", "success");
    } catch (err) {
      const msg = err.response?.data?.message || "Error al subir fondo de login";
      mostrarToast(msg, "error");
    } finally {
      setSubiendoFondo(false);
    }
  };

  const handleRemoveFondo = async () => {
    try {
      await api.delete("/configuracion/fondo");
      setForm(prev => ({ ...prev, fondoLogin: "" }));
      setModificado(true);
      mostrarToast("Fondo de login eliminado", "success");
    } catch {
      mostrarToast("Error al eliminar fondo de login", "error");
    }
  };

  const tabs = [
    { id: "info", label: "Información", icon: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" },
    { id: "logo", label: "Logo", icon: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" },
    { id: "fondoLogin", label: "Fondo Login", icon: "M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" },
    { id: "apariencia", label: "Apariencia", icon: "M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" },
    { id: "formato", label: "Formato Regional", icon: "M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0A1.5 1.5 0 003 14.5v-4a1.5 1.5 0 011-.5h18a1.5 1.5 0 011.5 1.5v3.546z" },
    { id: "metodosPago", label: "Métodos de Pago", icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" },
    { id: "factura", label: "Factura", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
    { id: "notificaciones", label: "Notificaciones", icon: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" },
    { id: "mensajes", label: "Mensajes WhatsApp", icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" },
    { id: "operativa", label: "Operativa", icon: "M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" },
    { id: "seguridad", label: "Seguridad", icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" },
  ];

  const PLANTILLAS_PREDETERMINADAS = {
    mensajeWhatsappBienvenida: "¡Hola {{cliente}}! Bienvenido a {{parqueadero}}. Tu vehículo {{placa}} ha sido registrado. Puesto: {{puesto}}.",
    mensajeWhatsappIngreso: "Hola {{cliente}}, tu ingreso a {{parqueadero}} ha sido registrado. Vehículo: {{placa}}. Puesto: {{puesto}}. Fecha: {{fecha}}.",
    mensajeWhatsappSalida: "Hola {{cliente}}, tu vehículo {{placa}} ha salido de {{parqueadero}}. Total pagado: {{total}}. ¡Gracias por preferirnos!",
    mensajeWhatsappFactura: "{{parqueadero}}\n\n🧾 Recibo de Pago No. {{factura}}\nFecha: {{fecha}}\n\nCliente: {{cliente}}\nVehículo: {{placa}}\nTotal: {{total}}\nMétodo: {{metodo}}\n\n¡Gracias por preferirnos!",
    mensajeWhatsappReserva: "Hola {{cliente}}, tu reserva en {{parqueadero}} ha sido {{estado}}. Vehículo: {{placa}}. Puesto: {{puesto}}. Inicio: {{inicio}}. Fin: {{fin}}.",
    mensajeWhatsappRecordatorio: "Recordatorio: Hola {{cliente}}, tu {{tipo}} en {{parqueadero}} está próxima a vencer. Por favor acércate a renovar.",
    mensajeWhatsappVencida: "Hola {{cliente}}, te recordamos que tu {{tipo}} de ${{total}} para el vehículo {{placa}} está vencida. Por favor acércate a pagar para evitar inconvenientes.",
  };

  const setPlantilla = (campo) => {
    setForm(prev => ({ ...prev, [campo]: PLANTILLAS_PREDETERMINADAS[campo] || prev[campo] }));
    setModificado(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-slate-800 dark:text-white tracking-tight">Configuración</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Personaliza todos los aspectos del sistema</p>
          </div>
          <div className="flex items-center gap-3">
            {modificado && (
              <span className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Cambios sin guardar
              </span>
            )}
            <button onClick={guardarConfig} disabled={cargando}
              className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-xl font-medium text-sm shadow-lg shadow-teal-600/20 disabled:opacity-50 active:scale-[0.98] transition-all">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              {cargando ? "Guardando..." : "Guardar Cambios"}
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          <nav className="lg:w-56 shrink-0">
            <div className="flex lg:flex-col gap-1 overflow-x-auto pb-1 lg:pb-0 lg:sticky lg:top-8">
              {tabs.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium rounded-xl whitespace-nowrap transition-all ${
                    tab === t.id
                      ? "bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-sm border border-slate-200 dark:border-slate-700"
                      : "text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}>
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={t.icon} />
                  </svg>
                  <span className="truncate">{t.label}</span>
                </button>
              ))}
            </div>
          </nav>

          <div className="flex-1 min-w-0">
            {tab === "info" && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 lg:p-8">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">Información del Parqueadero</h2>
                <p className="text-sm text-slate-400 dark:text-slate-500 mb-6">Datos que aparecerán en facturas, recibos y reportes</p>
                <div className="space-y-5">
                  <div>
                    <label className={labelClass}>Nombre del parqueadero</label>
                    <input name="nombreParqueadero" value={form.nombreParqueadero} onChange={handleChange} className={inputClass} placeholder="Ej: ParkAdmin Pro" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><label className={labelClass}>NIT</label><input name="nit" value={form.nit} onChange={handleChange} className={inputClass} placeholder="123456789-0" /></div>
                    <div><label className={labelClass}>Teléfono</label><input name="telefono" value={form.telefono} onChange={handleChange} className={inputClass} placeholder="+57 300 000 0000" /></div>
                  </div>
                  <div><label className={labelClass}>Dirección</label><input name="direccion" value={form.direccion} onChange={handleChange} className={inputClass} placeholder="Calle 123 # 45-67" /></div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><label className={labelClass}>Ciudad</label><input name="ciudad" value={form.ciudad} onChange={handleChange} className={inputClass} placeholder="Bogotá" /></div>
                    <div><label className={labelClass}>Correo electrónico</label><input name="correo" type="email" value={form.correo} onChange={handleChange} className={inputClass} placeholder="info@parqueadero.com" /></div>
                  </div>
                  <div><label className={labelClass}>WhatsApp (sin +)</label><input name="whatsapp" value={form.whatsapp} onChange={handleChange} className={inputClass} placeholder="573000000000" /></div>
                </div>
              </div>
            )}

            {tab === "logo" && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 lg:p-8">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">Logo del Parqueadero</h2>
                <p className="text-sm text-slate-400 dark:text-slate-500 mb-6">Sube el logo que aparecerá en facturas y recibos (jpg, png, gif, webp, svg — máx 5MB)</p>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                  <div className="w-36 h-36 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-600 flex items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-700 shrink-0">
                    {form.logo ? (
                      <img src={form.logo} alt="Logo" className="w-full h-full object-contain p-3" />
                    ) : (
                      <svg className="w-14 h-14 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    )}
                  </div>
                  <div className="space-y-3">
                    <label className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium cursor-pointer shadow-md shadow-teal-600/20 transition-all active:scale-[0.98]">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      {subiendoLogo ? "Subiendo..." : "Subir Logo"}
                      <input type="file" accept="image/*" onChange={handleUploadLogo} className="hidden" disabled={subiendoLogo} />
                    </label>
                    {form.logo && (
                      <button onClick={handleRemoveLogo} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all active:scale-[0.98]">
                        Eliminar Logo
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {tab === "fondoLogin" && (
              <div className="space-y-5">
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 lg:p-8">
                  <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">Color de Fondo</h2>
                  <p className="text-sm text-slate-400 dark:text-slate-500 mb-5">Elige un color sólido para el fondo de la pantalla de inicio de sesión</p>
                  <div className="flex items-center gap-3">
                    <input type="color" name="colorFondoLogin" value={form.colorFondoLogin} onChange={handleChange} className="w-11 h-11 rounded-xl border border-slate-200 dark:border-slate-600 cursor-pointer" />
                    <span className="text-sm text-slate-600 dark:text-slate-300 font-mono">{form.colorFondoLogin}</span>
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 lg:p-8">
                  <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">Imagen de Fondo</h2>
                  <p className="text-sm text-slate-400 dark:text-slate-500 mb-5">Opcional. Si subes una imagen, reemplazará el color sólido (jpg, png, webp — máx 10MB)</p>
                  <div className="w-full h-48 lg:h-56 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-600 flex items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-700 mb-5">
                    {form.fondoLogin ? (
                      <img src={form.fondoLogin} alt="Fondo login" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center text-slate-300 dark:text-slate-500">
                        <svg className="w-14 h-14 mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                        <p className="text-sm">Sin imagen de fondo</p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium cursor-pointer shadow-md shadow-teal-600/20 transition-all active:scale-[0.98]">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      {subiendoFondo ? "Subiendo..." : "Subir Imagen"}
                      <input type="file" accept="image/*" onChange={handleUploadFondo} className="hidden" disabled={subiendoFondo} />
                    </label>
                    {form.fondoLogin && (
                      <button onClick={handleRemoveFondo} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all active:scale-[0.98]">
                        Eliminar Imagen
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {tab === "apariencia" && (
              <div className="space-y-5">
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 lg:p-8">
                  <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">Colores del Sistema</h2>
                  <p className="text-sm text-slate-400 dark:text-slate-500 mb-5">Personaliza la paleta de colores del sistema</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    {[
                      { label: "Color principal", name: "colorPrincipal" },
                      { label: "Color secundario", name: "colorSecundario" },
                      { label: "Color de fondo", name: "colorFondo" },
                    ].map(c => (
                      <div key={c.name}>
                        <label className={labelClass}>{c.label}</label>
                        <div className="flex items-center gap-3">
                          <input type="color" name={c.name} value={form[c.name]} onChange={handleChange} className="w-11 h-11 rounded-xl border border-slate-200 dark:border-slate-600 cursor-pointer" />
                          <span className="text-sm text-slate-600 dark:text-slate-300 font-mono">{form[c.name]}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 lg:p-8">
                  <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">Modo Oscuro</h2>
                  <p className="text-sm text-slate-400 dark:text-slate-500 mb-5">Cambia entre tema claro y oscuro</p>
                  <label className="inline-flex items-center gap-3 cursor-pointer">
                    <div className={`relative w-10 h-5 rounded-full transition-colors ${form.modoOscuro ? "bg-teal-500" : "bg-slate-300 dark:bg-slate-600"}`}>
                      <div className={`absolute w-4 h-4 bg-white rounded-full top-0.5 transition-transform shadow-sm ${form.modoOscuro ? "translate-x-5" : "translate-x-0.5"}`} />
                    </div>
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      {form.modoOscuro ? "Modo oscuro activado" : "Activar modo oscuro"}
                    </span>
                    <input type="checkbox" name="modoOscuro" checked={form.modoOscuro} onChange={handleChange} className="hidden" />
                  </label>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 lg:p-8">
                  <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">Tamaño de Fuente</h2>
                  <p className="text-sm text-slate-400 dark:text-slate-500 mb-5">Ajusta el tamaño del texto en el sistema</p>
                  <div className="flex gap-2">
                    {["small", "medium", "large"].map(s => (
                      <button key={s} onClick={() => { setForm(prev => ({ ...prev, tamanoFuente: s })); setModificado(true); }}
                        className={`px-6 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                          form.tamanoFuente === s
                            ? "bg-teal-600 text-white border-teal-600 shadow-md"
                            : "bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600"
                        }`}>
                        {s === "small" ? "Pequeño" : s === "medium" ? "Mediano" : "Grande"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 lg:p-8">
                  <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">Vista Previa</h2>
                  <p className="text-sm text-slate-400 dark:text-slate-500 mb-5">Así se verá tu parqueadero en el sistema</p>
                  <div className="p-6 rounded-2xl border-2 transition-all" style={{ backgroundColor: form.colorFondo, borderColor: form.colorSecundario + "40" }}>
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg" style={{ backgroundColor: form.colorPrincipal }}>
                        {form.logo ? <img src={form.logo} alt="" className="w-full h-full object-contain p-1.5" /> : "P"}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 dark:text-white" style={{ fontSize: form.tamanoFuente === "small" ? "1rem" : form.tamanoFuente === "large" ? "1.5rem" : "1.25rem" }}>{form.nombreParqueadero || "Nombre del Parqueadero"}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{`${form.ciudad || "Ciudad"} • ${form.telefono || "Teléfono"}`}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === "formato" && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 lg:p-8">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">Formato Regional</h2>
                <p className="text-sm text-slate-400 dark:text-slate-500 mb-6">Configura cómo se muestran fechas, horas y moneda en todo el sistema</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className={labelClass}>Formato de fecha</label>
                    <Select value={form.formatoFecha} onChange={(val) => handleChange({ target: { name: "formatoFecha", value: val } })} options={[
                      { value: "DD/MM/YYYY", label: "DD/MM/YYYY (31/12/2025)" },
                      { value: "MM/DD/YYYY", label: "MM/DD/YYYY (12/31/2025)" },
                      { value: "YYYY-MM-DD", label: "YYYY-MM-DD (2025-12-31)" },
                    ]} />
                  </div>
                  <div>
                    <label className={labelClass}>Formato de hora</label>
                    <Select value={form.formatoHora} onChange={(val) => handleChange({ target: { name: "formatoHora", value: val } })} options={[
                      { value: "24h", label: "24 horas (14:30)" },
                      { value: "12h", label: "12 horas (02:30 PM)" },
                    ]} />
                  </div>
                  <div>
                    <label className={labelClass}>Moneda</label>
                    <Select value={form.formatoMoneda} onChange={(val) => handleChange({ target: { name: "formatoMoneda", value: val } })} options={[
                      { value: "COP", label: "COP — Peso colombiano ($)" },
                      { value: "USD", label: "USD — Dólar estadounidense ($)" },
                      { value: "EUR", label: "EUR — Euro (€)" },
                      { value: "MXN", label: "MXN — Peso mexicano ($)" },
                    ]} />
                  </div>
                  <div>
                    <label className={labelClass}>Símbolo moneda</label>
                    <input name="monedaSimbolo" value={form.monedaSimbolo} onChange={handleChange} className={inputClass} placeholder="$" maxLength={5} />
                  </div>
                  <div>
                    <label className={labelClass}>Zona horaria</label>
                    <Select value={form.zonaHoraria} onChange={(val) => handleChange({ target: { name: "zonaHoraria", value: val } })} options={[
                      { value: "America/Bogota", label: "America/Bogotá (UTC-5)" },
                      { value: "America/Mexico_City", label: "America/Ciudad de México (UTC-6)" },
                      { value: "America/Argentina/Buenos_Aires", label: "America/Buenos Aires (UTC-3)" },
                      { value: "America/Santiago", label: "America/Santiago (UTC-4)" },
                      { value: "America/Lima", label: "America/Lima (UTC-5)" },
                      { value: "America/Caracas", label: "America/Caracas (UTC-4)" },
                      { value: "America/Panama", label: "America/Panamá (UTC-5)" },
                      { value: "America/New_York", label: "America/New York (UTC-5)" },
                      { value: "Europe/Madrid", label: "Europe/Madrid (UTC+1)" },
                    ]} />
                  </div>
                  <div>
                    <label className={labelClass}>Idioma</label>
                    <Select value={form.idioma} onChange={(val) => handleChange({ target: { name: "idioma", value: val } })} options={[
                      { value: "es", label: "Español" },
                      { value: "en", label: "English" },
                      { value: "pt", label: "Português" },
                    ]} />
                  </div>
                </div>
              </div>
            )}

            {tab === "metodosPago" && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 lg:p-8">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">Métodos de Pago</h2>
                <p className="text-sm text-slate-400 dark:text-slate-500 mb-6">Activa o desactiva los métodos de pago disponibles en el sistema</p>
                <div className="space-y-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Selecciona los métodos de pago que estarán disponibles al registrar ingresos y facturas:</p>
                  {[
                    { key: "efectivo", label: "Efectivo", desc: "Pago en efectivo al momento de la salida", icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" },
                    { key: "tarjeta", label: "Tarjeta", desc: "Pago con tarjeta débito o crédito", icon: "M3 10h18M7 15h1m4 0h1" },
                    { key: "transferencia", label: "Transferencia", desc: "Pago por transferencia bancaria o Nequi", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
                  ].map(m => {
                    const activos = (form.metodosPago || "").split(",").filter(Boolean);
                    const activo = activos.includes(m.key);
                    const toggle = () => {
                      const nuevos = activo ? activos.filter(x => x !== m.key) : [...activos, m.key];
                      setForm(prev => ({ ...prev, metodosPago: nuevos.join(",") }));
                      setModificado(true);
                    };
                    return (
                      <label key={m.key} className={`flex items-start gap-4 p-5 rounded-xl border-2 cursor-pointer transition-all ${
                        activo ? "border-teal-500 dark:border-teal-400 bg-teal-50/50 dark:bg-teal-900/10" : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                      }`}>
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                          activo ? "bg-teal-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-400"
                        }`}>
                          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={m.icon} /></svg>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-slate-800 dark:text-white">{m.label}</p>
                            <div className={`relative w-9 h-5 rounded-full transition-colors ${activo ? "bg-teal-500" : "bg-slate-300 dark:bg-slate-600"}`}>
                              <div className={`absolute w-3.5 h-3.5 bg-white rounded-full top-0.75 transition-transform shadow-sm ${activo ? "translate-x-5" : "translate-x-0.5"}`} />
                            </div>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{m.desc}</p>
                        </div>
                        <input type="checkbox" checked={activo} onChange={toggle} className="hidden" />
                      </label>
                    );
                  })}
                </div>
                <div className="mt-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-700">
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">Métodos activos actualmente:</p>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {(form.metodosPago || "").split(",").filter(Boolean).length > 0
                      ? (form.metodosPago || "").split(",").filter(Boolean).map(m => ({ efectivo: "Efectivo", tarjeta: "Tarjeta", transferencia: "Transferencia" }[m] || m)).join(", ")
                      : "Ninguno"}
                  </p>
                </div>
              </div>
            )}

            {tab === "factura" && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 lg:p-8">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">Personalización de Factura</h2>
                <p className="text-sm text-slate-400 dark:text-slate-500 mb-6">Configura la información que aparecerá en los recibos y facturas del sistema</p>
                <div className="space-y-5">
                  <div>
                    <label className={labelClass}>Pie de factura</label>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">Texto personalizado que aparecerá al final de cada recibo. Puedes incluir información como horarios, políticas, agradecimientos, etc.</p>
                    <textarea name="pieFactura" value={form.pieFactura} onChange={handleChange} rows={4}
                      className={inputClass + " resize-y"} placeholder='Ej: Gracias por preferirnos. Horario: Lun-Sáb 6am-10pm. Parqueadero no se responsabiliza por objetos dejados dentro del vehículo.' />
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-700">
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-2">Vista previa del pie de factura:</p>
                    <div className="text-center text-xs text-slate-400 dark:text-slate-500 space-y-1 border-t border-dashed border-slate-200 dark:border-slate-700 pt-3">
                      {form.pieFactura ? (
                        form.pieFactura.split("\n").map((line, i) => <p key={i}>{line}</p>)
                      ) : (
                        <>
                          <p>Este documento certifica el pago realizado.</p>
                          <p>¡Gracias por preferirnos!</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === "notificaciones" && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 lg:p-8">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">Notificaciones Automáticas</h2>
                <p className="text-sm text-slate-400 dark:text-slate-500 mb-6">Activa o desactiva el envío automático de mensajes a clientes</p>
                <div className="space-y-3">
                  {[
                    { key: "notificarWhatsappIngreso", label: "Notificar por WhatsApp al registrar ingreso", desc: "Se envía automáticamente cuando un vehículo ingresa" },
                    { key: "notificarWhatsappSalida", label: "Notificar por WhatsApp al registrar salida", desc: "Se envía automáticamente cuando un vehículo sale" },
                    { key: "notificarWhatsappReserva", label: "Notificar por WhatsApp al crear reserva", desc: "Se envía automáticamente cuando se crea una reserva" },
                    { key: "notificarWhatsappVencimiento", label: "Notificar vencimiento de suscripción", desc: "Recordatorio automático cuando una suscripción está por vencer" },
                    { key: "notificarEmail", label: "Activar notificaciones por correo", desc: "Envía copias de facturas y reportes por email" },
                  ].map(n => (
                    <label key={n.key} className="flex items-start gap-3 p-4 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:hover:border-slate-600 transition-colors cursor-pointer">
                      <input type="checkbox" name={n.key} checked={form[n.key]} onChange={handleChange} className="mt-0.5 w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
                      <div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{n.label}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{n.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {tab === "mensajes" && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 lg:p-8">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">Plantillas de Mensajes WhatsApp</h2>
                <p className="text-sm text-slate-400 dark:text-slate-500 mb-5">Personaliza los mensajes que se envían automáticamente a los clientes</p>
                <div className="flex flex-wrap gap-1.5 mb-6 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-600">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium mr-1">Variables:</span>
                  {["{{cliente}}", "{{placa}}", "{{parqueadero}}", "{{puesto}}", "{{fecha}}", "{{total}}", "{{factura}}", "{{metodo}}", "{{inicio}}", "{{fin}}", "{{estado}}", "{{tipo}}"].map(v => (
                    <code key={v} className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded text-xs font-mono text-teal-700 dark:text-teal-300">{v}</code>
                  ))}
                </div>
                <div className="space-y-5">
                  {[
                    { key: "mensajeWhatsappBienvenida", label: "Bienvenida / Registro" },
                    { key: "mensajeWhatsappIngreso", label: "Notificación de Ingreso" },
                    { key: "mensajeWhatsappSalida", label: "Notificación de Salida / Pago" },
                    { key: "mensajeWhatsappFactura", label: "Factura / Recibo de Pago" },
                    { key: "mensajeWhatsappReserva", label: "Confirmación de Reserva" },
                    { key: "mensajeWhatsappRecordatorio", label: "Recordatorio de Vencimiento" },
                    { key: "mensajeWhatsappVencida", label: "Aviso de Suscripción Vencida" },
                  ].map(p => (
                    <div key={p.key}>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className={labelClass + " mb-0"}>{p.label}</label>
                        <button type="button" onClick={() => setPlantilla(p.key)} className="text-xs text-teal-600 dark:text-teal-400 hover:text-teal-700 font-medium">Restaurar predeterminado</button>
                      </div>
                      <textarea name={p.key} value={form[p.key]} onChange={handleChange} className={inputClass + " resize-y font-mono text-xs"} rows={3} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === "operativa" && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 lg:p-8">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">Configuración Operativa</h2>
                <p className="text-sm text-slate-400 dark:text-slate-500 mb-6">Ajustes generales de operación del parqueadero</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className={labelClass}>Horario de apertura</label>
                    <input name="horarioApertura" type="time" value={form.horarioApertura} onChange={handleChange} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Horario de cierre</label>
                    <input name="horarioCierre" type="time" value={form.horarioCierre} onChange={handleChange} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Elementos por página</label>
                    <Select value={String(form.paginacionPorDefecto)} onChange={(val) => handleChange({ target: { name: "paginacionPorDefecto", value: val } })} options={[
                      ...[10, 15, 20, 25, 50].map(n => ({ value: String(n), label: String(n) })),
                    ]} />
                  </div>
                  <div>
                    <label className={labelClass}>IVA / Impuesto (%)</label>
                    <input name="iva" type="number" min="0" max="100" step="0.01" value={form.iva} onChange={handleChange} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Minutos de gracia</label>
                    <input name="minutosGracia" type="number" min="0" placeholder="0" value={form.minutosGracia} onChange={handleChange} className={inputClass} />
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Tiempo adicional gratis al calcular cobros (se suma a minutos gratis de la tarifa)</p>
                  </div>
                </div>
                <div className="mt-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-700">
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">Resumen operativo:</p>
                  <p className="text-sm text-slate-700 dark:text-slate-200">
                    Horario: {form.horarioApertura || "—"} a {form.horarioCierre || "—"} &middot; {form.paginacionPorDefecto || 15} reg/página &middot; IVA: {form.iva || 0}%
                  </p>
                </div>
              </div>
            )}

            {tab === "seguridad" && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 lg:p-8">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">Seguridad</h2>
                <p className="text-sm text-slate-400 dark:text-slate-500 mb-6">Configura los parámetros de seguridad del sistema</p>
                <div className="space-y-5">
                  <div>
                    <label className={labelClass}>Intentos máximos de inicio de sesión</label>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">Número máximo de intentos fallidos permitidos por minuto antes de bloquear temporalmente el acceso</p>
                    <Select value={String(form.intentosMaximos)} onChange={(val) => handleChange({ target: { name: "intentosMaximos", value: val } })} options={[
                      ...[3, 5, 10, 15, 20, 50, 100].map(n => ({ value: String(n), label: `${n} intentos por minuto` })),
                    ]} />
                  </div>
                  <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 flex items-start gap-3">
                    <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Límite de intentos configurable</p>
                      <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">El sistema bloqueará temporalmente la IP después de {form.intentosMaximos || 10} intentos fallidos en 1 minuto. Los usuarios con intentos acumulados en la base de datos también serán bloqueados automáticamente.</p>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-700">
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-2">Estado de seguridad actual:</p>
                    <ul className="text-sm text-slate-700 dark:text-slate-200 space-y-1.5">
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Rate limiting por IP activo
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Contraseñas hasheadas con bcrypt
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Sesiones con JWT + refresh token
                      </li>
                      <li className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${(form.intentosMaximos || 10) > 5 ? "bg-emerald-500" : "bg-amber-500"}`} />
                        Máximo {form.intentosMaximos || 10} intentos/minuto
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={() => setToast({ mensaje: "", tipo: "" })} />
    </div>
  );
}