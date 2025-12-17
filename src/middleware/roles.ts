// src/middleware/roles.ts
import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "./auth";

/**
 * requireRole('admin') or requireRole('provider')
 */
export function requireRole(...allowed: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    if (!allowed.includes(user.role)) {
      return res.status(403).json({ error: "Forbidden - insufficient role" });
    }
    return next();
  };
}
