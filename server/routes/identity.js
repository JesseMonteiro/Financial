import { Router } from 'express';
import { checkAuth, loadPluggyClient } from '../middleware/auth.js';
import { cacheMiddleware } from '../middleware/cache.js';

const router = Router();

router.get('/', checkAuth, loadPluggyClient, cacheMiddleware(3600), async (req, res) => {
  try {
    const client = req.pluggyClient;
    const { itemId } = req.query;

    if (!itemId) {
      return res.status(400).json({ error: 'itemId é obrigatório' });
    }

    if (!req.pluggyItemIds.includes(itemId)) {
      return res.status(403).json({ error: 'Acesso negado para este item ID' });
    }

    const response = await client.get('/identity', { params: { itemId } });
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
  }
});

export default router;
