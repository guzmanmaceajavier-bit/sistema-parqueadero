# Análisis de Reducción de Código — Parqueadero

Inventario real de archivos grandes y plan de reducción. Medido sobre `backend/src`
y `frontend/src` (solo `.ts`/`.tsx`).

---

## 1. Inventario (archivos > 600 líneas)

| Líneas | Archivo | Tipo |
|---:|---|---|
| 1262 | `frontend/src/pages/Clientes.tsx` | frontend |
| 1005 | `backend/src/modules/ingresos/ingresos.controller.ts` | backend |
| 916 | `frontend/src/pages/Caja.tsx` | frontend |
| 727 | `backend/src/modules/mensualidades/mensualidades.controller.ts` | backend |
| 672 | `frontend/src/pages/Ingresos.tsx` | frontend |
| 661 | `frontend/src/pages/Mensualidades.tsx` | frontend |
| 649 | `frontend/src/pages/Configuracion.tsx` | frontend |
| 647 | `backend/src/modules/clientes/clientes.controller.ts` | backend |
| 580 | `frontend/src/pages/Login.tsx` | frontend |
| 567 | `frontend/src/pages/DashboardPage.tsx` | frontend |
| 545 | `backend/src/modules/ausencias/ausencias.controller.ts` | backend |
| 532 | `backend/src/modules/reservas/reservas.controller.ts` | backend |
| 510 | `frontend/src/pages/Puestos.tsx` | frontend |
| 483 | `frontend/src/pages/Tarifas.tsx` | frontend |
| 476 | `frontend/src/pages/Reportes.tsx` | frontend |
| 446 | `frontend/src/pages/Reservas.tsx` | frontend |

Total: ~11.000 líneas en 16 archivos. El problema **no es una sola línea gigante**,
sino patrones repetidos.

---

## 2. Duplicación #1 — Iconos SVG inline ( MAYOR AHORRO )

Casi todas las páginas definen localmente los mismos componentes:

```
IconSearch  → Clientes, Mensualidades, Tarifas, Ingresos, Gastos, Facturas, Movimientos, Usuarios
IconPlus    → Clientes, Mensualidades, Vehiculos, Gastos, Tarifas, Planes, Puestos, Usuarios
IconEdit    → Clientes, Mensualidades, Vehiculos, Gastos, Tarifas, Planes, Ingresos, Usuarios
IconTrash   → Clientes, Mensualidades, Vehiculos, Gastos, Tarifas, Planes, Ingresos, Usuarios
IconX       → Clientes, Mensualidades, Vehiculos, Gastos, Tarifas, Planes, Ingresos, Usuarios
IconCar/IconUser/IconCash → en varias páginas
```

**Acción:** crear `frontend/src/components/Icons.tsx` que reexporte desde
`lucide-react` (ya instalado) y eliminar todas las definiciones locales.

```tsx
// components/Icons.tsx
export {
  Search as IconSearch, Plus as IconPlus, Pencil as IconEdit,
  Trash2 as IconTrash, X as IconX, Car as IconCar, User as IconUser,
  Banknote as IconCash, ...
} from "lucide-react";
```

**Ahorro estimado:** ~40-60 líneas × ~14 páginas = **~600-800 líneas** sin
cambiar comportamiento (son reexportaciones, no reescrituras).

---

## 3. Duplicación #2 — Badges de estado

`EstadoBadge`, `EstadoMensualidadBadge`, `TipoBadge`, `ModalidadBadge`,
`RolBadge`, `CategoriaBadge`, `CajaEstadoBadge`, `OpcionBadge` — todos hacen
lo mismo: mapear un valor → color + texto.

**Acción:** un solo componente genérico:

```tsx
// components/Badge.tsx
const TONOS = { verde:"...", rojo:"...", amarillo:"...", azul:"..." };
export function Badge({ tono, children }) {
  return <span className={`px-2 py-1 rounded-full text-xs ${TONOS[tono]}`}>{children}</span>;
}
// Mapas declarativos por entidad (fuera del componente)
export const ESTADO_INGRESO = { ACTIVO:"verde", FINALIZADO:"gris" };
```

**Ahorro estimado:** ~15-25 líneas × ~10 páginas = **~200 líneas**.

---

## 4. Duplicación #3 — Modal CRUD en cada página

Clientes, Vehículos, Puestos, Tarifas, Planes, Gastos, Usuarios, Mensualidades,
Reservas, Ausencias repiten la estructura: `open`, `editando`, `form`,
`handleSubmit`, `handleEdit`, `handleDelete`, overlay + panel.

**Acción:** componente `CRUDModal` con props (`titulo`, `campos`, `onGuardar`,
`valoresIniciales`) y un hook `useCrud(api)` que encapsule cargar/crear/editar/
eliminar + estado de carga.

**Ahorro estimado:** ~50-80 líneas × ~10 páginas = **~500-800 líneas**.

---

## 5. Duplicación #4 — Formateo de fecha/zona

`fechaLocalInput` y `formatFechaZona` aparecen iguales en `Reportes.tsx` y
`DashboardPage.tsx`; `formatValor`/`formatCurrency` en Caja y otras.

**Acción:** mover a `frontend/src/utils/formato.ts`.

**Ahorro:** ~60 líneas.

---

## 6. Backend — controladores grandes

`ingresos.controller.ts` (1005) tiene 11 handlers y 2 helpers. `registrarSalidaConCobro`
solo ya ocupa ~320 líneas. No conviene partirlo por líneas, sino **extraer reglas
de negocio a servicios**:

| Extraer a | Contenido | Líneas liberadas |
|---|---|---|
| `services/disponibilidadPuesto.ts` | `puestoAceptaTipo`, `puestoEstaDisponibleParaAsignar` | ~60 |
| `services/coberturaPlan.ts` | búsqueda de plan vigente, excedente por vencimiento, revalidación con locks | ~120 |
| `services/estadoPuesto.ts` | recálculo de LIBRE/RESERVADO/OCUPADO (hoy repetido en 6+ lugares) | ~80 |
| `services/salidaIngreso.ts` | transacción de salida con cobro, factura, saldo, caja | ~250 |

El recálculo de estado de puesto es el más importante: hoy está duplicado en
`ingresos`, `mensualidades`, `reservas`, `ausencias` y `puestos`. Unificarlo en
una sola función `recalcularEstadoPuesto(tx, puestoId)` elimina inconsistencias
y reduce ~300 líneas en total.

**Ahorro backend estimado:** ~500-700 líneas, con el beneficio extra de una
única fuente de verdad para el estado del puesto.

---

## 7. Orden recomendado (riesgo bajo → alto)

1. **Icons.tsx** — reexportaciones, riesgo nulo, gran ahorro inmediato.
2. **utils/formato.ts** — mover funciones puras, riesgo nulo.
3. **Badge.tsx** — componente presentacional, riesgo muy bajo.
4. **services/estadoPuesto.ts** — unificar lógica, riesgo medio (tocar transacciones),
   pero con tests de integración ya existentes.
5. **CRUDModal / useCrud** — riesgo medio, requiere probar cada formulario.
6. **Services de salida/cobertura** — riesgo alto, hacerlo con la simulación
   funcional como red de seguridad.

---

## 8. Nota sobre "ideas mal planteadas" detectadas y ya corregidas

- ~~Botón "Renovar" directo~~ → ahora la renovación solo ocurre al pagar (con factura).
- ~~`valor` obligatorio en mensualidad~~ → se deriva del plan.
- ~~Comparar fechas en hora local~~ → `AT TIME ZONE 'UTC'`.
- ~~`count()` dentro de transacción~~ → `findMany().length`.
- ~~Estado del puesto guardado a mano~~ → derivado de ingreso/plan/reserva.
- ~~Anular factura borrando el registro~~ → anulación con contrapartida y auditoría.

Estas correcciones ya están commiteadas; el único trabajo pendiente de reducción
es el listo del inventario, 100% mecánico en los pasos 1-3.
