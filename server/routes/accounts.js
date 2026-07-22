import { Router } from 'express';
import { checkAuth, loadPluggyClient } from '../middleware/auth.js';
import { cacheMiddleware } from '../middleware/cache.js';

const router = Router();

// GET /api/accounts
router.get('/', checkAuth, loadPluggyClient, cacheMiddleware(180), async (req, res) => {
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

    // Fetch accounts in parallel for all target items
    const promises = targetItemIds.map(async (id) => {
      try {
        const params = { itemId: id };
        if (type) params.type = type;

        const res = await client.get('/accounts', { params });
        const list = res.data.results || res.data || [];
        return Array.isArray(list) ? list : [];
      } catch (e) {
        console.warn(`[Accounts Proxy] Erro ao buscar contas do itemId ${id}:`, e.response?.data || e.message);
        return [];
      }
    });

    const results = await Promise.all(promises);
    const allAccounts = results.flat();

    res.json({ results: allAccounts, total: allAccounts.length });
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
  }
});

// GET /api/accounts/:id
router.get('/:id', checkAuth, loadPluggyClient, cacheMiddleware(300), async (req, res) => {
  try {
    const client = req.pluggyClient;
    const response = await client.get(`/accounts/${req.params.id}`);
    const account = response.data;

    // Verify ownership of the item ID that owns this account
    if (!account || !req.pluggyItemIds.includes(account.itemId)) {
      return res.status(403).json({ error: 'Acesso negado para esta conta' });
    }

    res.json(account);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
  }
});

export default router;
