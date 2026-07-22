import { getPluggyApiKey } from '../services/tokenManager.js';

export async function checkPluggyAuth(req, res, next) {
  try {
    const apiKey = await getPluggyApiKey();
    if (!apiKey) {
      return res.status(401).json({
        error: 'Credenciais Pluggy não configuradas',
        message: 'Por favor, configure PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET no arquivo .env'
      });
    }
    req.pluggyApiKey = apiKey;
    next();
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
