/**
 * Simulación funcional de los menús del parqueadero contra la BD aislada.
 * Ejecuta flujos reales y muestra el resultado de cada uno.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BASE = process.env.SIM_BASE || "http://127.0.0.1:3101";
const PASS = "E2eAdmin123";
let cookie = "";

const line = (t) => console.log("\n" + "=".repeat(72) + "\n" + t + "\n" + "=".repeat(72));
const sub = (t) => console.log("\n-- " + t);

async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setC = res.headers.get("set-cookie");
  if (setC) cookie = setC.split(";")[0];
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data };
}

const S = Math.floor(Date.now() / 1000);
const PLACA_A = `SIM${String(S).slice(-4)}A`;
const PLACA_B = `SIM${String(S).slice(-4)}B`;

async function main() {
  line("0. AUTENTICACIÓN  (menú: todos)");
  const login = await api("POST", "/api/usuarios/login", { usuario: "admin", password: PASS });
  console.log(`login admin -> HTTP ${login.status} | rol=${login.data?.usuario?.rol}`);
  const loginMal = await api("POST", "/api/usuarios/login", { usuario: "admin", password: "mala" });
  console.log(`login con clave incorrecta -> HTTP ${loginMal.status} | ${loginMal.data?.message}`);

  // La caja debe estar abierta ANTES de cualquier cobro (simular/salida).
  const cajaPrevia = await api("POST", "/api/caja/abrir", { apertura: 50000, password: PASS });
  console.log(`abrir caja inicial -> HTTP ${cajaPrevia.status} | id=${cajaPrevia.data?.caja?.id}`);

  line("1. CLIENTES  (menú: Clientes → Registro)");
  const c1 = await api("POST", "/api/clientes", { nombres: "Ana", apellidos: "Simulación", documento: `SIM${S}`, telefono: "3001112222" });
  console.log(`crear cliente -> HTTP ${c1.status} | id=${c1.data?.cliente?.id} | estado=${c1.data?.cliente?.estado}`);
  const c1dup = await api("POST", "/api/clientes", { nombres: "Ana", apellidos: "Dup", documento: `SIM${S}` });
  console.log(`crear cliente con documento repetido -> HTTP ${c1dup.status} | ${c1dup.data?.message}`);
  const cliId = c1.data?.cliente?.id;

  line("2. VEHÍCULOS  (menú: Clientes → Vehículos)");
  const v1 = await api("POST", "/api/vehiculos", { placa: PLACA_A.toLowerCase(), tipo: "carro", marca: "Toyota", clienteId: cliId });
  console.log(`crear vehiculo "abc-1234" -> HTTP ${v1.status} | placa=${v1.data?.vehiculo?.placa} (normalizada)`);
  const v2 = await api("POST", "/api/vehiculos", { placa: PLACA_A, tipo: "carro", clienteId: cliId });
  console.log(`crear el mismo vehiculo otra vez -> HTTP ${v2.status} | ${v2.data?.message}`);
  const vehId = v1.data?.vehiculo?.id;

  line("3. PUESTOS  (menú: Parqueadero → Puestos)");
  const p1 = await api("POST", "/api/puestos", { codigo: `SIM-${S}-A`, tipoPuesto: "carro", zona: "Sim" });
  const p2 = await api("POST", "/api/puestos", { codigo: `SIM-${S}-B`, tipoPuesto: "carro", zona: "Sim" });
  const pMoto = await api("POST", "/api/puestos", { codigo: `SIM-${S}-M`, tipoPuesto: "moto", zona: "Sim" });
  console.log(`crear puesto carro SIM-${S}-A -> HTTP ${p1.status} | id=${p1.data?.puesto?.id} estado=${p1.data?.puesto?.estado}`);
  console.log(`crear puesto moto  SIM-${S}-M -> HTTP ${pMoto.status} | id=${pMoto.data?.puesto?.id}`);
  const puestoAutoId = p1.data?.puesto?.id;
  const puestoLibreId = p2.data?.puesto?.id;
  const puestoMotoId = pMoto.data?.puesto?.id;

  line("4. PLANES Y SUSCRIPCIONES  (menú: Configuración → Planes / Suscripciones)");
  const plan = await api("POST", "/api/planes", { nombre: `SIM Plan Mensual ${S}`, duracionDias: 30, valor: 200000, tipoVehiculo: "carro" });
  console.log(`crear plan 30 días -> HTTP ${plan.status} | id=${plan.data?.plan?.id}`);
  const planId = plan.data?.plan?.id;
  const m1 = await api("POST", "/api/mensualidades", { clienteId: cliId, vehiculoId: vehId, planId, puestoId: puestoAutoId, fechaInicio: new Date().toISOString(), fechaFin: new Date(Date.now() + 30 * 864e5).toISOString() });
  console.log(`crear suscripción con puesto fijo -> HTTP ${m1.status} | mensualidad=${m1.data?.mensualidad?.id} | puesto=${m1.data?.mensualidad?.puestoId}`);
  const puestoTrasPlan = await prisma.puesto.findUnique({ where: { id: puestoAutoId } });
  console.log(`estado del puesto tras la suscripción -> ${puestoTrasPlan?.estado} (debe ser OCUPADO o RESERVADO)`);

  line("5. ENTRADA  (menú: Mov. Entrada → Entradas/Salidas)");
  const ing = await api("POST", "/api/ingresos", { clienteId: cliId, vehiculoId: vehId });
  console.log(`registrar entrada -> HTTP ${ing.status} | puesto=${ing.data?.ingreso?.puestoId} (debe ser el del plan=${puestoAutoId}) | tipo=${ing.data?.tipoIngreso}`);
  const ingId = ing.data?.ingreso?.id;
  const ingDup = await api("POST", "/api/ingresos", { clienteId: cliId, vehiculoId: vehId });
  console.log(`entrada duplicada del mismo vehículo -> HTTP ${ingDup.status} | ${ingDup.data?.message}`);
  const ingMoto = await api("POST", "/api/ingresos", { clienteId: cliId, vehiculoId: vehId, puestoId: puestoMotoId });
  console.log(`entrar en puesto de MOTO con un CARRO -> HTTP ${ingMoto.status} | ${ingMoto.data?.message || "ACEPTADO (debería rechazar)"}`);

  line("6. SIMULACIÓN DE COBRO  (menú: Entradas/Salidas → Registrar salida)");
  const sim = await api("POST", "/api/ingresos/simular-cobro", { ingresoId: ingId });
  console.log(`simular cobro con plan vigente -> HTTP ${sim.status} | total=${sim.data?.cobro?.total} | plan=${sim.data?.cobro?.plan}`);
  const puestoTrasSim = await prisma.puesto.findUnique({ where: { id: puestoAutoId } });
  console.log(`estado del puesto tras simular -> ${puestoTrasSim?.estado}`);

  line("7. SALIDA CON PLAN  (no debe cobrar)");
  const sal = await api("POST", `/api/ingresos/salida-con-cobro/${ingId}`, { metodoPago: "efectivo" });
  console.log(`registrar salida -> HTTP ${sal.status} | ${sal.data?.message}`);
  console.log(`factura generada: ${sal.data?.factura ? "SI (no debería)" : "NO (correcto)"} | cobro=${sal.data?.cobro?.total}`);
  const puestoTrasSalida = await prisma.puesto.findUnique({ where: { id: puestoAutoId } });
  console.log(`estado del puesto tras la salida -> ${puestoTrasSalida?.estado} (debe seguir RESERVADO por el plan)`);

  line("8. REINGRESO  (debe recuperar el mismo puesto)");
  const ing2 = await api("POST", "/api/ingresos", { clienteId: cliId, vehiculoId: vehId });
  console.log(`volver a entrar -> HTTP ${ing2.status} | puesto=${ing2.data?.ingreso?.puestoId} (debe ser ${puestoAutoId}) | tipo=${ing2.data?.tipoIngreso}`);

  line("9. CLIENTE OCASIONAL  (menú: Entradas/Salidas → sin plan, sí cobra)");
  const c2 = await api("POST", "/api/clientes", { nombres: "Luis", apellidos: "Ocasional", documento: `SIM2${S}` });
  const cli2 = c2.data?.cliente?.id;
  const v3 = await api("POST", "/api/vehiculos", { placa: PLACA_B, tipo: "carro", clienteId: cli2 });
  const veh2 = v3.data?.vehiculo?.id;
  const ingOcas = await api("POST", "/api/ingresos", { clienteId: cli2, vehiculoId: veh2, puestoId: puestoLibreId });
  console.log(`entrada ocasional -> HTTP ${ingOcas.status} | puesto=${ingOcas.data?.ingreso?.puestoId}`);
  const simOcas = await api("POST", "/api/ingresos/simular-cobro", { ingresoId: ingOcas.data?.ingreso?.id });
  console.log(`simular cobro -> HTTP ${simOcas.status} | total=${simOcas.data?.cobro?.total} | minutos=${simOcas.data?.cobro?.totalMinutos}`);
  const salOcas = await api("POST", `/api/ingresos/salida-con-cobro/${ingOcas.data?.ingreso?.id}`, { metodoPago: "efectivo" });
  console.log(`salida ocasional -> HTTP ${salOcas.status} | factura=${salOcas.data?.factura?.numero} | total=${salOcas.data?.cobro?.total}`);
  const puestoTrasOcas = await prisma.puesto.findUnique({ where: { id: puestoLibreId } });
  console.log(`estado del puesto tras la salida -> ${puestoTrasOcas?.estado} (debe ser LIBRE)`);
  const movCaja = await prisma.cajaMovimiento.findFirst({ where: { facturaId: salOcas.data?.factura?.id } });
  console.log(`movimiento de caja ligado a la factura -> ${movCaja ? `SI (${movCaja.tipo} $${movCaja.monto})` : "NO (debería existir)"}`);

  line("10. ANULACIÓN DE FACTURA  (menú: Facturas → Anular)");
  const salOcas2 = salOcas.data?.factura?.id;
  const anulSinMotivo = await api("POST", `/api/facturas/${salOcas2}/anular`, { motivo: "" });
  console.log(`anular sin motivo -> HTTP ${anulSinMotivo.status} | ${anulSinMotivo.data?.message}`);
  const anul = await api("POST", `/api/facturas/${salOcas2}/anular`, { motivo: "Error de prueba: cobro duplicado" });
  console.log(`anular con motivo -> HTTP ${anul.status} | ${anul.data?.message}`);
  const fAnulada = await prisma.factura.findUnique({ where: { id: salOcas2 } });
  console.log(`factura -> anulada=${fAnulada?.anulada} por=${fAnulada?.anuladoPor} motivo="${fAnulada?.motivoAnulacion}"`);
  const movTrasAnul = await prisma.cajaMovimiento.findFirst({ where: { facturaId: salOcas2 } });
  console.log(`movimiento de caja -> anulado=${movTrasAnul?.anulado} (debe quedar fuera de los totales)`);

  line("11. CAJA  (menú: Caja → Estado)");
  const cajaAb = await api("POST", "/api/caja/abrir", { apertura: 50000, password: PASS });
  console.log(`abrir caja -> HTTP ${cajaAb.status} | id=${cajaAb.data?.caja?.id} apertura=${cajaAb.data?.caja?.apertura}`);
  const cajaId = cajaAb.data?.caja?.id;
  const caja2 = await api("POST", "/api/caja/abrir", { apertura: 1000, password: PASS });
  console.log(`abrir una segunda caja -> HTTP ${caja2.status} | ${caja2.data?.message}`);
  const tot = await api("GET", "/api/caja/actual");
  console.log(`caja actual -> ingresos=${tot.data?.caja?.ingresos} egresos=${tot.data?.caja?.egresos} saldo=${tot.data?.caja?.saldo}`);
  const cierre = await api("PUT", `/api/caja/cerrar/${cajaId}`, { conteo: { billetes: { "50000": 1 }, monedas: {} }, observacion: "Arqueo simulado" });
  console.log(`cerrar caja -> HTTP ${cierre.status} | esperado=${cierre.data?.esperado} contado=${cierre.data?.totalConteo} diferencia=${cierre.data?.diferencia}`);

  line("12. GASTOS  (menú: Caja → Gastos)");
  const gasto = await api("POST", "/api/gastos", { concepto: "SIM료를", categoria: "otros", valor: 15000 });
  console.log(`registrar gasto -> HTTP ${gasto.status} | id=${gasto.data?.gasto?.id}`);
  const movGasto = await prisma.cajaMovimiento.findFirst({ where: { gastoId: gasto.data?.gasto?.id } });
  console.log(`movimiento de caja del gasto -> ${movGasto ? `SI (${movGasto.tipo})` : "NO"}`);

  line("13. RESERVAS  (menú: Mov. Entrada → Reservas)");
  const res1 = await api("POST", "/api/reservas", { clienteId: cliId, vehiculoId: vehId, puestoId: puestoLibreId, fechaInicio: new Date(Date.now() + 5 * 864e5).toISOString(), fechaFin: new Date(Date.now() + 6 * 864e5).toISOString() });
  console.log(`reservar puesto a 5 días -> HTTP ${res1.status} | id=${res1.data?.reserva?.id}`);
  const puestoTrasRes = await prisma.puesto.findUnique({ where: { id: puestoLibreId } });
  console.log(`estado del puesto tras reservar a 5 días -> ${puestoTrasRes?.estado} (NO debe quedar RESERVADO si la ventana es 24 h)`);

  line("14. RELACIONES E INTEGRIDAD  (verificación en BD)");
  const ingRel = await prisma.ingreso.findFirst({ where: { id: ingId }, include: { cliente: true, vehiculo: true, puesto: true, facturas: true } });
  console.log(`ingreso ${ingId}: cliente=${ingRel?.clienteId} vehiculo=${ingRel?.vehiculoId} puesto=${ingRel?.puestoId} | cliente del ingreso coincide con dueño del vehículo: ${ingRel?.clienteId === ingRel?.vehiculo?.clienteId ? "SI" : "NO"}`);
  const saldos = await prisma.clienteSaldoMovimiento.findMany({ where: { clienteId: cliId } });
  console.log(`movimientos de saldo del cliente -> ${saldos.length}`);
  const props = await prisma.vehiculoPropietario.findMany({ where: { vehiculoId: vehId } });
  console.log(`historial de propietarios del vehículo -> ${props.length} registro(s)`);

  line("15. RESUMEN DE ANOMALÍAS DETECTADAS");
  const anomalias = [];
  if (ingMoto.status < 400) anomalias.push("Se permitió ocupar un puesto de MOTO con un CARRO (validación solo en frontend)");
  if (sal.data?.factura) anomalias.push("Se generó factura en una salida cubierta por plan");
  if (puestoTrasSalida?.estado === "LIBRE") anomalias.push("El puesto quedó LIBRE tras la salida, aunque el plan sigue vigente");
  if (puestoTrasRes?.estado === "RESERVADO") anomalias.push("Una reserva a 5 días dejó el puesto RESERVADO (ventana de 24 h no aplicada)");
  if (movTrasAnul && movTrasAnul.anulado === false) anomalias.push("La anulación de factura no anuló su movimiento de caja");
  if (!anul.data?.ok) anomalias.push("No se pudo anular la factura");
  console.log(anomalias.length === 0 ? "SIN anomalías en los flujos simulados." : anomalias.map((a, i) => `${i + 1}. ${a}`).join("\n"));

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error("SIMULACIÓN FALLÓ:", e.message); await prisma.$disconnect(); process.exit(1); });
