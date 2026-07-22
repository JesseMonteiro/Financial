import { supabase } from './supabaseClient.js';
import { initStorage } from './storage.js';

const MIGRATION_KEY = 'financehub_migration_completed';

export async function migrateLocalDataToSupabase() {
  // 1. Check if migration already done
  if (localStorage.getItem(MIGRATION_KEY)) return;
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  
  try {
    // 2. Open IndexedDB with proper schema initialization
    const db = await initStorage();
    
    // 3. Migrate budgets
    if (db.objectStoreNames.contains('budgets')) {
      const budgets = await db.getAll('budgets');
      if (budgets.length) {
        await supabase.from('budgets').upsert(
          budgets.map(b => ({ user_id: user.id, category: b.category, limit: b.limit })),
          { onConflict: 'user_id,category' }
        );
      }
    }
    
    // 4. Migrate goals
    if (db.objectStoreNames.contains('goals')) {
      const goals = await db.getAll('goals');
      if (goals.length) {
        await supabase.from('goals').upsert(
          goals.map(g => ({
            id: g.id,
            user_id: user.id,
            name: g.name,
            target_amount: g.targetAmount || g.target_amount || 0,
            current_amount: g.currentAmount || g.current_amount || 0,
            deadline: g.deadline,
            icon: g.icon,
            color: g.color
          })),
          { onConflict: 'id' }
        );
      }
    }
    
    // 5. Migrate receivables
    if (db.objectStoreNames.contains('receivables')) {
      const receivables = await db.getAll('receivables');
      if (receivables.length) {
        await supabase.from('receivables').upsert(
          receivables.map(r => ({
            id: r.id,
            user_id: user.id,
            person_name: r.personName || r.person_name,
            person_color: r.personColor || r.person_color,
            description: r.description,
            total_amount: r.totalAmount || r.total_amount,
            original_total_amount: r.originalTotalAmount || r.original_total_amount,
            installments: r.installments,
            paid_installments: r.paidInstallments || r.paid_installments,
            is_continuous: r.isContinuous || r.is_continuous,
            linked_transaction_id: r.linkedTransactionId || r.linked_transaction_id,
            linked_bill_forecast_date: r.linkedBillForecastDate || r.linked_bill_forecast_date,
            notes: r.notes,
            installment_history: r.installmentHistory || r.installment_history
          })),
          { onConflict: 'id' }
        );
      }
    }
    
    // 6. Migrate manual transactions
    if (db.objectStoreNames.contains('manual_transactions')) {
      const manualTxs = await db.getAll('manual_transactions');
      if (manualTxs.length) {
        await supabase.from('manual_transactions').upsert(
          manualTxs.map(t => ({
            id: t.id,
            user_id: user.id,
            description: t.description,
            original_description: t.originalDescription || t.original_description,
            amount: t.amount,
            category: t.category,
            date: t.date,
            type: t.type,
            status: t.status,
            is_recurring: t.isRecurring || t.is_recurring,
            is_continuous: t.isContinuous || t.is_continuous,
            parent_id: t.parentId || t.parent_id,
            frequency: t.frequency,
            merchant: t.merchant
          })),
          { onConflict: 'id' }
        );
      }
    }
    
    // 7. Migrate settings from localStorage
    const settings = {};
    ['theme', 'primaryColor', 'density', 'animationsEnabled', 'currency'].forEach(key => {
      const val = localStorage.getItem(`financehub_${key}`);
      if (val) settings[key] = JSON.parse(val);
    });
    const customNames = localStorage.getItem('financehub_custom_account_names');
    if (Object.keys(settings).length || customNames) {
      await supabase.from('profiles').update({
        theme: settings.theme,
        primary_color: settings.primaryColor,
        density: settings.density,
        animations_enabled: settings.animationsEnabled,
        currency: settings.currency,
        custom_account_names: customNames ? JSON.parse(customNames) : {}
      }).eq('id', user.id);
    }
    
    // 8. Mark migration as done
    localStorage.setItem(MIGRATION_KEY, 'true');
    console.log('[Migration] Dados locais migrados para o Supabase com sucesso!');
  } catch (err) {
    console.error('[Migration] Erro ao migrar dados:', err);
    localStorage.setItem(MIGRATION_KEY, 'true');
  }
}
