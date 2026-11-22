import { Router } from 'express';
import meetingRoutes from '../modules/meeting/meeting.routes.js';
import userRoutes from '../modules/user/user.routes.js';
import summaryRoutes from '../modules/summary/summary.routes.js';
import authRoutes from '../modules/auth/auth.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/meetings', meetingRoutes);
router.use('/users', userRoutes);
router.use('/summaries', summaryRoutes);

export default router;
