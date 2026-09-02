import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash("Admin123", 12);
  const u = await prisma.usuario.upsert({
    where: { usuario: "admin" },
    update: { password: hash },
    create: {
      usuario: "admin",
      nombre: "Administrador",
      correo: "admin@parqueadero.com",
      password: hash,
      rol: "ADMIN",
      estado: true,
    },
  });
  console.log("OK:", u.usuario, u.rol);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
