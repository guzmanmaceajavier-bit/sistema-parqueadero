import prisma from "../../config/prisma.js";
import bcrypt from "bcrypt";

export const crearUsuarioAdmin = async () => {
  const existe = await prisma.usuario.findFirst({
    where: { rol: "admin" },
  });

  if (existe) {
    console.log("El administrador ya existe");
    return;
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword || adminPassword.length < 8) {
    console.error("FATAL: Define ADMIN_PASSWORD en .env (min 8 caracteres)");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.usuario.create({
    data: {
      nombre: "Administrador",
      usuario: "admin",
      correo: "admin@parqueadero.com",
      password: passwordHash,
      rol: "admin",
    },
  });

  console.log("Administrador creado correctamente");
  console.log(admin);
};