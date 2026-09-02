import { Request, Response, NextFunction } from "express";

function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, "").replace(/[<>]/g, "");
}

function sanitizeValue(val: any): any {
  if (typeof val === "string") return stripHtml(val.trim());
  if (Array.isArray(val)) return val.map(sanitizeValue);
  if (val && typeof val === "object") {
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      clean[k] = sanitizeValue(v);
    }
    return clean;
  }
  return val;
}

export function sanitizeBody(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeValue(req.body);
  }
  if (req.query && typeof req.query === "object") {
    for (const [k, v] of Object.entries(req.query)) {
      if (typeof v === "string") (req.query as any)[k] = stripHtml(v.trim());
    }
  }
  next();
}
