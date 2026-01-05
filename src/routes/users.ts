import express, { Response } from "express";
import { pool } from "../config/db";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { requireRole } from "../middleware/roles";

const router: express.Router = express.Router();

/**
 * ============================
 * Admin: List users (paginated)
 * ============================
 */
router.get(
  "/",
  requireAuth,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1);
      const limit = Math.max(parseInt(req.query.limit as string, 10) || 10, 1);
      const role = req.query.role as string | undefined;
      const offset = (page - 1) * limit;

      const whereClause = role ? "WHERE role = ?" : "";
      const params: any[] = role ? [role] : [];

      const [users] = await pool.query(
        `
        SELECT id, email, display_name, phone, role, email_verified,
               created_at, updated_at
        FROM profiles
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
        `,
        [...params, limit, offset]
      );

      const [countRows] = await pool.query(
        `SELECT COUNT(*) as total FROM profiles ${whereClause}`,
        params
      );

      const total = (countRows as any[])[0].total;

      res.json({
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("[USERS] List users error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * ============================
 * Get current user (/me)
 * ============================
 */
router.get("/me", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const [rows] = await pool.query(
      `
        SELECT id, email, display_name, phone, role, email_verified,
               created_at, updated_at
        FROM profiles
        WHERE id = ?
        `,
      [userId]
    );

    if ((rows as any[]).length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user: (rows as any[])[0] });
  } catch (error) {
    console.error("[USERS] /me error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * ============================
 * Admin: Get user by ID
 * ============================
 */
router.get(
  "/:id",
  requireAuth,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const [rows] = await pool.query(
        `
        SELECT id, email, display_name, phone, role, email_verified,
               created_at, updated_at
        FROM profiles
        WHERE id = ?
        `,
        [id]
      );

      if ((rows as any[]).length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({ user: (rows as any[])[0] });
    } catch (error) {
      console.error("[USERS] Get user error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * ============================
 * Admin: Delete user (hard delete)
 * ============================
 */
router.delete(
  "/:id",
  requireAuth,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const currentUserId = req.user!.id;

      // Prevent self-deletion
      if (String(currentUserId) === String(id)) {
        return res
          .status(400)
          .json({ error: "Cannot delete your own account" });
      }

      const [userRows] = await pool.query(
        "SELECT id FROM profiles WHERE id = ?",
        [id]
      );

      if ((userRows as any[]).length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      // Ensure user has no services
      const [serviceRows] = await pool.query(
        "SELECT COUNT(*) as count FROM services WHERE owner_id = ?",
        [id]
      );

      if ((serviceRows as any[])[0].count > 0) {
        return res.status(409).json({
          error: "Cannot delete user with existing services",
        });
      }

      // HARD DELETE
      await pool.query("DELETE FROM profiles WHERE id = ?", [id]);

      res.json({ success: true, message: "User deleted successfully" });
    } catch (error) {
      console.error("[USERS] Delete user error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;



// import express, { Request, Response } from "express";
// import { pool } from "../config/db";
// import { requireAuth, AuthRequest } from "../middleware/auth";
// import { requireRole } from "../middleware/roles";

// const router: express.Router = express.Router();

// // Admin: list users with pagination
// router.get(
//   "/",
//   requireAuth,
//   requireRole("admin"),
//   async (req: AuthRequest, res: Response) => {
//     try {
//       const page = parseInt(req.query.page as string, 10) || 1;
//       const limit = parseInt(req.query.limit as string, 10) || 10;
//       const role = req.query.role as string;

//       if (page < 1 || limit < 1) {
//         return res.status(400).json({ error: "Invalid pagination parameters" });
//       }

//       const offset = (page - 1) * limit;
//       const whereClause = role ? "WHERE role = ?" : "";
//       const params = role ? [role] : [];

//       const [rows] = await pool.query(
//         `SELECT id, email, display_name, phone, role, email_verified, created_at, updated_at FROM profiles ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
//         [...params, limit, offset]
//       );

//       const [countRows] = await pool.query(
//         `SELECT COUNT(*) as total FROM profiles ${whereClause}`,
//         params
//       );
//       const total = (countRows as any[])[0].total;

//       res.json({
//         users: rows,
//         pagination: {
//           page,
//           limit,
//           total,
//           pages: Math.ceil(total / limit),
//         },
//       });
//     } catch (error) {
//       console.error("List users error:", error);
//       res.status(500).json({ error: "Internal server error" });
//     }
//   }
// );

// // get currently authenticated user's profile
// router.get(
//   "/me",
//   requireAuth,
//   async (req: AuthRequest, res: Response) => {
//     try {
//       const { id } = req.user!;

//       console.log(`[USERS] Getting user by ID: ${id}`);

//       const [rows] = await pool.query(
//         "SELECT id, email, display_name, phone, role, email_verified, created_at, updated_at FROM profiles WHERE id = ? AND deleted_at IS NULL",
//         [id]
//       );

//       console.log(`[USERS] Query result for ID ${id}:`, rows);

//       if ((rows as any[]).length === 0) {
//         console.log(`[USERS] User ${id} not found`);
//         return res.status(404).json({ error: "User not found" });
//       }

//       console.log(`[USERS] User ${id} found successfully`);
//       res.json({ user: (rows as any[])[0] });
//     } catch (error) {
//       console.error("[USERS] Get user by ID error:", error);
//       res.status(500).json({ error: "Internal server error" });
//     }
//   }
// );

// // Admin: get user by ID
// router.get(
//   "/:id",
//   requireAuth,
//   requireRole("admin"),
//   async (req: AuthRequest, res: Response) => {
//     try {
//       const { id } = req.params;

//       console.log(`[USERS] Getting user by ID: ${id}`);

//       const [rows] = await pool.query(
//         "SELECT id, email, display_name, phone, role, email_verified, created_at, updated_at FROM profiles WHERE id = ? AND deleted_at IS NULL",
//         [id]
//       );

//       console.log(`[USERS] Query result for ID ${id}:`, rows);

//       if ((rows as any[]).length === 0) {
//         console.log(`[USERS] User ${id} not found`);
//         return res.status(404).json({ error: "User not found" });
//       }

//       console.log(`[USERS] User ${id} found successfully`);
//       res.json({ user: (rows as any[])[0] });
//     } catch (error) {
//       console.error("[USERS] Get user by ID error:", error);
//       res.status(500).json({ error: "Internal server error" });
//     }
//   }
// );

// // Admin: delete user (soft delete)
// router.delete(
//   "/:id",
//   requireAuth,
//   requireRole("admin"),
//   async (req: AuthRequest, res: Response) => {
//     try {
//       const { id } = req.params;

//       // Prevent self-deletion
//       if (req.user!.userId === id) {
//         return res
//           .status(400)
//           .json({ error: "Cannot delete your own account" });
//       }

//       // Check if user exists
//       const [userRows] = await pool.query(
//         "SELECT id FROM profiles WHERE id = ?",
//         [id]
//       );
//       if ((userRows as any[]).length === 0) {
//         return res.status(404).json({ error: "User not found" });
//       }

//       // Check for services owned by user
//       const [serviceRows] = await pool.query(
//         "SELECT COUNT(*) as count FROM services WHERE owner_id = ? AND deleted_at IS NULL",
//         [id]
//       );
//       if ((serviceRows as any[])[0].count > 0) {
//         return res.status(409).json({
//           error:
//             "Cannot delete user with active services. Delete services first.",
//         });
//       }

//       // Soft delete: set a deleted_at timestamp
//       await pool.query("UPDATE profiles SET deleted_at = NOW() WHERE id = ?", [
//         id,
//       ]);

//       res.json({ success: true, message: "User deleted successfully" });
//     } catch (error) {
//       console.error("Delete user error:", error);
//       res.status(500).json({ error: "Internal server error" });
//     }
//   }
// );

// export default router;
