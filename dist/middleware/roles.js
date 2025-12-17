"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = requireRole;
/**
 * requireRole('admin') or requireRole('provider')
 */
function requireRole(...allowed) {
    return (req, res, next) => {
        const user = req.user;
        if (!user)
            return res.status(401).json({ error: "Unauthorized" });
        if (!allowed.includes(user.role)) {
            return res.status(403).json({ error: "Forbidden - insufficient role" });
        }
        return next();
    };
}
//# sourceMappingURL=roles.js.map