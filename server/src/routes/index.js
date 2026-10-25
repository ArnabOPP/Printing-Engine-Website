import { Router } from 'express';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

router.get('/hello', (req, res) => {
  res.json({ message: 'Hello from the Node.js API!' });
});

export default router;
