"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.validateRefreshToken = validateRefreshToken;
const jwt_1 = require("../utils/jwt");
const db_1 = require("../config/db");
/**
 * Protect routes - expects header: Authorization: Bearer <accessToken>
 */
async function requireAuth(req, res, next) {
    try {
        const auth = req.headers.authorization;
        if (!auth || !auth.startsWith("Bearer ")) {
            return res.status(401).json({ error: "Missing authorization header" });
        }
        const token = auth.split(" ")[1];
        const decoded = (0, jwt_1.verifyToken)(token);
        // optionally validate decoded payload shape
        req.user = {
            userId: decoded.id,
            email: decoded.email,
            role: decoded.role,
        };
        return next();
    }
    catch (err) {
        console.error("Auth middleware error:", err.message || err);
        return res.status(401).json({ error: "Invalid or expired token" });
    }
}
/**
 * Validate refresh token presence in DB (rotating tokens)
 */
async function validateRefreshToken(userId, token) {
    // refresh tokens stored hashed in DB in table refresh_tokens (token_hash)
    // For simplicity this example stores raw tokens (NOT recommended for prod).
    // In production: store hashed token, compare with bcrypt/crypto timing-safe.
    const [rows] = await db_1.pool.query("SELECT id, revoked, expires_at FROM refresh_tokens WHERE user_id = ? AND token = ? LIMIT 1", [userId, token]);
    const row = rows[0];
    if (!row)
        return false;
    if (row.revoked)
        return false;
    const expires = new Date(row.expires_at);
    if (expires < new Date())
        return false;
    return true;
}
//# sourceMappingURL=auth.js.map