import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
export declare const signup: (req: AuthRequest, res: Response) => Promise<void>;
export declare const signin: (req: AuthRequest, res: Response) => Promise<void>;
export declare const signout: (req: AuthRequest, res: Response) => Promise<void>;
export declare const refresh: (req: AuthRequest, res: Response) => Promise<void>;
export declare const me: (req: AuthRequest, res: Response) => Promise<void>;
export declare const updatePassword: (req: AuthRequest, res: Response) => Promise<void>;
export declare const resetPassword: (req: Request, res: Response) => Promise<void>;
export declare const confirmResetPassword: (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=authController.d.ts.map