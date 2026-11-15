import { defineConfig } from "vitest/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Carga .env.test (base de datos EXCLUSIVA de pruebas) si existe.
 * Nunca debe apuntar a producción: el script de integración valida el nombre.
 */
function cargarEnvTest() {
  const envTest = path.join(__dirname, ".env.test");
  if (!fs.existsSync(envTest)) return;
  for (const linea of fs.readFileSync(envTest, "utf8").split(/\r?\n/)) {
    const match = linea.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    const [, clave, valorCrudo] = match;
    const valor = valorCrudo.trim().replace(/^["']|["']$/g, "");
    if (clave === "DATABASE_URL" && !/parqueadero_test/.test(valor)) {
      throw new Error("El DATABASE_URL de .env.test debe apuntar a la base de datos de pruebas (parqueadero_test).");
    }
    if (!process.env[clave]) process.env[clave] = valor;
  }
}

cargarEnvTest();

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/tests/setup.ts"],
    testTimeout: 20000,
    // La carpeta de integración usa la base de datos de pruebas; el resto,
    // pruebas unitarias con mocks, no toca la base de datos.
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/tests/**/*.test.ts"],
          exclude: ["src/tests/integration/**"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["src/tests/integration/**/*.test.ts"],
          testTimeout: 30000,
          // La base de datos de pruebas es compartida: los archivos se ejecutan
          // en serie para que no se interfieran entre sí.
          fileParallelism: false,
          sequence: { concurrent: false },
        },
      },
    ],
  },
});
