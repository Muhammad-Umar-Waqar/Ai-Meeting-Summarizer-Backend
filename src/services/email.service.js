import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendOtpEmail = async (to, name, otp) => {
  const appName = 'AI Meeting Summarizer';
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Email Verification</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          background-color: #f4f6f8;
          margin: 0;
          padding: 24px;
          color: #1f2937;
        }
        .container {
          max-width: 540px;
          margin: 0 auto;
          background: #ffffff;
          border-radius: 16px;
          padding: 36px 32px;
          border: 1px solid #e5e7eb;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 24px;
        }
        .brand-badge {
          background: linear-gradient(135deg, #1a73e8 0%, #0d47a1 100%);
          color: #ffffff;
          font-weight: 700;
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 14px;
          letter-spacing: 0.5px;
          display: inline-block;
        }
        h1 {
          font-size: 22px;
          font-weight: 600;
          color: #111827;
          margin: 0 0 12px;
        }
        p {
          font-size: 15px;
          line-height: 1.6;
          color: #4b5563;
          margin: 0 0 20px;
        }
        .otp-box {
          background: #f0f7ff;
          border: 2px dashed #93c5fd;
          border-radius: 12px;
          padding: 20px;
          text-align: center;
          margin: 28px 0;
        }
        .otp-code {
          font-size: 36px;
          font-weight: 700;
          letter-spacing: 8px;
          color: #1a73e8;
          font-family: 'Courier New', Courier, monospace;
        }
        .hint {
          font-size: 13px;
          color: #6b7280;
          margin-top: 8px;
        }
        .footer {
          margin-top: 32px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          font-size: 12px;
          color: #9ca3af;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="brand">
          <span class="brand-badge">${appName}</span>
        </div>
        <h1>Verify your email address</h1>
        <p>Hi <strong>${name || 'there'}</strong>,</p>
        <p>Thank you for signing up for ${appName}. Use the 6-digit verification code below to complete your registration:</p>
        <div class="otp-box">
          <div class="otp-code">${otp}</div>
          <div class="hint">This code will expire in 10 minutes.</div>
        </div>
        <p>If you didn't create an account with ${appName}, you can safely disregard this email.</p>
        <div class="footer">
          &copy; ${new Date().getFullYear()} ${appName}. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: `"${appName}" <${process.env.SMTP_USER}>`,
    to,
    subject: `Your ${appName} Verification Code: ${otp}`,
    html: htmlContent,
  });

  return true;
};

export default { sendOtpEmail };
