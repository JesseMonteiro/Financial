import axios from 'axios';
import { getPluggyApiKey } from './tokenManager.js';

export async function createPluggyClient() {
  const apiKey = await getPluggyApiKey();
  
  const client = axios.create({
    baseURL: 'https://api.pluggy.ai',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(apiKey ? { 'X-API-KEY': apiKey } : {}),
    },
    timeout: 30000,
  });

  // Interceptor for 429 rate limit handling
  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (error.response?.status === 429) {
        const retryAfter = error.response.headers['retry-after'] || 60;
        console.warn(`[Pluggy Rate Limit] Hit 429 rate limit. Retry after ${retryAfter}s`);
      }
      return Promise.reject(error);
    }
  );

  return client;
}
