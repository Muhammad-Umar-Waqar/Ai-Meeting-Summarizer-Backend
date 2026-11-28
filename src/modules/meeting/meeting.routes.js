import { Router } from 'express';
import {
  createInstantMeeting,
  scheduleMeeting,
  getMeetingInfo,
  verifyMeetingPasscode,
  updateMeetingSettings,
} from './meeting.controller.js';
import { requireAuth, optionalAuth } from '../../middleware/auth.middleware.js';

const router = Router();

// Create new instant meeting
router.post('/instant', requireAuth, createInstantMeeting);

// Schedule a meeting for later
router.post('/schedule', requireAuth, scheduleMeeting);

// Get meeting information by room code
router.get('/:code', optionalAuth, getMeetingInfo);

// Verify passcode for secured room
router.post('/:code/verify-passcode', verifyMeetingPasscode);

// Update room settings (host only)
router.patch('/:code/settings', requireAuth, updateMeetingSettings);

export default router;
