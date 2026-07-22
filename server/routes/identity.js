import { Router } from 'express';
import { createPluggyClient } from '../services/pluggyClient.js';
import { cacheMiddleware } from '../middleware/cache.js';

const router = Router();

router.get('/', cacheMiddleware(3600), async (req, res) => {
  try {
    const client = await createPluggyClient();
    const { itemId } = req.query;
    const params = {};
    if (itemId) params.itemId = itemId;

    const response = await client.get('/identity', { params });
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
  }
});

export default router;
