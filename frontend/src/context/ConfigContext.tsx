import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api, { rawApi } from "../services/api";
import { syncFormatterConfig } from "../utils/formatters";

const ConfigContext = createContext(null);

export function ConfigProvider({ children }) {
  const [config, setConfig] = useState(null);

  const cargarConfig = async () => {
    try {
      const res = await rawApi.get("/configuracion");
      if (res.data.configuracion) {
        setConfig(res.data.configuracion);
        syncFormatterConfig(res.data.configuracion);
      }
    } catch { }
  };

  useEffect(() => { cargarConfig(); }, []);

  const toggleModoOscuro = useCallback(async () => {
    try {
      const nuevoValor = !config?.modoOscuro;
      await rawApi.post("/configuracion", { ...config, modoOscuro: nuevoValor });
      document.documentElement.classList.toggle("dark", nuevoValor);
      await cargarConfig();
    } catch {}
  }, [config]);

  return (
    <ConfigContext.Provider value={{ config, recargarConfig: cargarConfig, toggleModoOscuro }}>
      {children}
    </ConfigContext.Provider>
  );
}

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (!context) throw new Error("useConfig debe usarse dentro de ConfigProvider");
  return context;
};
