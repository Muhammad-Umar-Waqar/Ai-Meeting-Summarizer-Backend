import { Router } from 'express';
import {
  register,
  verifyOtp,
  resendOtp,
  login,
  getMe,
} from './auth.controller.js';
import { requireAuth } from '../../middleware/auth.middleware.js';

const router = Router();

router.post('/register', register);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);
router.post('/login', login);
router.get('/me', requireAuth, getMe);

export default router;
