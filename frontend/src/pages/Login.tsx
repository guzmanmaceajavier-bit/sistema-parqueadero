import { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useConfig } from "../context/ConfigContext";
import { Eye, EyeOff, Loader2, LogIn, AlertCircle, User, Lock, Car, LayoutDashboard, FileText } from "lucide-react";
import api, { resetAuthState } from "../services/api";

/* ─── Halo energético v2: responde al usuario (solo CSS) ───
   idle → respiración casi imperceptible · user → ondas desde el logo +
   partículas progresivas en órbita orgánica · pass → un poco más de
   energía · ready → secuencia de convergencia en 5 fases · finale →
   onda desde el logo + fade continuo de la tarjeta. Sin porcentajes. */

/* Semilla de partículas: cada una con órbita, ritmo y brillo propios
   para que no parezcan un reloj. */
const PARTICLE_SEED = Array.from({ length: 8 }).map((_, i) => ({
  a0: (i * 47 + 13) % 360,
  r: 418 + ((i * 37) % 26),
  size: 4 + (i % 3),
  dur: 23 + ((i * 13) % 8),
  delay: -((i * 3.7) % 23),
  op: 0.55 + (((i * 29) % 35) / 100),
}));

function EnergyHalo({ accent, phase, particleCount, fast, converge }) {
  const showOrbit = phase !== "idle" && particleCount > 0;
  const orbitScale = 1 - converge * 0.09;

  return (
    <div className="absolute pointer-events-none z-0 flex items-center justify-center" style={{ top: "-46px", left: "-46px", right: "-46px", bottom: "-46px" }}>
      <div className="relative w-full h-full" style={{ transform: `scale(${1 - converge * 0.015})`, transition: "transform 0.35s ease-out" }}>
        {/* Respiración base, casi imperceptible */}
        <div
          className="absolute inset-0 halo-breathe halo-glow-a"
          style={{
            borderRadius: "3rem",
            background: `radial-gradient(ellipse at center, ${accent}24 0%, ${accent}12 45%, transparent 70%)`,
          }}
        />
        <div
          className="absolute halo-breathe halo-glow-b"
          style={{
            inset: "-36px",
            borderRadius: "4rem",
            background: `radial-gradient(ellipse at center, ${accent}12 0%, transparent 65%)`,
            animationDelay: "-3.5s",
            opacity: fast ? 0.9 : 0.6,
            transition: "opacity 1.2s ease",
          }}
        />

        {/* Órbita orgánica: cada partícula gira a su propio ritmo */}
        {showOrbit && (
          <div className="absolute inset-0" style={{ transform: `scale(${orbitScale})`, opacity: 0.8 + converge * 0.04, transition: "transform 0.35s ease-out, opacity 0.35s ease" }}>
            {PARTICLE_SEED.slice(0, particleCount).map((p, i) => (
              <span
                key={i}
                className="absolute left-1/2 top-1/2 halo-particle"
                style={{
                  "--a0": `${p.a0}deg`,
                  "--or": `${p.r}px`,
                  margin: -3,
                  opacity: p.op,
                  animationDuration: `${fast ? p.dur * 0.68 : p.dur}s`,
                  animationDelay: `${p.delay}s`,
                }}
              >
                <span
                  className="block halo-shimmer"
                  style={{
                    width: p.size,
                    height: p.size,
                    borderRadius: 9999,
                    background: accent,
                    boxShadow: `0 0 8px ${accent}`,
                    animationDelay: `${p.delay * 0.4}s`,
                  }}
                />
              </span>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes halo-breathe {
          0%, 100% { transform: scale(1); opacity: 0.45; }
          50% { transform: scale(1.015); opacity: 0.58; }
        }
        .halo-breathe { animation: halo-breathe 7s ease-in-out infinite; }
        .halo-glow-a { filter: blur(28px); }
        .halo-glow-b { filter: blur(44px); }
        @keyframes halo-orbit {
          from { transform: rotate(var(--a0)) translateX(var(--or)); }
          to { transform: rotate(calc(var(--a0) + 360deg)) translateX(var(--or)); }
        }
        .halo-particle {
          animation-name: halo-orbit;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        @keyframes halo-shimmer {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.35); opacity: 1; }
        }
        .halo-shimmer { animation: halo-shimmer 3.2s ease-in-out infinite; }
        @keyframes logo-breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.045); }
        }
        .halo-logo-breathe { animation: logo-breathe 5s ease-in-out infinite; }
        @keyframes logo-beat {
          0% { transform: scale(1); }
          35% { transform: scale(1.04); }
          100% { transform: scale(1); }
        }
        .halo-logo-beat { animation: logo-beat 0.5s ease-out; }
        .halo-wave-pair {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 0;
          height: 0;
          pointer-events: none;
        }
        .halo-logo-wave {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 440px;
          height: 440px;
          translate: -50% -50%;
          border-radius: 9999px;
          border: 3px solid;
          animation: halo-logo-wave 0.65s ease-out forwards;
          pointer-events: none;
        }
        .halo-logo-echo { animation-delay: 0.12s; border-width: 2px; }
        @keyframes halo-logo-wave {
          0% { transform: scale(0.12); opacity: 0.75; }
          100% { transform: scale(1.04); opacity: 0; }
        }
        .halo-logo-release {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 420px;
          height: 420px;
          translate: -50% -50%;
          border-radius: 9999px;
          border: 2px solid;
          animation: halo-logo-release 1.2s ease-out forwards;
          pointer-events: none;
        }
        @keyframes halo-logo-release {
          0% { transform: scale(0.1); opacity: 0.55; }
          100% { transform: scale(1.05); opacity: 0; }
        }
        .halo-logo-finale {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 460px;
          height: 460px;
          translate: -50% -50%;
          border-radius: 9999px;
          border: 2px solid;
          animation: halo-logo-finale 1.1s ease-out forwards;
          pointer-events: none;
        }
        @keyframes halo-logo-finale {
          0% { transform: scale(0.12); opacity: 0.65; }
          100% { transform: scale(1.15); opacity: 0; }
        }
        @media (max-width: 640px) {
          .halo-glow-a { filter: blur(16px); }
          .halo-glow-b { filter: blur(26px); }
          .halo-particle:nth-child(n+6) { display: none; }
          .halo-logo-wave, .halo-logo-release, .halo-logo-finale {
            width: 300px;
            height: 300px;
          }
        }
      `}</style>
    </div>
  );
}

/* Ondas que nacen en el centro del logo: anillo principal + eco con
   delay para dar cuerpo, ambos con glow para que se vean. */
function LogoWaves({ accent, ripples, releaseId, finale }) {
  const glow = `0 0 26px ${accent}73, inset 0 0 16px ${accent}40`;
  return (
    <>
      {ripples.map((id) => (
        <span key={id} className="halo-wave-pair">
          <span className="halo-logo-wave" style={{ borderColor: `${accent}b3`, boxShadow: glow }} />
          <span className="halo-logo-wave halo-logo-echo" style={{ borderColor: `${accent}73`, boxShadow: `0 0 18px ${accent}59` }} />
        </span>
      ))}
      {releaseId > 0 && (
        <span key={releaseId} className="halo-logo-release" style={{ borderColor: `${accent}99`, boxShadow: glow }} />
      )}
      {finale && (
        <span className="halo-logo-finale" style={{ borderColor: `${accent}99`, boxShadow: glow }} />
      )}
    </>
  );
}

const ROL_LABEL = { admin: "Administrador", supervisor: "Supervisor", empleado: "Empleado" };

/* ─── Overlay de bienvenida: cierra la secuencia del halo ─── */
function WelcomeOverlay({ nombre, rol, accent, leaving }) {
  return (
    <div className="absolute inset-0 z-30 overflow-hidden"
      style={{
        opacity: leaving ? 0 : 1,
        transition: "opacity 0.4s ease",
        animation: "welcome-fade 0.4s ease-out forwards",
      }}
    >
      {/* Velo ligero para atenuar el login detrás */}
      <div className="absolute inset-0" style={{
        background: "radial-gradient(70% 65% at 50% 48%, rgba(3,11,22,0.42) 0%, rgba(2,7,15,0.72) 100%)",
      }} />
      {/* Humo decorativo en las esquinas, lejos del texto */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-16 -left-16 w-72 h-72 rounded-full welcome-smoke-a" style={{ background: `${accent}59`, filter: "blur(70px)" }} />
        <div className="absolute -bottom-20 -right-14 w-80 h-80 rounded-full welcome-smoke-b" style={{ background: "#1d4ed859", filter: "blur(70px)" }} />
        <div className="absolute top-1/4 -right-20 w-60 h-60 rounded-full welcome-smoke-a" style={{ background: `${accent}40`, filter: "blur(60px)", animationDelay: "-4s" }} />
        <div className="absolute -bottom-16 -left-14 w-60 h-60 rounded-full welcome-smoke-b" style={{ background: "#0ea5e54d", filter: "blur(60px)", animationDelay: "-6s" }} />
      </div>

      {/* Contenido flotante sin panel: solo humo detrás y letras blancas */}
      <div className="relative flex flex-col items-center px-6 py-4">
      <style>{`
        @keyframes welcome-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes welcome-ring {
          0% { transform: scale(0.6); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes welcome-check-ring {
          0% { transform: scale(0.55); opacity: 0.8; }
          100% { transform: scale(1.7); opacity: 0; }
        }
        .welcome-check-ring { animation: welcome-check-ring 1.1s ease-out 0.5s both; }
        @keyframes welcome-pop {
          0% { transform: scale(0.92); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes welcome-draw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes welcome-rise {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes welcome-shimmer {
          0% { transform: translateX(-110%); }
          100% { transform: translateX(320%); }
        }
        @keyframes welcome-smoke-a {
          0%, 100% { transform: translate(0, 0); opacity: 0.75; }
          50% { transform: translate(26px, 18px); opacity: 1; }
        }
        @keyframes welcome-smoke-b {
          0%, 100% { transform: translate(0, 0); opacity: 1; }
          50% { transform: translate(-24px, -16px); opacity: 0.75; }
        }
        .welcome-smoke-a { animation: welcome-smoke-a 9s ease-in-out infinite; }
        .welcome-smoke-b { animation: welcome-smoke-b 11s ease-in-out infinite; }
      `}</style>

      {/* Check con trazo dibujado + anillo único + glow que respira */}
      <div className="relative mb-5" style={{ animation: "welcome-ring 0.5s cubic-bezier(0.3, 1.4, 0.5, 1) both" }}>
        <div className="absolute inset-0 rounded-full halo-logo-breathe" style={{ boxShadow: `0 0 34px ${accent}aa`, filter: "blur(6px)" }} />
        <span className="absolute inset-0 rounded-full welcome-check-ring" style={{ border: `1.5px solid ${accent}99` }} />
        <svg width="76" height="76" viewBox="0 0 76 76" fill="none" className="relative">
          <circle cx="38" cy="38" r="34" stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" />
          <circle cx="38" cy="38" r="34" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round"
            strokeDasharray="214" strokeDashoffset="214"
            style={{ animation: "welcome-draw 0.7s ease-out 0.25s forwards", transform: "rotate(-90deg)", transformOrigin: "center" }} />
          <path d="M27 39 l8 8 l15 -17" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray="40" strokeDashoffset="40"
            style={{ animation: "welcome-draw 0.45s ease-out 0.55s forwards" }} />
        </svg>
      </div>

      <h2 className="text-3xl font-extrabold text-white mb-2" style={{ textShadow: "0 2px 14px rgba(0,0,0,0.55)" }}>
        Bienvenido, {nombre || "Usuario"}
      </h2>
      <div className="flex items-center gap-3 mb-5">
        <span className="block w-10 h-px" style={{ background: "linear-gradient(to right, transparent, rgba(255,255,255,0.5))" }} />
        <span className="inline-block text-xs font-semibold tracking-[0.18em] uppercase px-4 py-2 rounded-full text-white"
          style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.35)", textShadow: "0 1px 6px rgba(0,0,0,0.5)" }}>
          {ROL_LABEL[rol] || "Acceso autorizado"}
        </span>
        <span className="block w-10 h-px" style={{ background: "linear-gradient(to left, transparent, rgba(255,255,255,0.5))" }} />
      </div>
      <div className="w-44 rounded-full bg-white/15 overflow-hidden" style={{ height: 3, animation: "welcome-rise 0.45s ease-out 0.7s both", boxShadow: "0 0 12px rgba(255,255,255,0.25)" }}>
        <div className="h-full w-1/3 rounded-full bg-white" style={{ animation: "welcome-shimmer 1.1s ease-in-out infinite", boxShadow: "0 0 10px rgba(255,255,255,0.9)" }} />
      </div>
      <span className="mt-3 text-[11px] tracking-wide text-white" style={{ opacity: 0.85 }}>
        Entrando al panel…
      </span>
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

  const savedUser = localStorage.getItem("rememberedUser") || "";
  const [user, setUser] = useState(savedUser || "admin");
  const [pass, setPass] = useState("Admin123");
  const [rememberMe, setRememberMe] = useState(!!savedUser);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeUser, setWelcomeUser] = useState(null);
  const [welcomeLeaving, setWelcomeLeaving] = useState(false);

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

  // Partículas progresivas: pocas al empezar, todas al escribir más.
  const typedChars = user.trim().length + pass.length;
  const particleCount = typedChars <= 0 ? 0 : typedChars <= 2 ? 2 : typedChars <= 5 ? 4 : typedChars <= 9 ? 6 : 8;
  const fast = phase === "pass";

  // Secuencia de convergencia (~1s en 5 fases) al completar:
  // órbita que decae → partículas al logo → logo concentra → halo que
  // se contrae → onda suave de liberación. Se mantiene mientras siga completo.
  const [converge, setConverge] = useState(0);
  const [releaseId, setReleaseId] = useState(0);
  useEffect(() => {
    if (!complete || loading || showWelcome) {
      setConverge(0);
      return;
    }
    const timers = [200, 450, 700, 950].map((ms, i) =>
      setTimeout(() => {
        setConverge(i + 1);
        if (i === 3) setReleaseId(Date.now());
      }, ms)
    );
    return () => timers.forEach(clearTimeout);
  }, [complete, loading, showWelcome]);

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
        setWelcomeUser(res.data.usuario);
        setWelcomeLeaving(false);
        setShowWelcome(true);
        // Visible ~2s para leerlo: entra (0.4s) + lectura + salida (0.4s).
        setTimeout(() => setWelcomeLeaving(true), 2000);
        setTimeout(() => login(res.data.usuario), 2400);
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

  // Escena fija del login: navy profundo + tarjeta blanca, igual con
  // tema claro u oscuro. El accent de configuración sigue mandando.
  return (
    <div className="login-scope h-screen w-screen flex items-center justify-center relative overflow-hidden" style={{ background: "#030b16" }}>
      {/* Fondo cinematográfico fijo */}
      {bgImage ? (
        <>
          <div className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-110" style={{ backgroundImage: `url(${bgImage})` }} />
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950/85 via-slate-950/65 to-slate-950/85" />
          <div className="absolute inset-0 backdrop-blur-[1px]" />
        </>
      ) : (
        <div className="absolute inset-0">
          <div className="absolute inset-0" style={{ background: "radial-gradient(1100px 750px at 50% 18%, #0b2b4d 0%, #051322 52%, #02070f 100%)" }} />
          <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)", backgroundSize: "56px 56px", maskImage: "radial-gradient(700px 500px at 50% 45%, black 30%, transparent 75%)", WebkitMaskImage: "radial-gradient(700px 500px at 50% 45%, black 30%, transparent 75%)" }} />
          <div className="absolute -top-48 left-1/2 -translate-x-1/2 w-[640px] h-[420px] rounded-full blur-[130px] pointer-events-none" style={{ background: `radial-gradient(ellipse, ${accent}59 0%, transparent 70%)`, opacity: 0.5 }} />
          <div className="absolute -bottom-56 -left-40 w-[520px] h-[520px] rounded-full blur-[130px] pointer-events-none" style={{ background: "radial-gradient(circle, #1d4ed866 0%, transparent 70%)", opacity: 0.5 }} />
          <div className="absolute -bottom-56 -right-40 w-[520px] h-[520px] rounded-full blur-[130px] pointer-events-none" style={{ background: `radial-gradient(circle, ${accent}40 0%, transparent 70%)`, opacity: 0.4 }} />
          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(120% 90% at 50% 50%, transparent 55%, rgba(0,0,0,0.5) 100%)" }} />
        </div>
      )}

      {/* Tarjeta */}
      <div className="relative z-10" style={{ overflow: "visible" }}>
        {/* Halo energético — detrás de la tarjeta */}
        <EnergyHalo
          accent={accent}
          phase={phase}
          particleCount={phase === "idle" ? 0 : particleCount}
          fast={fast}
          converge={converge}
        />

        {/* Tarjeta */}
        <div
          className="relative overflow-hidden rounded-3xl shadow-2xl w-[860px] max-w-[calc(100vw-32px)] z-10 bg-white/95 ring-1 ring-white/50 backdrop-blur-xl grid md:grid-cols-[1fr_1fr]"
          style={{
            transition: "box-shadow 0.8s ease, opacity 0.6s ease, transform 0.6s cubic-bezier(0.4, 0, 0.2, 1), filter 0.6s ease",
            boxShadow: phase === "ready" || converge > 0
              ? `0 8px 44px ${accent}26, 0 0 60px ${accent}0d`
              : undefined,
            opacity: loading ? 0.62 : 1,
            transform: loading ? "scale(0.98)" : "scale(1)",
            filter: loading ? "blur(2px)" : "blur(0px)",
          }}
        >
          <div className="absolute top-0 inset-x-0 h-1 z-20" style={{ background: accentGrad }} />

          {/* Columna del formulario */}
          <div className="flex flex-col items-center px-8 sm:px-10 py-10 text-center relative z-20">
            {/* Logo: núcleo del halo — respira y late con cada tecla */}
            <div className="relative mb-5">
              <LogoWaves accent={accent} ripples={ripples} releaseId={releaseId} finale={loading || showWelcome} />
              <div
                className="absolute inset-0 halo-logo-breathe"
                style={{ borderRadius: "1rem", background: `radial-gradient(circle, ${accent}40 0%, transparent 70%)`, filter: "blur(10px)", transform: "scale(1.4)", opacity: phase === "idle" ? 0.5 : 0.9, transition: "opacity 1s ease" }}
              />
              <div key={pulse} className={pulse > 0 ? "halo-logo-beat relative" : "relative"}>
                {logo ? (
                <img src={logo} alt="Logo" className="w-16 h-16 rounded-2xl shadow-lg object-cover ring-2 ring-white" style={{ boxShadow: `0 4px 20px ${accent}30` }} />
              ) : (
                <div className="w-16 h-16 rounded-2xl shadow-lg flex items-center justify-center ring-2 ring-white" style={{ background: accentGrad, boxShadow: `0 4px 20px ${accent}30` }}>
                    <span className="text-white font-bold text-2xl tracking-tight">P</span>
                  </div>
                )}
              </div>
            </div>

            <h1 className="text-2xl font-bold mb-1 text-slate-900">
              Iniciar sesion
            </h1>
            <p className="text-sm mb-6 text-slate-500">
              Ingresa tus credenciales para acceder
            </p>

            <form onSubmit={handleLogin} className="w-full flex flex-col items-center gap-3.5">
              <div className="relative w-full group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 opacity-70 transition-all duration-300 group-focus-within:opacity-100 group-focus-within:translate-x-[2px]">
                  <User size={18} />
                </div>
                <input
                  className="w-full border-2 rounded-xl py-3 pl-12 pr-4 text-sm outline-none transition-all duration-200 placeholder:transition-opacity placeholder:duration-300 focus:placeholder:opacity-50 bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:shadow-[0_0_0_4px_rgba(13,148,136,0.12)]"
                  type="text"
                  value={user}
                  onChange={(e) => { setUser(e.target.value); keystroke(); }}
                  onFocus={() => setFocus("user")}
                  onBlur={() => setFocus(null)}
                  placeholder="Usuario o correo"
                  autoComplete="username"
                />
              </div>

              <div className="relative w-full group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 opacity-70 transition-all duration-300 group-focus-within:opacity-100 group-focus-within:translate-x-[2px]">
                  <Lock size={18} />
                </div>
                <input
                  className="w-full border-2 rounded-xl py-3 pl-12 pr-12 text-sm outline-none transition-all duration-200 placeholder:transition-opacity placeholder:duration-300 focus:placeholder:opacity-50 bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:shadow-[0_0_0_4px_rgba(13,148,136,0.12)]"
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
                  className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors cursor-pointer bg-transparent border-none p-0 text-slate-400 hover:text-slate-600"
                >
                  {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none self-start ml-1">
                <div
                  className="w-[18px] h-[18px] rounded-md border-2 flex items-center justify-center transition-all"
                  style={{ borderColor: rememberMe ? accent : "#cbd5e1", background: rememberMe ? accent : "transparent" }}
                >
                  {rememberMe && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <input type="checkbox" checked={rememberMe} onChange={() => setRememberMe(!rememberMe)} className="hidden" />
                <span className="text-xs font-medium transition-colors text-slate-400 hover:text-slate-600">
                  Recordar usuario
                </span>
              </label>

              {error && (
                <div className="w-full p-3 rounded-xl text-xs flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-600">
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

          {/* Columna de marca (solo desktop) */}
          <div className="relative hidden md:flex flex-col justify-between overflow-hidden p-10 text-white" style={{ background: "linear-gradient(155deg, #0d3057 0%, #071a30 55%, #030b16 100%)" }}>
            {/* Decoración */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full blur-[100px]" style={{ background: `${accent}4d`, opacity: 0.55 }} />
              <div className="absolute -bottom-32 -left-24 w-80 h-80 rounded-full blur-[100px]" style={{ background: "#1d4ed855", opacity: 0.5 }} />
              <span className="absolute -bottom-10 -right-4 text-[190px] leading-none font-extrabold tracking-tighter select-none" style={{ color: "rgba(255,255,255,0.05)" }}>P</span>
            </div>

            <div className="relative">
              <span className="inline-block text-[11px] font-semibold tracking-[0.22em] uppercase px-3 py-1.5 rounded-full" style={{ background: `${accent}26`, color: "#99f6e4", border: `1px solid ${accent}55` }}>
                {config?.nombreParqueadero || "ParkAdmin"}
              </span>
              <h2 className="mt-5 text-3xl font-bold leading-tight">
                Control total de tu parqueadero, en tiempo real.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-300/90">
                Entradas y salidas, caja, planes mensuales y facturación desde un solo panel.
              </p>
            </div>

            <ul className="relative mt-8 space-y-4 text-sm">
              {[
                { icon: Car, title: "Cobro automático", desc: "Por minuto, hora, día o mes." },
                { icon: LayoutDashboard, title: "Caja y dashboard en vivo", desc: "Ocupación e ingresos al momento." },
                { icon: FileText, title: "Facturación en PDF", desc: "Tickets y reportes listos." },
              ].map(({ icon: Icon, title, desc }) => (
                <li key={title} className="flex items-start gap-3">
                  <span className="mt-0.5 w-9 h-9 shrink-0 rounded-xl flex items-center justify-center" style={{ background: `${accent}22`, border: `1px solid ${accent}44` }}>
                    <Icon size={17} style={{ color: "#99f6e4" }} />
                  </span>
                  <span>
                    <span className="block font-semibold text-white">{title}</span>
                    <span className="block text-xs text-slate-300/80 mt-0.5">{desc}</span>
                  </span>
                </li>
              ))}
            </ul>

            <p className="relative mt-8 text-[11px] tracking-wide text-slate-400/80">
              Acceso seguro · roles por usuario
            </p>
          </div>
        </div>

        {/* Welcome overlay FUERA de la tarjeta: la tarjeta se difumina al
            entrar, pero la bienvenida debe quedar siempre nítida */}
        {showWelcome && (
          <div className="absolute inset-0 z-20 overflow-hidden rounded-3xl">
            <WelcomeOverlay
              nombre={welcomeUser?.nombre || user}
              rol={welcomeUser?.rol}
              accent={accent}
              leaving={welcomeLeaving}
            />
          </div>
        )}
      </div>
    </div>
  );
}
