# Documentación de auditoría — Sistema de Parqueadero (ParkAdmin)

Radiografía técnica, funcional y comercial del sistema, generada por análisis de solo lectura
del código fuente. **No se modificó ningún archivo del proyecto.**

Fecha de elaboración: 2026-11-04
Alcance: repositorio completo (backend, frontend, base de datos, pruebas, despliegue).

## Cómo navegar

| # | Documento | Contenido |
|---|---|---|
| 01 | [Arquitectura general](01-arquitectura-general.md) | Stack, arquitectura, comunicación entre componentes, despliegue, variables. |
| 02 | [Mapa de menús](02-mapa-de-menus.md) | Todos los menús, submenús, rutas, roles, botones, formularios y permisos. |
| 03 | [Funcionalidades por módulo](03-funcionalidades-por-modulo.md) | Qué hace cada módulo, validaciones, tablas, estados, errores. |
| 04 | [Procesos del negocio](04-procesos-del-negocio.md) | Secuencias paso a paso de cada proceso y sus dependencias. |
| 05 | [Reglas de negocio](05-reglas-de-negocio.md) | Reglas implementadas / parciales / inexistentes / a definir. |
| 06 | [Modelo Entidad-Relación](06-modelo-entidad-relacion.md) | Entidades, campos, relaciones, diagrama ER, riesgos de integridad. |
| 07 | [Roles y permisos](07-roles-y-permisos.md) | Matriz de permisos real (API) vs frontend. |
| 08 | [API y backend](08-api-backend.md) | Todos los endpoints con método, middlewares y controlador. |
| 09 | [Estados y transiciones](09-estados-y-transiciones.md) | Estados de cada entidad y diagramas de transición. |
| 10 | [Auditoría de consistencia](10-auditoria-consistencia.md) | Coherencia entre funcionalidades; casos correctos e inconsistentes. |
| 11 | [Pruebas y cobertura](11-pruebas-y-cobertura.md) | Qué está probado y qué no. |
| 12 | [Hallazgos y recomendaciones](12-hallazgos-y-recomendaciones.md) | Hallazgos priorizados (CRÍTICO→BAJO) y temas a definir. |

## Resumen ejecutivo

- **Stack**: Node 20 + Express 5 + TypeScript + Prisma 6 + PostgreSQL 16 (backend); React 19 + Vite 8 (frontend); JWT en cookie httpOnly; Socket.IO; despliegue Docker/local/Render+Neon.
- **Roles reales**: `admin`, `supervisor`, `empleado`. **No existe rol cliente ni portal de clientes** (el cliente es un registro gestionado por el personal).
- **Fortalezas**: motor de cobro completo (modalidades, cortesía, progresiva, tope, ticket extraviado); integridad financiera (facturas/caja inmutables, soft-delete con auditoría); concurrencia resuelta con advisory locks; aislamiento multi-sucursal.
- **Principales riesgos**: plan vencido con vehículo dentro (crítico), tipo de puesto no validado en backend (alto), permisos UI inconsistentes con la API (alto), trazabilidad histórica limitada (medio), varios temas de negocio sin definir.
- **Cobertura de pruebas**: sólida en cálculo de cobros y concurrencia de ingresos/caja; inexistente en CRUD, permisos por endpoint, flujo de suscripciones, backup y frontend.

## Metodología

- Lectura del esquema Prisma, controladores, rutas, middlewares, servicios y utilidades del backend.
- Lectura del enrutado, páginas, contextos y servicios del frontend.
- Inventario de pruebas y de la configuración de CI.
- **No** se ejecutaron migraciones, no se accedió a producción, no se revelaron credenciales, no se modificó código.

## Cómo leer las clasificaciones

- **Reglas/estados**: (A) implementada, (B) parcial, (C) inexistente, (D) indeterminable.
- **Hallazgos**: CRÍTICO / ALTO / MEDIO / BAJO / PENDIENTE DE DEFINICIÓN.
- Donde el comportamiento depende de una decisión de negocio, se marca explícitamente como "a definir" y no se inventa una regla.
