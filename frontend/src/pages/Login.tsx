import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useConfig } from "../context/ConfigContext";
import { Eye, EyeOff, Loader2, LogIn, AlertCircle, User, Lock } from "lucide-react";
import api from "../services/api";

export default function Login() {
  const { login } = useAuth();
  const { config } = useConfig();

  const accent = config?.colorPrincipal || "#0d9488";
  const bgImage = config?.fondoLogin;
  const logo = config?.logo;
  const isDark = config?.modoOscuro;

  const savedUser = localStorage.getItem("rememberedUser") || "";
  const [user, setUser] = useState(savedUser || "admin");
  const [pass, setPass] = useState("Admin123");
  const [rememberMe, setRememberMe] = useState(!!savedUser);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
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
    } finally {
      setLoading(false);
    }
  };

  const accentGrad = `linear-gradient(135deg, ${accent}, ${accent}bb)`;

  return (
    <div
      className={`h-screen w-screen flex items-center justify-center overflow-hidden relative ${
        isDark
          ? "bg-gradient-to-br from-slate-900 via-slate-950 to-slate-800"
          : "bg-gradient-to-br from-slate-50 via-white to-slate-100"
      }`}
    >
      {bgImage ? (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-110"
            style={{ backgroundImage: `url(${bgImage})` }}
          />
          <div
            className={`absolute inset-0 ${
              isDark
                ? "bg-gradient-to-br from-slate-950/80 via-slate-950/60 to-slate-950/80"
                : "bg-gradient-to-br from-white/70 via-white/50 to-white/70"
            }`}
          />
          <div className="absolute inset-0 backdrop-blur-[1px]" />
        </>
      ) : (
        <div className="absolute inset-0">
          <div
            className={`absolute inset-0 ${
              isDark
                ? "opacity-[0.04]"
                : "opacity-[0.03]"
            }`}
            style={{
              backgroundImage: `linear-gradient(${isDark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.06)"} 1px, transparent 1px), linear-gradient(90deg, ${isDark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.06)"} 1px, transparent 1px)`,
              backgroundSize: "60px 60px",
            }}
          />
          <div
            className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full blur-[120px] pointer-events-none"
            style={{
              background: `radial-gradient(circle, ${accent}${isDark ? "33" : "22"}, transparent 70%)`,
              opacity: isDark ? 0.2 : 0.15,
            }}
          />
          <div
            className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full blur-[120px] pointer-events-none"
            style={{
              background: `radial-gradient(circle, ${accent}${isDark ? "22" : "18"}, transparent 70%)`,
              opacity: isDark ? 0.2 : 0.15,
            }}
          />
        </div>
      )}

      <div
        className={`relative overflow-hidden rounded-3xl shadow-2xl w-[400px] max-w-[calc(100vw-32px)] ${
          isDark
            ? "bg-slate-800/80 ring-1 ring-slate-700/50 backdrop-blur-xl"
            : "bg-white/95 ring-1 ring-slate-200/50 backdrop-blur-xl"
        }`}
      >
        <div className="h-1 w-full" style={{ background: accentGrad }} />

        <div className="flex flex-col items-center px-10 py-10 text-center">
          <div className="relative mb-5">
            {logo ? (
              <img
                src={logo}
                alt="Logo"
                className={`w-16 h-16 rounded-2xl shadow-lg object-cover ring-2 ${
                  isDark ? "ring-slate-600/50" : "ring-white"
                }`}
                style={{ boxShadow: `0 4px 20px ${accent}30` }}
              />
            ) : (
              <div
                className={`w-16 h-16 rounded-2xl shadow-lg flex items-center justify-center ring-2 ${
                  isDark ? "ring-slate-600/50" : "ring-white"
                }`}
                style={{ background: accentGrad, boxShadow: `0 4px 20px ${accent}30` }}
              >
                <span className="text-white font-bold text-2xl tracking-tight">P</span>
              </div>
            )}
          </div>

          <h1 className={`text-2xl font-bold mb-1 ${isDark ? "text-white" : "text-slate-900"}`}>
            Iniciar sesion
          </h1>
          <p className={`text-sm mb-6 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            Ingresa tus credenciales para acceder
          </p>

          <form onSubmit={handleLogin} className="w-full flex flex-col items-center gap-3.5">
            <div className="relative w-full group">
              <div
                className={`absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${
                  isDark ? "text-slate-500" : "text-slate-400"
                }`}
              >
                <User size={18} />
              </div>
              <input
                className={`w-full border-2 rounded-xl py-3 pl-12 pr-4 text-sm outline-none transition-all duration-200 ${
                  isDark
                    ? "bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-teal-400 focus:bg-slate-700/80 focus:shadow-[0_0_0_4px_rgba(45,212,191,0.1)]"
                    : "bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:shadow-[0_0_0_4px_rgba(13,148,136,0.1)]"
                }`}
                type="text"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                placeholder="Usuario o correo"
                autoComplete="username"
              />
            </div>

            <div className="relative w-full group">
              <div
                className={`absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${
                  isDark ? "text-slate-500" : "text-slate-400"
                }`}
              >
                <Lock size={18} />
              </div>
              <input
                className={`w-full border-2 rounded-xl py-3 pl-12 pr-12 text-sm outline-none transition-all duration-200 ${
                  isDark
                    ? "bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-teal-400 focus:bg-slate-700/80 focus:shadow-[0_0_0_4px_rgba(45,212,191,0.1)]"
                    : "bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:shadow-[0_0_0_4px_rgba(13,148,136,0.1)]"
                }`}
                type={showPass ? "text" : "password"}
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="Contrasena"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className={`absolute right-4 top-1/2 -translate-y-1/2 transition-colors cursor-pointer bg-transparent border-none p-0 ${
                  isDark
                    ? "text-slate-500 hover:text-slate-300"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none self-start ml-1">
              <div
                className="w-[18px] h-[18px] rounded-md border-2 flex items-center justify-center transition-all"
                style={{
                  borderColor: rememberMe ? accent : isDark ? "#475569" : "#cbd5e1",
                  background: rememberMe ? accent : "transparent",
                }}
              >
                {rememberMe && (
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={() => setRememberMe(!rememberMe)}
                className="hidden"
              />
              <span
                className={`text-xs font-medium transition-colors ${
                  isDark
                    ? "text-slate-500 hover:text-slate-300"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                Recordar usuario
              </span>
            </label>

            {error && (
              <div
                className={`w-full p-3 rounded-xl text-xs flex items-center gap-2.5 ${
                  isDark
                    ? "bg-red-900/20 border border-red-800/50 text-red-400"
                    : "bg-red-50 border border-red-200 text-red-600"
                }`}
              >
                <AlertCircle size={14} className="shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !user || !pass}
              className="w-full text-white font-semibold text-sm py-3 rounded-xl cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none inline-flex items-center justify-center gap-2 relative overflow-hidden"
              style={{ background: accentGrad, boxShadow: `0 4px 15px ${accent}40` }}
            >
              {loading ? <Loader2 size={17} className="animate-spin" /> : <LogIn size={17} />}
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
