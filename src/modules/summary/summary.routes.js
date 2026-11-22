import { Router } from 'express';

const router = Router();

// Milestone 5+: AI summaries via Python ML service
router.get('/', (_req, res) => {
  res.json({ message: 'Summaries module scaffold — not implemented yet' });
});

export default router;
