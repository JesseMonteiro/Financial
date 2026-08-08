import { supabase } from './supabaseClient.js';

export async function getCurrentUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id;
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
    
  if (error) console.error('Error saving budget:', error);
}

export async function deleteStoredBudget(category) {
  const userId = await getCurrentUserId();
  if (!userId) return;
  const { error } = await supabase
    .from('budgets')
    .delete()
    .eq('user_id', userId)
    .eq('category', category);
    
  if (error) console.error('Error deleting budget:', error);
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
    
  if (error) console.error('Error saving goal:', error);
}

export async function deleteStoredGoal(goalId) {
  const userId = await getCurrentUserId();
  if (!userId) return;
  const { error } = await supabase
    .from('goals')
    .delete()
    .eq('user_id', userId)
    .eq('id', goalId);
    
  if (error) console.error('Error deleting goal:', error);
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
    
  if (error) console.error('Error deleting receivable:', error);
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
  return data.map(row => ({
    ...toCamelCase(row),
    isManual: true,
    accountId: 'manual'
  }));
}

export async function saveStoredManualTransaction(tx) {
  const userId = await getCurrentUserId();
  if (!userId) return;

  // Never reassign ownership: existing rows keep DB user_id; new rows belong to caller
  let ownerId = userId;
  if (tx.id) {
    const { data: existing } = await supabase
      .from('manual_transactions')
      .select('user_id')
      .eq('id', tx.id)
      .maybeSingle();
    if (existing?.user_id) {
      ownerId = existing.user_id;
    }
  }

  const snakeTx = toSnakeCase(tx);
  snakeTx.user_id = ownerId;
  delete snakeTx.is_manual;
  delete snakeTx.account_id;
  delete snakeTx.owner_user_id;
  delete snakeTx.owner_label;
  if (snakeTx.is_paid == null) snakeTx.is_paid = false;

  const { error } = await supabase
    .from('manual_transactions')
    .upsert(snakeTx, { onConflict: 'id' });

  if (error) console.error('Error saving manual transaction:', error);
}

export async function deleteStoredManualTransaction(id) {
  const userId = await getCurrentUserId();
  if (!userId) return;
  const { error } = await supabase
    .from('manual_transactions')
    .delete()
    .eq('user_id', userId)
    .eq('id', id);
    
  if (error) console.error('Error deleting manual transaction:', error);
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
    
  if (error) console.error('Error updating profile settings:', error);
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

  if (error) console.error('Error saving custom account names:', error);
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
    if (error) console.error('Error saving monthly salaries:', error);
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
    
  if (error) console.error('Error saving pluggy credentials:', error);
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
