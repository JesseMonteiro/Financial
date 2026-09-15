import { Router } from 'express';
import { checkAuth, loadPluggyClient } from '../middleware/auth.js';
import { cacheMiddleware } from '../middleware/cache.js';

const router = Router();

router.get('/', checkAuth, loadPluggyClient, cacheMiddleware(86400), async (req, res) => {
  try {
    const client = req.pluggyClient;
    const first = await client.get('/categories');
    const data = first.data;
    if (Array.isArray(data)) {
      return res.json({ results: data, total: data.length });
    }
    const results = [...(data?.results || [])];
    const totalPages = Number(data?.totalPages || 1);
    for (let page = 2; page <= totalPages && page <= 20; page++) {
      const next = await client.get('/categories', { params: { page } });
      results.push(...(next.data?.results || []));
    }
    res.json({ results, total: results.length, page: 1, totalPages: 1 });
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
  }
});

export default router;
