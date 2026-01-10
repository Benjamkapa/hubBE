// src/routes/auth.ts
import express, { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { pool } from "../config/db";
import {
  signAccessToken,
  signRefreshToken,
  ACCESS_EXPIRES_IN,
  REFRESH_EXPIRES_IN,
} from "../utils/jwt";
import { requireAuth, validateRefreshToken } from "../middleware/auth";
import {
  sendPasswordResetEmail,
  sendEmailVerification,
  sendMagicLinkEmail,
} from "../utils/email";

const router: express.Router = express.Router();

/**
 * Provider signup (public). Never allow role=admin here.
 */
router.post(
  "/signup",
  [
    body("email").isEmail(),
    body("password").isLength({ min: 8 }),
    body("display_name").isLength({ min: 2 }),
    body("phone").optional().isString(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const { email, password, display_name, phone, role, verification_token } =
      req.body;
    // block admin creation via public signup
    if (role && role === "admin") {
      return res.status(403).json({ error: "Cannot self-register as admin" });
    }
    const assignedRole =
      role === "service_provider" ? "service_provider" : "service_provider"; // only providers sign up
    try {
      const [existing] = await pool.query(
        "SELECT id FROM profiles WHERE email = ? LIMIT 1",
        [email]
      );
      if ((existing as any).length > 0) {
        return res.status(409).json({ error: "Email already in use" });
      }
      const password_hash = await bcrypt.hash(password, 12);
      const verificationToken = uuidv4();
      const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      const [result] = await pool.query(
        "INSERT INTO profiles (email, password_hash, display_name, phone, role, email_verified, verification_token, verification_token_expiry, created_at, updated_at) VALUES (?, ?, ?, ?, ?, FALSE, ?, ?, NOW(), NOW())",
        [
          email,
          password_hash,
          display_name,
          phone,
          assignedRole,
          verificationToken,
          verificationExpiry,
        ]
      );

      const userId = (result as any).insertId;

      // Send verification email
      await sendEmailVerification(email, verificationToken);

      const response: any = {
        success: true,
        message:
          "Account created successfully. Please check your email to verify your account.",
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
    } catch (err: any) {
      console.error("Signup error:", err.message || err);
      return res.status(500).json({ error: "Server error" });
    }
  }
);

/**
 * Signin - returns access + refresh tokens
 */
router.post(
  "/signin",
  [body("email").isEmail(), body("password").exists()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;
    try {
      const [rows] = await pool.query(
        "SELECT * FROM profiles WHERE email = ? LIMIT 1",
        [email]
      );
      const user = (rows as any)[0];
      if (!user) return res.status(401).json({ error: "Invalid credentials" });

      if (!user.password_hash)
        return res.status(401).json({ error: "User has no password set" });

      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok) return res.status(401).json({ error: "Invalid credentials" });

      // Check if email is verified
      if (!user.email_verified) {
        return res
          .status(403)
          .json({ error: "Please verify your email before signing in" });
      }

      const accessToken = signAccessToken({
        id: user.id,
        email: user.email,
        role: user.role,
      });
      const refreshToken = signRefreshToken({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      // store refresh token
      const expiresAt = new Date(Date.now() + msToMs(REFRESH_EXPIRES_IN!));
      await pool.query(
        "INSERT INTO refresh_tokens (user_id, token, expires_at, revoked, created_at) VALUES (?, ?, ?, 0, NOW())",
        [user.id, refreshToken, expiresAt]
      );

      const { password_hash, reset_token, reset_token_expiry, ...safe } = user;
      return res.json({
        success: true,
        user: safe,
        accessToken,
        refreshToken,
        expiresIn: ACCESS_EXPIRES_IN,
      });
    } catch (err: any) {
      console.error("Signin error:", err.message || err);
      return res.status(500).json({ error: "Server error" });
    }
  }
);

/**
 * Refresh tokens - rotating refresh tokens
 */
router.post("/refresh", async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken)
    return res.status(400).json({ error: "refreshToken required" });

  try {
    // verify token signature
    const payload = (await import("jsonwebtoken")).verify(
      refreshToken,
      process.env.JWT_SECRET || "please_change_this"
    ) as any;
    // validate presence in DB and not revoked
    const ok = await validateRefreshToken(payload.id, refreshToken);
    if (!ok) return res.status(401).json({ error: "Invalid refresh token" });

    // rotate: revoke old token and issue new tokens
    await pool.query("UPDATE refresh_tokens SET revoked = 1 WHERE token = ?", [
      refreshToken,
    ]);

    const newAccess = signAccessToken({
      id: payload.id,
      email: payload.email,
      role: payload.role,
    });
    const newRefresh = signRefreshToken({
      id: payload.id,
      email: payload.email,
      role: payload.role,
    });
    const expiresAt = new Date(Date.now() + msToMs(REFRESH_EXPIRES_IN!));
    await pool.query(
      "INSERT INTO refresh_tokens (user_id, token, expires_at, revoked, created_at) VALUES (?, ?, ?, 0, NOW())",
      [payload.id, newRefresh, expiresAt]
    );

    return res.json({
      accessToken: newAccess,
      refreshToken: newRefresh,
      expiresIn: ACCESS_EXPIRES_IN,
    });
  } catch (err: any) {
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
    await pool.query("UPDATE refresh_tokens SET revoked = 1 WHERE token = ?", [
      refreshToken,
    ]);
    return res.json({ success: true, message: "Signed out" });
  } catch (err: any) {
    console.error("Signout error:", err.message || err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * Get current user
 */
router.get("/me", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const [rows] = await pool.query(
      "SELECT id, email, display_name, phone, role, created_at, updated_at FROM profiles WHERE id = ?",
      [userId]
    );
    const user = (rows as any)[0];
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json({ user });
  } catch (err: any) {
    console.error("Me error:", err.message || err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * Update password while logged in
 */
router.put(
  "/update-password",
  requireAuth,
  [
    body("current_password").exists(),
    body("new_password").isLength({ min: 8 }),
  ],
  async (req: any, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });
    try {
      const userId = req.user.userId;
      const { current_password, new_password } = req.body;
      const [rows] = await pool.query(
        "SELECT password_hash FROM profiles WHERE id = ?",
        [userId]
      );
      const user = (rows as any)[0];
      if (!user) return res.status(404).json({ error: "User not found" });

      const ok = await bcrypt.compare(current_password, user.password_hash);
      if (!ok)
        return res.status(401).json({ error: "Current password incorrect" });

      const newHash = await bcrypt.hash(new_password, 12);
      await pool.query(
        "UPDATE profiles SET password_hash = ?, updated_at = NOW() WHERE id = ?",
        [newHash, userId]
      );

      return res.json({ success: true, message: "Password updated" });
    } catch (err: any) {
      console.error("Update password error:", err.message || err);
      return res.status(500).json({ error: "Server error" });
    }
  }
);

/**
 * Forgot password -> generates reset token and stores it
 */
router.post("/forgot-password", [body("email").isEmail()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });
  const { email } = req.body;
  try {
    const [rows] = await pool.query(
      "SELECT id FROM profiles WHERE email = ? LIMIT 1",
      [email]
    );
    const user = (rows as any)[0];
    if (!user) {
      // respond same to avoid account enumeration
      return res.json({
        success: true,
        message: "Reset link has been sent to your email",
      });
    }
    const resetToken = uuidv4();
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await pool.query(
      "UPDATE profiles SET reset_token = ?, reset_token_expiry = ? WHERE id = ?",
      [resetToken, expiry, user.id]
    );

    // Send email with reset link
    await sendPasswordResetEmail(email, resetToken);

    return res.json({
      success: true,
      message: "Reset link has been sent to your email",
      ...(process.env.NODE_ENV !== "production" && { resetToken }),
    });
  } catch (err: any) {
    console.error("Forgot password error:", err.message || err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * Validate reset token (for frontend to check before showing form)
 */
router.get("/validate-reset-token", async (req, res) => {
  const { token } = req.query;
  if (!token || typeof token !== "string")
    return res.status(400).json({ error: "Token required" });

  try {
    const [rows] = await pool.query(
      "SELECT id, reset_token_expiry FROM profiles WHERE reset_token = ? LIMIT 1",
      [token]
    );
    const user = (rows as any)[0];
    if (!user)
      return res.status(400).json({ error: "Invalid or expired token" });

    const expiry = new Date(user.reset_token_expiry);
    if (!expiry || expiry < new Date())
      return res.status(400).json({ error: "Invalid or expired token" });

    return res.json({ valid: true });
  } catch (err: any) {
    console.error("Validate reset token error:", err.message || err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * Reset password using token (one-time use)
 */
router.post(
  "/reset-password",
  [body("token").exists(), body("newPassword").isLength({ min: 8 })],
  async (req, res) => {
    const { token, newPassword } = req.body;
    try {
      const [rows] = await pool.query(
        "SELECT id, reset_token_expiry FROM profiles WHERE reset_token = ? LIMIT 1",
        [token]
      );
      const user = (rows as any)[0];
      if (!user)
        return res.status(400).json({ error: "Invalid or expired token" });

      const expiry = new Date(user.reset_token_expiry);
      if (!expiry || expiry < new Date())
        return res.status(400).json({ error: "Invalid or expired token" });

      // Clear the token immediately to make it one-time use
      await pool.query(
        "UPDATE profiles SET reset_token = NULL, reset_token_expiry = NULL WHERE id = ?",
        [user.id]
      );

      const newHash = await bcrypt.hash(newPassword, 12);
      await pool.query(
        "UPDATE profiles SET password_hash = ?, updated_at = NOW() WHERE id = ?",
        [newHash, user.id]
      );

      return res.json({
        success: true,
        message: "Password reset successfully",
      });
    } catch (err: any) {
      console.error("Reset password error:", err.message || err);
      return res.status(500).json({ error: "Server error" });
    }
  }
);

/**
 * Change password using token (one-time use, for logged-out users)
 */
router.post(
  "/change-password",
  [body("token").exists(), body("newPassword").isLength({ min: 8 })],
  async (req, res) => {
    const { token, newPassword } = req.body;
    try {
      const [rows] = await pool.query(
        "SELECT id, reset_token_expiry FROM profiles WHERE reset_token = ? LIMIT 1",
        [token]
      );
      const user = (rows as any)[0];
      if (!user)
        return res.status(400).json({ error: "Invalid or expired token" });

      const expiry = new Date(user.reset_token_expiry);
      if (!expiry || expiry < new Date())
        return res.status(400).json({ error: "Invalid or expired token" });

      // Clear the token immediately to make it one-time use
      await pool.query(
        "UPDATE profiles SET reset_token = NULL, reset_token_expiry = NULL WHERE id = ?",
        [user.id]
      );

      const newHash = await bcrypt.hash(newPassword, 12);
      await pool.query(
        "UPDATE profiles SET password_hash = ?, updated_at = NOW() WHERE id = ?",
        [newHash, user.id]
      );

      return res.json({
        success: true,
        message: "Password changed successfully",
      });
    } catch (err: any) {
      console.error("Change password error:", err.message || err);
      return res.status(500).json({ error: "Server error" });
    }
  }
);

/**
 * Verify email using token
 */
router.post("/verify-email", [body("token").exists()], async (req, res) => {
  const { token } = req.body;
  try {
    const [rows] = await pool.query(
      "SELECT id, verification_token_expiry FROM profiles WHERE verification_token = ? LIMIT 1",
      [token]
    );
    const user = (rows as any)[0];
    if (!user)
      return res.status(400).json({ error: "Invalid or expired token" });

    const expiry = new Date(user.verification_token_expiry);
    if (!expiry || expiry < new Date())
      return res.status(400).json({ error: "Invalid or expired token" });

    await pool.query(
      "UPDATE profiles SET email_verified = TRUE, verification_token = NULL, verification_token_expiry = NULL, updated_at = NOW() WHERE id = ?",
      [user.id]
    );

    return res.redirect("https://hudumalynk.vercel.app/auth/signin");

    // return res.json({
    //   success: true,
    //   message: "Email verified successfully",
    // });
  } catch (err: any) {
    console.error("Verify email error:", err.message || err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * Send magic link for passwordless login (admin only)
 */
router.post(
  "/send-magic-link",
  requireAuth,
  [body("email").isEmail()],
  async (req: any, res) => {
    const errors = validationResult(req);
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
      const [rows] = await pool.query(
        "SELECT id FROM profiles WHERE email = ? LIMIT 1",
        [email]
      );
      const user = (rows as any)[0];
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const magicToken = uuidv4();
      const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      // Store magic token (we can reuse reset_token for this)
      await pool.query(
        "UPDATE profiles SET reset_token = ?, reset_token_expiry = ? WHERE id = ?",
        [magicToken, expiry, user.id]
      );

      // Send magic link email
      await sendMagicLinkEmail(email, magicToken);

      const response: any = {
        success: true,
        message: "Magic link sent successfully",
      };

      // Include magic token in development for testing
      if (process.env.NODE_ENV !== "production") {
        response.magicToken = magicToken;
        response.magicUrl = `${process.env.FRONTEND_URL}/magic-login?token=${magicToken}`;
      }

      return res.json(response);
    } catch (err: any) {
      console.error("Send magic link error:", err.message || err);
      return res.status(500).json({ error: "Server error" });
    }
  }
);

/**
 * Generate magic token for admin to login as user (no email sent)
 */
router.post(
  "/generate-magic-token",
  requireAuth,
  [body("email").isEmail()],
  async (req: any, res) => {
    const errors = validationResult(req);
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
      const [rows] = await pool.query(
        "SELECT id FROM profiles WHERE email = ? LIMIT 1",
        [email]
      );
      const user = (rows as any)[0];
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const magicToken = uuidv4();
      const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      // Store magic token (reuse reset_token for this)
      await pool.query(
        "UPDATE profiles SET reset_token = ?, reset_token_expiry = ? WHERE id = ?",
        [magicToken, expiry, user.id]
      );

      return res.json({
        success: true,
        message: "Magic token generated successfully",
        token: magicToken,
        expiresIn: "15 minutes",
      });
    } catch (err: any) {
      console.error("Generate magic token error:", err.message || err);
      return res.status(500).json({ error: "Server error" });
    }
  }
);

/**
 * Magic login using token
 */
router.post("/magic-login", [body("token").exists()], async (req, res) => {
  const { token } = req.body;
  try {
    const [rows] = await pool.query(
      "SELECT id, email, role, reset_token_expiry FROM profiles WHERE reset_token = ? LIMIT 1",
      [token]
    );
    const user = (rows as any)[0];
    if (!user)
      return res.status(400).json({ error: "Invalid or expired token" });

    const expiry = new Date(user.reset_token_expiry);
    if (!expiry || expiry < new Date())
      return res.status(400).json({ error: "Invalid or expired token" });

    // Clear the magic token
    await pool.query(
      "UPDATE profiles SET reset_token = NULL, reset_token_expiry = NULL WHERE id = ?",
      [user.id]
    );

    const accessToken = signAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });
    const refreshToken = signRefreshToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    // store refresh token
    const expiresAt = new Date(Date.now() + msToMs(REFRESH_EXPIRES_IN!));
    await pool.query(
      "INSERT INTO refresh_tokens (user_id, token, expires_at, revoked, created_at) VALUES (?, ?, ?, 0, NOW())",
      [user.id, refreshToken, expiresAt]
    );

    const { password_hash, reset_token, reset_token_expiry, ...safe } = user;
    return res.json({
      success: true,
      user: safe,
      accessToken,
      refreshToken,
      expiresIn: ACCESS_EXPIRES_IN,
    });
  } catch (err: any) {
    console.error("Magic login error:", err.message || err);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;

/* helpers */
function msToMs(str: string) {
  // Accept common patterns like "15m", "7d", "3600s"
  // very basic parser:
  const num = parseInt(str.replace(/\D/g, ""), 10) || 0;
  if (str.endsWith("ms")) return num;
  if (str.endsWith("s")) return num * 1000;
  if (str.endsWith("m")) return num * 60 * 1000;
  if (str.endsWith("h")) return num * 60 * 60 * 1000;
  if (str.endsWith("d")) return num * 24 * 60 * 60 * 1000;
  // fallback: treat as ms
  return num;
}
