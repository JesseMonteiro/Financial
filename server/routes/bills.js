import { Router } from 'express';
import { createPluggyClient } from '../services/pluggyClient.js';
import { cacheMiddleware } from '../middleware/cache.js';

const router = Router();

// GET /api/bills (List all bills for an account)
router.get('/', cacheMiddleware(180), async (req, res) => {
  try {
    const client = await createPluggyClient();
    const { accountId } = req.query;
    const params = {};
    if (accountId) params.accountId = accountId;

    const response = await client.get('/bills', { params });
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
  }
});

// GET /api/bills/:id
router.get('/:id', cacheMiddleware(300), async (req, res) => {
  try {
    const client = await createPluggyClient();
    const response = await client.get(`/bills/${req.params.id}`);
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
  }
});

// GET /api/bills/:id/transactions
router.get('/:id/transactions', cacheMiddleware(300), async (req, res) => {
  try {
    const client = await createPluggyClient();
    const response = await client.get(`/bills/${req.params.id}/transactions`);
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
  }
});

export default router;
