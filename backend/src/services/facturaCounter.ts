import prisma from "../config/prisma.js";

const SECURE_PREFIX = "_factura_seq_";

function sanitizarPrefijo(prefijo: string): string {
  return prefijo.replace(/[^a-zA-Z0-9_-]/g, "");
}

async function asegurarSecuencia(prefijo: string): Promise<string> {
  const limpio = sanitizarPrefijo(prefijo);
  const seqName = `${SECURE_PREFIX}${limpio}`;
  try {
    await prisma.$executeRawUnsafe(
      `CREATE SEQUENCE IF NOT EXISTS "${seqName}" START 1`
    );
  } catch {
    // Sequence may already exist
  }
  return seqName;
}

export async function generarNumeroFactura(prefijo = "FACT"): Promise<string> {
  const limpio = sanitizarPrefijo(prefijo);
  const seqName = await asegurarSecuencia(limpio);
  const [result] = await prisma.$queryRawUnsafe(
    `SELECT nextval('"${seqName}"') as contador`
  );
  const contador = Number((result as Record<string, unknown>).contador);
  return `${limpio}-${String(contador).padStart(6, "0")}`;
}
