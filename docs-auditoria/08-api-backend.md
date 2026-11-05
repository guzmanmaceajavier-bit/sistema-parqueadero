# 08 — API y backend

> Endpoints extraídos de `backend/src/modules/**/*.routes.ts`. Middlewares comunes documentados al pie.

## 1. Usuarios — `/api/usuarios`
| Método | Ruta | Middlewares | Controlador |
|---|---|---|---|
| POST | `/login` | loginLimiter, validate(loginSchema) | login |
| POST | `/` | verificarToken, verificarRol(admin), validate | crearUsuario |
| POST | `/crear-admin` | rateLimit 3/h, validate (**sin auth**) | crearAdmin |
| POST | `/forgot-password` | forgotPasswordLimiter, validate | solicitarResetPassword |
| POST | `/reset-password` | validate | resetPassword |
| POST | `/verificar-password` | verificarToken, validate | verificarPassword |
| POST | `/refresh-token` | — | refreshToken |
| POST | `/logout` | verificarToken | logout |
| POST | `/invalidar-sesiones` | verificarToken | invalidarSesiones |
| GET | `/perfil` | verificarTokenOpcional | obtenerPerfil |
| GET | `/` | verificarToken, verificarRol(admin) | obtenerUsuarios |
| GET | `/accesos` | verificarToken, verificarRol(admin) | obtenerAccesos |
| PUT | `/:id` | verificarToken, verificarRol(admin), validate | actualizarUsuario |
| PUT | `/estado/:id` | verificarToken, verificarRol(admin), validate | cambiarEstadoUsuario |
| DELETE | `/:id` | verificarToken, verificarRol(admin) | eliminarUsuario |

## 2. Configuración — `/api/configuracion`
| Método | Ruta | Middlewares | Controlador |
|---|---|---|---|
| GET | `/` | verificarTokenOpcional | obtenerConfiguracion |
| POST | `/` | verificarToken, verificarRol(admin, supervisor), validate | guardarConfiguracion |
| POST | `/formatear` | verificarToken, verificarRol(admin), formatearLimiter | formatearSistema |
| POST | `/upload-logo` | verificarToken, verificarRol(admin, supervisor), multer | inline |
| DELETE | `/logo` | verificarToken, verificarRol(admin, supervisor) | inline |
| POST | `/upload-fondo` | verificarToken, verificarRol(admin, supervisor), multer | inline |
| DELETE | `/fondo` | verificarToken, verificarRol(admin, supervisor) | inline |
| POST | `/fix-listas` | verificarToken, verificarRol(admin) | inline |

## 3. Clientes — `/api/clientes`
| Método | Ruta | Middlewares | Controlador |
|---|---|---|---|
| POST | `/` | verificarToken, validate(crearClienteSchema) | crearCliente |
| GET | `/` | verificarToken | obtenerClientes |
| GET | `/:id` | verificarToken, validateIdParam | obtenerCliente |
| PUT | `/:id` | verificarToken, validateIdParam, validate | actualizarCliente |
| DELETE | `/:id` | verificarToken, verificarRol(admin), validateIdParam | eliminarCliente |
| GET | `/:id/bloqueos` | verificarToken, verificarRol(admin), validateIdParam | obtenerBloqueosCliente |
| GET | `/:id/perfil` | verificarToken, validateIdParam | perfilCliente |
| POST | `/importar` | verificarToken, verificarRol(admin, supervisor) | importarClientes |
| POST | `/:id/recargar-saldo` | verificarToken, verificarRol(admin), validateIdParam | recargarSaldo |

## 4. Vehículos — `/api/vehiculos`
| Método | Ruta | Middlewares | Controlador |
|---|---|---|---|
| POST | `/` | verificarToken, verificarRol(admin, supervisor), validate | crearVehiculo |
| GET | `/` | verificarToken | obtenerVehiculos |
| GET | `/:id` | verificarToken, validateIdParam | obtenerVehiculo |
| PUT | `/:id` | verificarToken, verificarRol(admin, supervisor), validateIdParam, validate | actualizarVehiculo |
| DELETE | `/:id` | verificarToken, verificarRol(admin), validateIdParam | eliminarVehiculo |

## 5. Puestos — `/api/puestos`
| Método | Ruta | Middlewares | Controlador |
|---|---|---|---|
| POST | `/` | verificarToken, verificarRol(admin, supervisor), validate | crearPuesto |
| POST | `/masivos` | verificarToken, verificarRol(admin, supervisor), validate | crearPuestosMasivos |
| GET | `/` | verificarToken | obtenerPuestos |
| GET | `/:id` | verificarToken, validateIdParam | obtenerPuesto |
| PUT | `/:id` | verificarToken, verificarRol(admin, supervisor), validateIdParam, validate | actualizarPuesto |
| DELETE | `/:id` | verificarToken, verificarRol(admin), validateIdParam | eliminarPuesto |
| PUT | `/toggle/:id` | verificarToken, verificarRol(admin, supervisor), validateIdParam | togglePuesto |

## 6. Ingresos — `/api/ingresos`
| Método | Ruta | Middlewares | Controlador |
|---|---|---|---|
| POST | `/` | verificarToken, verificarRol(admin, supervisor), validate | registrarIngreso |
| GET | `/` | verificarToken | obtenerIngresos |
| GET | `/:id` | verificarToken, validateIdParam | obtenerIngreso |
| PUT | `/liberar/:id` | verificarToken, verificarRol(admin, supervisor), validateIdParam | liberarPuesto |
| POST | `/simular-cobro` | verificarToken, verificarRol(admin, supervisor) | simularCobro |
| POST | `/salida-con-cobro/:id` | verificarToken, verificarRol(admin, supervisor), validateIdParam | registrarSalidaConCobro |
| PUT | `/:id` | verificarToken, verificarRol(admin, supervisor), validateIdParam, validate | actualizarIngreso |
| DELETE | `/:id` | verificarToken, verificarRol(admin), validateIdParam | eliminarIngreso |
| GET | `/:id/ticket` | verificarToken, validateIdParam | ticketEntrada (PDF) |

## 7. Tarifas — `/api/tarifas`
POST `/` (admin), GET `/`, GET `/:id`, PUT `/:id` (admin), DELETE `/:id` (admin).

## 8. Dashboard — `/api/dashboard`
GET `/` (verificarToken).

## 9. Caja — `/api/caja`
| Método | Ruta | Middlewares |
|---|---|---|
| POST | `/abrir` | verificarToken, verificarRol(admin, supervisor), cajaLimiter, validate |
| GET | `/actual` | verificarToken |
| PUT | `/cerrar/:id` | verificarToken, verificarRol(admin, supervisor), validateIdParam, validate |
| GET | `/historial` y `/` | verificarToken, verificarRol(admin, supervisor) |
| GET | `/:id` | verificarToken, validateIdParam |
| GET | `/:id/movimientos` | verificarToken, validateIdParam |
| PUT | `/:id` | verificarToken, validateIdParam, verificarRol(admin) |
| PUT | `/movimiento/:id` | verificarToken, verificarRol(admin, supervisor), validateIdParam |
| DELETE | `/:id` | verificarToken, validateIdParam, verificarRol(admin) |
| DELETE | `/movimiento/:id` | verificarToken, verificarRol(admin, supervisor), validateIdParam |

## 10. Mensualidades — `/api/mensualidades`
POST `/` (admin,supervisor), GET `/`, GET `/vencidas`, GET `/:id`, PUT `/renovar/:id`, PUT `/cancelar/:id`, PUT `/:id`, DELETE `/:id`, POST `/cobrar/:id`, POST `/generar-facturas` (todas las mutaciones admin/supervisor).

## 11. Gastos — `/api/gastos`
POST `/`, GET `/`, GET `/:id`, POST `/generar-recurrentes`, PUT `/:id`, DELETE `/:id` (mutaciones admin/supervisor).

## 12. Reservas — `/api/reservas`
POST `/`, GET `/`, GET `/:id`, PUT `/:id`, PUT `/:id/estado`, PUT `/cancelar/:id`, DELETE `/:id`, POST `/liberar-vencidas` (mutaciones admin/supervisor).

## 13. Ausencias — `/api/ausencias`
POST `/`, GET `/`, GET `/:id`, PUT `/:id`, PUT `/finalizar/:id` (admin/supervisor), DELETE `/:id` (admin).

## 14. Alertas — `/api/alertas`
GET `/` (verificarToken).

## 15. Planes — `/api/planes`
POST `/` (admin), GET `/`, GET `/:id`, PUT `/:id` (admin), DELETE `/:id` (admin).

## 16. Movimientos — `/api/movimientos`
GET `/` (admin, supervisor). Solo lectura.

## 17. Facturas — `/api/facturas`
GET `/`, GET `/:id`, GET `/pdf/:id` (pdfLimiter), GET `/whatsapp/:id`, GET `/:id/recibo` (pdfLimiter).

## 18. Backup — `/api/backup`
GET `/` (admin), POST `/restaurar` (admin, restoreLimiter 3/h).

## 19. Notificaciones — `/api/notificaciones`
POST `/subscribir`, POST `/enviar` (verificarToken).

## 20. Sucursales — `/api/sucursales`
GET `/`, POST `/`, PUT `/:id` (todas admin).

## 21. Reportes — `/api/reportes`
GET `/` (admin, supervisor).

---

## Middlewares globales (`app.ts`)
Helmet · CORS por whitelist (`CORS_ORIGINS`) · rate-limit global (300/min prod, 600/min dev) · cookie-parser · `express.json({limit:"25mb"})` · `sanitizeBody` (anti-XSS) · morgan.

## Middlewares de módulo
- `verificarToken` / `verificarTokenOpcional` (`auth.middleware.ts`).
- `verificarRol(...roles)` (`roles.middleware.ts`).
- `validate(schema)` (`validate.middleware.ts`, Zod).
- `validateIdParam` (`validateId.middleware.ts`).
- Rate limiters específicos: login (dinámico), forgot-password, crear-admin, caja/abrir, facturas/pdf, backup/restaurar, formatear.

## Errores estándar (`error.middleware.ts`)
- `AppError` → status propio con `{ok:false, message}`.
- `ZodError` → 400 "Error de validación".
- Prisma `P2002` → 409 "El registro ya existe (valor duplicado)".
- Prisma `P2025` → 404 "Registro no encontrado".
- Resto → 500 (mensaje real solo fuera de producción).

## Correspondencia endpoint ↔ pantalla frontend
| Endpoint base | Pantalla(s) |
|---|---|
| `/api/dashboard` | DashboardPage (contadores en MainLayout) |
| `/api/clientes` (+perfil, importar, recargar, bloqueos) | Clientes, PerfilCliente |
| `/api/vehiculos` | Vehiculos, Clientes, Reservas |
| `/api/puestos` | Puestos, Ocupacion, Ingresos |
| `/api/ingresos` (+simular-cobro, salida-con-cobro, ticket) | Ingresos, Puestos |
| `/api/tarifas` | Tarifas, Vehiculos, Ingresos |
| `/api/planes` | Planes, Clientes, Mensualidades |
| `/api/caja` | Caja, Gastos, Mensualidades, Ingresos |
| `/api/mensualidades` | Mensualidades |
| `/api/gastos` | Gastos |
| `/api/reservas` | Reservas |
| `/api/ausencias` | Ausencias, Puestos |
| `/api/facturas` | Facturas, Ingresos |
| `/api/movimientos` | Movimientos |
| `/api/reportes` | Reportes |
| `/api/usuarios` | Login, Usuarios, Caja (verificar-password) |
| `/api/configuracion` | Configuracion, Login, toda la app (tema) |
| `/api/sucursales` | Sucursales, Dashboard, Reportes, Usuarios |
| `/api/backup` | BackupPage |
| `/api/alertas` | CampanaNotificaciones / NotificacionContext |
| `/api/notificaciones` | useNotifications (push) |
