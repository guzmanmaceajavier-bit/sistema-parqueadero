import prisma from "../config/prisma.js";

const SECURE_PREFIX = "_factura_seq_";

function sanitizarPrefijo(prefijo) {
  return prefijo.replace(/[^a-zA-Z0-9_-]/g, "");
}

async function asegurarSecuencia(prefijo) {
  const limpio = sanitizarPrefijo(prefijo);
  const seqName = `${SECURE_PREFIX}${limpio}`;
  try {
    await prisma.$executeRawUnsafe(
      `CREATE SEQUENCE IF NOT EXISTS "${seqName}" START 1`
    );
  } catch {
  }
  return seqName;
}

export async function generarNumeroFactura(prefijo = "FACT") {
  const limpio = sanitizarPrefijo(prefijo);
  const seqName = await asegurarSecuencia(limpio);
  const [result] = await prisma.$queryRawUnsafe(
    `SELECT nextval('"${seqName}"') as contador`
  );
  const contador = Number(result.contador);
  return `${limpio}-${String(contador).padStart(6, "0")}`;
}
