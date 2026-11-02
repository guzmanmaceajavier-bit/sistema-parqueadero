import { AppError } from "../../middlewares/error.middleware.js";

export function calcularProximaGeneracion(periodicidad: string | null | undefined, desde = new Date()) {
  const siguiente = new Date(desde);
  switch (periodicidad) {
    case "semanal":
      siguiente.setDate(siguiente.getDate() + 7);
      return siguiente;
    case "mensual": {
      const dia = siguiente.getDate();
      const eraFinDeMes = dia === new Date(siguiente.getFullYear(), siguiente.getMonth() + 1, 0).getDate();
      siguiente.setDate(1);
      siguiente.setMonth(siguiente.getMonth() + 1);
      const ultimoDia = new Date(siguiente.getFullYear(), siguiente.getMonth() + 1, 0).getDate();
      siguiente.setDate(eraFinDeMes ? ultimoDia : Math.min(dia, ultimoDia));
      return siguiente;
    }
    case "anual": {
      const mes = siguiente.getMonth();
      const dia = siguiente.getDate();
      siguiente.setDate(1);
      siguiente.setFullYear(siguiente.getFullYear() + 1);
      siguiente.setMonth(mes);
      const ultimoDia = new Date(siguiente.getFullYear(), mes + 1, 0).getDate();
      siguiente.setDate(Math.min(dia, ultimoDia));
      return siguiente;
    }
    default:
      throw new AppError("Periodicidad no válida. Usa semanal, mensual o anual.", 400);
  }
}
