"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.confirmResetPassword = exports.resetPassword = exports.updatePassword = exports.me = exports.refresh = exports.signout = exports.signin = exports.signup = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const zod_1 = require("zod");
const db_js_1 = require("../config/db.js");
const jwt_js_1 = require("../utils/jwt.js");
const email_js_1 = require("../utils/email.js");
// Validation schemas
const signupSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    displayName: zod_1.z.string().min(1),
    phone: zod_1.z.string().min(1),
    password: zod_1.z.string().min(6),
});
const signinSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(1),
});
const updatePasswordSchema = zod_1.z.object({
    currentPassword: zod_1.z.string().min(1),
    newPassword: zod_1.z.string().min(6),
});
const resetPasswordSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
});
const confirmResetSchema = zod_1.z.object({
    token: zod_1.z.string().min(1),
    newPassword: zod_1.z.string().min(6),
});
const signup = async (req, res) => {
    try {
        const { email, displayName, phone, password } = signupSchema.parse(req.body);
        console.log(`[AUTH] Signup attempt for email: ${email}`);
        // Check if email already exists
        const [existing] = await db_js_1.pool.execute("SELECT id FROM profiles WHERE email = ?", [email]);
        if (existing.length > 0) {
            console.log(`[AUTH] Signup failed for ${email}: Email already registered`);
            res.status(400).json({ error: "Email already registered" });
            return;
        }
        // Hash password
        const passwordHash = await bcryptjs_1.default.hash(password, 12);
        // Insert new provider user
        const [result] = await db_js_1.pool.execute("INSERT INTO profiles (email, display_name, phone, role, password_hash) VALUES (?, ?, ?, ?, ?)", [email, displayName, phone, "service_provider", passwordHash]);
        const userId = result.insertId;
        console.log(`[AUTH] Signup successful for ${email} (ID: ${userId}, Role: service_provider)`);
        res
            .status(201)
            .json({ message: "Service Provider account created successfully", userId });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            console.log(`[AUTH] Signup failed for ${req.body.email || "unknown"}: Validation errors - ${JSON.stringify(error.errors)}`);
            res.status(400).json({ error: "Invalid input", details: error.errors });
        }
        else {
            console.error(`[AUTH] Signup error for ${req.body.email || "unknown"}:`, error);
            res.status(500).json({ error: "Internal server error" });
        }
    }
};
exports.signup = signup;
const signin = async (req, res) => {
    try {
        const { email, password } = signinSchema.parse(req.body);
        console.log(`[AUTH] Signin attempt for email: ${email}`);
        // Find user
        const [rows] = await db_js_1.pool.execute("SELECT id, password_hash, role FROM profiles WHERE email = ?", [email]);
        if (rows.length === 0) {
            console.log(`[AUTH] Signin failed for ${email}: User not found`);
            res.status(401).json({ error: "Invalid credentials" });
            return;
        }
        const user = rows[0];
        // Verify password
        const isValidPassword = await bcryptjs_1.default.compare(password, user.password_hash);
        if (!isValidPassword) {
            console.log(`[AUTH] Signin failed for ${email}: Invalid password`);
            res.status(401).json({ error: "Invalid credentials" });
            return;
        }
        // Generate tokens
        const accessToken = (0, jwt_js_1.signAccessToken)({ userId: user.id, role: user.role });
        const refreshToken = (0, jwt_js_1.signRefreshToken)({ userId: user.id, role: user.role });
        console.log(`[AUTH] Signin successful for ${email} (ID: ${user.id}, Role: ${user.role})`);
        res.json({ accessToken, refreshToken });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            console.log(`[AUTH] Signin failed for ${req.body.email || "unknown"}: Validation errors - ${JSON.stringify(error.errors)}`);
            res.status(400).json({ error: "Invalid input", details: error.errors });
        }
        else {
            console.error(`[AUTH] Signin error for ${req.body.email || "unknown"}:`, error);
            res.status(500).json({ error: "Internal server error" });
        }
    }
};
exports.signin = signin;
const signout = async (req, res) => {
    try {
        // For now, just return success. In a real implementation, you might want to blacklist the token
        res.json({ message: "Signed out successfully" });
    }
    catch (error) {
        console.error("Signout error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.signout = signout;
const refresh = async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken || !req.user) {
            res.status(400).json({ error: "Refresh token required" });
            return;
        }
        // For simplicity, just generate new tokens. In a real implementation, you'd validate the refresh token
        const newAccessToken = (0, jwt_js_1.signAccessToken)({
            userId: req.user.userId,
            role: req.user.role,
        });
        const newRefreshToken = (0, jwt_js_1.signRefreshToken)({
            userId: req.user.userId,
            role: req.user.role,
        });
        res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
    }
    catch (error) {
        console.error("Refresh error:", error);
        res.status(401).json({ error: "Invalid refresh token" });
    }
};
exports.refresh = refresh;
const me = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: "Not authenticated" });
            return;
        }
        const [rows] = await db_js_1.pool.execute("SELECT id, email, display_name, phone, role, created_at FROM profiles WHERE id = ?", [req.user.userId]);
        if (rows.length === 0) {
            res.status(404).json({ error: "User not found" });
            return;
        }
        res.json({ user: rows[0] });
    }
    catch (error) {
        console.error("Me error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.me = me;
const updatePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = updatePasswordSchema.parse(req.body);
        if (!req.user) {
            res.status(401).json({ error: "Not authenticated" });
            return;
        }
        // Get current password hash
        const [rows] = await db_js_1.pool.execute("SELECT password_hash FROM profiles WHERE id = ?", [req.user.userId]);
        if (rows.length === 0) {
            res.status(404).json({ error: "User not found" });
            return;
        }
        const user = rows[0];
        // Verify current password
        const isValidPassword = await bcryptjs_1.default.compare(currentPassword, user.password_hash);
        if (!isValidPassword) {
            res.status(400).json({ error: "Current password is incorrect" });
            return;
        }
        // Hash new password
        const newPasswordHash = await bcryptjs_1.default.hash(newPassword, 12);
        // Update password
        await db_js_1.pool.execute("UPDATE profiles SET password_hash = ? WHERE id = ?", [
            newPasswordHash,
            req.user.userId,
        ]);
        res.json({ message: "Password updated successfully" });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: "Invalid input", details: error.errors });
        }
        else {
            console.error("Update password error:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }
};
exports.updatePassword = updatePassword;
const resetPassword = async (req, res) => {
    try {
        const { email } = resetPasswordSchema.parse(req.body);
        // Generate reset token
        const resetToken = require("crypto").randomBytes(32).toString("hex");
        const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        // Update user with reset token
        const [result] = await db_js_1.pool.execute("UPDATE profiles SET reset_token = ?, reset_token_expiry = ? WHERE email = ?", [resetToken, resetTokenExpiry, email]);
        if (result.affectedRows === 0) {
            // Don't reveal if email exists or not for security
            res.json({ message: "If the email exists, a reset link has been sent" });
            return;
        }
        // Send email
        await (0, email_js_1.sendPasswordResetEmail)(email, resetToken);
        res.json({ message: "If the email exists, a reset link has been sent" });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: "Invalid input", details: error.errors });
        }
        else {
            console.error("Reset password error:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }
};
exports.resetPassword = resetPassword;
const confirmResetPassword = async (req, res) => {
    try {
        const { token, newPassword } = confirmResetSchema.parse(req.body);
        // Find user with valid reset token
        const [rows] = await db_js_1.pool.execute("SELECT id FROM profiles WHERE reset_token = ? AND reset_token_expiry > NOW()", [token]);
        if (rows.length === 0) {
            res.status(400).json({ error: "Invalid or expired reset token" });
            return;
        }
        const userId = rows[0].id;
        // Hash new password
        const newPasswordHash = await bcryptjs_1.default.hash(newPassword, 12);
        // Update password and clear reset token
        await db_js_1.pool.execute("UPDATE profiles SET password_hash = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?", [newPasswordHash, userId]);
        res.json({ message: "Password reset successfully" });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: "Invalid input", details: error.errors });
        }
        else {
            console.error("Confirm reset password error:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }
};
exports.confirmResetPassword = confirmResetPassword;
//# sourceMappingURL=authController.js.map