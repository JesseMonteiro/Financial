import { Router } from 'express';
import { createPluggyClient } from '../services/pluggyClient.js';
import { cacheMiddleware } from '../middleware/cache.js';
import { getItemIds, addItemId } from '../services/itemRegistry.js';

const router = Router();

// GET /api/investments
router.get('/', cacheMiddleware(180), async (req, res) => {
  try {
    const client = await createPluggyClient();
    const { itemId, type } = req.query;

    let targetItemIds = [];
    if (itemId) {
      targetItemIds = [itemId];
    } else {
      try {
        const itemsRes = await client.get('/items');
        const items = itemsRes.data.results || itemsRes.data || [];
        if (Array.isArray(items) && items.length > 0) {
          items.forEach(i => i.id && addItemId(i.id));
        }
      } catch (e) {}
      targetItemIds = getItemIds();
    }

    const allInvestments = [];
    for (const id of targetItemIds) {
      try {
        const params = { itemId: id };
        if (type) params.type = type;
        const response = await client.get('/investments', { params });
        const list = response.data.results || response.data || [];
        if (Array.isArray(list)) {
          allInvestments.push(...list);
        }
      } catch (e) {
        console.warn(`[Investments Proxy] Erro ao buscar investimentos do item ${id}:`, e.message);
      }
    }

    res.json({ results: allInvestments, total: allInvestments.length });
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
  }
});

// GET /api/investments/:id
router.get('/:id', cacheMiddleware(300), async (req, res) => {
  try {
    const client = await createPluggyClient();
    const response = await client.get(`/investments/${req.params.id}`);
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
  }
});

export default router;
