import { Server } from "socket.io";
import jwt from "jsonwebtoken";

let io = null;

function parseCookies(header) {
  if (!header) return {};
  return Object.fromEntries(header.split(";").map(c => {
    const [k, ...v] = c.trim().split("=");
    return [k, v.join("=")];
  }));
}

export function initSocket(server) {
  const NODE_ENV = process.env.NODE_ENV || "development";
  const allowedOrigins = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map(o => o.trim())
    .filter(Boolean);
  if (NODE_ENV !== "production") {
    allowedOrigins.push("http://localhost:5173", "http://localhost:3000");
  }

  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (NODE_ENV !== "production") return callback(null, true);
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error("Not allowed by CORS"));
      },
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  io.use((socket, next) => {
    const cookies = socket.handshake.headers?.cookie ? parseCookies(socket.handshake.headers.cookie) : {};
    const token = cookies?.token || socket.handshake.auth?.token;
    if (!token) return next(new Error("Token requerido"));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.usuario = decoded;
      socket.authenticated = true;
      next();
    } catch {
      next(new Error("Token invalido o expirado"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("join", (userId) => {
      if (userId && socket.usuario && userId === socket.usuario.id) {
        socket.join(`user:${userId}`);
      }
    });
  });

  return io;
}

export function getIO() {
  if (!io) throw new Error("Socket.io no inicializado");
  return io;
}

export function emitirEvento(evento, data) {
  if (io) io.emit(evento, data);
}
