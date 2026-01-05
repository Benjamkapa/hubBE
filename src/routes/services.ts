// src/routes/services.ts
import express, { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { pool } from "../config/db";
import { globalLimiter, anonymousOrderLimiter } from "../middleware/rateLimit";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { requireRole } from "../middleware/roles";
import jwt from "jsonwebtoken"; // { changed code }
import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const router: express.Router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../../uploads"));
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"));
    }
  },
});

// Optional auth middleware: populate req.user if Authorization header present
const optionalAuth = (req: Request, _res: Response, next: any) => {
  const authHeader = (req.headers as any).authorization;
  if (!authHeader) return next();
  const parts = authHeader.split(" ");
  if (parts.length !== 2) return next();
  const token = parts[1];
  try {
    const decodedAny = jwt.verify(
      token,
      process.env.JWT_SECRET || "please_change_this"
    ) as any;

    // Normalize token shape: ensure req.user.user_id and req.user.role exist
    (req as any).user = {
      user_id: decodedAny.user_id ?? decodedAny.id ?? decodedAny.sub,
      role: decodedAny.role ?? decodedAny.userRole ?? decodedAny.roleName,
    };

    console.log("optionalAuth decoded user:", (req as any).user);
  } catch (err) {
    // invalid token - ignore and treat as unauthenticated
  }
  next();
};

// List services with pagination and filtering
router.get(
  "/",
  // requireAuth,
  // requireRole("admin", "service_provider"),
  // globalLimiter,
  async (req: AuthRequest, res: Response) => {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 10;
      const category = req.query.category as string;
      const owner_id = req.query.owner_id as string | undefined; // Keep as query param
      const owner_name = req.query.owner_name as string;
      const status = req.query.status as string;

      // Basic validation
      if (page < 1 || limit < 1) {
        return res.status(400).json({ error: "Invalid pagination parameters" });
      }

      const offset = (page - 1) * limit;

      // Build WHERE clause
      const whereConditions: string[] = ["deleted_at IS NULL"];
      const params: any[] = [];

      if (category) {
        whereConditions.push("category = ?");
        params.push(category);
      }
      if (owner_id) {
        // Only filter if explicitly provided in query
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

      const [rows] = await pool.query(
        `SELECT id, slug, title, description, category, status, delivery_fee, color, bg_color, color_hex, image, fields, owner_id, owner_name, latitude, longitude, created_at FROM services WHERE ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      const [countRows] = await pool.query(
        `SELECT COUNT(*) as total FROM services WHERE ${whereClause}`,
        params
      );
      const total = (countRows as any)[0].total;

      res.json({
        services: rows,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (error) {
      console.error("List services error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Get by slug
router.get("/:slug", optionalAuth, async (req: Request, res: Response) => {
  // { changed code }
  try {
    const { slug } = req.params;
    const [rows] = await pool.execute(
      "SELECT id, slug, title, description, category, status, delivery_fee, color, bg_color, color_hex, image, fields, owner_id, owner_name, latitude, longitude, created_at FROM services WHERE slug = ? AND deleted_at IS NULL",
      [slug]
    );

    if ((rows as any[]).length === 0) {
      return res.status(404).json({ error: "Service not found" });
    }

    const service = (rows as any[])[0];

    // If requester is authenticated service_provider, ensure they own the service
    const reqUser = (req as any).user;
    if (reqUser && reqUser.role === "service_provider") {
      const ownerId = service.owner_id ?? null;
      const requesterId =
        reqUser.user_id ?? reqUser.userId ?? reqUser.id ?? null;
      if (
        ownerId === null ||
        requesterId === null ||
        String(ownerId) !== String(requesterId)
      ) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    res.json({ service });
  } catch (error) {
    console.error("Get service by slug error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create service - service provider or admin
// router.post(
//   "/",
//   requireAuth,
//   requireRole("service_provider", "admin"),
//   upload.single("image"), // Handle file upload
//   [
//     body("title").isLength({ min: 1 }),
//     body("description").optional().isLength({ min: 1 }),
//     body("category").isIn([
//       "shop",
//       "cleaning",
//       "shopping",
//       "transport",
//       "repair",
//       "delivery",
//       "tutoring",
//       "health",
//       "food",
//       "events",
//       "home",
//       "education",
//       "technology",
//       "finance",
//       "legal",
//       "travel",
//       "entertainment",
//       "beauty",
//       "other",
//     ]),
//     body("delivery_fee").optional().isFloat({ min: 0 }),
//     body("color").optional().isLength({ min: 1 }),
//     body("bg_color").optional().isLength({ min: 1 }),
//     body("color_hex").optional().isLength({ min: 1 }),
//     body("fields")
//       .optional()
//       .custom((value) => {
//         if (!value) return true; // Allow empty
//         try {
//           const parsed = JSON.parse(value);
//           if (Array.isArray(parsed)) return true;
//           throw new Error("Fields must be a valid JSON array");
//         } catch (e) {
//           throw new Error("Fields must be a valid JSON array");
//         }
//       }),
//     body("owner_name").isLength({ min: 1 }),
//     body("latitude").optional().isFloat({ min: -90, max: 90 }),
//     body("longitude").optional().isFloat({ min: -180, max: 180 }),
//     body("status").optional().isIn(["active", "inactive"]),
//   ],
//   async (req: AuthRequest, res: Response) => {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//       return res.status(400).json({ errors: errors.array() });
//     }

//     try {
//       const {
//         title,
//         description,
//         category,
//         delivery_fee,
//         color,
//         bg_color,
//         color_hex,
//         fields,
//         owner_name,
//         latitude,
//         longitude,
//         status,
//       } = req.body;

//       // FIX: Check if user exists first
//       if (!req.user) {
//         return res.status(401).json({ error: "Unauthorized" });
//       }

//       const ownerId = req.user.user_id;

//       // FIX: Validate ownerId is not undefined
//       if (!ownerId) {
//         console.error("ownerId is undefined. req.user:", req.user);
//         return res.status(400).json({ error: "Invalid user ID" });
//       }

//       // Handle image upload
//       let imagePath = null;
//       if (req.file) {
//         imagePath = `/uploads/${req.file.filename}`;
//       }

//       // Ensure optional fields are null if not provided
//       const safeDescription = description || null;
//       const safeDeliveryFee = delivery_fee || null;
//       const safeColor = color || null;
//       const safeBgColor = bg_color || null;
//       const safeColorHex = color_hex || null;
//       const safeFields = fields || [];
//       const safeLatitude = latitude || null;
//       const safeLongitude = longitude || null;

//       // Generate slug from title
//       const slug = title
//         .toLowerCase()
//         .replace(/[^a-z0-9]+/g, "-")
//         .replace(/^-+|-+$/g, "");

//       // Check if slug is unique
//       const [existing] = await pool.execute(
//         "SELECT id FROM services WHERE slug = ? AND deleted_at IS NULL",
//         [slug]
//       );
//       if ((existing as any[]).length > 0) {
//         return res.status(409).json({ error: "Slug already exists" });
//       }

//       const params = [
//         slug,
//         title,
//         safeDescription,
//         category,
//         safeDeliveryFee,
//         safeColor,
//         safeBgColor,
//         safeColorHex,
//         imagePath,
//         JSON.stringify(safeFields),
//         ownerId,
//         owner_name,
//         safeLatitude,
//         safeLongitude,
//       ];

//       console.log("Params before execution:", params);

//       const [result] = await pool.execute(
//         "INSERT INTO services (slug, title, description, category, delivery_fee, color, bg_color, color_hex, image, fields, owner_id, owner_name, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
//         params
//       );

//       const serviceId = (result as any).insertId;
//       res.status(201).json({
//         service: {
//           id: serviceId,
//           slug,
//           title,
//           description,
//           category,
//           delivery_fee,
//           color,
//           bg_color,
//           color_hex,
//           image: imagePath,
//           fields,
//           owner_id: ownerId,
//           owner_name,
//           latitude,
//           longitude,
//           created_at: new Date().toISOString(),
//           updated_at: new Date().toISOString(),
//         },
//       });
//     } catch (error) {
//       console.error("Create service error:", error);
//       res.status(500).json({ error: "Internal server error" });
//     }
//   }
// );

router.post(
  "/",
  requireAuth,
  requireRole("service_provider", "admin"),
  upload.single("image"),
  [
    body("title").notEmpty(),
    body("category").isIn([
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
      "beauty",
      "other",
    ]),
    body("owner_name").notEmpty(),
    body("delivery_fee").optional().isFloat({ min: 0 }),
    body("latitude").optional().isFloat({ min: -90, max: 90 }),
    body("longitude").optional().isFloat({ min: -180, max: 180 }),
    body("image_url").optional().isURL(),
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      if (!req.user?.user_id) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const {
        title,
        description,
        category,
        delivery_fee,
        color,
        bg_color,
        color_hex,
        fields,
        owner_name,
        latitude,
        longitude,
        image_url,
      } = req.body;

      const ownerId = req.user.user_id;

      // 🔑 Image logic (FILE > URL > null)
      let image: string | null = null;

      if (req.file) {
        image = `/uploads/${req.file.filename}`;
      } else if (image_url) {
        image = image_url;
      }

      // Normalize fields
      const safeFields = normalizeFields(fields);

      // Generate slug
      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      // Check slug uniqueness
      const [existing] = await pool.execute(
        "SELECT id FROM services WHERE slug = ? AND deleted_at IS NULL",
        [slug]
      );
      if ((existing as any[]).length) {
        return res.status(409).json({ error: "Slug already exists" });
      }

      const [result] = await pool.execute(
        `
        INSERT INTO services
        (slug, title, description, category, delivery_fee, color, bg_color, color_hex, image, fields, owner_id, owner_name, latitude, longitude)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          slug,
          title,
          description ?? null,
          category,
          delivery_fee ?? null,
          color ?? null,
          bg_color ?? null,
          color_hex ?? null,
          image,
          JSON.stringify(safeFields),
          ownerId,
          owner_name,
          latitude ?? null,
          longitude ?? null,
        ]
      );

      res.status(201).json({
        service: {
          id: (result as any).insertId,
          slug,
          title,
          image,
          fields: safeFields,
        },
      });
    } catch (err: any) {
      console.error("Create service error:", err);
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  }
);

// Update service - provider (owner) or admin
// router.put(
//   "/:id",
//   requireAuth,
//   requireRole("service_provider", "admin"),
//   [
//     body("title").optional().isLength({ min: 1 }),
//     body("description").optional().isLength({ min: 1 }),
//     body("category")
//       .optional()
//       .isIn([
//         "shop",
//         "cleaning",
//         "shopping",
//         "transport",
//         "repair",
//         "delivery",
//         "tutoring",
//         "health",
//         "food",
//         "events",
//         "home",
//         "education",
//         "technology",
//         "finance",
//         "legal",
//         "travel",
//         "beauty",
//         "entertainment",
//         "other",
//       ]),
//     body("delivery_fee").optional().isFloat({ min: 0 }),
//     body("color").optional().isLength({ min: 1 }),
//     body("bg_color").optional().isLength({ min: 1 }),
//     body("color_hex").optional().isLength({ min: 1 }),
//     body("image").optional().isLength({ min: 1 }),
//     body("fields")
//       .optional()
//       .custom((value) => {
//         if (!value) return true; // Allow empty
//         try {
//           const parsed = JSON.parse(value);
//           if (Array.isArray(parsed)) return true;
//           throw new Error("Fields must be a valid JSON array");
//         } catch (e) {
//           throw new Error("Fields must be a valid JSON array");
//         }
//       }),
//     body("owner_name").optional().isLength({ min: 1 }),
//     body("latitude").optional().isFloat({ min: -90, max: 90 }),
//     body("longitude").optional().isFloat({ min: -180, max: 180 }),
//     body("status").optional().isIn(["active", "inactive"]),
//   ],
//   async (req: AuthRequest, res: Response) => {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//       return res.status(400).json({ errors: errors.array() });
//     }

//     try {
//       const { id } = req.params;
//       const {
//         title,
//         description,
//         category,
//         delivery_fee,
//         color,
//         bg_color,
//         color_hex,
//         image,
//         fields,
//         owner_name,
//         latitude,
//         longitude,
//         status,
//       } = req.body;
//       const user_id = req.user!.user_id;
//       const userRole = req.user!.role;

//       // Check ownership
//       const [serviceRows] = await pool.execute(
//         "SELECT owner_id, title FROM services WHERE id = ? AND deleted_at IS NULL",
//         [id]
//       );
//       if ((serviceRows as any[]).length === 0) {
//         return res.status(404).json({ error: "Service not found" });
//       }
//       const service = (serviceRows as any[])[0];
//       console.log(
//         `Update service check: user_id=${user_id}, userRole=${userRole}, service.owner_id=${service.owner_id}`
//       );
//       if (userRole !== "admin" && service.owner_id !== user_id) {
//         return res.status(403).json({ error: "Forbidden" });
//       }

//       // Build update query
//       const updates: string[] = [];
//       const params: any[] = [];
//       if (title !== undefined) {
//         updates.push("title = ?");
//         params.push(title);
//         // Regenerate slug if title changed
//         const newSlug = title
//           .toLowerCase()
//           .replace(/[^a-z0-9]+/g, "-")
//           .replace(/^-+|-+$/g, "");
//         updates.push("slug = ?");
//         params.push(newSlug);
//       }
//       if (description !== undefined) {
//         updates.push("description = ?");
//         params.push(description);
//       }
//       if (category !== undefined) {
//         updates.push("category = ?");
//         params.push(category);
//       }
//       if (delivery_fee !== undefined) {
//         updates.push("delivery_fee = ?");
//         params.push(delivery_fee);
//       }
//       if (color !== undefined) {
//         updates.push("color = ?");
//         params.push(color);
//       }
//       if (bg_color !== undefined) {
//         updates.push("bg_color = ?");
//         params.push(bg_color);
//       }
//       if (color_hex !== undefined) {
//         updates.push("color_hex = ?");
//         params.push(color_hex);
//       }
//       if (image !== undefined) {
//         updates.push("image = ?");
//         params.push(image);
//       }
//       if (fields !== undefined) {
//         updates.push("fields = ?");
//         params.push(JSON.stringify(fields));
//       }
//       if (owner_name !== undefined) {
//         updates.push("owner_name = ?");
//         params.push(owner_name);
//       }
//       if (latitude !== undefined) {
//         updates.push("latitude = ?");
//         params.push(latitude);
//       }
//       if (longitude !== undefined) {
//         updates.push("longitude = ?");
//         params.push(longitude);
//       }
//       if (status !== undefined) {
//         updates.push("status = ?");
//         params.push(status);
//       }
//       if (updates.length === 0) {
//         return res.status(400).json({ error: "No fields to update" });
//       }

//       params.push(id);
//       await pool.execute(
//         `UPDATE services SET ${updates.join(
//           ", "
//         )}, updated_at = NOW() WHERE id = ?`,
//         params
//       );

//       // Get updated service
//       const [updatedRows] = await pool.execute(
//         "SELECT id, slug, title, description, category, status, delivery_fee, color, bg_color, color_hex, image, fields, owner_id, owner_name, latitude, longitude, created_at, updated_at FROM services WHERE id = ?",
//         [id]
//       );

//       res.json({ service: (updatedRows as any[])[0] });
//     } catch (error) {
//       console.error("Update service error:", error);
//       res.status(500).json({ error: "Internal server error" });
//     }
//   }
// );

router.put(
  "/:id",
  requireAuth,
  requireRole("service_provider", "admin"),
  upload.single("image"), // 👈 ADD multer
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = Number(req.user!.user_id);
      const userRole = req.user!.role;

      // Fetch service
      const [rows] = await pool.execute(
        "SELECT owner_id FROM services WHERE id = ? AND deleted_at IS NULL",
        [id]
      );

      if (!(rows as any[]).length) {
        return res.status(404).json({ error: "Service not found" });
      }

      const service = (rows as any[])[0];

      // 🔒 Ownership check (FIXED)
      if (userRole !== "admin" && Number(service.owner_id) !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const updates: string[] = [];
      const params: any[] = [];

      const {
        title,
        description,
        category,
        delivery_fee,
        color,
        bg_color,
        color_hex,
        owner_name,
        latitude,
        longitude,
        status,
        image_url,
        fields,
      } = req.body;

      if (title) {
        updates.push("title = ?", "slug = ?");
        params.push(
          title,
          title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
        );
      }

      if (description !== undefined) {
        updates.push("description = ?");
        params.push(description);
      }

      if (category) {
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

      // 🖼 Image logic (FILE > URL)
      if (req.file) {
        updates.push("image = ?");
        params.push(`/uploads/${req.file.filename}`);
      } else if (image_url) {
        updates.push("image = ?");
        params.push(image_url);
      }

      if (fields !== undefined) {
        updates.push("fields = ?");
        params.push(JSON.stringify(normalizeFields(fields)));
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

      if (!updates.length) {
        return res.status(400).json({ error: "No fields to update" });
      }

      params.push(id);

      await pool.execute(
        `UPDATE services SET ${updates.join(
          ", "
        )}, updated_at = NOW() WHERE id = ?`,
        params
      );

      res.json({ message: "Service updated successfully" });
    } catch (err: any) {
      console.error("Update service error:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// Delete service - provider (owner) or admin (soft delete)
router.delete(
  "/:id",
  requireAuth,
  requireRole("service_provider", "admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const user_id = req.user!.user_id;
      const userRole = req.user!.role;

      // Check ownership
      const [serviceRows] = await pool.execute(
        "SELECT owner_id FROM services WHERE id = ? AND deleted_at IS NULL",
        [id]
      );
      if ((serviceRows as any[]).length === 0) {
        return res.status(404).json({ error: "Service not found" });
      }
      const service = (serviceRows as any[])[0];
      if (userRole !== "admin" && service.owner_id !== user_id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      // Check for existing orders
      const [orderRows] = await pool.execute(
        "SELECT id FROM order_items WHERE service_id = ? LIMIT 1",
        [id]
      );
      if ((orderRows as any[]).length > 0) {
        return res
          .status(409)
          .json({ error: "Cannot delete service with existing orders" });
      }

      await pool.execute(
        "UPDATE services SET deleted_at = NOW() WHERE id = ?",
        [id]
      );

      res.json({ message: "Service deleted successfully" });
    } catch (error) {
      console.error("Delete service error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// List services by owner with pagination and filtering
router.get(
  "/owner/:owner_id",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const { owner_id } = req.params;
      const user_id = req.user!.user_id;
      const userRole = req.user!.role;

      // Permission check
      if (userRole === "service_provider" && owner_id !== String(user_id)) {
        return res
          .status(403)
          .json({ error: "Forbidden: Cannot access other users' services" });
      }

      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 10;
      const category = req.query.category as string;
      const status = req.query.status as string;

      if (page < 1 || limit < 1) {
        return res.status(400).json({ error: "Invalid pagination parameters" });
      }

      const offset = (page - 1) * limit;

      // Build WHERE clause
      const whereConditions: string[] = ["deleted_at IS NULL", "owner_id = ?"];
      const params: any[] = [owner_id];

      if (category) {
        whereConditions.push("category = ?");
        params.push(category);
      }
      if (status) {
        whereConditions.push("status = ?");
        params.push(status);
      }

      const whereClause = whereConditions.join(" AND ");

      // Fetch services with pagination
      const [rows] = await pool.query(
        `SELECT id, slug, title, description, category, status, delivery_fee, color, bg_color, color_hex, image, fields, owner_id, owner_name, latitude, longitude, created_at 
         FROM services 
         WHERE ${whereClause} 
         ORDER BY created_at DESC 
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      // Get total count for pagination
      const [countRows] = await pool.query(
        `SELECT COUNT(*) as total FROM services WHERE ${whereClause}`,
        params
      );
      const total = (countRows as any)[0].total;

      res.json({
        services: rows,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Get services by owner error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

function normalizeFields(fields: any): any[] {
  if (!fields) return [];
  if (typeof fields === "string") {
    try {
      const parsed = JSON.parse(fields);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return Array.isArray(fields) ? fields : [];
}

export default router;
