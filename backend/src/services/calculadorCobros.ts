import prisma from "../config/prisma.js";
import type { Tarifa } from "@prisma/client";

function diffMinutos(fechaEntrada: Date, fechaSalida: Date): number {
  return Math.ceil((fechaSalida.getTime() - fechaEntrada.getTime()) / (1000 * 60));
}

function diffMeses(fechaEntrada: Date, fechaSalida: Date): number {
  // Cada periodo vence en el aniversario mensual; si el mes no tiene ese día,
  // se utiliza su último día (por ejemplo, 31 de enero -> 28/29 de febrero).
  let meses = (fechaSalida.getFullYear() - fechaEntrada.getFullYear()) * 12;
  meses += fechaSalida.getMonth() - fechaEntrada.getMonth();

  const diaObjetivo = Math.min(
    fechaEntrada.getDate(),
    new Date(fechaEntrada.getFullYear(), fechaEntrada.getMonth() + meses + 1, 0).getDate()
  );
  const aniversario = new Date(
    fechaEntrada.getFullYear(),
    fechaEntrada.getMonth() + meses,
    diaObjetivo,
    fechaEntrada.getHours(),
    fechaEntrada.getMinutes(),
    fechaEntrada.getSeconds(),
    fechaEntrada.getMilliseconds()
  );

  if (fechaSalida > aniversario) meses++;
  return Math.max(1, meses);
}

export async function calcularCobro({ ingreso, tipoVehiculo, modalidad, fechaSalida, ticketExtraviado, tarifaId }: { ingreso: any; tipoVehiculo?: string; modalidad?: string; fechaSalida?: Date; ticketExtraviado?: boolean; tarifaId?: number }) {
  const salida = fechaSalida || new Date();
  const entrada = new Date(ingreso.fechaEntrada);
  if (!Number.isFinite(entrada.getTime()) || !Number.isFinite(salida.getTime()) || salida < entrada) {
    return { error: "La fecha de salida no puede ser anterior a la fecha de entrada.", total: 0, detalle: [] };
  }
  const totalMinutos = diffMinutos(entrada, salida);

  if (!tipoVehiculo) {
    const primerVehiculo = await prisma.vehiculo.findFirst({ where: { id: ingreso.vehiculoId } });
    tipoVehiculo = primerVehiculo?.tipo || undefined;
  }
  if (!tipoVehiculo) {
    return { error: "El vehículo no tiene un tipo asignado. Configúrelo antes de registrar la salida.", total: 0, detalle: [] };
  }

  const modalidadNormalizada = (modalidad || "hora").toLowerCase();

  let tarifa: Tarifa | null = null;

  if (tarifaId) {
    tarifa = await prisma.tarifa.findUnique({ where: { id: tarifaId } });
    if (!tarifa || !tarifa.activa) {
      return { error: `La tarifa asignada al vehículo no está activa`, total: 0, detalle: [] };
    }
  } else {
    tarifa = await prisma.tarifa.findFirst({
      where: {
        OR: [
          { tipoVehiculo: { contains: tipoVehiculo } },
          { tipoVehiculo: "todos" },
        ],
        modalidad: modalidadNormalizada,
        activa: true,
      },
    });
  }

  if (!tarifa) {
    return { error: `No hay tarifa activa para ${tipoVehiculo} con modalidad ${modalidadNormalizada}`, total: 0, detalle: [] };
  }

  const config = await prisma.configuracion.findFirst();
  const minutosGracia = config?.minutosGracia || 0;
  const minutosGratis = tarifa.minutosGratis || 0;
  const cortesia = tarifa.minutosCortesia || 0;

  const modalidadTarifa = String(tarifa.modalidad || modalidadNormalizada).trim().toLowerCase();
  const modalidadesSoportadas = ["minuto", "hora", "diario", "semanal", "quincenal", "mensual"];
  if (!modalidadesSoportadas.includes(modalidadTarifa)) {
    return { error: `La modalidad de tarifa "${tarifa.modalidad}" no está soportada. Usa minuto, hora, diario, semanal, quincenal o mensual.`, total: 0, detalle: [] };
  }

  const minutosNoFacturables = cortesia + minutosGratis + minutosGracia;
  const minutosFacturables = Math.max(0, totalMinutos - minutosNoFacturables);
  const fechaInicioFacturable = new Date(entrada.getTime() + minutosNoFacturables * 60000);

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

  function minCargo(valor: number): number {
    return minutosFacturables <= 0 ? 0 : valor;
  }

  // El máximo diario se aplica por cada bloque de 24 horas facturables.
  function aplicarTopeDiario(valor: number): number {
    const maximoDiario = tarifa?.tarifaMaximaDiaria;
    if (minutosFacturables <= 0 || maximoDiario == null || maximoDiario <= 0) return valor;
    const bloquesDiarios = Math.ceil(minutosFacturables / 1440);
    return Math.min(valor, maximoDiario * bloquesDiarios);
  }

  let detalle = [];
  let total = 0;
  let desglose = {};

  const usarProgresiva = tarifa.precioPrimeraHora != null && tarifa.precioHoraAdicional != null;

  switch (modalidadTarifa) {
    case "minuto": {
      const base = Math.ceil(minutosFacturables * tarifa.valor);
      const valor = aplicarTopeDiario(minCargo(base));
      detalle.push({ concepto: `${totalMinutos} min - ${cortesia + minutosGratis + minutosGracia} min gratis = ${minutosFacturables} min facturables → $${valor}`, valor });
      total = valor;
      desglose = { minutosFacturables, valor, unidad: "min" };
      break;
    }
    case "hora": {
      if (usarProgresiva) {
        const horas = Math.ceil(minutosFacturables / 60);
        let valor = 0;
        if (horas >= 1) {
          valor += tarifa.precioPrimeraHora ?? 0;
          if (horas > 1) {
            valor += (horas - 1) * (tarifa.precioHoraAdicional ?? 0);
          }
        }
        valor = aplicarTopeDiario(valor);
        detalle.push({ concepto: `${totalMinutos} min → ${horas} hora(s) (1ª hra: $${tarifa.precioPrimeraHora}, adic: $${tarifa.precioHoraAdicional})`, valor });
        total = valor;
        desglose = { minutosFacturables, horas, valor, unidad: "hora_progresiva" };
      } else {
        const horas = Math.ceil(minutosFacturables / 60);
        const valor = aplicarTopeDiario(horas * tarifa.valor);
        detalle.push({ concepto: `${totalMinutos} min → ${horas} hora(s) × $${tarifa.valor}`, valor });
        total = valor;
        desglose = { minutosFacturables, horas, valor, unidad: "hora" };
      }
      break;
    }
    case "diario": {
      const dias = Math.ceil(minutosFacturables / 1440);
      const valor = dias * tarifa.valor;
      detalle.push({ concepto: `${totalMinutos} min → ${dias} día(s) × $${tarifa.valor}`, valor });
      total = valor;
      desglose = { dias, valor, unidad: "dia" };
      break;
    }
    case "semanal": {
      const semanas = Math.ceil(minutosFacturables / (7 * 1440));
      const valor = semanas * tarifa.valor;
      detalle.push({ concepto: `${totalMinutos} min → ${semanas} semana(s) × $${tarifa.valor}`, valor });
      total = valor;
      desglose = { semanas, valor, unidad: "semana" };
      break;
    }
    case "quincenal": {
      const quincenas = Math.ceil(minutosFacturables / (15 * 1440));
      const valor = quincenas * tarifa.valor;
      detalle.push({ concepto: `${totalMinutos} min → ${quincenas} quincena(s) × $${tarifa.valor}`, valor });
      total = valor;
      desglose = { quincenas, valor, unidad: "quincena" };
      break;
    }
    case "mensual": {
      const meses = minutosFacturables <= 0 ? 0 : diffMeses(fechaInicioFacturable, salida);
      const valor = meses * tarifa.valor;
      detalle.push({ concepto: `${totalMinutos} min → ${meses} mes(es) × $${tarifa.valor}`, valor });
      total = valor;
      desglose = { meses, valor, unidad: "mes" };
      break;
    }
    default: {
      return { error: "La modalidad de tarifa no está soportada.", total: 0, detalle: [] };
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
