import bcrypt from "bcrypt";
import prisma from "./src/config/prisma.js";

async function main() {
  const hash = await bcrypt.hash("admin123", 12);
  await prisma.usuario.update({ where: { id: 1 }, data: { password: hash, intentosFallidos: 0, bloqueadoHasta: null } });
  console.log("Password reseteada a: admin123");
  process.exit();
}

main();
