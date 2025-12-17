import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool } from "../config/db.js";
import { signAccessToken, signRefreshToken } from "../utils/jwt.js";
import { sendPasswordResetEmail } from "../utils/email.js";

// Validation schemas
const signupSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1),
  phone: z.string().min(1),
  password: z.string().min(6),
});

const signinSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

const resetPasswordSchema = z.object({
  email: z.string().email(),
});

const confirmResetSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(6),
});

export const signup = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { email, displayName, phone, password } = signupSchema.parse(
      req.body
    );

    console.log(`[AUTH] Signup attempt for email: ${email}`);

    // Check if email already exists
    const [existing] = await pool.execute(
      "SELECT id FROM profiles WHERE email = ?",
      [email]
    );
    if ((existing as any[]).length > 0) {
      console.log(
        `[AUTH] Signup failed for ${email}: Email already registered`
      );
      res.status(400).json({ error: "Email already registered" });
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Insert new provider user
    const [result] = await pool.execute(
      "INSERT INTO profiles (email, display_name, phone, role, password_hash) VALUES (?, ?, ?, ?, ?)",
      [email, displayName, phone, "service_provider", passwordHash]
    );

    const userId = (result as any).insertId;

    console.log(
      `[AUTH] Signup successful for ${email} (ID: ${userId}, Role: service_provider)`
    );

    res
      .status(201)
      .json({ message: "Service Provider account created successfully", userId });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.log(
        `[AUTH] Signup failed for ${
          req.body.email || "unknown"
        }: Validation errors - ${JSON.stringify(error.errors)}`
      );
      res.status(400).json({ error: "Invalid input", details: error.errors });
    } else {
      console.error(
        `[AUTH] Signup error for ${req.body.email || "unknown"}:`,
        error
      );
      res.status(500).json({ error: "Internal server error" });
    }
  }
};

export const signin = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { email, password } = signinSchema.parse(req.body);

    console.log(`[AUTH] Signin attempt for email: ${email}`);

    // Find user
    const [rows] = await pool.execute(
      "SELECT id, password_hash, role FROM profiles WHERE email = ?",
      [email]
    );
    if ((rows as any[]).length === 0) {
      console.log(`[AUTH] Signin failed for ${email}: User not found`);
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const user = (rows as any[])[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      console.log(`[AUTH] Signin failed for ${email}: Invalid password`);
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    // Generate tokens
    const accessToken = signAccessToken({ userId: user.id, role: user.role });
    const refreshToken = signRefreshToken({ userId: user.id, role: user.role });

    console.log(
      `[AUTH] Signin successful for ${email} (ID: ${user.id}, Role: ${user.role})`
    );

    res.json({ accessToken, refreshToken });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.log(
        `[AUTH] Signin failed for ${
          req.body.email || "unknown"
        }: Validation errors - ${JSON.stringify(error.errors)}`
      );
      res.status(400).json({ error: "Invalid input", details: error.errors });
    } else {
      console.error(
        `[AUTH] Signin error for ${req.body.email || "unknown"}:`,
        error
      );
      res.status(500).json({ error: "Internal server error" });
    }
  }
};

export const signout = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    // For now, just return success. In a real implementation, you might want to blacklist the token
    res.json({ message: "Signed out successfully" });
  } catch (error) {
    console.error("Signout error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const refresh = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken || !req.user) {
      res.status(400).json({ error: "Refresh token required" });
      return;
    }

    // For simplicity, just generate new tokens. In a real implementation, you'd validate the refresh token
    const newAccessToken = signAccessToken({
      userId: req.user.userId,
      role: req.user.role,
    });
    const newRefreshToken = signRefreshToken({
      userId: req.user.userId,
      role: req.user.role,
    });

    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (error) {
    console.error("Refresh error:", error);
    res.status(401).json({ error: "Invalid refresh token" });
  }
};

export const me = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const [rows] = await pool.execute(
      "SELECT id, email, display_name, phone, role, created_at FROM profiles WHERE id = ?",
      [req.user.userId]
    );

    if ((rows as any[]).length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({ user: (rows as any[])[0] });
  } catch (error) {
    console.error("Me error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updatePassword = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { currentPassword, newPassword } = updatePasswordSchema.parse(
      req.body
    );
    if (!req.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    // Get current password hash
    const [rows] = await pool.execute(
      "SELECT password_hash FROM profiles WHERE id = ?",
      [req.user.userId]
    );
    if ((rows as any[]).length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const user = (rows as any[])[0];

    // Verify current password
    const isValidPassword = await bcrypt.compare(
      currentPassword,
      user.password_hash
    );
    if (!isValidPassword) {
      res.status(400).json({ error: "Current password is incorrect" });
      return;
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    // Update password
    await pool.execute("UPDATE profiles SET password_hash = ? WHERE id = ?", [
      newPasswordHash,
      req.user.userId,
    ]);

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid input", details: error.errors });
    } else {
      console.error("Update password error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
};

export const resetPassword = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email } = resetPasswordSchema.parse(req.body);

    // Generate reset token
    const resetToken = require("crypto").randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Update user with reset token
    const [result] = await pool.execute(
      "UPDATE profiles SET reset_token = ?, reset_token_expiry = ? WHERE email = ?",
      [resetToken, resetTokenExpiry, email]
    );

    if ((result as any).affectedRows === 0) {
      // Don't reveal if email exists or not for security
      res.json({ message: "If the email exists, a reset link has been sent" });
      return;
    }

    // Send email
    await sendPasswordResetEmail(email, resetToken);

    res.json({ message: "If the email exists, a reset link has been sent" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid input", details: error.errors });
    } else {
      console.error("Reset password error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
};

export const confirmResetPassword = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { token, newPassword } = confirmResetSchema.parse(req.body);

    // Find user with valid reset token
    const [rows] = await pool.execute(
      "SELECT id FROM profiles WHERE reset_token = ? AND reset_token_expiry > NOW()",
      [token]
    );

    if ((rows as any[]).length === 0) {
      res.status(400).json({ error: "Invalid or expired reset token" });
      return;
    }

    const userId = (rows as any[])[0].id;

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    // Update password and clear reset token
    await pool.execute(
      "UPDATE profiles SET password_hash = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?",
      [newPasswordHash, userId]
    );

    res.json({ message: "Password reset successfully" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid input", details: error.errors });
    } else {
      console.error("Confirm reset password error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
};
