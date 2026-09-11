import { Router } from 'express';
import { checkAuth } from '../middleware/auth.js';
import { getServiceRoleClient } from '../services/supabaseClient.js';
import { createPluggyClient } from '../services/pluggyClient.js';
import { cacheMiddleware, clearUserCache } from '../middleware/cache.js';
import { hydrateManualAccount, syntheticManualBill } from '../../src/utils/manualAccounts.js';
import { decorateAccountWithIcon, ICON_BUCKET, ICON_SIGNED_TTL_SEC } from '../../src/utils/accountIcons.js';

const router = Router();

function asItemIdList(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((id) => typeof id === 'string' && id.length > 0);
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
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

async function fetchInvestmentsForItems(client, itemIds) {
  const results = await Promise.all(
    itemIds.map(async (itemId) => {
      try {
        const res = await client.get('/investments', { params: { itemId } });
        const list = res.data.results || res.data || [];
        return Array.isArray(list) ? list : [];
      } catch (e) {
        console.warn(`[Joint] investments item ${itemId}:`, e.message);
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

async function fetchItemsByIds(client, itemIds) {
  const results = await Promise.all(
    itemIds.map(async (itemId) => {
      try {
        const res = await client.get(`/items/${itemId}`);
        return res.data || null;
      } catch (e) {
        console.warn(`[Joint] item ${itemId}:`, e.message);
        return null;
      }
    })
  );
  return Object.fromEntries(results.filter((item) => item?.id).map((item) => [item.id, item]));
}

async function loadMemberPluggyBundle(profile) {
  const itemIds = asItemIdList(profile?.pluggy_item_ids);
  const clientId = profile?.pluggy_client_id || process.env.PLUGGY_CLIENT_ID || null;
  const clientSecret = profile?.pluggy_client_secret || process.env.PLUGGY_CLIENT_SECRET || null;

  if (!clientId || !clientSecret || itemIds.length === 0) {
    return { accounts: [], transactions: [], billsByAccount: {}, itemIds, itemsById: {} };
  }

  const client = await createPluggyClient(clientId, clientSecret);
  const [accounts, itemsById] = await Promise.all([
    fetchAccountsForItems(client, itemIds),
    fetchItemsByIds(client, itemIds),
  ]);
  const accountIds = accounts.map((a) => a.id).filter(Boolean);
  const transactions = await fetchTransactionsForAccounts(client, accountIds);

  const creditIds = accounts.filter((a) => a.type === 'CREDIT').map((a) => a.id);
  const billsByAccount = {};
  await Promise.all(
    creditIds.map(async (id) => {
      billsByAccount[id] = await fetchBillsForAccount(client, id);
    })
  );

  return { accounts, transactions, billsByAccount, itemIds, itemsById };
}

async function loadMemberInvestmentsBundle(profile) {
  const itemIds = asItemIdList(profile?.pluggy_item_ids);
  const clientId = profile?.pluggy_client_id || process.env.PLUGGY_CLIENT_ID || null;
  const clientSecret = profile?.pluggy_client_secret || process.env.PLUGGY_CLIENT_SECRET || null;

  if (!clientId || !clientSecret || itemIds.length === 0) {
    return { accounts: [], investments: [], itemIds, itemsById: {} };
  }

  const client = await createPluggyClient(clientId, clientSecret);
  const [accounts, investments, itemsById] = await Promise.all([
    fetchAccountsForItems(client, itemIds),
    fetchInvestmentsForItems(client, itemIds),
    fetchItemsByIds(client, itemIds),
  ]);

  return { accounts, investments, itemIds, itemsById };
}

async function signIconOverlays(supabase, overlays) {
  const next = {};
  await Promise.all(Object.entries(asIconMap(overlays)).map(async ([id, value]) => {
    const overlay = value && typeof value === 'object' ? { ...value } : {};
    if (overlay.path) {
      const { data, error } = await supabase.storage
        .from(ICON_BUCKET)
        .createSignedUrl(overlay.path, ICON_SIGNED_TTL_SEC);
      if (error) console.warn('[Joint] icon sign', id, error.message);
      overlay.url = data?.signedUrl || overlay.url || null;
    }
    const facePath = overlay.facePath || overlay.face_path;
    if (facePath) {
      overlay.facePath = facePath;
      if (/^https?:/i.test(facePath)) {
        overlay.faceUrl = facePath;
      } else {
        const { data, error } = await supabase.storage
          .from(ICON_BUCKET)
          .createSignedUrl(facePath, ICON_SIGNED_TTL_SEC);
        if (error) console.warn('[Joint] face sign', id, error.message);
        overlay.faceUrl = data?.signedUrl || overlay.faceUrl || null;
      }
    }
    next[id] = overlay;
  }));
  return next;
}

function asIconMap(value) {
  if (!value) return {};
  let parsed = value;
  if (typeof value === 'string') {
    try { parsed = JSON.parse(value); } catch { return {}; }
  }
  if (typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  return parsed;
}

function tagOwner(list, ownerUserId, ownerLabel) {
  return (list || []).map((item) => ({
    ...item,
    ownerUserId,
    ownerLabel,
  }));
}

async function requireActiveJointMembers(req) {
  const { data: link, error: linkError } = await req.supabase.rpc('get_my_joint_link');
  if (linkError) throw linkError;
  if (!link || link.status !== 'active' || !link.partner_id) {
    throw httpError(404, 'Nenhuma conta conjunta ativa');
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
      'id, display_name, pluggy_item_ids, pluggy_client_id, pluggy_client_secret, monthly_salaries, custom_account_names, custom_account_icons'
    )
    .in('id', memberIds);

  if (profileError) throw profileError;

  const profileById = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
  const members = memberIds.map((id) => ({
    id,
    displayName: profileById[id]?.display_name || (id === req.user.id ? 'Você' : 'Parceiro'),
    monthlySalaries: profileById[id]?.monthly_salaries || {},
  }));

  return { link, memberIds, service, profileById, members };
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
    const { link, memberIds, service, profileById, members } = await requireActiveJointMembers(req);

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
      const customIcons = await signIconOverlays(
        service,
        b.profile?.custom_account_icons && typeof b.profile.custom_account_icons === 'object'
          ? b.profile.custom_account_icons
          : {}
      );
      const iconCtx = { customIcons, itemsById: b.itemsById || {} };
      for (const acc of b.accounts) {
        if (seenAccountIds.has(acc.id)) continue;
        seenAccountIds.add(acc.id);
        accounts.push(decorateAccountWithIcon({
          ...acc,
          originalName: acc.originalName || acc.name,
          name: customNames[acc.id] || acc.name,
          ownerUserId: b.id,
          ownerLabel: b.label,
        }, iconCtx));
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

    const { data: manualAccounts, error: manualAccError } = await service
      .from('manual_accounts')
      .select('*')
      .in('user_id', memberIds);
    if (manualAccError) throw manualAccError;

    const { data: receivables, error: recvError } = await service
      .from('receivables')
      .select('*')
      .in('user_id', memberIds);
    if (recvError) throw recvError;

    const labelById = Object.fromEntries(members.map((m) => [m.id, m.displayName]));

    const iconsByUser = {};
    for (const id of memberIds) {
      const profile = profileById[id];
      iconsByUser[id] = await signIconOverlays(
        service,
        asIconMap(profile?.custom_account_icons)
      );
    }

    for (const row of manualAccounts || []) {
      if (seenAccountIds.has(row.id)) continue;
      seenAccountIds.add(row.id);
      const hydrated = hydrateManualAccount(row);
      hydrated.ownerUserId = row.user_id;
      hydrated.ownerLabel = labelById[row.user_id] || 'Usuário';
      accounts.push(decorateAccountWithIcon(hydrated, { customIcons: iconsByUser[row.user_id] || {} }));
      if (hydrated.type === 'CREDIT') {
        const bill = syntheticManualBill(hydrated);
        if (bill) {
          billsByAccount[hydrated.id] = tagOwner([bill], row.user_id, hydrated.ownerLabel);
        }
      }
    }

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
        accountId: row.account_id || 'manual',
      })),
      receivables: (receivables || []).map((row) => ({
        ...row,
        ownerUserId: row.user_id,
        ownerLabel: labelById[row.user_id] || 'Usuário',
      })),
    });
  } catch (err) {
    if (typeof err.status === 'number') {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('[Joint] moment-data:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/joint/investments — both members' Pluggy investments + accounts (caixinhas)
router.get('/investments', checkAuth, cacheMiddleware(3600), async (req, res) => {
  try {
    const { link, memberIds, service, profileById, members } = await requireActiveJointMembers(req);

    const bundles = await Promise.all(
      memberIds.map(async (id) => {
        const profile = profileById[id];
        const label = members.find((m) => m.id === id)?.displayName || 'Usuário';
        const bundle = await loadMemberInvestmentsBundle(profile);
        return { id, label, profile, ...bundle };
      })
    );

    const investments = [];
    const accounts = [];
    const seenAccountIds = new Set();

    for (const b of bundles) {
      investments.push(...tagOwner(b.investments, b.id, b.label));
      const customNames =
        b.profile?.custom_account_names && typeof b.profile.custom_account_names === 'object'
          ? b.profile.custom_account_names
          : {};
      const customIcons = await signIconOverlays(
        service,
        b.profile?.custom_account_icons && typeof b.profile.custom_account_icons === 'object'
          ? b.profile.custom_account_icons
          : {}
      );
      const iconCtx = { customIcons, itemsById: b.itemsById || {} };
      for (const acc of b.accounts) {
        if (seenAccountIds.has(acc.id)) continue;
        seenAccountIds.add(acc.id);
        accounts.push(decorateAccountWithIcon({
          ...acc,
          originalName: acc.originalName || acc.name,
          name: customNames[acc.id] || acc.name,
          ownerUserId: b.id,
          ownerLabel: b.label,
        }, iconCtx));
      }
    }

    res.json({ link, members, investments, accounts });
  } catch (err) {
    if (typeof err.status === 'number') {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('[Joint] investments:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
