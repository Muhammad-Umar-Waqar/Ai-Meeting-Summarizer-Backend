import { Router } from 'express';

const router = Router();

// Milestone 2+: create / join / get meeting
router.get('/', (_req, res) => {
  res.json({ message: 'Meetings module scaffold — not implemented yet' });
});

export default router;
