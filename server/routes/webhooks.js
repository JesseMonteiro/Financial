import { Router } from 'express';
import { checkAuth, loadPluggyClient } from '../middleware/auth.js';
import { cacheMiddleware, clearCache } from '../middleware/cache.js';

const router = Router();

// Store received webhook events in memory for UI debugging
const receivedEvents = [];

/**
 * 1. POST /api/webhooks (Público - Recebe os eventos disparados pela Pluggy.ai)
 * Coobre os eventos: item/created, item/updated, transactions/created, transactions/updated, transactions/deleted, etc.
 */
router.post('/', (req, res) => {
  const payload = req.body;
  console.log('[Pluggy Webhook Event Recebido]', JSON.stringify(payload, null, 2));

  // Armazena o evento para exibição na interface de debug
  receivedEvents.unshift({
    timestamp: new Date().toISOString(),
    event: payload.event || payload.type || 'desconhecido',
    itemId: payload.itemId || payload.id,
    data: payload
  });

  // Limita o histórico a 50 eventos
  if (receivedEvents.length > 50) receivedEvents.pop();

  // Quando dados novos chegam, invalida o cache do servidor para refletir no app
  if (['item/updated', 'item/created', 'transactions/created', 'transactions/updated'].includes(payload.event)) {
    clearCache(); // Invalida todo o cache para forçar recarga
  }

  // A Pluggy espera retorno HTTP 200 OK para confirmar o recebimento
  res.status(200).json({ status: 'success', message: 'Event received' });
});

/**
 * 2. GET /api/webhooks/history (Lista eventos recebidos recentemente)
 */
router.get('/history', checkAuth, (req, res) => {
  res.json(receivedEvents);
});

/**
 * 3. GET /api/webhooks/list (Lista webhooks cadastrados na API da Pluggy)
 */
router.get('/list', checkAuth, loadPluggyClient, async (req, res) => {
  try {
    const client = req.pluggyClient;
    const response = await client.get('/webhooks');
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
  }
});

/**
 * 4. POST /api/webhooks/register (Registra um novo Webhook na Pluggy)
 * Body esperado: { url: "https://sua-url-publica.ngrok-free.app/api/webhooks", event: "all" }
 */
router.post('/register', checkAuth, loadPluggyClient, async (req, res) => {
  try {
    const { url, event = 'all' } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'A URL do webhook é obrigatória' });
    }

    if (url.includes('localhost') || url.includes('127.0.0.1')) {
      return res.status(400).json({ 
        error: 'URL Inválida para a Pluggy.ai',
        message: 'A Pluggy exige uma URL pública HTTPS (ex: via ngrok ou domínio de produção). Endereços localhost não conseguem receber requisições de servidores externos.'
      });
    }

    const client = req.pluggyClient;
    const response = await client.post('/webhooks', {
      url,
      event // "all", "item/created", "item/updated", "transactions/created", etc.
    });

    res.json({
      success: true,
      message: `Webhook registrado com sucesso para o evento "${event}"!`,
      webhook: response.data
    });
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
  }
});

/**
 * 5. DELETE /api/webhooks/:id (Remove um Webhook cadastrado)
 */
router.delete('/:id', checkAuth, loadPluggyClient, async (req, res) => {
  try {
    const client = req.pluggyClient;
    await client.delete(`/webhooks/${req.params.id}`);
    res.json({ success: true, message: 'Webhook removido com sucesso' });
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
  }
});

export default router;
