import { getSupabaseClient } from '../services/supabaseClient.js';
import { createPluggyClient } from '../services/pluggyClient.js';

export async function checkAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Token de autenticação ausente' });
  }

  try {
    const supabase = getSupabaseClient(req);
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return res.status(401).json({ error: 'Token de autenticação inválido ou expirado' });
    }

    req.user = user;
    req.supabase = supabase;
    next();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function loadPluggyClient(req, res, next) {
  if (!req.supabase || !req.user) {
    return res.status(500).json({ error: 'Cliente Supabase ou usuário não inicializado' });
  }

  try {
    const { data: profile, error } = await req.supabase
      .from('profiles')
      .select('pluggy_item_ids, pluggy_client_id, pluggy_client_secret')
      .eq('id', req.user.id)
      .maybeSingle();

    const rawItemIds = profile?.pluggy_item_ids;
    const pluggyItemIds = Array.isArray(rawItemIds)
      ? rawItemIds.filter((id) => typeof id === 'string' && id.length > 0)
      : [];
    const clientId = profile?.pluggy_client_id || null;
    const clientSecret = profile?.pluggy_client_secret || null;

    const pluggyClient = await createPluggyClient(clientId, clientSecret);

    req.pluggyItemIds = pluggyItemIds;
    req.pluggyClient = pluggyClient;
    req.userProfile = {
      pluggyItemIds,
      clientId,
      clientSecret
    };

    next();
  } catch (err) {
    return res.status(500).json({ error: `Falha ao instanciar cliente Pluggy: ${err.message}` });
  }
}
