import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { errorResponse, jsonResponse } from "../middleware/http.ts";
import { asItemIdList, pluggyJson } from "./pluggy.ts";
import {
  handleJointFinancialMoment,
  handleJointMemberSalary,
  loadMemberPluggyBundle,
} from "./jointMoment.ts";

export function normalizeJointLink(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== 'object') return null;
  const row = data as Record<string, unknown>;
  return {
    id: String(row.id || ''),
    status: String(row.status || ''),
    partnerId: row.partner_id ? String(row.partner_id) : (row.partnerId ? String(row.partnerId) : null),
    partnerDisplayName: row.partner_display_name
      ? String(row.partner_display_name)
      : (row.partnerDisplayName ? String(row.partnerDisplayName) : null),
    inviteToken: row.invite_token
      ? String(row.invite_token)
      : (row.inviteToken ? String(row.inviteToken) : null),
    inviteExpiresAt: row.invite_expires_at || row.inviteExpiresAt || null,
  };
}

export async function loadMemberInvestmentsBundleEdge(profile: {
  pluggy_item_ids?: unknown;
  pluggy_client_id?: string | null;
  pluggy_client_secret?: string | null;
}): Promise<{
  accounts: Record<string, unknown>[];
  investments: Record<string, unknown>[];
}> {
  const itemIds = asItemIdList(profile?.pluggy_item_ids);
  const clientId = profile?.pluggy_client_id || Deno.env.get('PLUGGY_CLIENT_ID') || '';
  const clientSecret = profile?.pluggy_client_secret || Deno.env.get('PLUGGY_CLIENT_SECRET') || '';
  if (!clientId || !clientSecret || itemIds.length === 0) {
    return { accounts: [], investments: [] };
  }
  const creds = { clientId, clientSecret };
  const accounts: Record<string, unknown>[] = [];
  const investments: Record<string, unknown>[] = [];
  await Promise.all([
    (async () => {
      for (const itemId of itemIds) {
        try {
          const d = await pluggyJson(creds, '/accounts', { params: { itemId } }) as { results?: Record<string, unknown>[] };
          accounts.push(...(d.results || []));
        } catch (e) {
          console.warn('[joint] accounts', itemId, e);
        }
      }
    })(),
    (async () => {
      for (const itemId of itemIds) {
        try {
          const d = await pluggyJson(creds, '/investments', { params: { itemId } }) as { results?: Record<string, unknown>[] };
          investments.push(...(d.results || []));
        } catch (e) {
          console.warn('[joint] investments', itemId, e);
        }
      }
    })(),
  ]);
  return { accounts, investments };
}

function resolveAccountDisplayName(customNames: Record<string, string> | null | undefined, acc: { id?: string; name?: string }): string {
  if (customNames && acc?.id && customNames[acc.id]) {
    return String(customNames[acc.id]);
  }
  return acc?.name || 'Conta';
}

export async function handleJoint(
  supabaseClient: SupabaseClient,
  userId: string,
  method: string,
  actionOrId: string | undefined,
  body: unknown,
  url: URL,
): Promise<Response> {
  if (method === 'GET' && (!actionOrId || actionOrId === 'status')) {
    const { data, error } = await supabaseClient.rpc('get_my_joint_link');
    if (error) return errorResponse(error.message, 500);
    return jsonResponse({ link: normalizeJointLink(data) });
  }

  if (method === 'POST' && actionOrId === 'invite') {
    const { data: token, error } = await supabaseClient.rpc('generate_joint_invite_token', {
      p_user_id: userId,
    });
    if (error) return errorResponse(error.message, 400);
    return jsonResponse({ success: true, token });
  }

  if (method === 'POST' && actionOrId === 'accept') {
    const token = String((body as { token?: string })?.token || '').trim();
    if (!token) return errorResponse('token é obrigatório', 400);
    const { data, error } = await supabaseClient.rpc('accept_joint_invite', { p_token: token });
    if (error) return errorResponse(error.message, 400);
    if (!data?.success) return errorResponse(data?.message || 'Falha ao aceitar convite', 400);
    return jsonResponse(data);
  }

  if (method === 'DELETE' && actionOrId === 'unlink') {
    const { data, error } = await supabaseClient.rpc('unlink_joint_account');
    if (error) return errorResponse(error.message, 400);
    if (!data?.success) return errorResponse(data?.message || 'Falha ao desvincular', 400);
    return jsonResponse(data);
  }

  if (method === 'GET' && actionOrId === 'financial-moment') {
    return await handleJointFinancialMoment(supabaseClient, userId, url);
  }

  if (method === 'POST' && actionOrId === 'member-salary') {
    return await handleJointMemberSalary(supabaseClient, userId, body);
  }

  if (method === 'GET' && actionOrId === 'moment-data') {
    const { data: link, error: linkError } = await supabaseClient.rpc('get_my_joint_link');
    if (linkError) return errorResponse(linkError.message, 500);
    if (!link || link.status !== 'active' || !link.partner_id) {
      return errorResponse('Nenhuma conta conjunta ativa', 404);
    }

    const memberIds = [userId, link.partner_id as string];
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const service = serviceKey
      ? createClient(supabaseUrl, serviceKey)
      : supabaseClient;

    const { data: profiles, error: profileError } = await service
      .from('profiles')
      .select('id, display_name, pluggy_item_ids, pluggy_client_id, pluggy_client_secret, monthly_salaries, custom_account_names')
      .in('id', memberIds);
    if (profileError) return errorResponse(profileError.message, 500);

    const profileById = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
    const members = memberIds.map((id) => ({
      id,
      displayName: profileById[id]?.display_name || (id === userId ? 'Você' : 'Parceiro'),
      monthlySalaries: profileById[id]?.monthly_salaries || {},
    }));

    const accounts: Record<string, unknown>[] = [];
    const transactions: Record<string, unknown>[] = [];
    const billsByAccount: Record<string, Record<string, unknown>[]> = {};
    const seenAccountIds = new Set<string>();

    for (const id of memberIds) {
      const label = members.find((m) => m.id === id)?.displayName || 'Usuário';
      const profile = profileById[id] || {};
      const bundle = await loadMemberPluggyBundle(profile);
      for (const acc of bundle.accounts) {
        const accId = String(acc.id || '');
        if (!accId || seenAccountIds.has(accId)) continue;
        seenAccountIds.add(accId);
        const displayName = resolveAccountDisplayName(
          profile.custom_account_names as Record<string, string> | null,
          {
            id: accId,
            name: typeof acc.name === 'string' ? acc.name : undefined,
          }
        );
        accounts.push({
          ...acc,
          originalName: acc.originalName || acc.name,
          name: displayName,
          ownerUserId: id,
          ownerLabel: label,
        });
      }
      for (const tx of bundle.transactions) {
        transactions.push({ ...tx, ownerUserId: id, ownerLabel: label });
      }
      for (const [accId, bills] of Object.entries(bundle.billsByAccount)) {
        billsByAccount[accId] = bills.map((b) => ({
          ...b,
          accountId: (b as { accountId?: string }).accountId || accId,
          ownerUserId: id,
          ownerLabel: label,
        }));
      }
    }

    const { data: manuals, error: manualError } = await service
      .from('manual_transactions')
      .select('*')
      .in('user_id', memberIds);
    if (manualError) return errorResponse(manualError.message, 500);

    const { data: manualAccounts, error: manualAccError } = await service
      .from('manual_accounts')
      .select('*')
      .in('user_id', memberIds);
    if (manualAccError) return errorResponse(manualAccError.message, 500);

    const { data: receivables, error: recvError } = await service
      .from('receivables')
      .select('*')
      .in('user_id', memberIds);
    if (recvError) return errorResponse(recvError.message, 500);

    const { data: mealBenefits, error: mealError } = await service
      .from('meal_benefits')
      .select('*')
      .in('user_id', memberIds);
    if (mealError) console.warn('[joint] meal_benefits', mealError.message);

    const { data: mealBenefitPurchases, error: mealPurchaseError } = await service
      .from('meal_benefit_purchases')
      .select('*')
      .in('user_id', memberIds);
    if (mealPurchaseError) console.warn('[joint] meal_benefit_purchases', mealPurchaseError.message);

    const labelById = Object.fromEntries(members.map((m) => [m.id, m.displayName]));

    for (const row of (manualAccounts || []) as Record<string, unknown>[]) {
      const id = String(row.id || '');
      if (!id || seenAccountIds.has(id)) continue;
      seenAccountIds.add(id);
      const type = row.type === 'CREDIT' ? 'CREDIT' : 'BANK';
      const institution = String(row.institution_name || 'Manual');
      const billAmount = Number(row.bill_amount) || 0;
      const bankBalance = Number(row.balance) || 0;
      const dueDayRaw = row.bill_due_day == null || row.bill_due_day === ''
        ? null
        : Number(row.bill_due_day);
      const dueDay = Number.isFinite(dueDayRaw) ? dueDayRaw : null;
      const creditLimit = Number(row.credit_limit) || 0;
      const ownerId = String(row.user_id || '');
      const ownerLabel = labelById[ownerId] || 'Usuário';

      const hydrated = {
        id,
        type,
        name: String(row.name || (type === 'CREDIT' ? 'Cartão manual' : 'Conta manual')),
        number: String(row.number || ''),
        balance: type === 'CREDIT' ? billAmount : bankBalance,
        isManual: true,
        pairId: row.pair_id || null,
        billAmount: type === 'CREDIT' ? billAmount : null,
        billDueDay: type === 'CREDIT' ? dueDay : null,
        ownerUserId: ownerId,
        ownerLabel,
        bankData: type === 'BANK' ? { institutionName: institution } : undefined,
        creditData: type === 'CREDIT'
          ? {
              institutionName: institution,
              creditLimit,
              availableCreditLimit: creditLimit > 0 ? Math.max(0, creditLimit - billAmount) : 0,
            }
          : undefined,
      };
      accounts.push(hydrated);
      if (type === 'CREDIT') {
        const now = new Date();
        let year = now.getFullYear();
        let month = now.getMonth();
        const day = Math.min(31, Math.max(1, dueDay || 10));
        if (now.getDate() > day) {
          month += 1;
          if (month > 11) { month = 0; year += 1; }
        }
        const last = new Date(year, month + 1, 0).getDate();
        const dueDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(Math.min(day, last)).padStart(2, '0')}`;
        billsByAccount[id] = [{
          id: `manual-bill-${id}-${dueDate.slice(0, 7)}`,
          accountId: id,
          dueDate,
          totalAmount: billAmount,
          isManual: true,
          ownerUserId: ownerId,
          ownerLabel,
        }];
      }
    }

    return jsonResponse({
      link,
      members,
      accounts,
      transactions,
      billsByAccount,
      manuals: (manuals || []).map((row) => ({
        ...row,
        ownerUserId: row.user_id,
        ownerLabel: labelById[row.user_id as string] || 'Usuário',
        isManual: true,
        accountId: (row as { account_id?: string }).account_id || 'manual',
      })),
      receivables: (receivables || []).map((row) => ({
        ...row,
        ownerUserId: row.user_id,
        ownerLabel: labelById[row.user_id as string] || 'Usuário',
      })),
      mealBenefits: (mealBenefits || []).map((row) => ({
        ...row,
        ownerUserId: row.user_id,
        ownerLabel: labelById[row.user_id as string] || 'Usuário',
      })),
      mealBenefitPurchases: (mealBenefitPurchases || []).map((row) => ({
        ...row,
        ownerUserId: row.user_id,
        ownerLabel: labelById[row.user_id as string] || 'Usuário',
      })),
    });
  }

  if (method === 'GET' && actionOrId === 'investments') {
    const { data: link, error: linkError } = await supabaseClient.rpc('get_my_joint_link');
    if (linkError) return errorResponse(linkError.message, 500);
    if (!link || link.status !== 'active' || !link.partner_id) {
      return errorResponse('Nenhuma conta conjunta ativa', 404);
    }

    const memberIds = [userId, link.partner_id as string];
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const service = serviceKey
      ? createClient(supabaseUrl, serviceKey)
      : supabaseClient;

    const { data: profiles, error: profileError } = await service
      .from('profiles')
      .select('id, display_name, pluggy_item_ids, pluggy_client_id, pluggy_client_secret')
      .in('id', memberIds);
    if (profileError) return errorResponse(profileError.message, 500);

    const profileById = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
    const members = memberIds.map((id) => ({
      id,
      displayName: profileById[id]?.display_name || (id === userId ? 'Você' : 'Parceiro'),
    }));

    const accounts: Record<string, unknown>[] = [];
    const investments: Record<string, unknown>[] = [];

    for (const id of memberIds) {
      const label = members.find((m) => m.id === id)?.displayName || 'Usuário';
      const bundle = await loadMemberInvestmentsBundleEdge(profileById[id] || {});
      for (const acc of bundle.accounts) {
        accounts.push({
          ...acc,
          ownerUserId: id,
          ownerLabel: label,
        });
      }
      for (const inv of bundle.investments) {
        investments.push({
          ...inv,
          ownerUserId: id,
          ownerLabel: label,
        });
      }
    }

    return jsonResponse({
      link,
      members,
      accounts,
      investments,
    });
  }

  return errorResponse('Rota conjunta não encontrada', 404);
}
