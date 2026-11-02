import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import jwt from "jsonwebtoken";

interface AuthenticatedSocket extends Socket {
  usuario?: jwt.JwtPayload;
  authenticated?: boolean;
}

let io: Server | null = null;

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(header.split(";").map((cookie) => {
    const [key, ...value] = cookie.trim().split("=");
    return [key, value.join("=")];
  }));
}

export function initSocket(server: HttpServer): Server {
  const socketServer = new Server(server, {
    cors: {
      origin: true,
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });
  io = socketServer;

  socketServer.use((socket, next) => {
    const authenticatedSocket = socket as AuthenticatedSocket;
    const cookies = parseCookies(socket.handshake.headers.cookie);
    const token = cookies.token || socket.handshake.auth?.token;

    if (typeof token !== "string" || token.length === 0) {
      return next(new Error("Token requerido"));
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) return next(new Error("JWT_SECRET no está configurado"));

    try {
      const decoded = jwt.verify(token, secret);
      if (typeof decoded === "string" || typeof decoded.id !== "number") {
        return next(new Error("Token inválido"));
      }
      authenticatedSocket.usuario = decoded;
      authenticatedSocket.authenticated = true;
      return next();
    } catch {
      return next(new Error("Token invalido o expirado"));
    }
  });

  socketServer.on("connection", (socket) => {
    const authenticatedSocket = socket as AuthenticatedSocket;
    authenticatedSocket.on("join", (userId: unknown) => {
      if (typeof userId === "number" && authenticatedSocket.usuario?.id === userId) {
        authenticatedSocket.join(`user:${userId}`);
      }
    });
  });

  return socketServer;
}

export function getIO(): Server {
  if (!io) throw new Error("Socket.io no inicializado");
  return io;
}

export function emitirEvento(evento: string, data: unknown): void {
  io?.emit(evento, data);
}
