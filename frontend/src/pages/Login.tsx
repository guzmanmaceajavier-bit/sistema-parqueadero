import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useConfig } from "../context/ConfigContext";
import {
  Eye, EyeOff, Loader2, LogIn, AlertCircle, Mail, CheckCircle,
  Sparkles, KeyRound, Info
} from "lucide-react";
import api from "../services/api";

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const { config } = useConfig();
  const [forgotMode, setForgotMode] = useState(searchParams.get("modo") === "recuperar");

  useEffect(() => {
    if (searchParams.get("modo") === "recuperar") setForgotMode(true);
  }, [searchParams]);

  const accent = config?.colorPrincipal || "#0d9488";
  const bgImage = config?.fondoLogin;
  const logo = config?.logo;

  /* Login state */
  const savedUser = localStorage.getItem("rememberedUser") || "";
  const [user, setUser] = useState(savedUser);
  const [pass, setPass] = useState("");
  const [rememberMe, setRememberMe] = useState(!!savedUser);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /* Forgot state */
  const [fUser, setFUser] = useState("");
  const [fMsg, setFMsg] = useState("");
  const [fLoading, setfLoading] = useState(false);
  const [fSent, setFSent] = useState(false);

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
      const msg = res.data?.message || "Credenciales incorrectas";
      const i = res.data?.intentosRestantes;
      setError(i !== undefined ? `${msg} — ${i} restante${i !== 1 ? "s" : ""}` : msg);
    } catch (err) {
      const data = err.response?.data;
      if (data) {
        const msg = data.message || "Credenciales incorrectas";
        const i = data.intentosRestantes;
        setError(i !== undefined ? `${msg} — ${i} restante${i !== 1 ? "s" : ""}` : msg);
      } else setError("Error de conexión");
    } finally { setLoading(false); }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setfLoading(true); setFMsg(""); setFSent(false);
    try {
      await api.post("/usuarios/forgot-password", fUser.includes("@") ? { correo: fUser } : { usuario: fUser });
      setFSent(true);
      setFMsg("Recibirás un enlace si el usuario existe");
    } catch (err) { setFMsg(err.response?.data?.message || "Error"); }
    finally { setfLoading(false); }
  };

  const accentGrad = `linear-gradient(135deg, ${accent}, ${accent}bb)`;

  return (
    <div className="h-screen w-screen flex items-center justify-center overflow-hidden relative bg-slate-950">
      {/* ── Background ── */}
      {bgImage ? (
        <>
          <div className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-110"
               style={{ backgroundImage: `url(${bgImage})` }} />
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950/80 via-slate-950/60 to-slate-950/80" />
          <div className="absolute inset-0 backdrop-blur-[1px]" />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 via-60% to-slate-800">
          {/* Mesh grid */}
          <div className="absolute inset-0 opacity-[0.04]"
               style={{ backgroundImage: `linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)`, backgroundSize: "60px 60px" }} />
          {/* Gradient orbs */}
          <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full opacity-20 blur-[120px] pointer-events-none"
               style={{ background: `radial-gradient(circle, ${accent}33, transparent 70%)` }} />
          <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full opacity-20 blur-[120px] pointer-events-none"
               style={{ background: `radial-gradient(circle, ${accent}22, transparent 70%)` }} />
        </div>
      )}

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <div key={i}
            className="absolute rounded-full opacity-[0.08] animate-pulse"
            style={{
              width: `${8 + (i * 4)}px`,
              height: `${8 + (i * 4)}px`,
              background: accent,
              left: `${10 + (i * 15)}%`,
              top: `${15 + (i * 12)}%`,
              animationDelay: `${i * 1.5}s`,
              animationDuration: `${3 + i}s`,
            }} />
        ))}
      </div>

      <style>{`
        .lc {
          position: relative;
          overflow: hidden;
          border-radius: 90px;
          box-shadow:
            0 30px 60px -15px rgba(0,0,0,0.3),
            0 0 0 1px rgba(255,255,255,0.06),
            inset 0 1px 0 rgba(255,255,255,0.1);
          width: 768px;
          max-width: calc(100vw - 32px);
          min-height: 500px;
          transition: 333ms;
        }
        .lc-glass {
          background: rgba(255,255,255,0.85);
          backdrop-filter: blur(20px) saturate(1.2);
        }
        .lc-solid {
          background: #fff;
        }
        .lf {
          position: absolute;
          top: 0;
          height: 100%;
          transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .lsi { left: 0; width: 50%; z-index: 2; }
        .lsu { left: 0; width: 50%; z-index: 1; opacity: 0; }
        .low {
          position: absolute; top: 0; left: 50%; width: 50%; height: 100%;
          overflow: hidden; transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
          z-index: 100;
        }
        .lo {
          position: relative; left: -100%; height: 100%; width: 200%;
          transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .lp {
          position: absolute; top: 0; width: 50%; height: 100%;
          display: flex; flex-direction: column; justify-content: center; align-items: center;
          padding: 0 40px; text-align: center; gap: 6px;
          transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .lpl { transform: translateY(-20%); }
        .lpr { right: 0; }

        .fm .lsi { transform: translateY(100%); }
        .fm .low { transform: translateX(-100%); }
        .fm .lsu { transform: translateX(100%); opacity: 1; z-index: 5; }
        .fm .lo  { transform: translateX(50%); }
        .fm .lpl { transform: translateY(0); }
        .fm .lpr { transform: translateY(20%); }

        .ghost-btn {
          border: 2px solid rgba(255,255,255,0.4);
          color: #fff;
          font-weight: 600;
          font-size: 0.875rem;
          padding: 10px 36px;
          border-radius: 999px;
          cursor: pointer;
          transition: all 0.3s ease;
          background: transparent;
        }
        .ghost-btn:hover {
          border-color: #fff;
          background: rgba(255,255,255,0.1);
          transform: scale(1.03);
        }
        .ghost-btn:active { transform: scale(0.97); }

        .inp {
          width: 100%;
          background: #f1f5f9;
          border: 2px solid transparent;
          border-radius: 999px;
          padding: 12px 20px 12px 48px;
          font-size: 0.875rem;
          color: #1e293b;
          outline: none;
          transition: all 0.25s ease;
        }
        .inp:focus {
          border-color: ${accent};
          background: #fff;
          box-shadow: 0 0 0 4px ${accent}15;
        }
        .inp::placeholder { color: #94a3b8; }
        .inp-wrap { position: relative; width: 100%; max-width: 280px; }
        .inp-icon {
          position: absolute; left: 18px; top: 50%; transform: translateY(-50%);
          color: #94a3b8; pointer-events: none; transition: color 0.25s;
        }
        .inp-wrap:focus-within .inp-icon { color: ${accent}; }

        .btn-primary {
          border: none;
          color: #fff;
          font-weight: 600;
          font-size: 0.875rem;
          padding: 12px 48px;
          border-radius: 999px;
          cursor: pointer;
          transition: all 0.3s ease;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          position: relative;
          overflow: hidden;
          box-shadow: 0 4px 15px ${accent}40;
        }
        .btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 25px ${accent}50;
        }
        .btn-primary:active { transform: scale(0.97); }
        .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
        .btn-primary::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.15), transparent 50%);
          pointer-events: none;
        }
      `}</style>

      <div className={`lc ${bgImage ? "lc-glass" : "lc-solid"} ${forgotMode ? "fm" : ""}`}>

        {/* ── SIGN IN ── */}
        <div className="lf lsi">
          <div className="h-full w-full flex flex-col items-center justify-center px-10 text-center bg-transparent relative">
            {/* Decorative top accent line */}
            <div className="absolute top-0 left-0 right-0 h-1" style={{ background: accentGrad }} />

            {/* Logo */}
            <div className="relative mb-4">
              {logo ? (
                <img src={logo} alt="Logo"
                  className="w-16 h-16 rounded-2xl shadow-lg object-cover ring-2 ring-white/50"
                  style={{ boxShadow: `0 4px 20px ${accent}30` }} />
              ) : (
                <div className="w-16 h-16 rounded-2xl shadow-lg flex items-center justify-center ring-2 ring-white/50"
                  style={{ background: accentGrad, boxShadow: `0 4px 20px ${accent}30` }}>
                  <span className="text-white font-bold text-2xl tracking-tight">P</span>
                </div>
              )}
            </div>

            <h1 className="text-2xl font-bold mb-0.5" style={{ color: "#0f172a" }}>Iniciar sesión</h1>
            <p className="text-sm text-slate-400 mb-5">Ingresa tus credenciales para acceder</p>

            <form onSubmit={handleLogin} className="w-full flex flex-col items-center gap-3.5">
              <div className="inp-wrap">
                <svg className="inp-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21v-2a4 4 0 00-4-4H9a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <input className="inp" type="text" value={user} onChange={(e) => setUser(e.target.value)} placeholder="Usuario o correo" autoComplete="username" />
              </div>
              <div className="inp-wrap">
                <svg className="inp-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                <input className="inp" type={showPass ? "text" : "password"} value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Contraseña" autoComplete="current-password" />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer bg-transparent border-none p-0">
                  {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>

              <div className="w-full max-w-[280px] flex items-center justify-start">
                <label className="flex items-center gap-2 cursor-pointer select-none group">
                  <div className="w-[18px] h-[18px] rounded-md border-2 flex items-center justify-center transition-all duration-200"
                    style={{ borderColor: rememberMe ? accent : "#cbd5e1", background: rememberMe ? accent : "transparent" }}>
                    {rememberMe && (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    )}
                  </div>
                  <input type="checkbox" checked={rememberMe} onChange={() => setRememberMe(!rememberMe)} className="hidden" />
                  <span className="text-xs font-medium text-slate-400 group-hover:text-slate-600 transition-colors">Recordar usuario</span>
                </label>
              </div>

              {error && (
                <div className="max-w-[280px] w-full p-3 rounded-xl text-xs flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-600">
                  <AlertCircle size={14} className="shrink-0" />{error}
                </div>
              )}

              <button type="submit" disabled={loading || !user || !pass}
                className="btn-primary mt-1" style={{ background: accentGrad }}>
                {loading ? <Loader2 size={17} className="animate-spin" /> : <LogIn size={17} />}
                {loading ? "Entrando..." : "Entrar"}
              </button>
            </form>
          </div>
        </div>

        {/* ── FORGOT ── */}
        <div className="lf lsu">
          <div className="h-full w-full flex flex-col items-center justify-center px-10 text-center bg-transparent relative">
            <div className="absolute top-0 left-0 right-0 h-1" style={{ background: accentGrad }} />

            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: `${accent}15`, boxShadow: `0 4px 20px ${accent}20` }}>
              <KeyRound size={28} style={{ color: accent }} />
            </div>

            <h1 className="text-2xl font-bold mb-0.5" style={{ color: "#0f172a" }}>Recuperar contraseña</h1>
            <p className="text-sm text-slate-400 mb-5">Te enviaremos un enlace para restablecer tu acceso</p>

            <form onSubmit={handleForgot} className="w-full flex flex-col items-center gap-3.5">
              <div className="inp-wrap">
                <svg className="inp-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21v-2a4 4 0 00-4-4H9a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <input className="inp" type="text" value={fUser} onChange={(e) => setFUser(e.target.value)} placeholder="Usuario o correo" />
              </div>

              {fMsg && (
                <div className={`max-w-[280px] w-full p-3 rounded-xl text-xs flex items-center gap-2.5 border ${
                  fSent ? "bg-emerald-50 border-emerald-200 text-emerald-600" : "bg-amber-50 border-amber-200 text-amber-600"
                }`}>
                  {fSent ? <CheckCircle size={14} className="shrink-0" /> : <AlertCircle size={14} className="shrink-0" />}{fMsg}
                </div>
              )}

              <button type="submit" disabled={fLoading || !fUser}
                className="btn-primary mt-1" style={{ background: accentGrad }}>
                {fLoading ? <Loader2 size={17} className="animate-spin" /> : <Mail size={17} />}
                {fLoading ? "Enviando..." : "Enviar enlace"}
              </button>
            </form>
          </div>
        </div>

        {/* ── OVERLAY ── */}
        <div className="low">
          <div className="lo relative" style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)` }}>
            {/* Decorative circles overlay */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full border border-white/10" />
              <div className="absolute -bottom-16 -left-16 w-32 h-32 rounded-full border border-white/10" />
              <div className="absolute top-1/3 right-1/4 w-2 h-2 rounded-full bg-white/20" />
              <div className="absolute bottom-1/4 left-1/3 w-1.5 h-1.5 rounded-full bg-white/15" />
            </div>

            {/* Panel Left */}
            <div className="lp lpl text-white relative z-[1]">
              <Sparkles size={32} className="text-white/40 mb-3" />
              <h2 className="text-2xl font-bold mb-1">¡Bienvenido!</h2>
              <p className="text-sm text-white/70 leading-relaxed max-w-[220px] mb-1">
                Accede a tu cuenta para gestionar tu parqueadero.
              </p>
              <p className="text-xs text-white/40 max-w-[220px]">
                Control de ingresos, reservas y más.
              </p>
              <button type="button" onClick={() => setForgotMode(false)}
                className="ghost-btn mt-5">
                Iniciar sesión
              </button>
            </div>

            {/* Panel Right */}
            <div className="lp lpr text-white relative z-[1]">
              <KeyRound size={32} className="text-white/40 mb-3" />
              <h2 className="text-2xl font-bold mb-1">¿Olvidaste tu clave?</h2>
              <p className="text-sm text-white/70 leading-relaxed max-w-[220px] mb-1">
                No te preocupes, te ayudamos a recuperarla.
              </p>
              <p className="text-xs text-white/40 max-w-[220px]">
                Recibirás un enlace en tu correo.
              </p>
              <button type="button" onClick={() => setForgotMode(true)}
                className="ghost-btn mt-5">
                Recuperar acceso
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
