import { Router } from 'express';

const router = Router();

// Milestone 2+: auth / profile
router.get('/', (_req, res) => {
  res.json({ message: 'Users module scaffold — not implemented yet' });
});

export default router;
