import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../services/api";

const ListasContext = createContext(null);

const LISTAS_POR_DEFECTO = {
  tiposVehiculo: [
    { value: "moto", label: "Moto" },
    { value: "carro", label: "Carro" },
    { value: "camioneta", label: "Camioneta" },
    { value: "bicicleta", label: "Bicicleta" },
    { value: "otro", label: "Otro" },
  ],
  marcasVehiculo: [
    { value: "chevrolet", label: "Chevrolet" },
    { value: "renault", label: "Renault" },
    { value: "toyota", label: "Toyota" },
    { value: "mazda", label: "Mazda" },
    { value: "hyundai", label: "Hyundai" },
    { value: "kia", label: "Kia" },
    { value: "nissan", label: "Nissan" },
    { value: "ford", label: "Ford" },
    { value: "volkswagen", label: "Volkswagen" },
    { value: "suzuki", label: "Suzuki" },
    { value: "bmw", label: "BMW" },
    { value: "mercedes-benz", label: "Mercedes-Benz" },
    { value: "audi", label: "Audi" },
    { value: "honda", label: "Honda" },
    { value: "mitsubishi", label: "Mitsubishi" },
    { value: "subaru", label: "Subaru" },
    { value: "peugeot", label: "Peugeot" },
    { value: "citroen", label: "Citroën" },
    { value: "fiat", label: "Fiat" },
    { value: "jeep", label: "Jeep" },
    { value: "volvo", label: "Volvo" },
    { value: "dongfeng", label: "Dongfeng" },
    { value: "jac", label: "JAC" },
    { value: "great-wall", label: "Great Wall" },
    { value: "changan", label: "Changan" },
    { value: "baic", label: "BAIC" },
    { value: "yamaha", label: "Yamaha" },
    { value: "activo", label: "Activo" },
    { value: "victory", label: "Victory" },
    { value: "akt", label: "AKT" },
  ],
  clasesVehiculo: [
    { value: "particular", label: "Particular" },
    { value: "publico", label: "Público" },
    { value: "carga", label: "Carga" },
    { value: "electrico", label: "Eléctrico" },
    { value: "deportivo", label: "Deportivo" },
    { value: "especial", label: "Especial" },
  ],
  tiposPuesto: [
    { value: "carro", label: "Carro" },
    { value: "moto", label: "Moto" },
    { value: "camioneta", label: "Camioneta" },
    { value: "bicicleta", label: "Bicicleta" },
    { value: "discapacitado", label: "Discapacitado" },
    { value: "carga", label: "Carga" },
    { value: "otro", label: "Otro" },
  ],
  zonas: [
    { value: "Zona A", label: "Zona A" },
    { value: "Zona B", label: "Zona B" },
    { value: "Zona C", label: "Zona C" },
    { value: "Zona D", label: "Zona D" },
    { value: "Zona E", label: "Zona E" },
    { value: "Zona VIP", label: "Zona VIP" },
    { value: "Zona Carga", label: "Zona Carga" },
    { value: "Zona Visitantes", label: "Zona Visitantes" },
  ],
  categoriasGasto: [
    { value: "servicios", label: "Servicios" },
    { value: "empleados", label: "Empleados" },
    { value: "mantenimiento", label: "Mantenimiento" },
    { value: "vigilancia", label: "Vigilancia" },
    { value: "limpieza", label: "Limpieza" },
    { value: "papeleria", label: "Papelería" },
    { value: "servicios-publicos", label: "Servicios Públicos" },
    { value: "impuestos", label: "Impuestos" },
    { value: "arriendo", label: "Arriendo" },
    { value: "seguros", label: "Seguros" },
    { value: "transporte", label: "Transporte" },
    { value: "marketing", label: "Marketing" },
    { value: "alimentacion", label: "Alimentación" },
    { value: "dotacion", label: "Dotación" },
    { value: "reparaciones", label: "Reparaciones" },
    { value: "tecnologia", label: "Tecnología" },
    { value: "otros", label: "Otros" },
  ],
};

function mergeListas(db, defaults) {
  if (!db) return defaults;
  const result = {};
  for (const key of Object.keys(defaults)) {
    const dbList = db[key];
    if (Array.isArray(dbList) && dbList.length > 0) {
      result[key] = dbList;
    } else {
      result[key] = defaults[key];
    }
  }
  return result;
}

export function ListasProvider({ children }) {
  const [listas, setListas] = useState(LISTAS_POR_DEFECTO);

  const cargarListas = useCallback(async () => {
    try {
      const res = await api.get("/configuracion");
      const config = res.data.configuracion;
      if (config?.listasConfiguracion) {
        setListas(mergeListas(config.listasConfiguracion, LISTAS_POR_DEFECTO));
      } else {
        setListas(LISTAS_POR_DEFECTO);
      }
    } catch {
      setListas(LISTAS_POR_DEFECTO);
    }
  }, []);

  useEffect(() => { cargarListas(); }, [cargarListas]);

  const guardarListas = useCallback(async (nuevasListas) => {
    setListas(nuevasListas);
  }, []);

  return (
    <ListasContext.Provider value={{ listas, guardarListas, recargarListas: cargarListas }}>
      {children}
    </ListasContext.Provider>
  );
}

export const useListas = () => {
  const context = useContext(ListasContext);
  if (!context) throw new Error("useListas debe usarse dentro de ListasProvider");
  return context;
};

export { LISTAS_POR_DEFECTO };
