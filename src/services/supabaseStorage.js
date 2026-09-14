import { supabase } from './supabaseClient.js';
import { useAuthStore } from '../stores/authStore.js';
import {
  ICON_BUCKET,
  ICON_SIGNED_TTL_SEC,
  extFromImageFile,
  validateIconFile,
  validateCardFaceFile,
} from '../utils/accountIcons.js';

export async function getCurrentUserId() {
  const cached = useAuthStore.getState().user?.id;
  if (cached) return cached;
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id || null;
}

function toSnakeCase(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const newObj = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    newObj[snakeKey] = value;
  }
  return newObj;
}

function toCamelCase(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const newObj = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    newObj[camelKey] = value;
  }
  return newObj;
}

// --- Budgets ---
export async function getStoredBudgets() {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  const { data, error } = await supabase.from('budgets').select('*').eq('user_id', userId);
  if (error) {
    console.error('Error fetching budgets:', error);
    return [];
  }
  return data.map(toCamelCase);
}

export async function saveStoredBudget(budget) {
  const userId = await getCurrentUserId();
  if (!userId) return;
  const snakeBudget = toSnakeCase(budget);
  snakeBudget.user_id = userId;
  
  const { error } = await supabase
    .from('budgets')
    .upsert(snakeBudget, { onConflict: 'user_id,category' });
    
  if (error) {
    console.error('Error saving budget:', error);
    throw error;
  }
}

export async function deleteStoredBudget(category) {
  const userId = await getCurrentUserId();
  if (!userId) return;
  const { error } = await supabase
    .from('budgets')
    .delete()
    .eq('user_id', userId)
    .eq('category', category);
    
  if (error) {
    console.error('Error deleting budget:', error);
    throw error;
  }
}

// --- Goals ---
export async function getStoredGoals() {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  const { data, error } = await supabase.from('goals').select('*').eq('user_id', userId);
  if (error) {
    console.error('Error fetching goals:', error);
    return [];
  }
  return data.map(toCamelCase);
}

export async function saveStoredGoal(goal) {
  const userId = await getCurrentUserId();
  if (!userId) return;
  const snakeGoal = toSnakeCase(goal);
  snakeGoal.user_id = userId;
  
  const { error } = await supabase
    .from('goals')
    .upsert(snakeGoal, { onConflict: 'id' });
    
  if (error) {
    console.error('Error saving goal:', error);
    throw error;
  }
}

export async function deleteStoredGoal(goalId) {
  const userId = await getCurrentUserId();
  if (!userId) return;
  const { error } = await supabase
    .from('goals')
    .delete()
    .eq('user_id', userId)
    .eq('id', goalId);
    
  if (error) {
    console.error('Error deleting goal:', error);
    throw error;
  }
}

// --- Receivables ---
export async function getStoredReceivables() {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  const { data, error } = await supabase.from('receivables').select('*').eq('user_id', userId);
  if (error) {
    console.error('Error fetching receivables:', error);
    return [];
  }
  return data.map(toCamelCase);
}

export async function saveStoredReceivable(receivable) {
  const userId = await getCurrentUserId();
  if (!userId) return;
  // Whitelist DB columns — form-only fields like firstDueDate must not be upserted
  // (PostgREST PGRST204 if an unknown column is sent).
  const snakeReceivable = {
    id: receivable.id,
    user_id: userId,
    person_name: receivable.personName ?? receivable.person_name,
    person_color: receivable.personColor ?? receivable.person_color ?? null,
    description: receivable.description ?? null,
    total_amount: receivable.totalAmount ?? receivable.total_amount,
    original_total_amount: receivable.originalTotalAmount ?? receivable.original_total_amount ?? null,
    installments: receivable.installments,
    paid_installments: receivable.paidInstallments ?? receivable.paid_installments ?? 0,
    is_continuous: receivable.isContinuous ?? receivable.is_continuous ?? false,
    linked_transaction_id: receivable.linkedTransactionId ?? receivable.linked_transaction_id ?? null,
    linked_bill_forecast_date: receivable.linkedBillForecastDate ?? receivable.linked_bill_forecast_date ?? null,
    notes: receivable.notes ?? null,
    installment_history: receivable.installmentHistory ?? receivable.installment_history ?? [],
    updated_at: new Date().toISOString(),
  };
  if (receivable.createdAt || receivable.created_at) {
    snakeReceivable.created_at = receivable.createdAt || receivable.created_at;
  }

  const { error } = await supabase
    .from('receivables')
    .upsert(snakeReceivable, { onConflict: 'id' });

  if (error) {
    console.error('Error saving receivable:', error);
    throw error;
  }
}

export async function deleteStoredReceivable(id) {
  const userId = await getCurrentUserId();
  if (!userId) return;
  const { error } = await supabase
    .from('receivables')
    .delete()
    .eq('user_id', userId)
    .eq('id', id);
    
  if (error) {
    console.error('Error deleting receivable:', error);
    throw error;
  }
}

// --- Manual Transactions ---
export async function getStoredManualTransactions() {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  const { data, error } = await supabase.from('manual_transactions').select('*').eq('user_id', userId);
  if (error) {
    console.error('Error fetching manual transactions:', error);
    return [];
  }
  return data.map(row => {
    const camel = toCamelCase(row);
    const accountId = camel.accountId || row.account_id || 'manual';
    const merchant = camel.merchant || { name: 'Manual' };
    const creditCardMetadata = camel.creditCardMetadata
      || (merchant.installmentNumber && merchant.totalInstallments
        ? {
            installmentNumber: merchant.installmentNumber,
            totalInstallments: merchant.totalInstallments,
          }
        : undefined);
    return {
      ...camel,
      isManual: true,
      accountId,
      merchant,
      creditCardMetadata,
    };
  });
}

function ownerIdFromTx(tx) {
  return tx?.userId || tx?.user_id || tx?.ownerUserId || tx?.owner_user_id || null;
}

function toSnakeManualTx(tx, ownerId) {
  const accountId = tx.accountId || tx.account_id || null;
  return {
    id: tx.id,
    user_id: ownerId,
    description: tx.description || '',
    original_description: tx.originalDescription ?? tx.original_description ?? tx.description ?? '',
    amount: tx.amount,
    category: tx.category || 'Other',
    date: tx.date,
    type: tx.type || 'DEBIT',
    status: tx.status || 'POSTED',
    is_recurring: Boolean(tx.isRecurring ?? tx.is_recurring),
    is_continuous: Boolean(tx.isContinuous ?? tx.is_continuous),
    parent_id: tx.parentId ?? tx.parent_id ?? null,
    frequency: tx.frequency || null,
    merchant: tx.merchant || { name: 'Manual' },
    is_paid: tx.isPaid ?? tx.is_paid ?? false,
    paid_at: tx.paidAt ?? tx.paid_at ?? null,
    account_id: accountId && accountId !== 'manual' ? accountId : (accountId === 'manual' ? 'manual' : null),
  };
}

async function resolveManualOwners(txs, fallbackUserId) {
  const owners = new Map();
  const missingIds = [];
  for (const tx of txs) {
    const known = ownerIdFromTx(tx);
    if (known) owners.set(tx.id, known);
    else if (tx.id) missingIds.push(tx.id);
  }

  if (missingIds.length) {
    const { data } = await supabase
      .from('manual_transactions')
      .select('id, user_id')
      .in('id', missingIds);
    for (const row of data || []) {
      if (row.user_id) owners.set(row.id, row.user_id);
    }
  }

  return txs.map((tx) => ({
    tx,
    ownerId: owners.get(tx.id) || fallbackUserId,
  }));
}

export async function saveStoredManualTransactions(txs) {
  const list = (Array.isArray(txs) ? txs : []).filter(Boolean);
  if (!list.length) return;

  const userId = await getCurrentUserId();
  if (!userId) return;

  const resolved = await resolveManualOwners(list, userId);
  const rows = resolved.map(({ tx, ownerId }) => toSnakeManualTx(tx, ownerId));

  const { error } = await supabase
    .from('manual_transactions')
    .upsert(rows, { onConflict: 'id' });

  if (error) {
    console.error('Error saving manual transactions:', error);
    throw error;
  }
}

export async function saveStoredManualTransaction(tx) {
  if (!tx) return;
  await saveStoredManualTransactions([tx]);
}

export async function deleteStoredManualTransactions(ids) {
  const list = [...new Set((Array.isArray(ids) ? ids : []).filter(Boolean))];
  if (!list.length) return;

  const userId = await getCurrentUserId();
  if (!userId) return;

  const { error } = await supabase
    .from('manual_transactions')
    .delete()
    .eq('user_id', userId)
    .in('id', list);

  if (error) {
    console.error('Error deleting manual transactions:', error);
    throw error;
  }
}

export async function deleteStoredManualTransaction(id) {
  if (!id) return;
  await deleteStoredManualTransactions([id]);
}

// --- Settings ---
export async function getProfileSettings() {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('theme, primary_color, density, animations_enabled, currency')
    .eq('id', userId)
    .single();
    
  if (error) {
    console.error('Error fetching profile settings:', error);
    return null;
  }
  return toCamelCase(data);
}

export async function updateProfileSettings(updates) {
  const userId = await getCurrentUserId();
  if (!userId) return;
  const snakeUpdates = toSnakeCase(updates);
  
  const { error } = await supabase
    .from('profiles')
    .update(snakeUpdates)
    .eq('id', userId);
    
  if (error) {
    console.error('Error updating profile settings:', error);
    throw error;
  }
}

// --- Custom Account Names ---
export async function getCustomAccountNames() {
  const userId = await getCurrentUserId();
  if (!userId) return readLocalCustomAccountNames();

  const { data, error } = await supabase
    .from('profiles')
    .select('custom_account_names')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching custom account names:', error);
    return readLocalCustomAccountNames();
  }

  const fromDb = data?.custom_account_names && typeof data.custom_account_names === 'object'
    ? data.custom_account_names
    : {};

  // One-time heal: old renames may still live only in localStorage
  const fromLocal = readLocalCustomAccountNames();
  if (Object.keys(fromDb).length === 0 && Object.keys(fromLocal).length > 0) {
    await saveCustomAccountNames(fromLocal);
    return fromLocal;
  }

  return fromDb;
}

function readLocalCustomAccountNames() {
  try {
    const raw = localStorage.getItem('financehub_custom_account_names');
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function saveCustomAccountNames(names) {
  const safe = names && typeof names === 'object' ? names : {};
  try {
    localStorage.setItem('financehub_custom_account_names', JSON.stringify(safe));
  } catch (_) { /* ignore quota */ }

  const userId = await getCurrentUserId();
  if (!userId) return;
  const { error } = await supabase
    .from('profiles')
    .update({ custom_account_names: safe })
    .eq('id', userId);

  if (error) {
    console.error('Error saving custom account names:', error);
    throw error;
  }
}

// --- Custom account icons ---
const LOCAL_ICONS_KEY = 'financehub_custom_account_icons';

function readLocalCustomAccountIcons() {
  try {
    const raw = localStorage.getItem(LOCAL_ICONS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function persistLocalCustomAccountIcons(icons) {
  try {
    localStorage.setItem(LOCAL_ICONS_KEY, JSON.stringify(icons && typeof icons === 'object' ? icons : {}));
  } catch (_) { /* ignore quota */ }
}

async function signIconOverlays(overlays) {
  const next = {};
  const entries = Object.entries(overlays || {});
  await Promise.all(entries.map(async ([id, value]) => {
    const overlay = value && typeof value === 'object' ? { ...value } : {};
    if (overlay.path) {
      const { data } = await supabase.storage
        .from(ICON_BUCKET)
        .createSignedUrl(overlay.path, ICON_SIGNED_TTL_SEC);
      overlay.url = data?.signedUrl || overlay.url || null;
    }
    if (overlay.facePath) {
      const { data } = await supabase.storage
        .from(ICON_BUCKET)
        .createSignedUrl(overlay.facePath, ICON_SIGNED_TTL_SEC);
      overlay.faceUrl = data?.signedUrl || overlay.faceUrl || null;
    }
    next[id] = overlay;
  }));
  return next;
}

export async function getCustomAccountIcons() {
  const userId = await getCurrentUserId();
  if (!userId) return readLocalCustomAccountIcons();

  const { data, error } = await supabase
    .from('profiles')
    .select('custom_account_icons')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching custom account icons:', error);
    return readLocalCustomAccountIcons();
  }

  const fromDb = data?.custom_account_icons && typeof data.custom_account_icons === 'object'
    ? data.custom_account_icons
    : {};
  const fromLocal = readLocalCustomAccountIcons();
  if (Object.keys(fromDb).length === 0 && Object.keys(fromLocal).length > 0) {
    await saveCustomAccountIcons(fromLocal);
    return signIconOverlays(fromLocal);
  }
  persistLocalCustomAccountIcons(fromDb);
  return signIconOverlays(fromDb);
}

export async function signStoragePath(path) {
  if (!path) return null;
  if (/^https?:/i.test(path)) return path;
  const { data, error } = await supabase.storage
    .from(ICON_BUCKET)
    .createSignedUrl(path, ICON_SIGNED_TTL_SEC);
  if (error) {
    console.warn('signStoragePath:', error.message);
    return null;
  }
  return data?.signedUrl || null;
}

export async function saveCustomAccountIcons(icons) {
  const safe = icons && typeof icons === 'object' ? icons : {};
  const persisted = {};
  for (const [id, value] of Object.entries(safe)) {
    if (!value || typeof value !== 'object') continue;
    persisted[id] = {};
    if (value.key) persisted[id].key = value.key;
    if (value.path) persisted[id].path = value.path;
    if (value.facePath) persisted[id].facePath = value.facePath;
  }
  persistLocalCustomAccountIcons(persisted);

  const userId = await getCurrentUserId();
  if (!userId) return persisted;
  const { error } = await supabase
    .from('profiles')
    .update({ custom_account_icons: persisted })
    .eq('id', userId);

  if (error) {
    console.error('Error saving custom account icons:', error);
    throw error;
  }
  return signIconOverlays(persisted);
}

export async function uploadAccountIconFile(accountId, file) {
  const invalid = validateIconFile(file);
  if (invalid) throw new Error(invalid);
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Faça login para enviar um ícone.');
  const ext = extFromImageFile(file);
  const path = `${userId}/${accountId}.${ext}`;
  const { error } = await supabase.storage.from(ICON_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || 'image/png',
    cacheControl: '3600',
  });
  if (error) {
    console.error('Error uploading account icon:', error);
    throw error;
  }
  const { data } = await supabase.storage.from(ICON_BUCKET).createSignedUrl(path, ICON_SIGNED_TTL_SEC);
  return { path, url: data?.signedUrl || null };
}

export async function uploadCardFaceFile(accountId, file) {
  const invalid = validateCardFaceFile(file);
  if (invalid) throw new Error(invalid);
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Faça login para enviar a foto do cartão.');
  const ext = extFromImageFile(file);
  const path = `${userId}/${accountId}-face.${ext}`;
  const { error } = await supabase.storage.from(ICON_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || 'image/png',
    cacheControl: '3600',
  });
  if (error) {
    console.error('Error uploading card face:', error);
    throw error;
  }
  const { data } = await supabase.storage.from(ICON_BUCKET).createSignedUrl(path, ICON_SIGNED_TTL_SEC);
  return { path, url: data?.signedUrl || null };
}

export async function deleteAccountIconFile(path) {
  if (!path) return;
  const { error } = await supabase.storage.from(ICON_BUCKET).remove([path]);
  if (error) console.warn('Error deleting account icon:', error.message);
}

// --- Monthly salaries (Momento Financeiro) ---
function readLocalMonthlySalaries() {
  try {
    const raw = localStorage.getItem('financehub_monthly_salaries');
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function getMonthlySalaries() {
  const userId = await getCurrentUserId();
  const fromLocal = readLocalMonthlySalaries();
  if (!userId) return fromLocal;

  const { data, error } = await supabase
    .from('profiles')
    .select('monthly_salaries')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching monthly salaries:', error);
    return fromLocal;
  }

  const fromDb =
    data?.monthly_salaries && typeof data.monthly_salaries === 'object'
      ? data.monthly_salaries
      : {};

  // Heal: local has data, DB empty → sync up
  if (Object.keys(fromDb).length === 0 && Object.keys(fromLocal).length > 0) {
    await saveMonthlySalaries(fromLocal);
    return fromLocal;
  }

  // Prefer DB, but merge any newer local-only months
  const merged = { ...fromLocal, ...fromDb };
  if (JSON.stringify(merged) !== JSON.stringify(fromDb)) {
    await saveMonthlySalaries(merged);
  }
  return merged;
}

export async function saveMonthlySalaries(salaries, opts = {}) {
  const safe = salaries && typeof salaries === 'object' ? salaries : {};
  const currentUserId = await getCurrentUserId();
  if (!currentUserId) return;

  const targetUserId = opts.userId || currentUserId;

  // Only cache locally when saving own salaries
  if (targetUserId === currentUserId) {
    try {
      localStorage.setItem('financehub_monthly_salaries', JSON.stringify(safe));
    } catch (_) { /* ignore */ }
  }

  if (targetUserId === currentUserId) {
    const { error } = await supabase
      .from('profiles')
      .update({ monthly_salaries: safe })
      .eq('id', currentUserId);
    if (error) {
      console.error('Error saving monthly salaries:', error);
      throw error;
    }
    return;
  }

  const { data, error } = await supabase.rpc('update_linked_monthly_salaries', {
    p_target_user_id: targetUserId,
    p_salaries: safe,
  });
  if (error) {
    console.error('Error saving partner monthly salaries:', error);
    throw error;
  }
  if (data && data.success === false) {
    throw new Error(data.message || 'Falha ao salvar salário do parceiro');
  }
}

// --- Custom Pluggy Credentials ---
export async function getPluggyCredentials() {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('pluggy_client_id, pluggy_client_secret')
    .eq('id', userId)
    .single();
    
  if (error) {
    console.error('Error fetching pluggy credentials:', error);
    return null;
  }
  return toCamelCase(data);
}

export async function savePluggyCredentials(clientId, clientSecret) {
  const userId = await getCurrentUserId();
  if (!userId) return;
  const { error } = await supabase
    .from('profiles')
    .update({
      pluggy_client_id: clientId || null,
      pluggy_client_secret: clientSecret || null
    })
    .eq('id', userId);
    
  if (error) {
    console.error('Error saving pluggy credentials:', error);
    throw error;
  }
}

// --- Manual accounts / cards ---
export async function getStoredManualAccounts() {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  const { data, error } = await supabase
    .from('manual_accounts')
    .select('*')
    .eq('user_id', userId);
  if (error) {
    console.error('Error fetching manual accounts:', error);
    throw error;
  }
  return data || [];
}

export async function saveStoredManualAccounts(accounts) {
  const list = (Array.isArray(accounts) ? accounts : [accounts]).filter(Boolean);
  if (!list.length) return;
  const userId = await getCurrentUserId();
  if (!userId) return;

  const rows = list.map((acc) => {
    const type = acc.type === 'CREDIT' ? 'CREDIT' : 'BANK';
    const row = {
      id: acc.id,
      user_id: acc.userId || acc.user_id || userId,
      type,
      name: acc.name,
      institution_name: acc.institutionName
        ?? acc.institution_name
        ?? acc.bankData?.institutionName
        ?? acc.creditData?.institutionName
        ?? '',
      number: acc.number || null,
      balance: type === 'BANK' ? Number(acc.balance) || 0 : 0,
      bill_amount: type === 'CREDIT'
        ? (acc.billAmount == null && acc.bill_amount == null
          ? Number(acc.balance) || 0
          : Number(acc.billAmount ?? acc.bill_amount) || 0)
        : null,
      bill_due_day: type === 'CREDIT' && (acc.billDueDay != null || acc.bill_due_day != null)
        ? Number(acc.billDueDay ?? acc.bill_due_day)
        : null,
      credit_limit: type === 'CREDIT'
        ? (Number(acc.creditLimit ?? acc.credit_limit ?? acc.creditData?.creditLimit) || null)
        : null,
      pair_id: acc.pairId ?? acc.pair_id ?? null,
      updated_at: new Date().toISOString(),
    };
    if (acc.createdAt || acc.created_at) {
      row.created_at = acc.createdAt || acc.created_at;
    }
    return row;
  });

  const { error } = await supabase
    .from('manual_accounts')
    .upsert(rows, { onConflict: 'id' });
  if (error) {
    console.error('Error saving manual accounts:', error);
    throw error;
  }
}

export async function saveStoredManualAccount(account) {
  if (!account) return;
  await saveStoredManualAccounts([account]);
}

export async function deleteStoredManualAccounts(ids) {
  const list = [...new Set((Array.isArray(ids) ? ids : [ids]).filter(Boolean))];
  if (!list.length) return;
  const userId = await getCurrentUserId();
  if (!userId) return;
  const { error } = await supabase
    .from('manual_accounts')
    .delete()
    .eq('user_id', userId)
    .in('id', list);
  if (error) {
    console.error('Error deleting manual accounts:', error);
    throw error;
  }
}

export async function deleteStoredManualTransactionsForAccounts(accountIds) {
  const list = [...new Set((Array.isArray(accountIds) ? accountIds : [accountIds]).filter(Boolean))];
  if (!list.length) return;
  const userId = await getCurrentUserId();
  if (!userId) return;
  const { error } = await supabase
    .from('manual_transactions')
    .delete()
    .eq('user_id', userId)
    .in('account_id', list);
  if (error) {
    console.error('Error deleting manual transactions for accounts:', error);
    throw error;
  }
}

export async function getPluggyItemIds() {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('pluggy_item_ids')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching pluggy item ids:', error);
    return [];
  }
  return Array.isArray(data?.pluggy_item_ids) ? data.pluggy_item_ids.filter(Boolean) : [];
}

// --- Meal benefits (VA/VR) ---
export async function getStoredMealBenefits() {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  const { data, error } = await supabase.from('meal_benefits').select('*').eq('user_id', userId);
  if (error) {
    console.error('Error fetching meal benefits:', error);
    return [];
  }
  return (data || []).map(toCamelCase);
}

export async function saveStoredMealBenefit(benefit) {
  const userId = await getCurrentUserId();
  if (!userId) return;
  const row = {
    id: benefit.id,
    user_id: userId,
    kind: benefit.kind === 'VR' ? 'VR' : 'VA',
    label: benefit.label ?? '',
    monthly_amount: benefit.monthlyAmount ?? benefit.monthly_amount ?? 0,
    credit_day: benefit.creditDay ?? benefit.credit_day,
    starts_on: benefit.startsOn ?? benefit.starts_on,
    opening_balance: benefit.openingBalance ?? benefit.opening_balance ?? 0,
    show_in_moment: Boolean(benefit.showInMoment ?? benefit.show_in_moment),
    updated_at: new Date().toISOString(),
  };
  if (benefit.createdAt || benefit.created_at) {
    row.created_at = benefit.createdAt || benefit.created_at;
  }
  const { error } = await supabase
    .from('meal_benefits')
    .upsert(row, { onConflict: 'id' });
  if (error) {
    console.error('Error saving meal benefit:', error);
    throw error;
  }
}

export async function deleteStoredMealBenefit(id) {
  const userId = await getCurrentUserId();
  if (!userId) return;
  const { error } = await supabase
    .from('meal_benefits')
    .delete()
    .eq('user_id', userId)
    .eq('id', id);
  if (error) {
    console.error('Error deleting meal benefit:', error);
    throw error;
  }
}

export async function getStoredMealBenefitPurchases() {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  const { data, error } = await supabase.from('meal_benefit_purchases').select('*').eq('user_id', userId);
  if (error) {
    console.error('Error fetching meal benefit purchases:', error);
    return [];
  }
  return (data || []).map(toCamelCase);
}

export async function saveStoredMealBenefitPurchase(purchase) {
  const userId = await getCurrentUserId();
  if (!userId) return;
  const row = {
    id: purchase.id,
    user_id: userId,
    benefit_id: purchase.benefitId ?? purchase.benefit_id,
    amount: purchase.amount ?? 0,
    purchased_at: purchase.purchasedAt ?? purchase.purchased_at,
    description: purchase.description ?? '',
    updated_at: new Date().toISOString(),
  };
  if (purchase.createdAt || purchase.created_at) {
    row.created_at = purchase.createdAt || purchase.created_at;
  }
  const { error } = await supabase
    .from('meal_benefit_purchases')
    .upsert(row, { onConflict: 'id' });
  if (error) {
    console.error('Error saving meal benefit purchase:', error);
    throw error;
  }
}

export async function deleteStoredMealBenefitPurchase(id) {
  const userId = await getCurrentUserId();
  if (!userId) return;
  const { error } = await supabase
    .from('meal_benefit_purchases')
    .delete()
    .eq('user_id', userId)
    .eq('id', id);
  if (error) {
    console.error('Error deleting meal benefit purchase:', error);
    throw error;
  }
}
