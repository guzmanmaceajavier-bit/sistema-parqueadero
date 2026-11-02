export interface ConteoEstadosPuesto {
  estado: string;
  _count: number;
}

export function resumirEstadosPuestos(puestos: ConteoEstadosPuesto[]) {
  const conteos = new Map(puestos.map((puesto) => [puesto.estado, puesto._count]));
  const total = puestos.reduce((suma, puesto) => suma + puesto._count, 0);
  const ocupados = conteos.get("OCUPADO") || 0;
  const libres = conteos.get("LIBRE") || 0;
  const reservados = conteos.get("RESERVADO") || 0;
  const mantenimiento = conteos.get("MANTENIMIENTO") || 0;
  const ausencias = conteos.get("AUSENCIA") || 0;

  return {
    total,
    ocupados,
    libres,
    reservados,
    mantenimiento,
    ausencias,
  };
}
