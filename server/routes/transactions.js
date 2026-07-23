import { Router } from 'express';
import { checkAuth, loadPluggyClient } from '../middleware/auth.js';
import { cacheMiddleware } from '../middleware/cache.js';

const router = Router();

// Helper to fetch user accounts
async function fetchUserAccounts(client, itemIds) {
  const promises = itemIds.map(async (itemId) => {
    try {
      const res = await client.get('/accounts', { params: { itemId } });
      return res.data.results || res.data || [];
    } catch (e) {
      return [];
    }
  });
  const results = await Promise.all(promises);
  return results.flat();
}

// GET /api/transactions
router.get('/', checkAuth, loadPluggyClient, cacheMiddleware(3600), async (req, res) => {
  try {
    const client = req.pluggyClient;
    const { accountId, from, to, cursor } = req.query;

    if (req.pluggyItemIds.length === 0) {
      return res.json({ results: [], total: 0 });
    }

    let targetAccountIds = [];

    if (accountId) {
      // Verify account belongs to user
      const userAccounts = await fetchUserAccounts(client, req.pluggyItemIds);
      if (!userAccounts.some(a => a.id === accountId)) {
        return res.status(403).json({ error: 'Acesso negado para esta conta' });
      }
      targetAccountIds = [accountId];
    } else {
      // Fetch all accounts of the user to get their IDs
      const userAccounts = await fetchUserAccounts(client, req.pluggyItemIds);
      targetAccountIds = userAccounts.map(a => a.id);
    }

    if (targetAccountIds.length === 0) {
      return res.json({ results: [], total: 0 });
    }

    const allTransactions = [];
    const promises = targetAccountIds.map(async (accId) => {
      try {
        const params = { accountId: accId };
        if (from) params.from = from;
        if (to) params.to = to;
        if (cursor) params.cursor = cursor;

        const response = await client.get('/v2/transactions', { params });
        const results = response.data.results || response.data || [];
        return Array.isArray(results) ? results : [];
      } catch (e) {
        console.warn(`[Transactions Proxy] Erro ao buscar transações da conta ${accId}:`, e.response?.data || e.message);
        return [];
      }
    });

    const results = await Promise.all(promises);
    results.forEach(list => allTransactions.push(...list));

    res.json({ results: allTransactions, total: allTransactions.length });
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
  }
});

// GET /api/transactions/:id
router.get('/:id', checkAuth, loadPluggyClient, cacheMiddleware(3600), async (req, res) => {
  try {
    const client = req.pluggyClient;
    const response = await client.get(`/transactions/${req.params.id}`);
    const transaction = response.data;

    // Verify ownership
    if (transaction && transaction.accountId) {
      const userAccounts = await fetchUserAccounts(client, req.pluggyItemIds);
      if (!userAccounts.some(a => a.id === transaction.accountId)) {
        return res.status(403).json({ error: 'Acesso negado para esta transação' });
      }
    } else {
      return res.status(404).json({ error: 'Transação não encontrada' });
    }

    res.json(transaction);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
  }
});

// PATCH /api/transactions/:id (Category update)
router.patch('/:id', checkAuth, loadPluggyClient, async (req, res) => {
  try {
    const client = req.pluggyClient;
    
    // Fetch transaction first to verify ownership
    const txResponse = await client.get(`/transactions/${req.params.id}`);
    const transaction = txResponse.data;

    if (transaction && transaction.accountId) {
      const userAccounts = await fetchUserAccounts(client, req.pluggyItemIds);
      if (!userAccounts.some(a => a.id === transaction.accountId)) {
        return res.status(403).json({ error: 'Acesso negado para esta transação' });
      }
    } else {
      return res.status(404).json({ error: 'Transação não encontrada' });
    }

    const response = await client.patch(`/transactions/${req.params.id}`, req.body);
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
  }
});

export default router;
