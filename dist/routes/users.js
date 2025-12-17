"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const db_1 = require("../config/db");
const auth_1 = require("../middleware/auth");
const roles_1 = require("../middleware/roles");
const router = express_1.default.Router();
// Admin: list users with pagination
router.get("/", auth_1.requireAuth, (0, roles_1.requireRole)("admin"), async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const role = req.query.role;
        if (page < 1 || limit < 1) {
            return res.status(400).json({ error: "Invalid pagination parameters" });
        }
        const offset = (page - 1) * limit;
        const whereClause = role ? "WHERE role = ?" : "";
        const params = role ? [role] : [];
        const [rows] = await db_1.pool.query(`SELECT id, email, display_name, phone, role, email_verified, created_at, updated_at FROM profiles ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
        const [countRows] = await db_1.pool.query(`SELECT COUNT(*) as total FROM profiles ${whereClause}`, params);
        const total = countRows[0].total;
        res.json({
            users: rows,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        });
    }
    catch (error) {
        console.error("List users error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// Admin: get user by ID
router.get("/:id", auth_1.requireAuth, (0, roles_1.requireRole)("admin"), async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db_1.pool.query("SELECT id, email, display_name, phone, role, email_verified, created_at, updated_at FROM profiles WHERE id = ? AND deleted_at IS NULL", [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }
        res.json({ user: rows[0] });
    }
    catch (error) {
        console.error("Get user by ID error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// Admin: delete user (soft delete)
router.delete("/:id", auth_1.requireAuth, (0, roles_1.requireRole)("admin"), async (req, res) => {
    try {
        const { id } = req.params;
        // Prevent self-deletion
        if (req.user.userId === id) {
            return res
                .status(400)
                .json({ error: "Cannot delete your own account" });
        }
        // Check if user exists
        const [userRows] = await db_1.pool.query("SELECT id FROM profiles WHERE id = ?", [id]);
        if (userRows.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }
        // Check for services owned by user
        const [serviceRows] = await db_1.pool.query("SELECT COUNT(*) as count FROM services WHERE owner_id = ? AND deleted_at IS NULL", [id]);
        if (serviceRows[0].count > 0) {
            return res.status(409).json({
                error: "Cannot delete user with active services. Delete services first.",
            });
        }
        // Soft delete: set a deleted_at timestamp
        await db_1.pool.query("UPDATE profiles SET deleted_at = NOW() WHERE id = ?", [
            id,
        ]);
        res.json({ success: true, message: "User deleted successfully" });
    }
    catch (error) {
        console.error("Delete user error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
exports.default = router;
//# sourceMappingURL=users.js.map