import { Router } from 'express';
import { checkAuth } from '../middleware/auth.js';
import { getServiceRoleClient } from '../services/supabaseClient.js';
import { resolveMerchantLogos } from '../services/merchantLogoCache.js';

const router = Router();

router.post('/resolve', checkAuth, async (req, res) => {
  try {
    let supabase = null;
    try {
      supabase = getServiceRoleClient();
    } catch (err) {
      console.warn('[merchant-logos] Supabase service role ausente:', err.message);
    }

    const results = await resolveMerchantLogos({
      supabase,
      secret: process.env.LOGO_DEV_SECRET_KEY || '',
      queries: req.body?.queries,
    });
    res.json({ results });
  } catch (err) {
    console.error('[merchant-logos]', err);
    res.status(500).json({ error: 'Falha ao resolver logos' });
  }
});

export default router;
