// src/middleware/auth.ts
import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";
import { pool } from "../config/db";

export interface AuthRequest extends Request {
  user?: any;
}

/**
 * Protect routes - expects header: Authorization: Bearer <accessToken>
 */
export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing authorization header" });
    }

    const token = auth.split(" ")[1];

    const decoded = verifyToken(token) as any;
    // optionally validate decoded payload shape
    req.user = {
      user_id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };
    return next();
  } catch (err: any) {
    console.error("Auth middleware error:", err.message || err);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/**
 * Validate refresh token presence in DB (rotating tokens)
 */
export async function validateRefreshToken(userId: string, token: string) {
  // refresh tokens stored hashed in DB in table refresh_tokens (token_hash)
  // For simplicity this example stores raw tokens (NOT recommended for prod).
  // In production: store hashed token, compare with bcrypt/crypto timing-safe.
  const [rows] = await pool.query(
    "SELECT id, revoked, expires_at FROM refresh_tokens WHERE user_id = ? AND token = ? LIMIT 1",
    [userId, token]
  );
  const row = (rows as any)[0];
  if (!row) return false;
  if (row.revoked) return false;
  const expires = new Date(row.expires_at);
  if (expires < new Date()) return false;
  return true;
}
