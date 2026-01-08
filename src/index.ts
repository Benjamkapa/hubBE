// src/server.ts
import express, { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import dotenv from "dotenv";
import morgan from "morgan";
import compression from "compression";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import path from "path";

import authRoutes from "./routes/auth";
import serviceRoutes from "./routes/services";
import orderRoutes from "./routes/orders";
import userRoutes from "./routes/users";
import { pool } from "./config/db";
import { requireAuth, AuthRequest } from "./middleware/auth";
import { requireRole } from "./middleware/roles";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 4000);

// test DB
(async () => {
  try {
    const conn = await pool.getConnection();
    console.log("✅ DB Successfully connected");
    conn.release();
  } catch (err: any) {
    console.error("❌ DB connection failed:", err.message || err);
    process.exit(1);
  }
})();

// security
app.use(helmet());
app.disable("x-powered-by");

const allowedOrigins = [process.env.FRONTEND_URL].filter(Boolean) as string[];

app.use(
  cors({
    origin: [
      "https://hudumalynk.vercel.app",
      "http://localhost:3000",
      ...allowedOrigins,
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    // allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Serve static files from uploads directory with CORS headers
app.use(
  "/uploads",
  (req, res, next) => {
    // Allow all origins for image access (more permissive for images)
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.header("Access-Control-Allow-Headers", "*");
    res.header("Cache-Control", "public, max-age=31536000"); // Cache for 1 year
    // Override CORP to allow cross-origin access for images
    res.header("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static(path.join(process.cwd(), "uploads"), {
    setHeaders: (res, path) => {
      // Set proper content type for images
      if (path.endsWith(".jpg") || path.endsWith(".jpeg")) {
        res.setHeader("Content-Type", "image/jpeg");
      } else if (path.endsWith(".png")) {
        res.setHeader("Content-Type", "image/png");
      } else if (path.endsWith(".webp")) {
        res.setHeader("Content-Type", "image/webp");
      } else if (path.endsWith(".gif")) {
        res.setHeader("Content-Type", "image/gif");
      }
      // Also set CORP for static file responses
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    },
  })
);

// global rate limiter (applies to /api)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", globalLimiter);

// routes
app.use("/api/auth", authRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/users", userRoutes);

// Get service statistics - admin only
app.get(
  "/api/stats/services",
  requireAuth,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const [totalRows] = await pool.execute(
        "SELECT COUNT(*) as totalCount FROM services WHERE deleted_at IS NULL"
      );
      const [activeRows] = await pool.execute(
        "SELECT COUNT(*) as activeCount FROM services WHERE status = 'active' AND deleted_at IS NULL"
      );

      const totalCount = (totalRows as any[])[0].totalCount;
      const activeCount = (activeRows as any[])[0].activeCount;

      res.json({ totalCount, activeCount });
    } catch (error) {
      console.error("Get service stats error:", error);
      res.status(500).json({ error: " Internal server error" });
    }
  }
);

// Handle POST /api/auth/verify-email for form submission
app.post(
  "/api/auth/verify-email",
  express.urlencoded({ extended: true }),
  async (req: Request, res: Response) => {
    const { token } = req.body;
    if (!token) {
      return res.status(400).send("No token provided");
    }

    try {
      const [rows] = await pool.query(
        "SELECT id, verification_token_expiry FROM profiles WHERE verification_token = ? LIMIT 1",
        [token]
      );
      const user = (rows as any)[0];
      if (!user) {
        return res.status(400).send("Invalid or expired token");
      }

      const expiry = new Date(user.verification_token_expiry);
      if (!expiry || expiry < new Date()) {
        return res.status(400).send("Invalid or expired token");
      }

      await pool.query(
        "UPDATE profiles SET email_verified = TRUE, verification_token = NULL, verification_token_expiry = NULL, updated_at = NOW() WHERE id = ?",
        [user.id]
      );

      // Redirect to login page after successful verification
      res.redirect(`${process.env.FRONTEND_URL}/login?verified=true`);
    } catch (err: any) {
      console.error("Verify email error:", err.message || err);
      res.status(500).send("Server error");
    }
  }
);

// Setup DB route (development only - remove after first use)
if (process.env.NODE_ENV !== "production") {
  app.get("/api/setup-db", async (req: Request, res: Response) => {
    try {
      const fs = require("fs");
      const path = require("path");

      const migrationsDir = path.join(process.cwd(), "migrations");
      const files = fs.readdirSync(migrationsDir).sort();

      for (const file of files) {
        if (file.endsWith(".sql")) {
          const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
          await pool.execute(sql);
          console.log(`✅ Executed migration: ${file}`);
        }
      }

      res.json({ message: "Database setup complete", migrations: files });
    } catch (error) {
      console.error("Setup DB error:", error);
      res.status(500).json({ error: "Database setup failed" });
    }
  });
}

// health
app.get("/api/health", (req: Request, res: Response) => {
  res.json({
    status: "OK",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// error handling
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("❌ Unhandled error:", err.stack || err.message || err);
  if (!res.headersSent) {
    res
      .status(err.status || 500)
      .json({ error: err.message || "Internal Server Error" });
  }
});

// 404
app.all("*", (req: Request, res: Response) => {
  res.status(404).json({
    error: "Route not found",
    path: req.originalUrl,
    method: req.method,
  });
});

app.listen(PORT, () => {
  console.log(
    `🚀 HudumaLynk server listening on port:${PORT} (env=${
      process.env.NODE_ENV || "dev"
    })`
  );
});
