import { Router } from 'express';
import { checkAuth } from '../middleware/auth.js';
import { createClient } from '@supabase/supabase-js';

const router = Router();

const MINUTE_MS = 60 * 1000;
const FRESH_MAX_AGE_MS = 15 * MINUTE_MS;
const AGING_MAX_AGE_MS = 60 * MINUTE_MS;

function classifyFreshness(ageMs) {
  if (ageMs == null) return { level: 'never', label: 'nunca sincronizado' };
  if (ageMs < FRESH_MAX_AGE_MS) return { level: 'fresh', label: 'atualizado' };
  if (ageMs < AGING_MAX_AGE_MS) return { level: 'aging', label: 'sincronizado há pouco' };
  return { level: 'stale', label: 'dados podem estar desatualizados' };
}

function getSupabaseClient() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * GET /api/sync/status
 * Returns sync freshness per item and overall for the authenticated user.
 */
router.get('/status', checkAuth, async (req, res) => {
  const userId = req.user?.id;
  const supabase = getSupabaseClient();

  if (!supabase || !userId) {
    return res.json({
      items: [],
      globalLastSyncedAt: null,
      freshness: { level: 'never', label: 'nunca sincronizado' },
      itemCount: 0,
    });
  }

  try {
    const { data: rows, error } = await supabase
      .from('pluggy_sync_items')
      .select('*')
      .eq('user_id', userId)
      .order('last_synced_at', { ascending: false });

    if (error) {
      console.warn('[sync/status] Error reading pluggy_sync_items:', error.message);
      return res.json({
        items: [],
        globalLastSyncedAt: null,
        freshness: { level: 'never', label: 'nunca sincronizado' },
        itemCount: 0,
      });
    }

    const now = Date.now();
    const items = (rows || []).map((row) => {
      const syncDate = row.last_synced_at ? new Date(row.last_synced_at) : null;
      const ageMs = syncDate ? Math.max(0, now - syncDate.getTime()) : null;
      const freshness = classifyFreshness(ageMs);

      return {
        pluggyItemId: row.pluggy_item_id,
        connectorName: row.connector_name,
        status: row.status,
        executionStatus: row.execution_status,
        errorMessage: row.error_message,
        lastSyncedAt: row.last_synced_at,
        ageMs,
        freshness,
      };
    });

    const validDates = items
      .map((i) => (i.lastSyncedAt ? new Date(i.lastSyncedAt).getTime() : null))
      .filter((t) => typeof t === 'number' && Number.isFinite(t));

    const globalLastSyncedAt =
      validDates.length > 0 ? new Date(Math.min(...validDates)).toISOString() : null;
    const globalAgeMs = globalLastSyncedAt
      ? Math.max(0, now - new Date(globalLastSyncedAt).getTime())
      : null;
    const globalFreshness = classifyFreshness(globalAgeMs);

    res.json({
      items,
      globalLastSyncedAt,
      freshness: globalFreshness,
      itemCount: items.length,
    });
  } catch (err) {
    console.error('[sync/status] Unexpected error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
