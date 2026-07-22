import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const tokenCache = new Map();

export async function getPluggyApiKey(clientId, clientSecret) {
  const cid = clientId || process.env.PLUGGY_CLIENT_ID;
  const secret = clientSecret || process.env.PLUGGY_CLIENT_SECRET;

  if (!cid || !secret) {
    console.warn('[Pluggy Auth] PLUGGY_CLIENT_ID ou PLUGGY_CLIENT_SECRET não configurados.');
    return null;
  }

  const cacheKey = `${cid}:${secret}`;
  const cached = tokenCache.get(cacheKey);

  // Retorna o token em cache se ainda for válido (com 5 min de margem de segurança)
  if (cached && Date.now() < cached.expiresAt - 5 * 60 * 1000) {
    return cached.apiKey;
  }

  try {
    console.log(`[Pluggy Auth] Requisitando nova chave de API da Pluggy para ${cid.slice(0, 8)}...`);
    const response = await axios.post('https://api.pluggy.ai/auth', {
      clientId: cid,
      clientSecret: secret,
    });

    const apiKey = response.data.apiKey;
    const expiresAt = Date.now() + 7200 * 1000; // Pluggy API keys expire in 2 hours

    tokenCache.set(cacheKey, { apiKey, expiresAt });
    console.log(`[Pluggy Auth] Chave obtida com sucesso para ${cid.slice(0, 8)}`);

    return apiKey;
  } catch (error) {
    console.error('[Pluggy Auth Error]', error.response?.data || error.message);
    throw new Error('Falha ao autenticar com Pluggy.ai. Verifique as credenciais.');
  }
}
