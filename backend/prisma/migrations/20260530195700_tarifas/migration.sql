-- CreateTable
CREATE TABLE "Tarifa" (
    "id" SERIAL NOT NULL,
    "tipo" TEXT NOT NULL,
    "valorHora" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tarifa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tarifa_tipo_key" ON "Tarifa"("tipo");
