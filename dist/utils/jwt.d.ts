import jwt from "jsonwebtoken";
declare const ACCESS_EXPIRES_IN: string;
declare const REFRESH_EXPIRES_IN: string;
export declare function signAccessToken(payload: object): string;
export declare function signRefreshToken(payload: object): string;
export declare function verifyToken(token: string): string | jwt.JwtPayload;
export { ACCESS_EXPIRES_IN, REFRESH_EXPIRES_IN };
//# sourceMappingURL=jwt.d.ts.map