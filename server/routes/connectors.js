import { Router } from 'express';
import { checkAuth, loadPluggyClient } from '../middleware/auth.js';
import { cacheMiddleware } from '../middleware/cache.js';

const router = Router();

router.get('/', checkAuth, loadPluggyClient, cacheMiddleware(86400), async (req, res) => {
  try {
    const client = req.pluggyClient;
    const { name, countries } = req.query;
    // Pluggy expects a form-style string (countries=BR), not countries[]=BR.
    const countryParam = Array.isArray(countries) ? countries[0] : countries;
    const params = { countries: countryParam || 'BR' };
    if (name) params.name = name;

    const response = await client.get('/connectors', { params });
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
  }
});

router.get('/:id', checkAuth, loadPluggyClient, cacheMiddleware(86400), async (req, res) => {
  try {
    const client = req.pluggyClient;
    const response = await client.get(`/connectors/${req.params.id}`);
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
  }
});

export default router;
