import { GoogleOAuthProvider } from "@react-oauth/google";
import AppRouter from "./routes/AppRouter";
import { NotificacionProvider } from "./context/NotificacionContext";
import { ConfigProvider, useConfig } from "./context/ConfigContext";
import { ListasProvider } from "./context/ListasContext";
import ErrorBoundary from "./components/ErrorBoundary";
import { useEffect } from "react";

function hexToHsl(hex) {
  let r = 0, g = 0, b = 0;
  if (hex.startsWith("#")) hex = hex.slice(1);
  if (hex.length === 3) hex = hex.split("").map(c => c + c).join("");
  if (hex.length === 6) {
    r = parseInt(hex.slice(0, 2), 16) / 255;
    g = parseInt(hex.slice(2, 4), 16) / 255;
    b = parseInt(hex.slice(4, 6), 16) / 255;
  }
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function injectThemeStyle(config) {
  const existing = document.getElementById("theme-dynamic");
  if (existing) existing.remove();

  const root = document.documentElement;
  const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
  const lightness = [97, 95, 90, 80, 70, 60, 50, 40, 30, 20];

  const vars = [];
  const setVar = (name, hex) => {
    if (!hex) return;
    const { h, s } = hexToHsl(hex);
    shades.forEach((sh, i) => vars.push(`--${name}-${sh}: hsl(${h}, ${s}%, ${lightness[i]}%)`));
  };

  setVar("teal", config.colorPrincipal || "#0d9488");
  setVar("emerald", config.colorSecundario || "#14b8a6");
  setVar("brand", config.colorPrincipal || "#0d9488");
  setVar("accent", config.colorSecundario || "#14b8a6");
  vars.push(`--color-primary: ${config.colorPrincipal || "#0d9488"}`);
  vars.push(`--color-secondary: ${config.colorSecundario || "#14b8a6"}`);
  vars.push(`--color-bg: ${config.colorFondo || "#ffffff"}`);

  const tc = config.colorPrincipal || "#0d9488";
  const ec = config.colorSecundario || "#14b8a6";
  const css = `
:root{${vars.map(v => `${v};`).join("")}}
.bg-teal-600{background-color:var(--teal-600)}
.text-teal-600{color:var(--teal-600)}
.text-teal-700{color:var(--teal-700)}
.border-teal-600{border-color:var(--teal-600)}
.ring-teal-500{--tw-ring-color:var(--teal-500)}
.shadow-teal-600\\/20{--tw-shadow-color:color-mix(in srgb, ${tc} 20%, transparent)}
.shadow-teal-600\\/30{--tw-shadow-color:color-mix(in srgb, ${tc} 30%, transparent)}
.bg-emerald-600{background-color:var(--emerald-600)}
.text-emerald-600{color:var(--emerald-600)}
.text-emerald-700{color:var(--emerald-700)}
.bg-emerald-50{background-color:var(--emerald-50)}
.text-emerald-500{color:var(--emerald-500)}
.shadow-emerald-600\\/20{--tw-shadow-color:color-mix(in srgb, ${ec} 20%, transparent)}
.shadow-emerald-600\\/30{--tw-shadow-color:color-mix(in srgb, ${ec} 30%, transparent)}
.hover\\:bg-teal-700:hover{background-color:var(--teal-700)}
.hover\\:bg-emerald-700:hover{background-color:var(--emerald-700)}
.hover\\:text-teal-600:hover{color:var(--teal-600)}
.focus\\:border-teal-500:focus{border-color:var(--teal-500)}
.focus\\:ring-teal-500:focus{--tw-ring-color:var(--teal-500)}
.bg-brand-600{background-color:var(--brand-600)}
.text-brand-600{color:var(--brand-600)}
.text-brand-700{color:var(--brand-700)}
.border-brand-600{border-color:var(--brand-600)}
.ring-brand-500{--tw-ring-color:var(--brand-500)}
.bg-accent-600{background-color:var(--accent-600)}
.text-accent-600{color:var(--accent-600)}
.bg-accent-50{background-color:var(--accent-50)}`;

  const style = document.createElement("style");
  style.id = "theme-dynamic";
  style.textContent = css;
  document.head.appendChild(style);

  if (config.modoOscuro) root.classList.add("dark");
  else root.classList.remove("dark");
  root.style.fontSize = config.tamanoFuente === "small" ? "14px" : config.tamanoFuente === "large" ? "17px" : "15.5px";
}

function ThemeApplier({ children }) {
  const { config } = useConfig();
  useEffect(() => {
    if (config) injectThemeStyle(config);
  }, [config]);
  return children;
}

function App() {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
  return (
    <ErrorBoundary>
      <GoogleOAuthProvider clientId={googleClientId}>
        <ConfigProvider>
          <ListasProvider>
            <ThemeApplier>
              <NotificacionProvider>
                <AppRouter />
              </NotificacionProvider>
            </ThemeApplier>
          </ListasProvider>
        </ConfigProvider>
      </GoogleOAuthProvider>
    </ErrorBoundary>
  );
}

export default App;