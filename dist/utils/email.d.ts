export declare const sendEmail: (to: string, subject: string, text: string, html?: string) => Promise<void>;
export declare const sendPasswordResetEmail: (email: string, resetToken: string) => Promise<void>;
export declare const sendEmailVerification: (email: string, verificationToken: string) => Promise<void>;
export declare const sendMagicLinkEmail: (email: string, magicToken: string) => Promise<void>;
export declare const sendOrderIdEmail: (email: string, orderId: string, serviceTitle: string, serviceImage?: string) => Promise<void>;
//# sourceMappingURL=email.d.ts.map