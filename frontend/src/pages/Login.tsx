import { useState, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useConfig } from "../context/ConfigContext";
import { Eye, EyeOff, Loader2, LogIn, AlertCircle, User, Lock, ShieldCheck } from "lucide-react";
import api, { resetAuthState } from "../services/api";

/* ─── Halo energético: respiración + ondas por tecla + órbita de partículas ───
   Fases: idle (reposo) → user (escribiendo usuario) → pass (contraseña,
   más intenso) → ready (completo: el halo se contrae) → finale (login:
   onda expansiva final). Sin porcentajes ni barras. */
const HALO_PARTICULAS = 8;

function EnergyHalo({ accent, phase, ripples, finale }) {
  const intenso = phase === "pass" || phase === "ready";
  const listo = phase === "ready" || finale;

  return (
    <div className="absolute pointer-events-none z-0 flex items-center justify-center" style={{ top: "-46px", left: "-46px", right: "-46px", bottom: "-46px" }}>
      <div className="relative w-full h-full">
        {/* Respiración base: dos capas de luz difusa */}
        <div
          className="absolute inset-0 halo-breathe"
          style={{
            borderRadius: "3rem",
            background: `radial-gradient(ellipse at center, ${accent}2e 0%, ${accent}14 45%, transparent 70%)`,
            filter: "blur(28px)",
          }}
        />
        <div
          className="absolute halo-breathe"
          style={{
            inset: "-36px",
            borderRadius: "4rem",
            background: `radial-gradient(ellipse at center, ${accent}14 0%, transparent 65%)`,
            filter: "blur(44px)",
            animationDelay: "-3.5s",
            opacity: intenso ? 1 : 0.7,
            transition: "opacity 1.2s ease",
          }}
        />

        {/* Onda expansiva por cada tecla */}
        {ripples.map((id) => (
          <div
            key={id}
            className="absolute halo-ripple"
            style={{
              inset: "-18px",
              borderRadius: "2.6rem",
              border: `2px solid ${accent}66`,
            }}
          />
        ))}

        {/* Partículas en órbita (aparecen al escribir) */}
        {phase !== "idle" && (
          <div
            className={`absolute inset-0 ${intenso ? "halo-orbit-fast" : "halo-orbit-slow"}`}
            style={{
              transform: listo ? "scale(0.78)" : "scale(1)",
              opacity: listo ? 0.95 : 0.8,
              transition: "transform 1.1s cubic-bezier(0.4, 0, 0.2, 1), opacity 1.1s ease",
            }}
          >
            {Array.from({ length: HALO_PARTICULAS }).map((_, i) => (
              <span
                key={i}
                className="absolute left-1/2 top-1/2"
                style={{
                  width: intenso ? 6 : 5,
                  height: intenso ? 6 : 5,
                  borderRadius: "9999px",
                  background: accent,
                  boxShadow: `0 0 ${intenso ? 10 : 7}px ${accent}`,
                  opacity: 0.85,
                  transform: `rotate(${i * (360 / HALO_PARTICULAS)}deg) translateX(252px)`,
                  filter: "blur(0.4px)",
                }}
              />
            ))}
          </div>
        )}

        {/* Onda final al entrar */}
        {finale && (
          <div
            className="absolute halo-finale"
            style={{
              inset: "-10px",
              borderRadius: "2.4rem",
              border: `2px solid ${accent}80`,
            }}
          />
        )}
      </div>

      <style>{`
        @keyframes halo-breathe {
          0%, 100% { transform: scale(1); opacity: 0.55; }
          50% { transform: scale(1.035); opacity: 0.8; }
        }
        .halo-breathe { animation: halo-breathe 7s ease-in-out infinite; }
        @keyframes halo-ripple {
          0% { transform: scale(0.97); opacity: 0.55; }
          100% { transform: scale(1.1); opacity: 0; }
        }
        .halo-ripple { animation: halo-ripple 1s cubic-bezier(0.2, 0, 0.2, 1) forwards; }
        @keyframes halo-spin { to { transform: rotate(360deg); } }
        .halo-orbit-slow { animation: halo-spin 26s linear infinite; }
        .halo-orbit-fast { animation: halo-spin 11s linear infinite; }
        @keyframes halo-finale {
          0% { transform: scale(0.94); opacity: 0.7; }
          100% { transform: scale(1.22); opacity: 0; }
        }
        .halo-finale { animation: halo-finale 1.4s cubic-bezier(0.2, 0, 0.2, 1) forwards; }
        @keyframes logo-breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.045); }
        }
        .halo-logo-breathe { animation: logo-breathe 5s ease-in-out infinite; }
        @keyframes logo-beat {
          0% { transform: scale(1); }
          35% { transform: scale(1.13); }
          100% { transform: scale(1); }
        }
        .halo-logo-beat { animation: logo-beat 0.45s cubic-bezier(0.3, 1.4, 0.5, 1); }
      `}</style>
    </div>
  );
}

/* ─── Overlay de bienvenida ─── */
function WelcomeOverlay({ nombre, accent }) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center rounded-3xl overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${accent}ee, ${accent}cc)`,
        backdropFilter: "blur(12px)",
        animation: "welcome-fade 0.35s ease-out forwards",
      }}
    >
      <style>{`
        @keyframes welcome-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes welcome-pop {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes welcome-text {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Check icon */}
      <div
        className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mb-5"
        style={{ animation: "welcome-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 0.1s) both" }}
      >
        <ShieldCheck className="w-8 h-8 text-white" strokeWidth={2} />
      </div>

      <h2
        className="text-2xl font-bold text-white mb-1"
        style={{ animation: "welcome-text 0.4s ease-out 0.2s both" }}
      >
        Bienvenido, {nombre || "Usuario"}!
      </h2>
      <p
        className="text-sm text-white/70 mb-5"
        style={{ animation: "welcome-text 0.4s ease-out 0.3s both" }}
      >
        Acceso autorizado
      </p>
      <div
        className="flex items-center gap-2 text-xs text-white/60"
        style={{ animation: "welcome-text 0.4s ease-out 0.4s both" }}
      >
        <Loader2 size={13} className="animate-spin" />
        Cargando panel...
      </div>
    </div>
  );
}

/* ─── Login principal ─── */
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
  const [showWelcome, setShowWelcome] = useState(false);

  // Fase del halo: reposo → usuario → contraseña → listo.
  // Sin porcentajes: la energía se comunica con luz y movimiento.
  const [focus, setFocus] = useState(null);
  const [pulse, setPulse] = useState(0);
  const [ripples, setRipples] = useState([]);
  const idRef = useRef(0);

  const keystroke = () => {
    idRef.current += 1;
    const id = idRef.current;
    setPulse(id);
    setRipples((r) => [...r.slice(-5), id]);
    setTimeout(() => setRipples((r) => r.filter((x) => x !== id)), 1050);
  };

  const complete = user.trim().length > 0 && pass.length > 0;
  const phase = loading || showWelcome
    ? "ready"
    : complete
      ? "ready"
      : focus === "pass" || (pass.length > 0 && !user)
        ? "pass"
        : user.length > 0 || focus === "user"
          ? "user"
          : "idle";

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    // Tras un logout, api queda en estado "Logged out" y cancelaría
    // esta petición (se ve como "Error de conexion"). Lo limpiamos antes.
    resetAuthState();
    try {
      const payload = user.includes("@")
        ? { correo: user, password: pass }
        : { usuario: user, password: pass };
      const res = await api.post("/usuarios/login", payload);
      if (res.data?.ok) {
        if (rememberMe) localStorage.setItem("rememberedUser", user);
        else localStorage.removeItem("rememberedUser");
        setShowWelcome(true);
        setTimeout(() => login(res.data.usuario), 1500);
        return;
      }
      setError(res.data?.message || "Credenciales incorrectas");
      setLoading(false);
    } catch (err) {
      setError(err.response?.data?.message || "Error de conexion");
      setLoading(false);
    }
  };

  const accentGrad = `linear-gradient(135deg, ${accent}, ${accent}bb)`;

  return (
    <div
      className={`h-screen w-screen flex items-center justify-center relative ${
        isDark
          ? "bg-gradient-to-br from-slate-900 via-slate-950 to-slate-800"
          : "bg-gradient-to-br from-slate-50 via-white to-slate-100"
      }`}
    >
      {/* Fondo */}
      {bgImage ? (
        <>
          <div className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-110" style={{ backgroundImage: `url(${bgImage})` }} />
          <div className={`absolute inset-0 ${isDark ? "bg-gradient-to-br from-slate-950/80 via-slate-950/60 to-slate-950/80" : "bg-gradient-to-br from-white/70 via-white/50 to-white/70"}`} />
          <div className="absolute inset-0 backdrop-blur-[1px]" />
        </>
      ) : (
        <div className="absolute inset-0">
          <div className={`absolute inset-0 ${isDark ? "opacity-[0.04]" : "opacity-[0.03]"}`} style={{ backgroundImage: `linear-gradient(${isDark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.06)"} 1px, transparent 1px), linear-gradient(90deg, ${isDark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.06)"} 1px, transparent 1px)`, backgroundSize: "60px 60px" }} />
          <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full blur-[120px] pointer-events-none" style={{ background: `radial-gradient(circle, ${accent}${isDark ? "33" : "22"}, transparent 70%)`, opacity: isDark ? 0.2 : 0.15 }} />
          <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full blur-[120px] pointer-events-none" style={{ background: `radial-gradient(circle, ${accent}${isDark ? "22" : "18"}, transparent 70%)`, opacity: isDark ? 0.2 : 0.15 }} />
        </div>
      )}

      {/* Tarjeta */}
      <div className="relative z-10" style={{ overflow: "visible" }}>
        {/* Halo energético — detrás de la tarjeta */}
        <EnergyHalo
          accent={accent}
          phase={phase}
          ripples={ripples}
          finale={loading || showWelcome}
        />

        {/* Tarjeta */}
        <div
          className={`relative overflow-hidden rounded-3xl shadow-2xl w-[400px] max-w-[calc(100vw-32px)] z-10 ${
            isDark
              ? "bg-slate-800/90 ring-1 ring-slate-700/50 backdrop-blur-xl"
              : "bg-white/95 ring-1 ring-slate-200/50 backdrop-blur-xl"
          }`}
          style={{
            transition: "box-shadow 0.8s ease",
            boxShadow: phase === "ready"
              ? `0 8px 44px ${accent}26, 0 0 60px ${accent}0d`
              : undefined,
          }}
        >
          {/* Welcome overlay */}
          {showWelcome && <WelcomeOverlay nombre={user} accent={accent} />}

          <div className="h-1 w-full" style={{ background: accentGrad }} />

          <div className="flex flex-col items-center px-10 py-10 text-center relative z-20">
            {/* Logo: núcleo del halo — respira y late con cada tecla */}
            <div className="relative mb-5">
              <div
                className="absolute inset-0 halo-logo-breathe"
                style={{ borderRadius: "1rem", background: `radial-gradient(circle, ${accent}40 0%, transparent 70%)`, filter: "blur(10px)", transform: "scale(1.4)", opacity: phase === "idle" ? 0.5 : 0.9, transition: "opacity 1s ease" }}
              />
              <div key={pulse} className={pulse > 0 ? "halo-logo-beat relative" : "relative"}>
                {logo ? (
                  <img src={logo} alt="Logo" className={`w-16 h-16 rounded-2xl shadow-lg object-cover ring-2 ${isDark ? "ring-slate-600/50" : "ring-white"}`} style={{ boxShadow: `0 4px 20px ${accent}30` }} />
                ) : (
                  <div className={`w-16 h-16 rounded-2xl shadow-lg flex items-center justify-center ring-2 ${isDark ? "ring-slate-600/50" : "ring-white"}`} style={{ background: accentGrad, boxShadow: `0 4px 20px ${accent}30` }}>
                    <span className="text-white font-bold text-2xl tracking-tight">P</span>
                  </div>
                )}
              </div>
            </div>

            <h1 className={`text-2xl font-bold mb-1 ${isDark ? "text-white" : "text-slate-900"}`}>
              Iniciar sesion
            </h1>
            <p className={`text-sm mb-6 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Ingresa tus credenciales para acceder
            </p>

            <form onSubmit={handleLogin} className="w-full flex flex-col items-center gap-3.5">
              <div className="relative w-full">
                <div className={`absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none ${isDark ? "text-slate-500" : "text-slate-400"}`}>
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
                  onChange={(e) => { setUser(e.target.value); keystroke(); }}
                  onFocus={() => setFocus("user")}
                  onBlur={() => setFocus(null)}
                  placeholder="Usuario o correo"
                  autoComplete="username"
                />
              </div>

              <div className="relative w-full">
                <div className={`absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none ${isDark ? "text-slate-500" : "text-slate-400"}`}>
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
                  onChange={(e) => { setPass(e.target.value); keystroke(); }}
                  onFocus={() => setFocus("pass")}
                  onBlur={() => setFocus(null)}
                  placeholder="Contrasena"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className={`absolute right-4 top-1/2 -translate-y-1/2 transition-colors cursor-pointer bg-transparent border-none p-0 ${isDark ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600"}`}
                >
                  {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none self-start ml-1">
                <div
                  className="w-[18px] h-[18px] rounded-md border-2 flex items-center justify-center transition-all"
                  style={{ borderColor: rememberMe ? accent : isDark ? "#475569" : "#cbd5e1", background: rememberMe ? accent : "transparent" }}
                >
                  {rememberMe && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <input type="checkbox" checked={rememberMe} onChange={() => setRememberMe(!rememberMe)} className="hidden" />
                <span className={`text-xs font-medium transition-colors ${isDark ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600"}`}>
                  Recordar usuario
                </span>
              </label>

              {error && (
                <div className={`w-full p-3 rounded-xl text-xs flex items-center gap-2.5 ${isDark ? "bg-red-900/20 border border-red-800/50 text-red-400" : "bg-red-50 border border-red-200 text-red-600"}`}>
                  <AlertCircle size={14} className="shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !user || !pass || showWelcome}
                className="w-full text-white font-semibold text-sm py-3 rounded-xl cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none inline-flex items-center justify-center gap-2"
                style={{ background: accentGrad, boxShadow: `0 4px 15px ${accent}40` }}
              >
                {loading ? <Loader2 size={17} className="animate-spin" /> : <LogIn size={17} />}
                {loading ? "Entrando..." : "Entrar"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
