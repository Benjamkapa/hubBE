import { Request, Response, NextFunction } from "express";
export interface AuthRequest extends Request {
    user?: any;
}
/**
 * Protect routes - expects header: Authorization: Bearer <accessToken>
 */
export declare function requireAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
/**
 * Validate refresh token presence in DB (rotating tokens)
 */
export declare function validateRefreshToken(userId: string, token: string): Promise<boolean>;
//# sourceMappingURL=auth.d.ts.map