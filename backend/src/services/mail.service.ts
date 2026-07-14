import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendResetPasswordEmail(to, nombre, token) {
  const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;

  await transporter.sendMail({
    from: `"${process.env.SMTP_FROM_NAME || "ParkAdmin"}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to,
    subject: "Recuperacion de contrasena - ParkAdmin",
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #f8fafc; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0;">
        <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 28px 32px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 22px; font-weight: 700;">Recuperacion de Contrasena</h1>
        </div>
        <div style="padding: 32px; background: #fff;">
          <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">Hola <strong>${nombre}</strong>,</p>
          <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 20px;">Recibimos una solicitud para restablecer la contrasena de tu cuenta. Haz clic en el siguiente boton para crear una nueva contrasena:</p>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981, #059669); color: #fff; text-decoration: none; padding: 14px 36px; border-radius: 12px; font-size: 15px; font-weight: 600; letter-spacing: 0.3px;">Restablecer Contrasena</a>
          </div>
          <p style="color: #94a3b8; font-size: 13px; line-height: 1.5; margin: 0 0 4px;">Si no solicitaste este cambio, ignora este correo.</p>
          <p style="color: #94a3b8; font-size: 13px; line-height: 1.5; margin: 0;">El enlace expira en 60 minutos.</p>
        </div>
        <div style="background: #f1f5f9; padding: 16px 32px; text-align: center;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} ParkAdmin — Sistema Inteligente de Parqueadero</p>
        </div>
      </div>
    `,
  });
}
