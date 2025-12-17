import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth";
/**
 * requireRole('admin') or requireRole('provider')
 */
export declare function requireRole(...allowed: string[]): (req: AuthRequest, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
//# sourceMappingURL=roles.d.ts.map