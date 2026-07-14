import { z } from "zod";

export const actualizarConfiguracionSchema = z.object({
  nombreParqueadero: z.string().optional(),
  nit: z.string().optional().nullable(),
  direccion: z.string().optional().nullable(),
  ciudad: z.string().optional().nullable(),
  telefono: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  correo: z.string().optional().nullable(),
  logo: z.string().optional().nullable(),
  fondoLogin: z.string().optional().nullable(),
  colorFondoLogin: z.string().optional().nullable(),
  /* Tema */
  colorPrincipal: z.string().optional().nullable(),
  colorSecundario: z.string().optional().nullable(),
  colorFondo: z.string().optional().nullable(),
  modoOscuro: z.boolean().optional(),
  tamanoFuente: z.string().optional().nullable(),
  /* Formato */
  formatoFecha: z.string().optional().nullable(),
  formatoHora: z.string().optional().nullable(),
  formatoMoneda: z.string().optional().nullable(),
  zonaHoraria: z.string().optional().nullable(),
  monedaSimbolo: z.string().optional().nullable(),
  idioma: z.string().optional().nullable(),
  /* Notificaciones */
  notificarWhatsappIngreso: z.boolean().optional(),
  notificarWhatsappSalida: z.boolean().optional(),
  notificarWhatsappReserva: z.boolean().optional(),
  notificarWhatsappVencimiento: z.boolean().optional(),
  notificarEmail: z.boolean().optional(),
  /* Plantillas WhatsApp */
  mensajeWhatsappIngreso: z.string().optional().nullable(),
  mensajeWhatsappSalida: z.string().optional().nullable(),
  mensajeWhatsappFactura: z.string().optional().nullable(),
  mensajeWhatsappReserva: z.string().optional().nullable(),
  mensajeWhatsappRecordatorio: z.string().optional().nullable(),
  mensajeWhatsappVencida: z.string().optional().nullable(),
  mensajeWhatsappBienvenida: z.string().optional().nullable(),
  /* Operativa */
  horarioApertura: z.string().optional().nullable(),
  horarioCierre: z.string().optional().nullable(),
  paginacionPorDefecto: z.number().int().optional().nullable(),
  iva: z.number().optional().nullable(),
  pieFactura: z.string().optional().nullable(),
  metodosPago: z.string().optional().nullable(),
  intentosMaximos: z.number().int().optional().nullable(),
});
