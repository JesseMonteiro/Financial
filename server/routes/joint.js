import { Router } from 'express';
import { checkAuth } from '../middleware/auth.js';
import { getServiceRoleClient } from '../services/supabaseClient.js';
import { createPluggyClient } from '../services/pluggyClient.js';
import { cacheMiddleware, clearUserCache } from '../middleware/cache.js';

const router = Router();

function asItemIdList(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((id) => typeof id === 'string' && id.length > 0);
}

async function fetchAccountsForItems(client, itemIds) {
  const results = await Promise.all(
    itemIds.map(async (itemId) => {
      try {
        const res = await client.get('/accounts', { params: { itemId } });
        const list = res.data.results || res.data || [];
        return Array.isArray(list) ? list : [];
      } catch (e) {
        console.warn(`[Joint] accounts item ${itemId}:`, e.message);
        return [];
      }
    })
  );
  return results.flat();
}

async function fetchTransactionsForAccounts(client, accountIds) {
  const results = await Promise.all(
    accountIds.map(async (accountId) => {
      try {
        const res = await client.get('/v2/transactions', { params: { accountId } });
        const list = res.data.results || res.data || [];
        return Array.isArray(list) ? list : [];
      } catch (e) {
        console.warn(`[Joint] txs account ${accountId}:`, e.message);
        return [];
      }
    })
  );
  return results.flat();
}

async function fetchBillsForAccount(client, accountId) {
  try {
    const res = await client.get('/bills', { params: { accountId } });
    const data = res.data;
    if (Array.isArray(data?.results)) return data.results;
    if (Array.isArray(data)) return data;
    return [];
  } catch (e) {
    console.warn(`[Joint] bills account ${accountId}:`, e.message);
    return [];
  }
}

async function loadMemberPluggyBundle(profile) {
  const itemIds = asItemIdList(profile?.pluggy_item_ids);
  const clientId = profile?.pluggy_client_id || process.env.PLUGGY_CLIENT_ID || null;
  const clientSecret = profile?.pluggy_client_secret || process.env.PLUGGY_CLIENT_SECRET || null;

  if (!clientId || !clientSecret || itemIds.length === 0) {
    return { accounts: [], transactions: [], billsByAccount: {}, itemIds };
  }

  const client = await createPluggyClient(clientId, clientSecret);
  const accounts = await fetchAccountsForItems(client, itemIds);
  const accountIds = accounts.map((a) => a.id).filter(Boolean);
  const transactions = await fetchTransactionsForAccounts(client, accountIds);

  const creditIds = accounts.filter((a) => a.type === 'CREDIT').map((a) => a.id);
  const billsByAccount = {};
  await Promise.all(
    creditIds.map(async (id) => {
      billsByAccount[id] = await fetchBillsForAccount(client, id);
    })
  );

  return { accounts, transactions, billsByAccount, itemIds };
}

function tagOwner(list, ownerUserId, ownerLabel) {
  return (list || []).map((item) => ({
    ...item,
    ownerUserId,
    ownerLabel,
  }));
}

// GET /api/joint/status
router.get('/status', checkAuth, async (req, res) => {
  try {
    const { data, error } = await req.supabase.rpc('get_my_joint_link');
    if (error) throw error;
    res.json({ link: data || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/joint/invite
router.post('/invite', checkAuth, async (req, res) => {
  try {
    const { data: token, error } = await req.supabase.rpc('generate_joint_invite_token', {
      p_user_id: req.user.id,
    });
    if (error) throw error;
    res.json({ success: true, token });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/joint/accept
router.post('/accept', checkAuth, async (req, res) => {
  try {
    const token = String(req.body?.token || '').trim();
    if (!token) return res.status(400).json({ error: 'token é obrigatório' });

    const { data, error } = await req.supabase.rpc('accept_joint_invite', { p_token: token });
    if (error) throw error;
    if (!data?.success) {
      return res.status(400).json({ error: data?.message || 'Falha ao aceitar convite' });
    }
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/joint/unlink
router.delete('/unlink', checkAuth, async (req, res) => {
  try {
    const { data: linkBefore } = await req.supabase.rpc('get_my_joint_link');
    const partnerId = linkBefore?.partner_id || null;

    const { data, error } = await req.supabase.rpc('unlink_joint_account');
    if (error) throw error;
    if (!data?.success) {
      return res.status(400).json({ error: data?.message || 'Falha ao desvincular' });
    }
    clearUserCache(req.user.id);
    if (partnerId) clearUserCache(partnerId);
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/joint/moment-data — consolidated Pluggy + ownership tags
// Not cached: includes custom account names and salaries that change frequently.
router.get('/moment-data', checkAuth, async (req, res) => {
  try {
    const { data: link, error: linkError } = await req.supabase.rpc('get_my_joint_link');
    if (linkError) throw linkError;
    if (!link || link.status !== 'active' || !link.partner_id) {
      return res.status(404).json({ error: 'Nenhuma conta conjunta ativa' });
    }

    const memberIds = [req.user.id, link.partner_id];
    let service;
    try {
      service = getServiceRoleClient();
    } catch (e) {
      console.warn('[Joint] SERVICE_ROLE ausente, usando client do usuário:', e.message);
      service = req.supabase;
    }

    const { data: profiles, error: profileError } = await service
      .from('profiles')
      .select(
        'id, display_name, pluggy_item_ids, pluggy_client_id, pluggy_client_secret, monthly_salaries, custom_account_names'
      )
      .in('id', memberIds);

    if (profileError) throw profileError;

    const profileById = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
    const members = memberIds.map((id) => ({
      id,
      displayName: profileById[id]?.display_name || (id === req.user.id ? 'Você' : 'Parceiro'),
      monthlySalaries: profileById[id]?.monthly_salaries || {},
    }));

    const bundles = await Promise.all(
      memberIds.map(async (id) => {
        const profile = profileById[id];
        const label = members.find((m) => m.id === id)?.displayName || 'Usuário';
        const bundle = await loadMemberPluggyBundle(profile);
        return { id, label, profile, ...bundle };
      })
    );

    const accounts = [];
    const transactions = [];
    const billsByAccount = {};
    const seenAccountIds = new Set();

    for (const b of bundles) {
      const customNames =
        b.profile?.custom_account_names && typeof b.profile.custom_account_names === 'object'
          ? b.profile.custom_account_names
          : {};
      for (const acc of b.accounts) {
        if (seenAccountIds.has(acc.id)) continue;
        seenAccountIds.add(acc.id);
        accounts.push({
          ...acc,
          originalName: acc.originalName || acc.name,
          name: customNames[acc.id] || acc.name,
          ownerUserId: b.id,
          ownerLabel: b.label,
        });
      }
      transactions.push(...tagOwner(b.transactions, b.id, b.label));
      for (const [accId, bills] of Object.entries(b.billsByAccount || {})) {
        billsByAccount[accId] = tagOwner(
          (bills || []).map((bill) => ({ ...bill, accountId: bill.accountId || accId })),
          b.id,
          b.label
        );
      }
    }

    const { data: manuals, error: manualError } = await service
      .from('manual_transactions')
      .select('*')
      .in('user_id', memberIds);
    if (manualError) throw manualError;

    const { data: receivables, error: recvError } = await service
      .from('receivables')
      .select('*')
      .in('user_id', memberIds);
    if (recvError) throw recvError;

    const labelById = Object.fromEntries(members.map((m) => [m.id, m.displayName]));

    res.json({
      link,
      members,
      accounts,
      transactions,
      billsByAccount,
      manuals: (manuals || []).map((row) => ({
        ...row,
        ownerUserId: row.user_id,
        ownerLabel: labelById[row.user_id] || 'Usuário',
        isManual: true,
        accountId: 'manual',
      })),
      receivables: (receivables || []).map((row) => ({
        ...row,
        ownerUserId: row.user_id,
        ownerLabel: labelById[row.user_id] || 'Usuário',
      })),
    });
  } catch (err) {
    console.error('[Joint] moment-data:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
