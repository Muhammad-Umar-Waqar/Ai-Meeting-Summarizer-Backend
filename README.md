# Ai-Meeting-Summarizer-Backend

Backend API for AI Meeting Summarizer powered by Node.js, Express, MongoDB (Atlas), Mongoose, Nodemailer, and JWT.

## Features
- **User Authentication**: Secure signup with bcrypt password hashing and 7-day JWT tokens.
- **Email OTP Verification**: 6-digit email OTP generation and validation using Nodemailer (Gmail SMTP).
- **Session Protection**: Express `requireAuth` middleware verifying Bearer tokens.
- **RESTful Endpoints**: `/api/auth/register`, `/api/auth/verify-otp`, `/api/auth/resend-otp`, `/api/auth/login`, `/api/auth/me`.
- **Health Check**: `/health` endpoint for uptime monitoring.

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the root of the backend folder based on `.env.example`:
```env
PORT=5000
MONGODB_URI=your_mongodb_atlas_connection_string
JWT_SECRET=your_jwt_secret_key
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_email_app_password
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

### 3. Run Development Server
```bash
npm run dev
```

### 4. Production (PM2)
```bash
pm2 start ecosystem.config.cjs
```
