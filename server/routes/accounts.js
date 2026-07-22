import { Router } from 'express';
import { createPluggyClient } from '../services/pluggyClient.js';
import { cacheMiddleware } from '../middleware/cache.js';
import { getItemIds, addItemId } from '../services/itemRegistry.js';

const router = Router();

// Helper to fetch accounts for a given itemId or all items
async function fetchAccountsForItems(client, targetItemId, typeFilter) {
  let itemIds = [];

  if (targetItemId) {
    itemIds = [targetItemId];
    addItemId(targetItemId);
  } else {
    try {
      const itemsRes = await client.get('/items');
      const items = itemsRes.data.results || itemsRes.data || [];
      if (Array.isArray(items) && items.length > 0) {
        items.forEach(i => i.id && addItemId(i.id));
      }
    } catch (e) {
      console.warn('[Accounts Proxy] Erro ao listar items via GET /items:', e.message);
    }
    itemIds = getItemIds();
  }

  const allAccounts = [];
  for (const itemId of itemIds) {
    try {
      const params = { itemId };
      if (typeFilter) params.type = typeFilter;

      const res = await client.get('/accounts', { params });
      const list = res.data.results || res.data || [];
      if (Array.isArray(list)) {
        allAccounts.push(...list);
      }
    } catch (e) {
      console.warn(`[Accounts Proxy] Erro ao buscar contas do itemId ${itemId}:`, e.response?.data || e.message);
    }
  }

  return allAccounts;
}

// GET /api/accounts
router.get('/', cacheMiddleware(180), async (req, res) => {
  try {
    const client = await createPluggyClient();
    const { itemId, type } = req.query;

    const accounts = await fetchAccountsForItems(client, itemId, type);
    res.json({ results: accounts, total: accounts.length });
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
  }
});

// GET /api/accounts/:id
router.get('/:id', cacheMiddleware(300), async (req, res) => {
  try {
    const client = await createPluggyClient();
    const response = await client.get(`/accounts/${req.params.id}`);
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
  }
});

export default router;
