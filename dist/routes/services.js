"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/services.ts
const express_1 = __importDefault(require("express"));
const express_validator_1 = require("express-validator");
const db_1 = require("../config/db");
const auth_1 = require("../middleware/auth");
const roles_1 = require("../middleware/roles");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken")); // { changed code }
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const router = express_1.default.Router();
// Configure multer for file uploads
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path_1.default.join(__dirname, "../../uploads"));
    },
    filename: (req, file, cb) => {
        const uniqueName = `${(0, uuid_1.v4)()}${path_1.default.extname(file.originalname)}`;
        cb(null, uniqueName);
    },
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path_1.default.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (mimetype && extname) {
            return cb(null, true);
        }
        else {
            cb(new Error("Only image files are allowed!"));
        }
    },
});
// Optional auth middleware: populate req.user if Authorization header present
const optionalAuth = (req, _res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader)
        return next();
    const parts = authHeader.split(" ");
    if (parts.length !== 2)
        return next();
    const token = parts[1];
    try {
        const decodedAny = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || "please_change_this");
        // Normalize token shape: ensure req.user.userId and req.user.role exist
        req.user = {
            userId: decodedAny.userId ?? decodedAny.id ?? decodedAny.sub,
            role: decodedAny.role ?? decodedAny.userRole ?? decodedAny.roleName,
        };
        console.log("optionalAuth decoded user:", req.user);
    }
    catch (err) {
        // invalid token - ignore and treat as unauthenticated
    }
    next();
};
// Public listing with pagination and filtering
router.get("/", optionalAuth, async (req, res) => {
    // { changed code }
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const category = req.query.category;
        let owner_id = req.query.owner_id;
        const owner_name = req.query.owner_name;
        const status = req.query.status;
        // If caller is an authenticated service_provider, force owner_id to their id
        const reqUser = req.user;
        if (reqUser && reqUser.role === "service_provider") {
            // coerce to DB type (string) and log for debugging
            owner_id = String(reqUser.userId);
            console.log("Enforcing owner_id filter for service_provider:", owner_id);
        }
        // Basic validation
        if (page < 1 || limit < 1) {
            return res.status(400).json({ error: "Invalid pagination parameters" });
        }
        const offset = (page - 1) * limit;
        // Build WHERE clause
        const whereConditions = ["deleted_at IS NULL"];
        const params = [];
        if (category) {
            whereConditions.push("category = ?");
            params.push(category);
        }
        if (owner_id) {
            whereConditions.push("owner_id = ?");
            params.push(owner_id);
        }
        if (owner_name) {
            whereConditions.push("owner_name = ?");
            params.push(owner_name);
        }
        if (status) {
            whereConditions.push("status = ?");
            params.push(status);
        }
        const whereClause = whereConditions.join(" AND ");
        const [rows] = await db_1.pool.query(`SELECT id, slug, title, description, category, status, delivery_fee, color, bg_color, color_hex, image, fields, owner_id, owner_name, latitude, longitude, created_at FROM services WHERE ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
        const [countRows] = await db_1.pool.query(`SELECT COUNT(*) as total FROM services WHERE ${whereClause}`, params);
        const total = countRows[0].total;
        res.json({
            services: rows,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit)),
            },
        });
    }
    catch (error) {
        console.error("List services error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// Get by slug
router.get("/:slug", optionalAuth, async (req, res) => {
    // { changed code }
    try {
        const { slug } = req.params;
        const [rows] = await db_1.pool.execute("SELECT id, slug, title, description, category, status, delivery_fee, color, bg_color, color_hex, image, fields, owner_id, owner_name, latitude, longitude, created_at FROM services WHERE slug = ? AND deleted_at IS NULL", [slug]);
        if (rows.length === 0) {
            return res.status(404).json({ error: "Service not found" });
        }
        const service = rows[0];
        // If requester is authenticated service_provider, ensure they own the service
        const reqUser = req.user;
        if (reqUser &&
            reqUser.role === "service_provider" &&
            service.owner_id !== reqUser.userId) {
            return res.status(403).json({ error: "Forbidden" });
        }
        res.json({ service });
    }
    catch (error) {
        console.error("Get service by slug error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// Create service - service provider or admin
router.post("/", auth_1.requireAuth, (0, roles_1.requireRole)("service_provider", "admin"), upload.single("image"), // Handle file upload
[
    (0, express_validator_1.body)("title").isLength({ min: 1 }),
    (0, express_validator_1.body)("description").optional().isLength({ min: 1 }),
    (0, express_validator_1.body)("category").isIn([
        "shop",
        "cleaning",
        "shopping",
        "transport",
        "repair",
        "delivery",
        "tutoring",
        "health",
        "food",
        "events",
        "home",
        "education",
        "technology",
        "finance",
        "legal",
        "travel",
        "entertainment",
        "other",
    ]),
    (0, express_validator_1.body)("delivery_fee").optional().isFloat({ min: 0 }),
    (0, express_validator_1.body)("color").optional().isLength({ min: 1 }),
    (0, express_validator_1.body)("bg_color").optional().isLength({ min: 1 }),
    (0, express_validator_1.body)("color_hex").optional().isLength({ min: 1 }),
    (0, express_validator_1.body)("fields").optional().isArray(),
    (0, express_validator_1.body)("owner_name").isLength({ min: 1 }),
    (0, express_validator_1.body)("latitude").optional().isFloat({ min: -90, max: 90 }),
    (0, express_validator_1.body)("longitude").optional().isFloat({ min: -180, max: 180 }),
    (0, express_validator_1.body)("status").optional().isIn(["active", "inactive"]),
], async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        const { title, description, category, delivery_fee, color, bg_color, color_hex, fields, owner_name, latitude, longitude, status, } = req.body;
        // FIX: Check if user exists first
        if (!req.user) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const ownerId = req.user.userId;
        // FIX: Validate ownerId is not undefined
        if (!ownerId) {
            console.error("ownerId is undefined. req.user:", req.user);
            return res.status(400).json({ error: "Invalid user ID" });
        }
        // Handle image upload
        let imagePath = null;
        if (req.file) {
            imagePath = `/uploads/${req.file.filename}`;
        }
        // Ensure optional fields are null if not provided
        const safeDescription = description || null;
        const safeDeliveryFee = delivery_fee || null;
        const safeColor = color || null;
        const safeBgColor = bg_color || null;
        const safeColorHex = color_hex || null;
        const safeFields = fields || [];
        const safeLatitude = latitude || null;
        const safeLongitude = longitude || null;
        // Generate slug from title
        const slug = title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
        // Check if slug is unique
        const [existing] = await db_1.pool.execute("SELECT id FROM services WHERE slug = ? AND deleted_at IS NULL", [slug]);
        if (existing.length > 0) {
            return res.status(409).json({ error: "Slug already exists" });
        }
        const params = [
            slug,
            title,
            safeDescription,
            category,
            safeDeliveryFee,
            safeColor,
            safeBgColor,
            safeColorHex,
            imagePath,
            JSON.stringify(safeFields),
            ownerId,
            owner_name,
            safeLatitude,
            safeLongitude,
        ];
        console.log("Params before execution:", params);
        const [result] = await db_1.pool.execute("INSERT INTO services (slug, title, description, category, delivery_fee, color, bg_color, color_hex, image, fields, owner_id, owner_name, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", params);
        const serviceId = result.insertId;
        res.status(201).json({
            service: {
                id: serviceId,
                slug,
                title,
                description,
                category,
                delivery_fee,
                color,
                bg_color,
                color_hex,
                image: imagePath,
                fields,
                owner_id: ownerId,
                owner_name,
                latitude,
                longitude,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            },
        });
    }
    catch (error) {
        console.error("Create service error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// Update service - provider (owner) or admin
router.put("/:id", auth_1.requireAuth, (0, roles_1.requireRole)("service_provider", "admin"), [
    (0, express_validator_1.body)("title").optional().isLength({ min: 1 }),
    (0, express_validator_1.body)("description").optional().isLength({ min: 1 }),
    (0, express_validator_1.body)("category")
        .optional()
        .isIn([
        "shop",
        "cleaning",
        "shopping",
        "transport",
        "repair",
        "delivery",
        "tutoring",
        "health",
        "food",
        "events",
        "home",
        "education",
        "technology",
        "finance",
        "legal",
        "travel",
        "entertainment",
        "other",
    ]),
    (0, express_validator_1.body)("delivery_fee").optional().isFloat({ min: 0 }),
    (0, express_validator_1.body)("color").optional().isLength({ min: 1 }),
    (0, express_validator_1.body)("bg_color").optional().isLength({ min: 1 }),
    (0, express_validator_1.body)("color_hex").optional().isLength({ min: 1 }),
    (0, express_validator_1.body)("image").optional().isLength({ min: 1 }),
    (0, express_validator_1.body)("fields").optional().isArray(),
    (0, express_validator_1.body)("owner_name").optional().isLength({ min: 1 }),
    (0, express_validator_1.body)("latitude").optional().isFloat({ min: -90, max: 90 }),
    (0, express_validator_1.body)("longitude").optional().isFloat({ min: -180, max: 180 }),
    (0, express_validator_1.body)("status").optional().isIn(["active", "inactive"]),
], async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        const { id } = req.params;
        const { title, description, category, delivery_fee, color, bg_color, color_hex, image, fields, owner_name, latitude, longitude, status, } = req.body;
        const userId = req.user.userId;
        const userRole = req.user.role;
        // Check ownership
        const [serviceRows] = await db_1.pool.execute("SELECT owner_id, title FROM services WHERE id = ? AND deleted_at IS NULL", [id]);
        if (serviceRows.length === 0) {
            return res.status(404).json({ error: "Service not found" });
        }
        const service = serviceRows[0];
        if (userRole !== "admin" && service.owner_id !== userId) {
            return res.status(403).json({ error: "Forbidden" });
        }
        // Build update query
        const updates = [];
        const params = [];
        if (title !== undefined) {
            updates.push("title = ?");
            params.push(title);
            // Regenerate slug if title changed
            const newSlug = title
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "");
            updates.push("slug = ?");
            params.push(newSlug);
        }
        if (description !== undefined) {
            updates.push("description = ?");
            params.push(description);
        }
        if (category !== undefined) {
            updates.push("category = ?");
            params.push(category);
        }
        if (delivery_fee !== undefined) {
            updates.push("delivery_fee = ?");
            params.push(delivery_fee);
        }
        if (color !== undefined) {
            updates.push("color = ?");
            params.push(color);
        }
        if (bg_color !== undefined) {
            updates.push("bg_color = ?");
            params.push(bg_color);
        }
        if (color_hex !== undefined) {
            updates.push("color_hex = ?");
            params.push(color_hex);
        }
        if (image !== undefined) {
            updates.push("image = ?");
            params.push(image);
        }
        if (fields !== undefined) {
            updates.push("fields = ?");
            params.push(JSON.stringify(fields));
        }
        if (owner_name !== undefined) {
            updates.push("owner_name = ?");
            params.push(owner_name);
        }
        if (latitude !== undefined) {
            updates.push("latitude = ?");
            params.push(latitude);
        }
        if (longitude !== undefined) {
            updates.push("longitude = ?");
            params.push(longitude);
        }
        if (status !== undefined) {
            updates.push("status = ?");
            params.push(status);
        }
        if (updates.length === 0) {
            return res.status(400).json({ error: "No fields to update" });
        }
        params.push(id);
        await db_1.pool.execute(`UPDATE services SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ?`, params);
        // Get updated service
        const [updatedRows] = await db_1.pool.execute("SELECT id, slug, title, description, category, status, delivery_fee, color, bg_color, color_hex, image, fields, owner_id, owner_name, latitude, longitude, created_at, updated_at FROM services WHERE id = ?", [id]);
        res.json({ service: updatedRows[0] });
    }
    catch (error) {
        console.error("Update service error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// Delete service - provider (owner) or admin (soft delete)
router.delete("/:id", auth_1.requireAuth, (0, roles_1.requireRole)("service_provider", "admin"), async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        const userRole = req.user.role;
        // Check ownership
        const [serviceRows] = await db_1.pool.execute("SELECT owner_id FROM services WHERE id = ? AND deleted_at IS NULL", [id]);
        if (serviceRows.length === 0) {
            return res.status(404).json({ error: "Service not found" });
        }
        const service = serviceRows[0];
        if (userRole !== "admin" && service.owner_id !== userId) {
            return res.status(403).json({ error: "Forbidden" });
        }
        // Check for existing orders
        const [orderRows] = await db_1.pool.execute("SELECT id FROM order_items WHERE service_id = ? LIMIT 1", [id]);
        if (orderRows.length > 0) {
            return res
                .status(409)
                .json({ error: "Cannot delete service with existing orders" });
        }
        await db_1.pool.execute("UPDATE services SET deleted_at = NOW() WHERE id = ?", [id]);
        res.json({ message: "Service deleted successfully" });
    }
    catch (error) {
        console.error("Delete service error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// Get services by owner ID - service provider (own) or admin (any)
router.get("/owner/:owner_id", auth_1.requireAuth, (0, roles_1.requireRole)("service_provider", "admin"), async (req, res) => {
    try {
        const { owner_id } = req.params;
        const userId = req.user.userId;
        const userRole = req.user.role;
        // Check permissions: service_provider can only query their own, admin can query any
        if (userRole !== "admin" && owner_id !== String(userId)) {
            return res.status(403).json({ error: "Forbidden" });
        }
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const category = req.query.category;
        const status = req.query.status;
        // Basic validation
        if (page < 1 || limit < 1) {
            return res.status(400).json({ error: "Invalid pagination parameters" });
        }
        const offset = (page - 1) * limit;
        // Build WHERE clause
        const whereConditions = ["deleted_at IS NULL", "owner_id = ?"];
        const params = [owner_id];
        if (category) {
            whereConditions.push("category = ?");
            params.push(category);
        }
        if (status) {
            whereConditions.push("status = ?");
            params.push(status);
        }
        const whereClause = whereConditions.join(" AND ");
        const [rows] = await db_1.pool.query(`SELECT id, slug, title, description, category, status, delivery_fee, color, bg_color, color_hex, image, fields, owner_id, owner_name, latitude, longitude, created_at FROM services WHERE ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
        const [countRows] = await db_1.pool.query(`SELECT COUNT(*) as total FROM services WHERE ${whereClause}`, params);
        const total = countRows[0].total;
        res.json({
            services: rows,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit)),
            },
        });
    }
    catch (error) {
        console.error("Get services by owner error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
exports.default = router;
//# sourceMappingURL=services.js.map