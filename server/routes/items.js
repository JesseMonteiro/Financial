import { Router } from 'express';
import { createPluggyClient } from '../services/pluggyClient.js';
import { cacheMiddleware, clearCache } from '../middleware/cache.js';

const router = Router();

// GET /api/items
router.get('/', cacheMiddleware(300), async (req, res) => {
  try {
    const client = await createPluggyClient();
    const response = await client.get('/items');
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
  }
});

// GET /api/items/:id
router.get('/:id', cacheMiddleware(60), async (req, res) => {
  try {
    const client = await createPluggyClient();
    const response = await client.get(`/items/${req.params.id}`);
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
  }
});

// PATCH /api/items/:id (Force refresh)
router.patch('/:id', async (req, res) => {
  try {
    const client = await createPluggyClient();
    const response = await client.patch(`/items/${req.params.id}`, req.body);
    clearCache();
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
  }
});

// DELETE /api/items/:id
router.delete('/:id', async (req, res) => {
  try {
    const client = await createPluggyClient();
    await client.delete(`/items/${req.params.id}`);
    clearCache();
    res.json({ success: true, message: 'Conexão removida com sucesso' });
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
  }
});

// POST /api/items/connect-token (Create connect token for Pluggy Connect Widget)
router.post('/connect-token', async (req, res) => {
  try {
    const client = await createPluggyClient();
    const { itemId } = req.body;
    const response = await client.post('/connect_token', itemId ? { itemId } : {});
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
  }
});

export default router;
