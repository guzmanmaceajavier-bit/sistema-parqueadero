import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Lock, Eye, EyeOff, ArrowLeft, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import api from "../services/api";
import { useConfig } from "../context/ConfigContext";

export default function ResetPassword() {
  const navigate = useNavigate();
  const { config } = useConfig();
  const [searchParams] = useSearchParams();
  const tokenUrl = searchParams.get("token") || "";

  const [form, setForm] = useState({ token: tokenUrl, password: "", confirmar: "" });
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);
  const [exito, setExito] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const resetear = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmar) { setMensaje("Las contrasenas no coinciden"); return; }
    if (form.password.length < 8) { setMensaje("La contrasena debe tener al menos 8 caracteres"); return; }
    setCargando(true);
    setMensaje("");
    try {
      await api.post("/usuarios/reset-password", { token: form.token, password: form.password });
      setExito(true);
      setMensaje("Contrasena actualizada. Redirigiendo al login...");
      setTimeout(() => navigate("/"), 2500);
    } catch (error) {
      setMensaje(error.response?.data?.message || "Error al restablecer contrasena");
    } finally { setCargando(false); }
  };

  const accentColor = config?.colorPrincipal || "#10b981";
  const bgImage = config?.fondoLogin;
  const isDark = config?.modoOscuro;

  return (
    <div className="h-screen w-screen overflow-hidden relative bg-slate-950 flex items-center justify-center">
      {bgImage ? (
        <>
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${bgImage})` }} />
          <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-[1px]" />
        </>
      ) : (
        <>
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, #0f172a, #1e293b)` }} />
          <svg className="absolute inset-0 w-full h-full opacity-[0.04]" viewBox="0 0 100 100">
            <defs>
              <pattern id="rp-bg" width="40" height="40" patternUnits="userSpaceOnUse">
                <rect width="40" height="40" fill="none" stroke="white" strokeWidth="0.5" />
                <rect x="8" y="8" width="24" height="24" rx="2" fill="none" stroke="white" strokeWidth="0.3" opacity="0.4" />
              </pattern>
            </defs>
            <rect width="100" height="100" fill="url(#rp-bg)" />
          </svg>
          <div className="absolute top-1/4 -left-20 w-72 h-72 rounded-full pointer-events-none"
            style={{ background: `radial-gradient(circle, ${accentColor}15 0%, transparent 70%)` }} />
          <div className="absolute bottom-1/3 -right-20 w-80 h-80 rounded-full pointer-events-none"
            style={{ background: `radial-gradient(circle, ${accentColor}10 0%, transparent 70%)` }} />
          <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-slate-950 to-transparent pointer-events-none" />
        </>
      )}

      <div className="relative z-10 w-full max-w-sm mx-4">
        <div
          className={`w-full md:w-[480px] rounded-3xl shadow-2xl overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-white'}`}
        >
          <div className={`h-2 w-full ${isDark ? 'opacity-80' : ''}`} style={{ background: `linear-gradient(90deg, ${accentColor}, ${accentColor}88, ${accentColor})` }} />

          <div className="p-10">
            <div className="text-center mb-6">
              {config?.logo ? (
                <img src={config.logo} alt="Logo" className="w-16 h-16 rounded-2xl mx-auto mb-4 shadow-lg object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-2xl mx-auto mb-4 shadow-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)` }}>
                  <span className="text-white font-bold text-2xl">P</span>
                </div>
              )}
              <h1 className={`text-xl font-bold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{config?.nombreParqueadero || "ParkAdmin"}</h1>
            </div>

            <h2 className={`text-3xl font-bold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>Restablecer Contrasena</h2>
            <p className={`mt-1.5 mb-7 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Ingresa tu nueva contrasena.</p>

            <form onSubmit={resetear} className="space-y-4">
              <div>
                <div className={`flex items-center border rounded-xl px-5 py-3.5 bg-slate-50 focus-within:ring-2 focus-within:border-emerald-500 transition-all ${isDark ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                  <Lock size={22} className="text-gray-400 shrink-0" />
                  <input type="text" placeholder="Token de recuperacion" value={form.token} onChange={(e) => setForm(p => ({ ...p, token: e.target.value }))}
                    className={`ml-3 w-full outline-none bg-transparent text-sm font-mono ${isDark ? 'text-slate-100 placeholder:text-slate-500' : 'text-slate-800 placeholder:text-slate-400'}`} />
                </div>
              </div>

              <div>
                <div className={`flex items-center border rounded-xl px-5 py-3.5 bg-slate-50 focus-within:ring-2 focus-within:border-emerald-500 transition-all ${isDark ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                  <Lock size={22} className="text-gray-400 shrink-0" />
                  <input type={showPass ? "text" : "password"} placeholder="Nueva contrasena (8+ caracteres)" value={form.password} onChange={(e) => setForm(p => ({ ...p, password: e.target.value }))}
                    className={`ml-3 w-full outline-none bg-transparent text-sm ${isDark ? 'text-slate-100 placeholder:text-slate-500' : 'text-slate-800 placeholder:text-slate-400'}`} />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="shrink-0 cursor-pointer text-gray-400 hover:text-slate-600 transition-colors">
                    {showPass ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div>
                <div className={`flex items-center border rounded-xl px-5 py-3.5 bg-slate-50 focus-within:ring-2 focus-within:border-emerald-500 transition-all ${isDark ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                  <Lock size={22} className="text-gray-400 shrink-0" />
                  <input type={showPass ? "text" : "password"} placeholder="Confirmar contrasena" value={form.confirmar} onChange={(e) => setForm(p => ({ ...p, confirmar: e.target.value }))}
                    className={`ml-3 w-full outline-none bg-transparent text-sm ${isDark ? 'text-slate-100 placeholder:text-slate-500' : 'text-slate-800 placeholder:text-slate-400'}`} />
                </div>
              </div>

              {mensaje && (
                <div className={`p-4 border rounded-xl text-sm flex items-center gap-2 leading-relaxed ${
                  exito
                    ? (isDark ? 'bg-emerald-900/30 border-emerald-800 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700')
                    : (isDark ? 'bg-red-900/30 border-red-800 text-red-300' : 'bg-red-50 border-red-200 text-red-700')
                }`}>
                  {exito ? <CheckCircle size={18} className="shrink-0" /> : <AlertCircle size={18} className="shrink-0" />}
                  {mensaje}
                </div>
              )}

              <button type="submit" disabled={cargando || !form.token || !form.password || !form.confirmar || exito}
                className="w-full text-white font-semibold py-3.5 px-5 rounded-xl text-sm transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)` }}>
                {cargando && <Loader2 size={20} className="animate-spin" />}
                {cargando ? "Restableciendo..." : "Restablecer Contrasena"}
              </button>

              <Link to="/"
                className="w-full flex items-center justify-center gap-2 text-sm cursor-pointer"
                style={{ color: accentColor }}>
                <ArrowLeft size={20} />
                Volver al inicio de sesion
              </Link>
            </form>
          </div>
        </div>

        <p className="text-center mt-4 text-xs text-white/20">
          &copy; {new Date().getFullYear()} {config?.nombreParqueadero || "ParkAdmin"}
        </p>
      </div>
    </div>
  );
}
