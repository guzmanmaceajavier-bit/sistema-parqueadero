import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useConfig } from "../context/ConfigContext";
import { Eye, EyeOff, Loader2, LogIn, AlertCircle } from "lucide-react";
import api from "../services/api";

export default function Login() {
  const { login } = useAuth();
  const { config } = useConfig();

  const accent = config?.colorPrincipal || "#0d9488";
  const bgImage = config?.fondoLogin;
  const logo = config?.logo;

  const savedUser = localStorage.getItem("rememberedUser") || "";
  const [user, setUser] = useState(savedUser);
  const [pass, setPass] = useState("");
  const [rememberMe, setRememberMe] = useState(!!savedUser);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const payload = user.includes("@") ? { correo: user, password: pass } : { usuario: user, password: pass };
      const res = await api.post("/usuarios/login", payload);
      if (res.data?.ok) {
        if (rememberMe) localStorage.setItem("rememberedUser", user);
        else localStorage.removeItem("rememberedUser");
        login(res.data.usuario);
        return;
      }
      setError(res.data?.message || "Credenciales incorrectas");
    } catch (err) {
      setError(err.response?.data?.message || "Error de conexion");
    } finally { setLoading(false); }
  };

  const accentGrad = `linear-gradient(135deg, ${accent}, ${accent}bb)`;

  return (
    <div className="h-screen w-screen flex items-center justify-center overflow-hidden relative bg-slate-950">
      {bgImage ? (
        <>
          <div className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-110" style={{ backgroundImage: `url(${bgImage})` }} />
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950/80 via-slate-950/60 to-slate-950/80" />
          <div className="absolute inset-0 backdrop-blur-[1px]" />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 via-60% to-slate-800">
          <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: `linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)`, backgroundSize: "60px 60px" }} />
          <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full opacity-20 blur-[120px] pointer-events-none" style={{ background: `radial-gradient(circle, ${accent}33, transparent 70%)` }} />
          <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full opacity-20 blur-[120px] pointer-events-none" style={{ background: `radial-gradient(circle, ${accent}22, transparent 70%)` }} />
        </div>
      )}

      <div className="relative overflow-hidden rounded-[40px] shadow-2xl w-[400px] max-w-[calc(100vw-32px)] bg-white/90 backdrop-blur-xl ring-1 ring-white/20">
        <div className="h-1 w-full" style={{ background: accentGrad }} />
        <div className="flex flex-col items-center px-10 py-10 text-center">
          <div className="relative mb-4">
            {logo ? (
              <img src={logo} alt="Logo" className="w-16 h-16 rounded-2xl shadow-lg object-cover ring-2 ring-white/50" style={{ boxShadow: `0 4px 20px ${accent}30` }} />
            ) : (
              <div className="w-16 h-16 rounded-2xl shadow-lg flex items-center justify-center ring-2 ring-white/50" style={{ background: accentGrad, boxShadow: `0 4px 20px ${accent}30` }}>
                <span className="text-white font-bold text-2xl tracking-tight">P</span>
              </div>
            )}
          </div>

          <h1 className="text-2xl font-bold text-slate-900 mb-0.5">Iniciar sesion</h1>
          <p className="text-sm text-slate-400 mb-4">Ingresa tus credenciales para acceder</p>

          <div className="w-full mb-4 p-3 rounded-xl border border-dashed" style={{ borderColor: `${accent}40`, background: `${accent}06` }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: accent }}>Credenciales de acceso</p>
            <div className="space-y-0.5">
              <p className="text-xs text-slate-500"><span className="font-semibold text-slate-700">Usuario:</span> admin</p>
              <p className="text-xs text-slate-500"><span className="font-semibold text-slate-700">Contrasena:</span> Admin123</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="w-full flex flex-col items-center gap-3.5">
            <div className="relative w-full">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21v-2a4 4 0 00-4-4H9a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              <input className="w-full bg-slate-100 border-2 border-transparent rounded-full py-3 pl-12 pr-4 text-sm text-slate-800 outline-none transition-all focus:border-teal-500 focus:bg-white focus:shadow-[0_0_0_4px_rgba(13,148,136,0.1)]" type="text" value={user} onChange={(e) => setUser(e.target.value)} placeholder="Usuario o correo" autoComplete="username" />
            </div>
            <div className="relative w-full">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              <input className="w-full bg-slate-100 border-2 border-transparent rounded-full py-3 pl-12 pr-12 text-sm text-slate-800 outline-none transition-all focus:border-teal-500 focus:bg-white focus:shadow-[0_0_0_4px_rgba(13,148,136,0.1)]" type={showPass ? "text" : "password"} value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Contrasena" autoComplete="current-password" />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer bg-transparent border-none p-0">
                {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none self-start ml-1">
              <div className="w-[18px] h-[18px] rounded-md border-2 flex items-center justify-center transition-all" style={{ borderColor: rememberMe ? accent : "#cbd5e1", background: rememberMe ? accent : "transparent" }}>
                {rememberMe && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
              </div>
              <input type="checkbox" checked={rememberMe} onChange={() => setRememberMe(!rememberMe)} className="hidden" />
              <span className="text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors">Recordar usuario</span>
            </label>

            {error && (
              <div className="w-full p-3 rounded-xl text-xs flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-600">
                <AlertCircle size={14} className="shrink-0" />{error}
              </div>
            )}

            <button type="submit" disabled={loading || !user || !pass}
              className="w-full text-white font-semibold text-sm py-3 rounded-full cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none inline-flex items-center justify-center gap-2 relative overflow-hidden"
              style={{ background: accentGrad, boxShadow: `0 4px 15px ${accent}40` }}>
              {loading ? <Loader2 size={17} className="animate-spin" /> : <LogIn size={17} />}
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
