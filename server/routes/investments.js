import { Router } from 'express';
import { checkAuth, loadPluggyClient } from '../middleware/auth.js';
import { cacheMiddleware } from '../middleware/cache.js';

const router = Router();

// GET /api/investments
router.get('/', checkAuth, loadPluggyClient, cacheMiddleware(3600), async (req, res) => {
  try {
    const client = req.pluggyClient;
    const { itemId, type } = req.query;

    let targetItemIds = [];
    if (itemId) {
      if (!req.pluggyItemIds.includes(itemId)) {
        return res.status(403).json({ error: 'Acesso negado para este item ID' });
      }
      targetItemIds = [itemId];
    } else {
      targetItemIds = req.pluggyItemIds;
    }

    if (targetItemIds.length === 0) {
      return res.json({ results: [], total: 0 });
    }

    const allInvestments = [];
    const promises = targetItemIds.map(async (id) => {
      try {
        const params = { itemId: id };
        if (type) params.type = type;
        const response = await client.get('/investments', { params });
        const list = response.data.results || response.data || [];
        return Array.isArray(list) ? list : [];
      } catch (e) {
        console.warn(`[Investments Proxy] Erro ao buscar investimentos do item ${id}:`, e.message);
        return [];
      }
    });

    const results = await Promise.all(promises);
    results.forEach(list => allInvestments.push(...list));

    res.json({ results: allInvestments, total: allInvestments.length });
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
  }
});

// GET /api/investments/:id
router.get('/:id', checkAuth, loadPluggyClient, cacheMiddleware(3600), async (req, res) => {
  try {
    const client = req.pluggyClient;
    const response = await client.get(`/investments/${req.params.id}`);
    const investment = response.data;

    // Verify ownership
    if (!investment || !req.pluggyItemIds.includes(investment.itemId)) {
      return res.status(403).json({ error: 'Acesso negado para este investimento' });
    }

    res.json(investment);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
  }
});

export default router;
