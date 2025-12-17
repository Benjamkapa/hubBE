"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.REFRESH_EXPIRES_IN = exports.ACCESS_EXPIRES_IN = void 0;
exports.signAccessToken = signAccessToken;
exports.signRefreshToken = signRefreshToken;
exports.verifyToken = verifyToken;
// src/utils/jwt.ts
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const ACCESS_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || "15m";
exports.ACCESS_EXPIRES_IN = ACCESS_EXPIRES_IN;
const REFRESH_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || "7d";
exports.REFRESH_EXPIRES_IN = REFRESH_EXPIRES_IN;
const SECRET = process.env.JWT_SECRET || "please_change_this";
function signAccessToken(payload) {
    return jsonwebtoken_1.default.sign(payload, SECRET, {
        expiresIn: ACCESS_EXPIRES_IN,
    });
}
function signRefreshToken(payload) {
    return jsonwebtoken_1.default.sign(payload, SECRET, {
        expiresIn: REFRESH_EXPIRES_IN,
    });
}
function verifyToken(token) {
    return jsonwebtoken_1.default.verify(token, SECRET);
}
//# sourceMappingURL=jwt.js.map