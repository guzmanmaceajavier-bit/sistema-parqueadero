import prisma from "../config/prisma.js";

function diffMinutos(fechaEntrada, fechaSalida) {
  return Math.ceil((fechaSalida - fechaEntrada) / (1000 * 60));
}

function diffDias(fechaEntrada, fechaSalida) {
  return Math.ceil((fechaSalida - fechaEntrada) / (1000 * 60 * 60 * 24));
}

function diffSemanas(fechaEntrada, fechaSalida) {
  return Math.ceil((fechaSalida - fechaEntrada) / (1000 * 60 * 60 * 24 * 7));
}

function diffMeses(fechaEntrada, fechaSalida) {
  let meses = (fechaSalida.getFullYear() - fechaEntrada.getFullYear()) * 12;
  meses += fechaSalida.getMonth() - fechaEntrada.getMonth();
  if (fechaSalida.getDate() >= fechaEntrada.getDate()) meses++;
  return Math.max(1, meses);
}

export async function calcularCobro({ ingreso, tipoVehiculo, modalidad, fechaSalida, ticketExtraviado }: { ingreso: any; tipoVehiculo?: string; modalidad?: string; fechaSalida?: Date; ticketExtraviado?: boolean }) {
  const salida = fechaSalida || new Date();
  const totalMinutos = diffMinutos(ingreso.fechaEntrada, salida);

  if (!tipoVehiculo) {
    const primerVehiculo = await prisma.vehiculo.findFirst({ where: { id: ingreso.vehiculoId } });
    tipoVehiculo = primerVehiculo?.tipo;
  }
  if (!tipoVehiculo) {
    return { error: "El vehículo no tiene un tipo asignado. Configúrelo antes de registrar la salida.", total: 0, detalle: [] };
  }

  const modalidadNormalizada = (modalidad || "hora").toLowerCase();

  let tarifa = await prisma.tarifa.findFirst({
    where: {
      OR: [
        { tipoVehiculo: { contains: tipoVehiculo } },
        { tipoVehiculo: "todos" },
      ],
      modalidad: modalidadNormalizada,
      activa: true,
    },
  });

  if (!tarifa) {
    tarifa = await prisma.tarifa.findFirst({
      where: {
        OR: [
          { tipoVehiculo: { contains: tipoVehiculo } },
          { tipoVehiculo: "todos" },
        ],
        activa: true,
      },
      orderBy: { id: "asc" },
    });
  }

  if (!tarifa) {
    return { error: `No hay tarifa activa para ${tipoVehiculo}`, total: 0, detalle: [] };
  }

  const config = await prisma.configuracion.findFirst();
  const minutosGracia = config?.minutosGracia || 0;
  const minutosGratis = tarifa.minutosGratis || 0;
  const cortesia = tarifa.minutosCortesia || 0;

  let minutosFacturables = Math.max(0, totalMinutos - cortesia - minutosGratis - minutosGracia);

  // Ticket extraviado: cobrar tarifa máxima del día
  if (ticketExtraviado && tarifa.tarifaMaximaDiaria) {
    const total = tarifa.tarifaMaximaDiaria;
    const detalle = [{ concepto: `Ticket extraviado — Tarifa máxima del día`, valor: total }];
    return {
      tarifa: { id: tarifa.id, nombre: tarifa.nombre, modalidad: tarifa.modalidad, valorUnitario: tarifa.valor },
      totalMinutos,
      minutosCortesia: cortesia,
      minutosGratis,
      minutosGracia,
      minutosFacturables,
      total,
      detalle,
      desglose: { tarifaMaximaDiaria: total, unidad: "tarifa_maxima" },
      fechaEntrada: ingreso.fechaEntrada,
      fechaSalida: salida,
      ticketExtraviado: true,
    };
  }

  function minCargo(valor, unidad) {
    return minutosFacturables <= 0 && totalMinutos > 0 ? Math.max(valor, tarifa.valor) : valor;
  }

  let detalle = [];
  let total = 0;
  let desglose = {};

  const usarProgresiva = tarifa.precioPrimeraHora != null && tarifa.precioHoraAdicional != null;

  switch (tarifa.modalidad) {
    case "minuto": {
      const base = Math.ceil(minutosFacturables * tarifa.valor);
      const valor = minCargo(base, 1);
      detalle.push({ concepto: `${totalMinutos} min - ${cortesia + minutosGratis + minutosGracia} min gratis = ${minutosFacturables} min facturables → $${valor}`, valor });
      total = valor;
      desglose = { minutosFacturables, valor, unidad: "min" };
      break;
    }
    case "hora": {
      if (usarProgresiva) {
        const horas = Math.max(1, Math.ceil(minutosFacturables / 60));
        let valor = 0;
        if (horas >= 1) {
          valor += tarifa.precioPrimeraHora;
          if (horas > 1) {
            valor += (horas - 1) * tarifa.precioHoraAdicional;
          }
        }
        if (tarifa.tarifaMaximaDiaria && valor > tarifa.tarifaMaximaDiaria) {
          valor = tarifa.tarifaMaximaDiaria;
        }
        detalle.push({ concepto: `${totalMinutos} min → ${horas} hora(s) (1ª hra: $${tarifa.precioPrimeraHora}, adic: $${tarifa.precioHoraAdicional})`, valor });
        total = valor;
        desglose = { minutosFacturables, horas, valor, unidad: "hora_progresiva" };
      } else {
        const horas = Math.max(1, Math.ceil(minutosFacturables / 60));
        const valor = horas * tarifa.valor;
        detalle.push({ concepto: `${totalMinutos} min → ${horas} hora(s) × $${tarifa.valor}`, valor });
        total = valor;
        desglose = { minutosFacturables, horas, valor, unidad: "hora" };
      }
      break;
    }
    case "diario": {
      const dias = Math.max(1, diffDias(ingreso.fechaEntrada, salida));
      const valor = dias * tarifa.valor;
      detalle.push({ concepto: `${totalMinutos} min → ${dias} día(s) × $${tarifa.valor}`, valor });
      total = valor;
      desglose = { dias, valor, unidad: "dia" };
      break;
    }
    case "semanal": {
      const semanas = Math.max(1, diffSemanas(ingreso.fechaEntrada, salida));
      const valor = semanas * tarifa.valor;
      detalle.push({ concepto: `${totalMinutos} min → ${semanas} semana(s) × $${tarifa.valor}`, valor });
      total = valor;
      desglose = { semanas, valor, unidad: "semana" };
      break;
    }
    case "quincenal": {
      const quincenas = Math.max(1, Math.ceil(diffDias(ingreso.fechaEntrada, salida) / 15));
      const valor = quincenas * tarifa.valor;
      detalle.push({ concepto: `${totalMinutos} min → ${quincenas} quincena(s) × $${tarifa.valor}`, valor });
      total = valor;
      desglose = { quincenas, valor, unidad: "quincena" };
      break;
    }
    case "mensual": {
      const meses = diffMeses(ingreso.fechaEntrada, salida);
      const valor = meses * tarifa.valor;
      detalle.push({ concepto: `${totalMinutos} min → ${meses} mes(es) × $${tarifa.valor}`, valor });
      total = valor;
      desglose = { meses, valor, unidad: "mes" };
      break;
    }
    default: {
      const horas = Math.max(1, Math.ceil(minutosFacturables / 60));
      const valor = horas * tarifa.valor;
      detalle.push({ concepto: `${totalMinutos} min → ${horas} hora(s) (tarifa por defecto) × $${tarifa.valor}`, valor });
      total = valor;
      desglose = { minutosFacturables, horas, valor, unidad: "hora" };
    }
  }

  return {
    tarifa: { id: tarifa.id, nombre: tarifa.nombre, modalidad: tarifa.modalidad, valorUnitario: tarifa.valor },
    totalMinutos,
    minutosCortesia: cortesia,
    minutosGratis,
    minutosGracia,
    minutosFacturables,
    total,
    detalle,
    desglose,
    fechaEntrada: ingreso.fechaEntrada,
    fechaSalida: salida,
  };
}
