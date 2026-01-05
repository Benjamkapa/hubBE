"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendOrderIdEmail = exports.sendMagicLinkEmail = exports.sendEmailVerification = exports.sendPasswordResetEmail = exports.sendEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const transporter = nodemailer_1.default.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});
const sendEmail = async (to, subject, text, html) => {
    try {
        const mailOptions = {
            from: process.env.SMTP_FROM,
            to,
            subject,
            text,
            html,
        };
        await transporter.sendMail(mailOptions);
        console.log(`Email sent successfully to ${to}`);
    }
    catch (error) {
        console.error(`Failed to send email to ${to}:`, error);
        throw error; // Re-throw to handle in caller
    }
};
exports.sendEmail = sendEmail;
const sendPasswordResetEmail = async (email, resetToken) => {
    const resetUrl = `${process.env.FRONTEND_URL}/auth/update-password?token=${resetToken}`;
    const currentYear = new Date().getFullYear();
    const subject = "Reset Your HudumaHub Password";
    const text = `We received a request to reset the password for your HudumaHub account. Click the link to set a new password: ${resetUrl}`;
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your HudumaHub Password</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
            line-height: 1.6;
        }
        .email-container {
            max-width: 600px;
            margin: 40px auto;
            background-color: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .email-header {
            background-color: #f0f0f0;
            color: #000;
            padding: 20px;
            text-align: center;
        }
        .email-body {
            padding: 30px;
            text-align: center;
        }
        .reset-button {
            display: inline-block;
            background-color: #ff6b00;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            margin-top: 20px;
            font-weight: bold;
            transition: background-color 0.3s ease;
        }
        .reset-button:hover {
            background-color: #ff8b00;
        }
        .email-footer {
            background-color: #f4f4f4;
            color: #666;
            text-align: center;
            padding: 15px;
            font-size: 12px;
        }
        .security-note {
            background-color: #f0f0f0;
            border-radius: 6px;
            padding: 15px;
            margin-top: 20px;
            font-size: 14px;
            color: #333;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="email-header">
            <h1>Reset Your Password</h1>
        </div>
        <div class="email-body">
            <p>We received a request to reset the password for your HudumaHub account. Click the button below to set a new password.</p>
            <a href="${resetUrl}" class="reset-button">Reset Password</a>
            <p style="margin-top: 30px; font-size: 14px; color: #666;">
                Not expecting this email? No worries! Your account is safe.
            </p>
        </div>
        <div class="email-footer">
            © ${currentYear} HudumaHub. All rights reserved.
        </div>
    </div>
</body>
</html>`;
    await (0, exports.sendEmail)(email, subject, text, html);
};
exports.sendPasswordResetEmail = sendPasswordResetEmail;
const sendEmailVerification = async (email, verificationToken) => {
    const backendUrl = process.env.BACKEND_URL;
    const verificationUrl = `${backendUrl}/api/auth/verify-email`;
    const currentYear = new Date().getFullYear();
    const subject = "Verify Your HudumaHub Account";
    const text = `Welcome to HudumaHub! Please verify your email address by clicking this link: ${verificationUrl}`;
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your HudumaHub Account</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
            line-height: 1.6;
        }
        .email-container {
            max-width: 600px;
            margin: 40px auto;
            background-color: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .email-header {
            background-color: #f0f0f0;
            color: #000;
            padding: 20px;
            text-align: center;
        }
        .email-body {
            padding: 30px;
            text-align: center;
        }
        .verify-form {
            display: inline;
        }
        .verify-button {
            background-color: #ff6b00;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 6px;
            margin-top: 20px;
            font-weight: bold;
            cursor: pointer;
            transition: background-color 0.3s ease;
        }
        .verify-button:hover {
            background-color: #ff8b00;
        }
        .email-footer {
            background-color: #f4f4f4;
            color: #666;
            text-align: center;
            padding: 15px;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="email-header">
            <h1>Welcome to HudumaHub!</h1>
        </div>
        <div class="email-body">
            <p>Thank you for signing up! Please verify your email address to activate your account.</p>
            <form action="${verificationUrl}" method="POST" class="verify-form">
                <input type="hidden" name="token" value="${verificationToken}">
                <button type="submit" class="verify-button">Verify Email</button>
            </form>
            <p style="margin-top: 30px; font-size: 14px; color: #666;">
                If you didn't create an account, you can safely ignore this email.
            </p>
        </div>
        <div class="email-footer">
            © ${currentYear} HudumaHub. All rights reserved.
        </div>
    </div>
</body>
</html>`;
    await (0, exports.sendEmail)(email, subject, text, html);
};
exports.sendEmailVerification = sendEmailVerification;
const sendMagicLinkEmail = async (email, magicToken) => {
    const magicUrl = `${process.env.FRONTEND_URL}/magic-login?token=${magicToken}`;
    const currentYear = new Date().getFullYear();
    const subject = "Your HudumaHub Magic Link";
    const text = `Click this link to sign in to your HudumaHub account: ${magicUrl}`;
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your HudumaHub Magic Link</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
            line-height: 1.6;
        }
        .email-container {
            max-width: 600px;
            margin: 40px auto;
            background-color: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .email-header {
            background-color: #f0f0f0;
            color: #000;
            padding: 20px;
            text-align: center;
        }
        .email-body {
            padding: 30px;
            text-align: center;
        }
        .magic-button {
            display: inline-block;
            background-color: #ff6b00;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            margin-top: 20px;
            font-weight: bold;
            transition: background-color 0.3s ease;
        }
        .magic-button:hover {
            background-color: #ff8b00;
        }
        .email-footer {
            background-color: #f4f4f4;
            color: #666;
            text-align: center;
            padding: 15px;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="email-header">
            <h1>Magic Link Login</h1>
        </div>
        <div class="email-body">
            <p>Click the button below to sign in to your HudumaHub account instantly.</p>
            <a href="${magicUrl}" class="magic-button">Sign In</a>
            <p style="margin-top: 30px; font-size: 14px; color: #666;">
                This link will expire in 15 minutes for security reasons.
            </p>
        </div>
        <div class="email-footer">
            © ${currentYear} HudumaHub. All rights reserved.
        </div>
    </div>
</body>
</html>`;
    await (0, exports.sendEmail)(email, subject, text, html);
};
exports.sendMagicLinkEmail = sendMagicLinkEmail;
const sendOrderIdEmail = async (email, orderId, serviceTitle, serviceImage) => {
    const currentYear = new Date().getFullYear();
    const subject = "Your HudumaHub Order ID";
    const text = `Your order ID is: ${orderId}`;
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Your HudumaHub Order</title>

<style>
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: #f5f5f5;
    padding: 0;
    margin: 0;
  }

  .email-container {
    max-width: 600px;
    margin: 40px auto;
    background: #ffffff;
    border-radius: 14px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    overflow: hidden;
  }

  .header {
    background: #ff6b00;
    padding: 25px;
    text-align: center;
    color: #ffffff;
  }

  .header h1 {
    margin: 0;
    font-size: 22px;
    font-weight: 700;
  }

  .body {
    padding: 30px;
    color: #333;
  }

  .order-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 20px;
    background: #fafafa;
    border-radius: 10px;
    overflow: hidden;
  }

  .order-table td {
    padding: 18px;
    vertical-align: top;
  }

  .service-img {
    width: 160px;
    height: 160px;
    object-fit: cover;
    border-radius: 10px;
    border: 1px solid #eee;
  }

  .order-id-box {
    background: #f0f0f0;
    padding: 15px;
    border-radius: 10px;
    text-align: center;
    font-size: 18px;
    font-weight: 600;
    letter-spacing: 0.5px;
    word-break: break-all;
  }

  .copy-btn {
    margin-top: 12px;
    display: inline-block;
    padding: 10px 16px;
    background: #ff6b00;
    color: #fff;
    text-decoration: none;
    border-radius: 6px;
    font-weight: 600;
    font-size: 14px;
  }

  .footer {
    padding: 15px;
    font-size: 12px;
    color: #777;
    text-align: center;
    background: #f2f2f2;
  }
</style>

</head>

<body>

<div class="email-container">

  <div class="header">
    <h1>Your HudumaHub Order ID</h1>
  </div>

  <div class="body">
    <p>Thank you for placing your order with HudumaHub. Below are your order details:</p>

    <table class="order-table">
      <tr>
        <td width="50%">
          ${serviceImage
        ? `<img src="${serviceImage}" class="service-img" alt="${serviceTitle}" />`
        : `<div style="font-size:14px; color:#999;">No image available</div>`}
          <p style="margin-top:10px; font-size:16px; font-weight:600;">${serviceTitle}</p>
        </td>

        <td width="50%">
          <div class="order-id-box">${orderId}</div>

          <p style="margin-top:8px; font-size:13px; color:#777;">
            Use this Order ID to track your service progress.
          </p>
        </td>
      </tr>
    </table>
  </div>

  <div class="footer">
    © ${currentYear} HudumaHub. All rights reserved.
  </div>

</div>

</body>
</html>`;
    await (0, exports.sendEmail)(email, subject, text, html);
};
exports.sendOrderIdEmail = sendOrderIdEmail;
//# sourceMappingURL=email.js.map