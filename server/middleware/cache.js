import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

export function cacheMiddleware(ttlSeconds = 300) {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const userId = req.user?.id || 'anonymous';
    const key = `${userId}:${req.originalUrl || req.url}`;
    const cachedResponse = cache.get(key);

    if (cachedResponse) {
      return res.json(cachedResponse);
    }

    res.originalJson = res.json;
    res.json = (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cache.set(key, body, ttlSeconds);
      }
      return res.originalJson(body);
    };

    next();
  };
}

export function clearCache() {
  cache.flushAll();
}

export function clearUserCache(userId) {
  if (!userId) return;
  const keys = cache.keys();
  const prefix = `${userId}:`;
  keys.forEach(key => {
    if (key.startsWith(prefix)) {
      cache.del(key);
    }
  });
}
