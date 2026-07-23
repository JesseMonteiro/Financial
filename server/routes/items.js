import { Router } from 'express';
import { checkAuth, loadPluggyClient } from '../middleware/auth.js';
import { cacheMiddleware, clearUserCache } from '../middleware/cache.js';

const router = Router();

// GET /api/items
router.get('/', checkAuth, loadPluggyClient, cacheMiddleware(3600), async (req, res) => {
  try {
    const client = req.pluggyClient;
    const userItemIds = req.pluggyItemIds;

    if (userItemIds.length === 0) {
      return res.json({ results: [], total: 0 });
    }

    const response = await client.get('/items');
    const items = response.data.results || response.data || [];
    const filteredItems = items.filter(i => userItemIds.includes(i.id));

    res.json({ results: filteredItems, total: filteredItems.length });
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
  }
});

// POST /api/items/register (Links a connected item ID to user profile)
router.post('/register', checkAuth, loadPluggyClient, async (req, res) => {
  try {
    const { itemId } = req.body;
    if (!itemId || typeof itemId !== 'string') {
      return res.status(400).json({ error: 'itemId é obrigatório' });
    }

    const currentItemIds = req.pluggyItemIds || [];
    if (!currentItemIds.includes(itemId)) {
      const updatedItemIds = [...currentItemIds, itemId];
      const { error } = await req.supabase
        .from('profiles')
        .upsert({ id: req.user.id, pluggy_item_ids: updatedItemIds }, { onConflict: 'id' });

      if (error) throw error;
      clearUserCache(req.user.id);
      return res.json({ success: true, message: 'Item registrado com sucesso', itemIds: updatedItemIds });
    }

    res.json({ success: true, message: 'Item já estava registrado', itemIds: currentItemIds });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/items/sync (Replace linked item IDs from Settings)
router.post('/sync', checkAuth, loadPluggyClient, async (req, res) => {
  try {
    const raw = req.body?.itemIds;
    let incoming = [];
    if (Array.isArray(raw)) {
      incoming = raw.filter((id) => typeof id === 'string' && id.length > 0);
    } else if (typeof raw === 'string') {
      incoming = raw
        .split(/[\s,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    }

    const uniqueIds = [...new Set(incoming)];
    const { error } = await req.supabase
      .from('profiles')
      .upsert({ id: req.user.id, pluggy_item_ids: uniqueIds }, { onConflict: 'id' });

    if (error) throw error;
    clearUserCache(req.user.id);
    res.json({
      success: true,
      message: `${uniqueIds.length} conexão(ões) vinculada(s) ao perfil.`,
      itemIds: uniqueIds,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/items/:id
router.get('/:id', checkAuth, loadPluggyClient, cacheMiddleware(3600), async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.pluggyItemIds.includes(id)) {
      return res.status(403).json({ error: 'Acesso negado para este item ID' });
    }

    const client = req.pluggyClient;
    const response = await client.get(`/items/${id}`);
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
  }
});

// PATCH /api/items/:id (Force refresh)
router.patch('/:id', checkAuth, loadPluggyClient, async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.pluggyItemIds.includes(id)) {
      return res.status(403).json({ error: 'Acesso negado para este item ID' });
    }

    const client = req.pluggyClient;
    const response = await client.patch(`/items/${id}`, req.body);
    clearUserCache(req.user.id);
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
  }
});

// DELETE /api/items/:id
router.delete('/:id', checkAuth, loadPluggyClient, async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.pluggyItemIds.includes(id)) {
      return res.status(403).json({ error: 'Acesso negado para este item ID' });
    }

    const client = req.pluggyClient;
    try {
      await client.delete(`/items/${id}`);
    } catch (err) {
      console.warn(`[Items delete] Erro ao remover da Pluggy (provavelmente já deletado): ${err.message}`);
    }

    const updatedItemIds = req.pluggyItemIds.filter(item => item !== id);
    const { error } = await req.supabase
      .from('profiles')
      .update({ pluggy_item_ids: updatedItemIds })
      .eq('id', req.user.id);

    if (error) throw error;

    clearUserCache(req.user.id);
    res.json({ success: true, message: 'Conexão removida com sucesso' });
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
  }
});

// POST /api/items/connect-token (Create connect token for Pluggy Connect Widget)
router.post('/connect-token', checkAuth, loadPluggyClient, async (req, res) => {
  try {
    const client = req.pluggyClient;
    const { itemId } = req.body;

    if (itemId && !req.pluggyItemIds.includes(itemId)) {
      return res.status(403).json({ error: 'Acesso negado para este item ID' });
    }

    const payload = {
      options: { clientUserId: req.user.id },
    };
    if (itemId) payload.itemId = itemId;

    const response = await client.post('/connect_token', payload);
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
  }
});

export default router;
