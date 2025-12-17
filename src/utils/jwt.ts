// src/utils/jwt.ts
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

const ACCESS_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || "15m";
const REFRESH_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || "7d";
const SECRET = process.env.JWT_SECRET || "please_change_this";

export function signAccessToken(payload: object) {
  return jwt.sign(payload, SECRET!, {
    expiresIn: ACCESS_EXPIRES_IN,
  } as jwt.SignOptions);
}

export function signRefreshToken(payload: object) {
  return jwt.sign(payload, SECRET!, {
    expiresIn: REFRESH_EXPIRES_IN,
  } as jwt.SignOptions);
}

export function verifyToken(token: string) {
  return jwt.verify(token, SECRET);
}

export { ACCESS_EXPIRES_IN, REFRESH_EXPIRES_IN };
