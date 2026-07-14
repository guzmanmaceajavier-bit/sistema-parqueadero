const MAPA_MONEDA_LOCALE = {
  COP: "es-CO",
  USD: "en-US",
  EUR: "de-DE",
  MXN: "es-MX",
};

const MAPA_IDIOMA_LOCALE = {
  es: "es-CO",
  en: "en-US",
  pt: "pt-BR",
};

let _cfg = {
  formatoMoneda: "COP",
  monedaSimbolo: "$",
  formatoFecha: "DD/MM/YYYY",
  formatoHora: "12h",
  idioma: "es",
};

export function syncFormatterConfig(config) {
  if (config) {
    _cfg = {
      formatoMoneda: config.formatoMoneda || "COP",
      monedaSimbolo: config.monedaSimbolo || "$",
      formatoFecha: config.formatoFecha || "DD/MM/YYYY",
      formatoHora: config.formatoHora || "12h",
      idioma: config.idioma || "es",
    };
  }
}

export function formatCurrency(value) {
  const moneda = _cfg.formatoMoneda;
  const simbolo = _cfg.monedaSimbolo;
  const locale = MAPA_MONEDA_LOCALE[moneda] || "es-CO";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: moneda,
      minimumFractionDigits: 0,
    }).format(value || 0);
  } catch {
    return `${simbolo}${(value || 0).toLocaleString()}`;
  }
}

export function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  const fmt = _cfg.formatoFecha;
  const idioma = _cfg.idioma;
  if (fmt === "DD/MM/YYYY") {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }
  if (fmt === "MM/DD/YYYY") {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  }
  return d.toLocaleDateString(MAPA_IDIOMA_LOCALE[idioma] || "es-CO");
}

export function formatTime(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true, hourCycle: "h12",
  }).replace(" AM", " am").replace(" PM", " pm");
}

export function formatDateTime(dateStr) {
  if (!dateStr) return "—";
  return `${formatDate(dateStr)} ${formatTime(dateStr)}`;
}

export function formatIva(iva) {
  if (iva === null || iva === undefined || iva === 0) return null;
  return `IVA ${Number(iva).toFixed(1)}%`;
}

export function dayNameInIdioma(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(MAPA_IDIOMA_LOCALE[_cfg.idioma] || "es-CO", { weekday: "long" });
}

export function monthNameInIdioma(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(MAPA_IDIOMA_LOCALE[_cfg.idioma] || "es-CO", { month: "long" });
}

const METODOS_LABEL = { efectivo: "Efectivo", tarjeta: "Tarjeta", transferencia: "Transferencia" };
const METODOS_ICON = { efectivo: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z", tarjeta: "M3 10h18M7 15h1m4 0h1", transferencia: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" };

export function getMetodosPagoActivos(config) {
  const raw = config?.metodosPago || "efectivo,tarjeta,transferencia";
  return raw.split(",").filter(Boolean).map(k => ({
    key: k,
    label: METODOS_LABEL[k] || k,
    icon: METODOS_ICON[k] || "",
  }));
}

export function isMetodoPagoActivo(config, metodo) {
  const raw = config?.metodosPago || "efectivo,tarjeta,transferencia";
  return raw.split(",").filter(Boolean).includes(metodo);
}
