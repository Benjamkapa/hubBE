"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/orders.ts
const express_1 = __importDefault(require("express"));
const zod_1 = require("zod");
const uuid_1 = require("uuid");
const db_1 = require("../config/db");
const auth_1 = require("../middleware/auth");
const roles_1 = require("../middleware/roles");
const rateLimit_1 = require("../middleware/rateLimit");
const email_1 = require("../utils/email");
const router = express_1.default.Router();
// Validation schemas
const anonymousOrderSchema = zod_1.z.object({
    serviceId: zod_1.z.number().int().positive(),
    quantity: zod_1.z.number().int().positive(),
    anonymousName: zod_1.z.string().min(1),
    anonymousEmail: zod_1.z.string().email(),
    anonymousPhone: zod_1.z.string().min(1),
});
const authenticatedOrderSchema = zod_1.z.object({
    serviceId: zod_1.z.number().int().positive(),
    quantity: zod_1.z.number().int().positive(),
});
// Create anonymous order (public, rate-limited)
router.post("/anonymous", rateLimit_1.anonymousOrderLimiter, async (req, res) => {
    try {
        const { serviceId, quantity, anonymousName, anonymousEmail, anonymousPhone, } = anonymousOrderSchema.parse(req.body);
        console.log(`[ORDERS] Anonymous order attempt: ${anonymousName} (${anonymousEmail}) for service ${serviceId}`);
        // Check if service exists and is active - FIX: use delivery_fee instead of price
        const [serviceRows] = await db_1.pool.execute("SELECT id, delivery_fee, title, image FROM services WHERE id = ? AND status = 'active' AND deleted_at IS NULL", [serviceId]);
        if (serviceRows.length === 0) {
            console.log(`[ORDERS] Anonymous order failed: Service ${serviceId} not found or inactive`);
            return res.status(404).json({ error: "Service not found" });
        }
        const service = serviceRows[0];
        const totalAmount = (service.delivery_fee || 0) * quantity;
        // Create order
        const orderId = (0, uuid_1.v4)();
        await db_1.pool.execute("INSERT INTO orders (id, anonymous_name, anonymous_email, anonymous_phone, total_amount, status, payment_status) VALUES (?, ?, ?, ?, ?, ?, ?)", [
            orderId,
            anonymousName,
            anonymousEmail,
            anonymousPhone,
            totalAmount,
            "pending",
            "pending",
        ]);
        // Create order item - FIX: use delivery_fee as price
        await db_1.pool.execute("INSERT INTO order_items (order_id, service_id, quantity, price) VALUES (?, ?, ?, ?)", [orderId, serviceId, quantity, service.delivery_fee]);
        console.log(`[ORDERS] Anonymous order created successfully: Order ${orderId}, Amount: ${totalAmount}`);
        // Send order ID email to anonymous user
        try {
            await (0, email_1.sendOrderIdEmail)(anonymousEmail, orderId, service.title, service.image);
            console.log(`[ORDERS] Order ID email sent to ${anonymousEmail}`);
        }
        catch (emailError) {
            console.error(`[ORDERS] Failed to send order ID email to ${anonymousEmail}:`, emailError);
            // Don't fail the order creation if email fails
        }
        res.status(201).json({
            message: "Anonymous order created successfully",
            orderId,
            totalAmount,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            console.log(`[ORDERS] Anonymous order failed: Validation errors - ${JSON.stringify(error.errors)}`);
            return res
                .status(400)
                .json({ error: "Invalid input", details: error.errors });
        }
        else {
            console.error(`[ORDERS] Anonymous order error:`, error);
            return res.status(500).json({ error: "Internal server error" });
        }
    }
});
// Create authenticated order (provider/admin)
router.post("/", auth_1.requireAuth, rateLimit_1.globalLimiter, async (req, res) => {
    try {
        const { serviceId, quantity } = authenticatedOrderSchema.parse(req.body);
        const userId = req.user.userId;
        console.log(`[ORDERS] Authenticated order attempt: User ${userId} for service ${serviceId}`);
        // Check if service exists and is active - FIX: use delivery_fee
        const [serviceRows] = await db_1.pool.execute("SELECT id, delivery_fee FROM services WHERE id = ? AND status = 'active' AND deleted_at IS NULL", [serviceId]);
        if (serviceRows.length === 0) {
            console.log(`[ORDERS] Authenticated order failed: Service ${serviceId} not found or inactive`);
            return res.status(404).json({ error: "Service not found" });
        }
        const service = serviceRows[0];
        const totalAmount = (service.delivery_fee || 0) * quantity;
        // Create order
        const orderId = (0, uuid_1.v4)();
        await db_1.pool.execute("INSERT INTO orders (id, user_id, total_amount, status, payment_status) VALUES (?, ?, ?, ?, ?)", [orderId, userId, totalAmount, "pending", "pending"]);
        // Create order item - FIX: use delivery_fee as price
        await db_1.pool.execute("INSERT INTO order_items (order_id, service_id, quantity, price) VALUES (?, ?, ?, ?)", [orderId, serviceId, quantity, service.delivery_fee]);
        console.log(`[ORDERS] Authenticated order created successfully: Order ${orderId}, User ${userId}, Amount: ${totalAmount}`);
        res.status(201).json({
            message: "Order created successfully",
            orderId,
            totalAmount,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            console.log(`[ORDERS] Authenticated order failed: Validation errors - ${JSON.stringify(error.errors)}`);
            return res
                .status(400)
                .json({ error: "Invalid input", details: error.errors });
        }
        else {
            console.error(`[ORDERS] Authenticated order error:`, error);
            return res.status(500).json({ error: "Internal server error" });
        }
    }
});
// Get user's orders (authenticated users)
router.get("/my", auth_1.requireAuth, rateLimit_1.globalLimiter, async (req, res) => {
    try {
        const userId = req.user.userId;
        console.log(`[ORDERS] Fetching orders for user ${userId}`);
        const [rows] = await db_1.pool.execute(`
      SELECT o.id, o.total_amount, o.status, o.payment_status, o.created_at,
             oi.service_id, oi.quantity, oi.price,
             s.title as service_title, s.slug as service_slug
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN services s ON oi.service_id = s.id
      WHERE o.user_id = ? AND o.deleted_at IS NULL
      ORDER BY o.created_at DESC
    `, [userId]);
        console.log(`[ORDERS] Retrieved ${rows.length} orders for user ${userId}`);
        res.json({ orders: rows });
    }
    catch (error) {
        console.error(`[ORDERS] Get user orders error:`, error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// Get all orders (admin or service_provider) - with pagination and filtering
router.get("/", auth_1.requireAuth, (0, roles_1.requireRole)("admin", "service_provider"), rateLimit_1.globalLimiter, async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const status = req.query.status;
        const payment_status = req.query.payment_status;
        const offset = (page - 1) * limit;
        if (page < 1 || limit < 1) {
            return res.status(400).json({ error: "Invalid pagination parameters" });
        }
        // Build base WHERE and params
        const conditions = ["o.deleted_at IS NULL"];
        const params = [];
        if (status) {
            conditions.push("o.status = ?");
            params.push(status);
        }
        if (payment_status) {
            conditions.push("o.payment_status = ?");
            params.push(payment_status);
        }
        // If caller is service_provider, restrict to orders that include services owned by them
        const userRole = req.user.role;
        const userId = req.user.userId;
        if (userRole === "service_provider") {
            conditions.push(`EXISTS (
             SELECT 1 FROM order_items oi2
             JOIN services s2 ON oi2.service_id = s2.id
             WHERE oi2.order_id = o.id AND s2.owner_id = ?
           )`);
            params.push(userId);
        }
        const whereClause = conditions.join(" AND ");
        // Count
        const [countRows] = await db_1.pool.query(`SELECT COUNT(*) as total FROM orders o WHERE ${whereClause}`, params);
        const total = countRows[0].total;
        // Main query - include joins for items; use same filter params then add pagination
        const queryParams = [...params, Number(limit), offset];
        const [rows] = await db_1.pool.query(`
        SELECT o.id, o.user_id, o.anonymous_name, o.anonymous_email, o.anonymous_phone,
               o.total_amount, o.status, o.payment_status, o.created_at,
               oi.service_id, oi.quantity, oi.price,
               s.title as service_title, s.slug as service_slug,
               p.display_name as user_name
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN services s ON oi.service_id = s.id
        LEFT JOIN profiles p ON o.user_id = p.id
        WHERE ${whereClause}
        ORDER BY o.created_at DESC
        LIMIT ? OFFSET ?
      `, queryParams);
        res.json({
            orders: rows,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit)),
            },
        });
    }
    catch (error) {
        console.error(`[ORDERS] Get all orders error:`, error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// Get order by id - owner/provider/admin
router.get("/:id", auth_1.requireAuth, rateLimit_1.globalLimiter, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        const userRole = req.user.role;
        console.log(`[ORDERS] Fetching order ${id} for user ${userId} (role: ${userRole})`);
        let query = "";
        let params = [];
        if (userRole === "admin") {
            query = `
          SELECT o.id, o.user_id, o.anonymous_name, o.anonymous_email, o.anonymous_phone,
                 o.total_amount, o.status, o.payment_status, o.created_at,
                 oi.service_id, oi.quantity, oi.price,
                 s.title as service_title, s.slug as service_slug,
                 p.display_name as user_name
          FROM orders o
          LEFT JOIN order_items oi ON o.id = oi.order_id
          LEFT JOIN services s ON oi.service_id = s.id
          LEFT JOIN profiles p ON o.user_id = p.id
          WHERE o.id = ? AND o.deleted_at IS NULL
        `;
            params = [id];
        }
        else if (userRole === "service_provider") {
            // Provider can view an order only if any item in the order belongs to one of their services
            query = `
          SELECT o.id, o.user_id, o.anonymous_name, o.anonymous_email, o.anonymous_phone,
                 o.total_amount, o.status, o.payment_status, o.created_at,
                 oi.service_id, oi.quantity, oi.price,
                 s.title as service_title, s.slug as service_slug,
                 p.display_name as user_name
          FROM orders o
          LEFT JOIN order_items oi ON o.id = oi.order_id
          LEFT JOIN services s ON oi.service_id = s.id
          LEFT JOIN profiles p ON o.user_id = p.id
          WHERE o.id = ? AND o.deleted_at IS NULL
            AND EXISTS (
              SELECT 1 FROM order_items oi2
              JOIN services s2 ON oi2.service_id = s2.id
              WHERE oi2.order_id = o.id AND s2.owner_id = ?
            )
        `;
            params = [id, userId];
        }
        else {
            // Regular user: can see only their own orders
            query = `
          SELECT o.id, o.total_amount, o.status, o.payment_status, o.created_at,
                 oi.service_id, oi.quantity, oi.price,
                 s.title as service_title, s.slug as service_slug
          FROM orders o
          JOIN order_items oi ON o.id = oi.order_id
          JOIN services s ON oi.service_id = s.id
          WHERE o.id = ? AND o.user_id = ? AND o.deleted_at IS NULL
        `;
            params = [id, userId];
        }
        const [rows] = await db_1.pool.query(query, params);
        if (rows.length === 0) {
            return res
                .status(404)
                .json({ error: "Order not found or access denied" });
        }
        res.json({ order: rows[0] });
    }
    catch (error) {
        console.error(`[ORDERS] Get order error:`, error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// Update order status (admin only)
router.put("/:id/status", auth_1.requireAuth, (0, roles_1.requireRole)("admin"), rateLimit_1.globalLimiter, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = zod_1.z
            .object({
            status: zod_1.z.enum([
                "pending",
                "confirmed",
                "in-progress",
                "completed",
                "cancelled",
            ]),
        })
            .parse(req.body);
        const [result] = await db_1.pool.execute("UPDATE orders SET status = ? WHERE id = ?", [status, id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Order not found" });
        }
        res.json({ message: "Order status updated successfully" });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res
                .status(400)
                .json({ error: "Invalid input", details: error.errors });
        }
        else {
            console.error("Update order status error:", error);
            return res.status(500).json({ error: "Internal server error" });
        }
    }
});
// Update payment status (admin only)
router.put("/:id/payment", auth_1.requireAuth, (0, roles_1.requireRole)("admin"), rateLimit_1.globalLimiter, async (req, res) => {
    try {
        const { id } = req.params;
        const { payment_status } = zod_1.z
            .object({
            payment_status: zod_1.z.enum(["pending", "paid", "failed", "refunded"]),
        })
            .parse(req.body);
        const [result] = await db_1.pool.execute("UPDATE orders SET payment_status = ? WHERE id = ?", [payment_status, id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Order not found" });
        }
        res.json({ message: "Payment status updated successfully" });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res
                .status(400)
                .json({ error: "Invalid input", details: error.errors });
        }
        else {
            console.error("Update payment status error:", error);
            return res.status(500).json({ error: "Internal server error" });
        }
    }
});
// Get order details by ID (public for anonymous orders, authenticated for user orders)
router.get("/track/:id", rateLimit_1.globalLimiter, async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`[ORDERS] Tracking order ${id}`);
        // First check if it's an anonymous order
        const [anonymousRows] = await db_1.pool.query(`
      SELECT o.id, o.anonymous_name, o.anonymous_email, o.anonymous_phone,
             o.total_amount, o.status, o.payment_status, o.created_at,
             oi.service_id, oi.quantity, oi.price,
             s.title as service_title, s.slug as service_slug, s.owner_name, s.image,
             p.phone as provider_phone, p.email as provider_email
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN services s ON oi.service_id = s.id
      LEFT JOIN profiles p ON s.owner_id = p.id
      WHERE o.id = ? AND o.anonymous_name IS NOT NULL AND o.deleted_at IS NULL
    `, [id]);
        if (anonymousRows.length > 0) {
            // Return anonymous order details
            const order = anonymousRows[0];
            return res.json({
                order: {
                    id: order.id,
                    customer: {
                        name: order.anonymous_name,
                        email: order.anonymous_email,
                        phone: order.anonymous_phone,
                    },
                    totalAmount: order.total_amount,
                    status: order.status,
                    payment_status: order.payment_status,
                    createdAt: order.created_at,
                    items: anonymousRows.map((row) => ({
                        serviceId: row.service_id,
                        serviceTitle: row.service_title,
                        serviceSlug: row.service_slug,
                        serviceImage: row.image,
                        providerName: row.owner_name,
                        providerPhone: row.provider_phone,
                        providerEmail: row.provider_email,
                        quantity: row.quantity,
                        price: row.price,
                    })),
                },
            });
        }
        // If not anonymous, check if user is authenticated and owns the order
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res
                .status(401)
                .json({ error: "Authentication required for user orders" });
        }
        // Parse token to get user info
        const jwt = require("jsonwebtoken");
        const parts = authHeader.split(" ");
        if (parts.length !== 2) {
            return res.status(401).json({ error: "Invalid authorization header" });
        }
        const token = parts[1];
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET || "please_change_this");
        }
        catch (err) {
            return res.status(401).json({ error: "Invalid token" });
        }
        const userId = decoded.userId ?? decoded.id ?? decoded.sub;
        // Check if authenticated user owns this order
        const [userRows] = await db_1.pool.query(`
      SELECT o.id, o.total_amount, o.status, o.payment_status, o.created_at,
             oi.service_id, oi.quantity, oi.price,
             s.title as service_title, s.slug as service_slug, s.owner_name, s.image,
             p.display_name as user_name, p.phone as provider_phone, p.email as provider_email
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN services s ON oi.service_id = s.id
      LEFT JOIN profiles p ON s.owner_id = p.id
      WHERE o.id = ? AND o.user_id = ? AND o.deleted_at IS NULL
    `, [id, userId]);
        if (userRows.length === 0) {
            return res
                .status(404)
                .json({ error: "Order not found or access denied" });
        }
        const order = userRows[0];
        res.json({
            order: {
                id: order.id,
                customer: {
                    name: order.user_name,
                    userId: userId,
                },
                totalAmount: order.total_amount,
                status: order.status,
                payment_status: order.payment_status,
                createdAt: order.created_at,
                items: userRows.map((row) => ({
                    serviceId: row.service_id,
                    serviceTitle: row.service_title,
                    serviceSlug: row.service_slug,
                    serviceImage: row.image,
                    providerName: row.owner_name,
                    providerPhone: row.provider_phone,
                    providerEmail: row.provider_email,
                    quantity: row.quantity,
                    price: row.price,
                })),
            },
        });
    }
    catch (error) {
        console.error(`[ORDERS] Track order error:`, error);
        res.status(500).json({ error: "Internal server error" });
    }
});
exports.default = router;
//# sourceMappingURL=orders.js.map