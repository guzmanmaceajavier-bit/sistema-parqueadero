import { useNavigate } from "react-router-dom";
import { useCaja } from "../context/CajaContext";
import { formatCurrency } from "../utils/formatters";
import { Wallet } from "lucide-react";

const formatValor = (v) => formatCurrency(v);

export default function CajaStatusWidget() {
  const navigate = useNavigate();
  const { cajaAbierta } = useCaja();
  const abierta = !!cajaAbierta;
  const efectivo = abierta ? (cajaAbierta.efectivoEnCaja ?? cajaAbierta.saldo ?? cajaAbierta.apertura ?? 0) : 0;
  const tarjeta = abierta ? (cajaAbierta.ingresosTarjeta || 0) : 0;
  const transferencia = abierta ? (cajaAbierta.ingresosTransferencia || 0) : 0;

  return (
    <button
      onClick={() => navigate("/caja")}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
        abierta
          ? "bg-white dark:bg-slate-700/50 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50 hover:bg-emerald-50 dark:hover:bg-slate-700"
          : "bg-white dark:bg-slate-700/50 text-red-600 dark:text-red-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
      }`}
      title={abierta
        ? `Efectivo: ${formatValor(efectivo)} | Tarjeta: ${formatValor(tarjeta)} | Transferencia: ${formatValor(transferencia)}${cajaAbierta.usuario ? ` — Abrió: ${cajaAbierta.usuario.nombre}` : ""}`
        : "Caja cerrada — Abrir"
      }
    >
      <Wallet className="w-3.5 h-3.5" />
      <span className={`w-1 h-1 rounded-full ${abierta ? "bg-emerald-500" : "bg-red-500"} ${abierta ? "animate-pulse" : ""}`} />
      <span className="hidden sm:inline">{abierta ? formatValor(efectivo) : "Caja cerrada"}</span>
    </button>
  );
}
