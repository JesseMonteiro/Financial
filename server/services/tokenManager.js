import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

let cachedApiKey = null;
let tokenExpiresAt = null;

export async function getPluggyApiKey() {
  const clientId = process.env.PLUGGY_CLIENT_ID;
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.warn('[Pluggy Auth] PLUGGY_CLIENT_ID or PLUGGY_CLIENT_SECRET not configured in .env');
    return null;
  }

  // Return cached token if still valid (with 5 min safety buffer)
  if (cachedApiKey && tokenExpiresAt && Date.now() < tokenExpiresAt - 5 * 60 * 1000) {
    return cachedApiKey;
  }

  try {
    console.log('[Pluggy Auth] Requesting new API Key from Pluggy...');
    const response = await axios.post('https://api.pluggy.ai/auth', {
      clientId,
      clientSecret,
    });

    cachedApiKey = response.data.apiKey;
    // Pluggy API keys expire in 2 hours (7200 seconds)
    tokenExpiresAt = Date.now() + 7200 * 1000;
    console.log('[Pluggy Auth] Successfully obtained Pluggy API Key');

    return cachedApiKey;
  } catch (error) {
    console.error('[Pluggy Auth Error]', error.response?.data || error.message);
    throw new Error('Falha ao autenticar com Pluggy.ai. Verifique suas credenciais no arquivo .env.');
  }
}
