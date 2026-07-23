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

// GET /api/bills (List all bills for an account)
router.get('/', checkAuth, loadPluggyClient, cacheMiddleware(3600), async (req, res) => {
  try {
    const client = req.pluggyClient;
    const { accountId } = req.query;

    if (!accountId) {
      return res.status(400).json({ error: 'accountId é obrigatório' });
    }

    // Verify account ownership
    const userAccounts = await fetchUserAccounts(client, req.pluggyItemIds);
    if (!userAccounts.some(a => a.id === accountId)) {
      return res.status(403).json({ error: 'Acesso negado para esta conta' });
    }

    const response = await client.get('/bills', { params: { accountId } });
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
  }
});

// GET /api/bills/:id
router.get('/:id', checkAuth, loadPluggyClient, cacheMiddleware(3600), async (req, res) => {
  try {
    const client = req.pluggyClient;
    const response = await client.get(`/bills/${req.params.id}`);
    const bill = response.data;

    // Verify ownership of the account linked to this bill
    if (bill && bill.accountId) {
      const userAccounts = await fetchUserAccounts(client, req.pluggyItemIds);
      if (!userAccounts.some(a => a.id === bill.accountId)) {
        return res.status(403).json({ error: 'Acesso negado para esta fatura' });
      }
    } else {
      return res.status(404).json({ error: 'Fatura não encontrada' });
    }

    res.json(bill);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
  }
});

// GET /api/bills/:id/transactions
router.get('/:id/transactions', checkAuth, loadPluggyClient, cacheMiddleware(3600), async (req, res) => {
  try {
    const client = req.pluggyClient;
    
    // Fetch bill first to check ownership
    const billResponse = await client.get(`/bills/${req.params.id}`);
    const bill = billResponse.data;

    if (bill && bill.accountId) {
      const userAccounts = await fetchUserAccounts(client, req.pluggyItemIds);
      if (!userAccounts.some(a => a.id === bill.accountId)) {
        return res.status(403).json({ error: 'Acesso negado para esta fatura' });
      }
    } else {
      return res.status(404).json({ error: 'Fatura não encontrada' });
    }

    const response = await client.get(`/bills/${req.params.id}/transactions`);
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
  }
});

export default router;
