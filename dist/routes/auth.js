"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/auth.ts
const express_1 = __importDefault(require("express"));
const express_validator_1 = require("express-validator");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const uuid_1 = require("uuid");
const db_1 = require("../config/db");
const jwt_1 = require("../utils/jwt");
const auth_1 = require("../middleware/auth");
const email_1 = require("../utils/email");
const router = express_1.default.Router();
/**
 * Provider signup (public). Never allow role=admin here.
 */
router.post("/signup", [
    (0, express_validator_1.body)("email").isEmail(),
    (0, express_validator_1.body)("password").isLength({ min: 8 }),
    (0, express_validator_1.body)("display_name").isLength({ min: 2 }),
    (0, express_validator_1.body)("phone").optional().isString(),
], async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty())
        return res.status(400).json({ errors: errors.array() });
    const { email, password, display_name, phone, role, verification_token } = req.body;
    // block admin creation via public signup
    if (role && role === "admin") {
        return res.status(403).json({ error: "Cannot self-register as admin" });
    }
    const assignedRole = role === "service_provider" ? "service_provider" : "service_provider"; // only providers sign up
    try {
        const [existing] = await db_1.pool.query("SELECT id FROM profiles WHERE email = ? LIMIT 1", [email]);
        if (existing.length > 0) {
            return res.status(409).json({ error: "Email already in use" });
        }
        const password_hash = await bcryptjs_1.default.hash(password, 12);
        const verificationToken = (0, uuid_1.v4)();
        const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        const [result] = await db_1.pool.query("INSERT INTO profiles (email, password_hash, display_name, phone, role, email_verified, verification_token, verification_token_expiry, created_at, updated_at) VALUES (?, ?, ?, ?, ?, FALSE, ?, ?, NOW(), NOW())", [
            email,
            password_hash,
            display_name,
            phone,
            assignedRole,
            verificationToken,
            verificationExpiry,
        ]);
        const userId = result.insertId;
        // Send verification email
        await (0, email_1.sendEmailVerification)(email, verificationToken);
        const response = {
            success: true,
            message: "Account created successfully. Please check your email to verify your account.",
            user: {
                id: userId,
                email,
                display_name,
                phone,
                role: assignedRole,
                email_verified: false,
            },
        };
        // Include verification token in development for testing
        if (process.env.NODE_ENV !== "production") {
            response.verificationToken = verificationToken;
            // response.message +=
            //   " (Development: Use the verificationToken to verify your email)";
        }
        return res.status(201).json(response);
    }
    catch (err) {
        console.error("Signup error:", err.message || err);
        return res.status(500).json({ error: "Server error" });
    }
});
/**
 * Signin - returns access + refresh tokens
 */
router.post("/signin", [(0, express_validator_1.body)("email").isEmail(), (0, express_validator_1.body)("password").exists()], async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty())
        return res.status(400).json({ errors: errors.array() });
    const { email, password } = req.body;
    try {
        const [rows] = await db_1.pool.query("SELECT * FROM profiles WHERE email = ? LIMIT 1", [email]);
        const user = rows[0];
        if (!user)
            return res.status(401).json({ error: "Invalid credentials" });
        if (!user.password_hash)
            return res.status(401).json({ error: "User has no password set" });
        const ok = await bcryptjs_1.default.compare(password, user.password_hash);
        if (!ok)
            return res.status(401).json({ error: "Invalid credentials" });
        // Check if email is verified
        if (!user.email_verified) {
            return res
                .status(403)
                .json({ error: "Please verify your email before signing in" });
        }
        const accessToken = (0, jwt_1.signAccessToken)({
            id: user.id,
            email: user.email,
            role: user.role,
        });
        const refreshToken = (0, jwt_1.signRefreshToken)({
            id: user.id,
            email: user.email,
            role: user.role,
        });
        // store refresh token
        const expiresAt = new Date(Date.now() + msToMs(jwt_1.REFRESH_EXPIRES_IN));
        await db_1.pool.query("INSERT INTO refresh_tokens (user_id, token, expires_at, revoked, created_at) VALUES (?, ?, ?, 0, NOW())", [user.id, refreshToken, expiresAt]);
        const { password_hash, reset_token, reset_token_expiry, ...safe } = user;
        return res.json({
            success: true,
            user: safe,
            accessToken,
            refreshToken,
            expiresIn: jwt_1.ACCESS_EXPIRES_IN,
        });
    }
    catch (err) {
        console.error("Signin error:", err.message || err);
        return res.status(500).json({ error: "Server error" });
    }
});
/**
 * Refresh tokens - rotating refresh tokens
 */
router.post("/refresh", async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken)
        return res.status(400).json({ error: "refreshToken required" });
    try {
        // verify token signature
        const payload = (await Promise.resolve().then(() => __importStar(require("jsonwebtoken")))).verify(refreshToken, process.env.JWT_SECRET || "please_change_this");
        // validate presence in DB and not revoked
        const ok = await (0, auth_1.validateRefreshToken)(payload.id, refreshToken);
        if (!ok)
            return res.status(401).json({ error: "Invalid refresh token" });
        // rotate: revoke old token and issue new tokens
        await db_1.pool.query("UPDATE refresh_tokens SET revoked = 1 WHERE token = ?", [
            refreshToken,
        ]);
        const newAccess = (0, jwt_1.signAccessToken)({
            id: payload.id,
            email: payload.email,
            role: payload.role,
        });
        const newRefresh = (0, jwt_1.signRefreshToken)({
            id: payload.id,
            email: payload.email,
            role: payload.role,
        });
        const expiresAt = new Date(Date.now() + msToMs(jwt_1.REFRESH_EXPIRES_IN));
        await db_1.pool.query("INSERT INTO refresh_tokens (user_id, token, expires_at, revoked, created_at) VALUES (?, ?, ?, 0, NOW())", [payload.id, newRefresh, expiresAt]);
        return res.json({
            accessToken: newAccess,
            refreshToken: newRefresh,
            expiresIn: jwt_1.ACCESS_EXPIRES_IN,
        });
    }
    catch (err) {
        console.error("Refresh error:", err.message || err);
        return res.status(401).json({ error: "Invalid or expired refresh token" });
    }
});
/**
 * Signout - revoke refresh token
 */
router.post("/signout", async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken)
        return res.status(400).json({ error: "refreshToken required" });
    try {
        await db_1.pool.query("UPDATE refresh_tokens SET revoked = 1 WHERE token = ?", [
            refreshToken,
        ]);
        return res.json({ success: true, message: "Signed out" });
    }
    catch (err) {
        console.error("Signout error:", err.message || err);
        return res.status(500).json({ error: "Server error" });
    }
});
/**
 * Get current user
 */
router.get("/me", auth_1.requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const [rows] = await db_1.pool.query("SELECT id, email, display_name, phone, role, created_at, updated_at FROM profiles WHERE id = ?", [userId]);
        const user = rows[0];
        if (!user)
            return res.status(404).json({ error: "User not found" });
        return res.json({ user });
    }
    catch (err) {
        console.error("Me error:", err.message || err);
        return res.status(500).json({ error: "Server error" });
    }
});
/**
 * Update password while logged in
 */
router.put("/update-password", auth_1.requireAuth, [
    (0, express_validator_1.body)("current_password").exists(),
    (0, express_validator_1.body)("new_password").isLength({ min: 8 }),
], async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty())
        return res.status(400).json({ errors: errors.array() });
    try {
        const userId = req.user.userId;
        const { current_password, new_password } = req.body;
        const [rows] = await db_1.pool.query("SELECT password_hash FROM profiles WHERE id = ?", [userId]);
        const user = rows[0];
        if (!user)
            return res.status(404).json({ error: "User not found" });
        const ok = await bcryptjs_1.default.compare(current_password, user.password_hash);
        if (!ok)
            return res.status(401).json({ error: "Current password incorrect" });
        const newHash = await bcryptjs_1.default.hash(new_password, 12);
        await db_1.pool.query("UPDATE profiles SET password_hash = ?, updated_at = NOW() WHERE id = ?", [newHash, userId]);
        return res.json({ success: true, message: "Password updated" });
    }
    catch (err) {
        console.error("Update password error:", err.message || err);
        return res.status(500).json({ error: "Server error" });
    }
});
/**
 * Forgot password -> generates reset token and stores it
 */
router.post("/forgot-password", [(0, express_validator_1.body)("email").isEmail()], async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty())
        return res.status(400).json({ errors: errors.array() });
    const { email } = req.body;
    try {
        const [rows] = await db_1.pool.query("SELECT id FROM profiles WHERE email = ? LIMIT 1", [email]);
        const user = rows[0];
        if (!user) {
            // respond same to avoid account enumeration
            return res.json({
                success: true,
                message: "Reset link has been sent to your email",
            });
        }
        const resetToken = (0, uuid_1.v4)();
        const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        await db_1.pool.query("UPDATE profiles SET reset_token = ?, reset_token_expiry = ? WHERE id = ?", [resetToken, expiry, user.id]);
        // Send email with reset link
        await (0, email_1.sendPasswordResetEmail)(email, resetToken);
        return res.json({
            success: true,
            message: "Reset link has been sent to your email",
            ...(process.env.NODE_ENV !== "production" && { resetToken }),
        });
    }
    catch (err) {
        console.error("Forgot password error:", err.message || err);
        return res.status(500).json({ error: "Server error" });
    }
});
/**temps
 * Reset password using token
 */
router.post("/reset-password", [(0, express_validator_1.body)("token").exists(), (0, express_validator_1.body)("newPassword").isLength({ min: 8 })], async (req, res) => {
    const { token, newPassword } = req.body;
    try {
        const [rows] = await db_1.pool.query("SELECT id, reset_token_expiry FROM profiles WHERE reset_token = ? LIMIT 1", [token]);
        const user = rows[0];
        if (!user)
            return res.status(400).json({ error: "Invalid or expired token" });
        const expiry = new Date(user.reset_token_expiry);
        if (!expiry || expiry < new Date())
            return res.status(400).json({ error: "Invalid or expired token" });
        const newHash = await bcryptjs_1.default.hash(newPassword, 12);
        await db_1.pool.query("UPDATE profiles SET password_hash = ?, reset_token = NULL, reset_token_expiry = NULL, updated_at = NOW() WHERE id = ?", [newHash, user.id]);
        return res.json({
            success: true,
            message: "Password reset successfully",
        });
    }
    catch (err) {
        console.error("Reset password error:", err.message || err);
        return res.status(500).json({ error: "Server error" });
    }
});
/**
 * Verify email using token
 */
router.post("/verify-email", [(0, express_validator_1.body)("token").exists()], async (req, res) => {
    const { token } = req.body;
    try {
        const [rows] = await db_1.pool.query("SELECT id, verification_token_expiry FROM profiles WHERE verification_token = ? LIMIT 1", [token]);
        const user = rows[0];
        if (!user)
            return res.status(400).json({ error: "Invalid or expired token" });
        const expiry = new Date(user.verification_token_expiry);
        if (!expiry || expiry < new Date())
            return res.status(400).json({ error: "Invalid or expired token" });
        await db_1.pool.query("UPDATE profiles SET email_verified = TRUE, verification_token = NULL, verification_token_expiry = NULL, updated_at = NOW() WHERE id = ?", [user.id]);
        return res.redirect(`${process.env.FRONTEND_URL}/auth/signin`);
        // return res.json({
        //   success: true,
        //   message: "Email verified successfully",
        // });
    }
    catch (err) {
        console.error("Verify email error:", err.message || err);
        return res.status(500).json({ error: "Server error" });
    }
});
/**
 * Send magic link for passwordless login (admin only)
 */
router.post("/send-magic-link", auth_1.requireAuth, [(0, express_validator_1.body)("email").isEmail()], async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty())
        return res.status(400).json({ errors: errors.array() });
    // Only admins can send magic links
    if (req.user.role !== "admin") {
        return res
            .status(403)
            .json({ error: "Only admins can send magic links" });
    }
    const { email } = req.body;
    try {
        const [rows] = await db_1.pool.query("SELECT id FROM profiles WHERE email = ? LIMIT 1", [email]);
        const user = rows[0];
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        const magicToken = (0, uuid_1.v4)();
        const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        // Store magic token (we can reuse reset_token for this)
        await db_1.pool.query("UPDATE profiles SET reset_token = ?, reset_token_expiry = ? WHERE id = ?", [magicToken, expiry, user.id]);
        // Send magic link email
        await (0, email_1.sendMagicLinkEmail)(email, magicToken);
        const response = {
            success: true,
            message: "Magic link sent successfully",
        };
        // Include magic token in development for testing
        if (process.env.NODE_ENV !== "production") {
            response.magicToken = magicToken;
            response.magicUrl = `${process.env.FRONTEND_URL}/magic-login?token=${magicToken}`;
        }
        return res.json(response);
    }
    catch (err) {
        console.error("Send magic link error:", err.message || err);
        return res.status(500).json({ error: "Server error" });
    }
});
/**
 * Generate magic token for admin to login as user (no email sent)
 */
router.post("/generate-magic-token", auth_1.requireAuth, [(0, express_validator_1.body)("email").isEmail()], async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty())
        return res.status(400).json({ errors: errors.array() });
    // Only admins can generate magic tokens
    if (req.user.role !== "admin") {
        return res
            .status(403)
            .json({ error: "Only admins can generate magic tokens" });
    }
    const { email } = req.body;
    try {
        const [rows] = await db_1.pool.query("SELECT id FROM profiles WHERE email = ? LIMIT 1", [email]);
        const user = rows[0];
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        const magicToken = (0, uuid_1.v4)();
        const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        // Store magic token (reuse reset_token for this)
        await db_1.pool.query("UPDATE profiles SET reset_token = ?, reset_token_expiry = ? WHERE id = ?", [magicToken, expiry, user.id]);
        return res.json({
            success: true,
            message: "Magic token generated successfully",
            token: magicToken,
            expiresIn: "15 minutes",
        });
    }
    catch (err) {
        console.error("Generate magic token error:", err.message || err);
        return res.status(500).json({ error: "Server error" });
    }
});
/**
 * Magic login using token
 */
router.post("/magic-login", [(0, express_validator_1.body)("token").exists()], async (req, res) => {
    const { token } = req.body;
    try {
        const [rows] = await db_1.pool.query("SELECT id, email, role, reset_token_expiry FROM profiles WHERE reset_token = ? LIMIT 1", [token]);
        const user = rows[0];
        if (!user)
            return res.status(400).json({ error: "Invalid or expired token" });
        const expiry = new Date(user.reset_token_expiry);
        if (!expiry || expiry < new Date())
            return res.status(400).json({ error: "Invalid or expired token" });
        // Clear the magic token
        await db_1.pool.query("UPDATE profiles SET reset_token = NULL, reset_token_expiry = NULL WHERE id = ?", [user.id]);
        const accessToken = (0, jwt_1.signAccessToken)({
            id: user.id,
            email: user.email,
            role: user.role,
        });
        const refreshToken = (0, jwt_1.signRefreshToken)({
            id: user.id,
            email: user.email,
            role: user.role,
        });
        // store refresh token
        const expiresAt = new Date(Date.now() + msToMs(jwt_1.REFRESH_EXPIRES_IN));
        await db_1.pool.query("INSERT INTO refresh_tokens (user_id, token, expires_at, revoked, created_at) VALUES (?, ?, ?, 0, NOW())", [user.id, refreshToken, expiresAt]);
        const { password_hash, reset_token, reset_token_expiry, ...safe } = user;
        return res.json({
            success: true,
            user: safe,
            accessToken,
            refreshToken,
            expiresIn: jwt_1.ACCESS_EXPIRES_IN,
        });
    }
    catch (err) {
        console.error("Magic login error:", err.message || err);
        return res.status(500).json({ error: "Server error" });
    }
});
exports.default = router;
/* helpers */
function msToMs(str) {
    // Accept common patterns like "15m", "7d", "3600s"
    // very basic parser:
    const num = parseInt(str.replace(/\D/g, ""), 10) || 0;
    if (str.endsWith("ms"))
        return num;
    if (str.endsWith("s"))
        return num * 1000;
    if (str.endsWith("m"))
        return num * 60 * 1000;
    if (str.endsWith("h"))
        return num * 60 * 60 * 1000;
    if (str.endsWith("d"))
        return num * 24 * 60 * 60 * 1000;
    // fallback: treat as ms
    return num;
}
//# sourceMappingURL=auth.js.map