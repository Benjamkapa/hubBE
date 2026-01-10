"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/server.ts
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const morgan_1 = __importDefault(require("morgan"));
const compression_1 = __importDefault(require("compression"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const path_1 = __importDefault(require("path"));
const auth_1 = __importDefault(require("./routes/auth"));
const services_1 = __importDefault(require("./routes/services"));
const orders_1 = __importDefault(require("./routes/orders"));
const users_1 = __importDefault(require("./routes/users"));
const uploads_1 = __importDefault(require("./routes/uploads"));
const db_1 = require("./config/db");
const auth_2 = require("./middleware/auth");
const roles_1 = require("./middleware/roles");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = Number(process.env.PORT || 4000);
// test DB
(async () => {
    try {
        const conn = await db_1.pool.getConnection();
        console.log("✅ DB Successfully connected");
        conn.release();
    }
    catch (err) {
        console.error("❌ DB connection failed:", err.message || err);
        process.exit(1);
    }
})();
// security
app.use((0, helmet_1.default)());
app.disable("x-powered-by");
const allowedOrigins = [process.env.FRONTEND_URL].filter(Boolean);
app.use((0, cors_1.default)({
    origin: [
        "https://hudumalynk.vercel.app",
        "http://localhost:3000",
        ...allowedOrigins,
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    // allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use((0, morgan_1.default)(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use((0, compression_1.default)());
app.use((0, cookie_parser_1.default)());
app.use(express_1.default.json({ limit: "50mb" }));
app.use(express_1.default.urlencoded({ extended: true, limit: "50mb" }));
// Serve static files from uploads directory with CORS headers
app.use("/uploads", (req, res, next) => {
    // Allow all origins for image access (more permissive for images)
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.header("Access-Control-Allow-Headers", "*");
    res.header("Cache-Control", "public, max-age=31536000"); // Cache for 1 year
    // Override CORP to allow cross-origin access for images
    res.header("Cross-Origin-Resource-Policy", "cross-origin");
    next();
}, express_1.default.static(path_1.default.join(process.cwd(), "uploads"), {
    setHeaders: (res, path) => {
        // Set proper content type for images
        if (path.endsWith(".jpg") || path.endsWith(".jpeg")) {
            res.setHeader("Content-Type", "image/jpeg");
        }
        else if (path.endsWith(".png")) {
            res.setHeader("Content-Type", "image/png");
        }
        else if (path.endsWith(".webp")) {
            res.setHeader("Content-Type", "image/webp");
        }
        else if (path.endsWith(".gif")) {
            res.setHeader("Content-Type", "image/gif");
        }
        // Also set CORP for static file responses
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    },
}));
// global rate limiter (applies to /api)
const globalLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
});
app.use("/api", globalLimiter);
// routes
app.use("/api/auth", auth_1.default);
app.use("/api/services", services_1.default);
app.use("/api/orders", orders_1.default);
app.use("/api/users", users_1.default);
app.use("/api", uploads_1.default);
// Get service statistics - admin only
app.get("/api/stats/services", auth_2.requireAuth, (0, roles_1.requireRole)("admin"), async (req, res) => {
    try {
        const [totalRows] = await db_1.pool.execute("SELECT COUNT(*) as totalCount FROM services WHERE deleted_at IS NULL");
        const [activeRows] = await db_1.pool.execute("SELECT COUNT(*) as activeCount FROM services WHERE status = 'active' AND deleted_at IS NULL");
        const totalCount = totalRows[0].totalCount;
        const activeCount = activeRows[0].activeCount;
        res.json({ totalCount, activeCount });
    }
    catch (error) {
        console.error("Get service stats error:", error);
        res.status(500).json({ error: " Internal server error" });
    }
});
// Handle POST /api/auth/verify-email for form submission
app.post("/api/auth/verify-email", express_1.default.urlencoded({ extended: true }), async (req, res) => {
    const { token } = req.body;
    if (!token) {
        return res.status(400).send("No token provided");
    }
    try {
        const [rows] = await db_1.pool.query("SELECT id, verification_token_expiry FROM profiles WHERE verification_token = ? LIMIT 1", [token]);
        const user = rows[0];
        if (!user) {
            return res.status(400).send("Invalid or expired token");
        }
        const expiry = new Date(user.verification_token_expiry);
        if (!expiry || expiry < new Date()) {
            return res.status(400).send("Invalid or expired token");
        }
        await db_1.pool.query("UPDATE profiles SET email_verified = TRUE, verification_token = NULL, verification_token_expiry = NULL, updated_at = NOW() WHERE id = ?", [user.id]);
        // Redirect to login page after successful verification
        res.redirect(`${process.env.FRONTEND_URL}/login?verified=true`);
    }
    catch (err) {
        console.error("Verify email error:", err.message || err);
        res.status(500).send("Server error");
    }
});
// Setup DB route (development only - remove after first use)
if (process.env.NODE_ENV !== "production") {
    app.get("/api/setup-db", async (req, res) => {
        try {
            const fs = require("fs");
            const path = require("path");
            const migrationsDir = path.join(process.cwd(), "migrations");
            const files = fs.readdirSync(migrationsDir).sort();
            for (const file of files) {
                if (file.endsWith(".sql")) {
                    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
                    await db_1.pool.execute(sql);
                    console.log(`✅ Executed migration: ${file}`);
                }
            }
            res.json({ message: "Database setup complete", migrations: files });
        }
        catch (error) {
            console.error("Setup DB error:", error);
            res.status(500).json({ error: "Database setup failed" });
        }
    });
}
// health
app.get("/api/health", (req, res) => {
    res.json({
        status: "OK",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
});
// error handling
app.use((err, req, res, next) => {
    console.error("❌ Unhandled error:", err.stack || err.message || err);
    if (!res.headersSent) {
        res
            .status(err.status || 500)
            .json({ error: err.message || "Internal Server Error" });
    }
});
// 404
app.all("*", (req, res) => {
    res.status(404).json({
        error: "Route not found",
        path: req.originalUrl,
        method: req.method,
    });
});
app.listen(PORT, () => {
    console.log(`🚀 HudumaLynk server listening on port:${PORT} (env=${process.env.NODE_ENV || "dev"})`);
});
//# sourceMappingURL=index.js.map