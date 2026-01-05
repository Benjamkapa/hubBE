// src/routes/orders.ts
import express, { Request, Response } from "express";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { pool } from "../config/db";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { requireRole } from "../middleware/roles";
import { globalLimiter, anonymousOrderLimiter } from "../middleware/rateLimit";
import { sendOrderIdEmail } from "../utils/email";

const router: express.Router = express.Router();

// Validation schemas
const anonymousOrderSchema = z.object({
  serviceId: z.number().int().positive(),
  quantity: z.number().int().positive(),
  anonymousName: z.string().min(1),
  anonymousEmail: z.string().email(),
  anonymousPhone: z.string().min(1),
});

const authenticatedOrderSchema = z.object({
  serviceId: z.number().int().positive(),
  quantity: z.number().int().positive(),
});

// Create anonymous order (public, rate-limited)
router.post("/anonymous", anonymousOrderLimiter, async (req, res) => {
  try {
    const {
      serviceId,
      quantity,
      anonymousName,
      anonymousEmail,
      anonymousPhone,
    } = anonymousOrderSchema.parse(req.body);

    console.log(
      `[ORDERS] Anonymous order attempt: ${anonymousName} (${anonymousEmail}) for service ${serviceId}`
    );

    // Check if service exists and is active - FIX: use delivery_fee instead of price
    const [serviceRows] = await pool.execute(
      "SELECT id, delivery_fee, title, image FROM services WHERE id = ? AND status = 'active' AND deleted_at IS NULL",
      [serviceId]
    );
    if ((serviceRows as any[]).length === 0) {
      console.log(
        `[ORDERS] Anonymous order failed: Service ${serviceId} not found or inactive`
      );
      return res.status(404).json({ error: "Service not found" });
    }

    const service = (serviceRows as any[])[0];
    const totalAmount = (service.delivery_fee || 0) * quantity;

    // Create order
    const orderId = uuidv4();
    await pool.execute(
      "INSERT INTO orders (id, anonymous_name, anonymous_email, anonymous_phone, total_amount, status, payment_status) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        orderId,
        anonymousName,
        anonymousEmail,
        anonymousPhone,
        totalAmount,
        "pending",
        "pending",
      ]
    );

    // Create order item - FIX: use delivery_fee as price
    await pool.execute(
      "INSERT INTO order_items (order_id, service_id, quantity, price) VALUES (?, ?, ?, ?)",
      [orderId, serviceId, quantity, service.delivery_fee]
    );

    console.log(
      `[ORDERS] Anonymous order created successfully: Order ${orderId}, Amount: ${totalAmount}`
    );

    // Send order ID email to anonymous user
    try {
      await sendOrderIdEmail(
        anonymousEmail,
        orderId,
        service.title,
        service.image
      );
      console.log(`[ORDERS] Order ID email sent to ${anonymousEmail}`);
    } catch (emailError) {
      console.error(
        `[ORDERS] Failed to send order ID email to ${anonymousEmail}:`,
        emailError
      );
      // Don't fail the order creation if email fails
    }

    res.status(201).json({
      message: "Anonymous order created successfully",
      orderId,
      totalAmount,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.log(
        `[ORDERS] Anonymous order failed: Validation errors - ${JSON.stringify(
          error.errors
        )}`
      );
      return res
        .status(400)
        .json({ error: "Invalid input", details: error.errors });
    } else {
      console.error(`[ORDERS] Anonymous order error:`, error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
});

// Create authenticated order (provider/admin)
router.post("/", requireAuth, globalLimiter, async (req: AuthRequest, res) => {
  try {
    const { serviceId, quantity } = authenticatedOrderSchema.parse(req.body);
    const userId = req.user!.user_id ?? req.user!.userId ?? req.user!.id;

    console.log(
      `[ORDERS] Authenticated order attempt: User ${userId} for service ${serviceId}`
    );

    // Check if service exists and is active - FIX: use delivery_fee
    const [serviceRows] = await pool.execute(
      "SELECT id, delivery_fee FROM services WHERE id = ? AND status = 'active' AND deleted_at IS NULL",
      [serviceId]
    );
    if ((serviceRows as any[]).length === 0) {
      console.log(
        `[ORDERS] Authenticated order failed: Service ${serviceId} not found or inactive`
      );
      return res.status(404).json({ error: "Service not found" });
    }

    const service = (serviceRows as any[])[0];
    const totalAmount = (service.delivery_fee || 0) * quantity;

    // Create order
    const orderId = uuidv4();
    await pool.execute(
      "INSERT INTO orders (id, user_id, total_amount, status, payment_status) VALUES (?, ?, ?, ?, ?)",
      [orderId, userId, totalAmount, "pending", "pending"]
    );

    // Create order item - FIX: use delivery_fee as price
    await pool.execute(
      "INSERT INTO order_items (order_id, service_id, quantity, price) VALUES (?, ?, ?, ?)",
      [orderId, serviceId, quantity, service.delivery_fee]
    );

    console.log(
      `[ORDERS] Authenticated order created successfully: Order ${orderId}, User ${userId}, Amount: ${totalAmount}`
    );

    res.status(201).json({
      message: "Order created successfully",
      orderId,
      totalAmount,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.log(
        `[ORDERS] Authenticated order failed: Validation errors - ${JSON.stringify(
          error.errors
        )}`
      );
      return res
        .status(400)
        .json({ error: "Invalid input", details: error.errors });
    } else {
      console.error(`[ORDERS] Authenticated order error:`, error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
});

// Admin & providers: get orders (providers see only their services' orders)
router.get(
  "/",
  requireAuth,
  requireRole("admin", "service_provider"),
  globalLimiter,
  async (req: AuthRequest, res: Response) => {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 10;
      const status = req.query.status as string;
      const payment_status = req.query.payment_status as string;
      const offset = (page - 1) * limit;

      const userRole = req.user!.role;
      const userId = req.user!.user_id ?? req.user!.userId ?? req.user!.id;

      if (page < 1 || limit < 1) {
        return res.status(400).json({ error: "Invalid pagination parameters" });
      }

      const conditions: string[] = ["o.deleted_at IS NULL"];
      const params: any[] = [];

      if (status) {
        conditions.push("o.status = ?");
        params.push(status);
      }
      if (payment_status) {
        conditions.push("o.payment_status = ?");
        params.push(payment_status);
      }

      // If requester is a service provider, restrict to orders that include their services
      if (userRole === "service_provider") {
        conditions.push(
          `EXISTS (
            SELECT 1 FROM order_items oi2
            JOIN services s2 ON oi2.service_id = s2.id
            WHERE oi2.order_id = o.id AND s2.owner_id = ?
          )`
        );
        params.push(userId);
      }

      const whereClause = conditions.join(" AND ");

      const [countRows] = await pool.query(
        `SELECT COUNT(*) as total FROM orders o WHERE ${whereClause}`,
        params
      );
      const total = (countRows as any[])[0].total;

      const queryParams = [...params, limit, offset];

      const [rows] = await pool.query(
        `
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
      `,
        queryParams
      );

      res.json({
        orders: rows,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error(`[ORDERS] Get all orders error:`, error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Get single order - admin sees all, provider sees only if they own the service
router.get(
  "/:id",
  requireAuth,
  globalLimiter,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user!.user_id ?? req.user!.userId ?? req.user!.id;
      const userRole = req.user!.role;

      console.log(
        `[ORDERS] Fetching order ${id} for user ${userId} (role: ${userRole})`
      );

      let query = "";
      let params: any[] = [];

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
      } else if (userRole === "service_provider") {
        // Provider can view order only if one of their services is in it
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
      } else {
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

      const [rows] = await pool.query(query, params);

      if ((rows as any[]).length === 0) {
        return res
          .status(404)
          .json({ error: "Order not found or access denied" });
      }

      res.json({ order: (rows as any[])[0] });
    } catch (error) {
      console.error(`[ORDERS] Get order error:`, error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Update order status (admin or service_provider)
router.put(
  "/:id/status",
  requireAuth,
  requireRole("admin", "service_provider"),
  globalLimiter,
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { status } = z
        .object({
          status: z.enum([
            "pending",
            "confirmed",
            "in-progress",
            "completed",
            "cancelled",
          ]),
        })
        .parse(req.body);

      const [result] = await pool.execute(
        "UPDATE orders SET status = ? WHERE id = ?",
        [status, id]
      );

      if ((result as any).affectedRows === 0) {
        return res.status(404).json({ error: "Order not found" });
      }

      res.json({ message: "Order status updated successfully" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Invalid input", details: error.errors });
      } else {
        console.error("Update order status error:", error);
        return res.status(500).json({ error: "Internal server error" });
      }
    }
  }
);

// Update payment status (admin or service_provider)
router.put(
  "/:id/payment",
  requireAuth,
  requireRole("admin", "service_provider"),
  globalLimiter,
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { payment_status } = z
        .object({
          payment_status: z.enum(["pending", "paid", "failed", "refunded"]),
        })
        .parse(req.body);

      const [result] = await pool.execute(
        "UPDATE orders SET payment_status = ? WHERE id = ?",
        [payment_status, id]
      );

      if ((result as any).affectedRows === 0) {
        return res.status(404).json({ error: "Order not found" });
      }

      res.json({ message: "Payment status updated successfully" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Invalid input", details: error.errors });
      } else {
        console.error("Update payment status error:", error);
        return res.status(500).json({ error: "Internal server error" });
      }
    }
  }
);

// Get order details by ID (public for anonymous orders, authenticated for user orders)
router.get("/track/:id", globalLimiter, async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`[ORDERS] Tracking order ${id}`);

    // First check if it's an anonymous order
    const [anonymousRows] = await pool.query(
      `
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
    `,
      [id]
    );

    if ((anonymousRows as any[]).length > 0) {
      // Return anonymous order details
      const order = (anonymousRows as any[])[0];
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
          items: (anonymousRows as any[]).map((row: any) => ({
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
    const authHeader = (req.headers as any).authorization;
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
      decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "please_change_this"
      );
    } catch (err) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const userId = decoded.userId ?? decoded.id ?? decoded.sub;

    // Check if authenticated user owns this order
    const [userRows] = await pool.query(
      `
      SELECT o.id, o.total_amount, o.status, o.payment_status, o.created_at,
             oi.service_id, oi.quantity, oi.price,
             s.title as service_title, s.slug as service_slug, s.owner_name, s.image,
             p.display_name as user_name, p.phone as provider_phone, p.email as provider_email
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN services s ON oi.service_id = s.id
      LEFT JOIN profiles p ON s.owner_id = p.id
      WHERE o.id = ? AND o.user_id = ? AND o.deleted_at IS NULL
    `,
      [id, userId]
    );

    if ((userRows as any[]).length === 0) {
      return res
        .status(404)
        .json({ error: "Order not found or access denied" });
    }

    const order = (userRows as any[])[0];
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
        items: (userRows as any[]).map((row: any) => ({
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
  } catch (error) {
    console.error(`[ORDERS] Track order error:`, error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
