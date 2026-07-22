import { Router } from 'express';
import { createPluggyClient } from '../services/pluggyClient.js';
import { cacheMiddleware } from '../middleware/cache.js';
import { getItemIds, addItemId } from '../services/itemRegistry.js';

const router = Router();

// GET /api/transactions (using cursor-based /v2/transactions)
router.get('/', cacheMiddleware(120), async (req, res) => {
  try {
    const client = await createPluggyClient();
    const { accountId, from, to, cursor } = req.query;

    let targetAccountIds = [];

    if (accountId) {
      targetAccountIds = [accountId];
    } else {
      // If no accountId provided, fetch accounts first to get their IDs
      try {
        const itemIds = getItemIds();
        try {
          const itemsRes = await client.get('/items');
          const items = itemsRes.data.results || itemsRes.data || [];
          if (Array.isArray(items) && items.length > 0) {
            items.forEach(i => i.id && addItemId(i.id));
          }
        } catch (e) {}

        const uniqueItemIds = getItemIds();
        for (const itemId of uniqueItemIds) {
          try {
            const accRes = await client.get('/accounts', { params: { itemId } });
            const list = accRes.data.results || accRes.data || [];
            targetAccountIds.push(...list.map(a => a.id));
          } catch (e) {}
        }
      } catch (e) {
        console.warn('[Transactions Proxy] Erro ao listar contas para transações:', e.message);
      }
    }

    const allTransactions = [];
    for (const accId of targetAccountIds) {
      try {
        const params = { accountId: accId };
        if (from) params.from = from;
        if (to) params.to = to;
        if (cursor) params.cursor = cursor;

        const response = await client.get('/v2/transactions', { params });
        const results = response.data.results || response.data || [];
        if (Array.isArray(results)) {
          allTransactions.push(...results);
        }
      } catch (e) {
        console.warn(`[Transactions Proxy] Erro ao buscar transações da conta ${accId}:`, e.response?.data || e.message);
      }
    }

    res.json({ results: allTransactions, total: allTransactions.length });
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
  }
});

// GET /api/transactions/:id
router.get('/:id', cacheMiddleware(300), async (req, res) => {
  try {
    const client = await createPluggyClient();
    const response = await client.get(`/transactions/${req.params.id}`);
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
  }
});

// PATCH /api/transactions/:id (Category update)
router.patch('/:id', async (req, res) => {
  try {
    const client = await createPluggyClient();
    const response = await client.patch(`/transactions/${req.params.id}`, req.body);
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
  }
});

export default router;
