import { Router } from 'express';
import { checkAuth, loadPluggyClient } from '../middleware/auth.js';
import { cacheMiddleware } from '../middleware/cache.js';

const router = Router();

// GET /api/loans
router.get('/', checkAuth, loadPluggyClient, cacheMiddleware(180), async (req, res) => {
  try {
    const client = req.pluggyClient;
    const { itemId } = req.query;

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

    const allLoans = [];
    const promises = targetItemIds.map(async (id) => {
      try {
        const response = await client.get('/loans', { params: { itemId: id } });
        const list = response.data.results || response.data || [];
        return Array.isArray(list) ? list : [];
      } catch (e) {
        console.warn(`[Loans Proxy] Erro ao buscar empréstimos do item ${id}:`, e.message);
        return [];
      }
    });

    const results = await Promise.all(promises);
    results.forEach(list => allLoans.push(...list));

    res.json({ results: allLoans, total: allLoans.length });
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
  }
});

// GET /api/loans/:id
router.get('/:id', checkAuth, loadPluggyClient, cacheMiddleware(300), async (req, res) => {
  try {
    const client = req.pluggyClient;
    const response = await client.get(`/loans/${req.params.id}`);
    const loan = response.data;

    // Verify ownership
    if (!loan || !req.pluggyItemIds.includes(loan.itemId)) {
      return res.status(403).json({ error: 'Acesso negado para este empréstimo' });
    }

    res.json(loan);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
  }
});

export default router;
