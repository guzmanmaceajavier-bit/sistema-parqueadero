declare global {
  namespace Express {
    interface Request {
      usuario?: Record<string, any>;
    }
  }
}
export {};
