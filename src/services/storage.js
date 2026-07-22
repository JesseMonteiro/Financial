import { openDB } from 'idb';

export {
  getStoredBudgets, saveStoredBudget, deleteStoredBudget,
  getStoredGoals, saveStoredGoal, deleteStoredGoal,
  getStoredReceivables, saveStoredReceivable, deleteStoredReceivable,
  getStoredManualTransactions, saveStoredManualTransaction, deleteStoredManualTransaction,
  getProfileSettings, updateProfileSettings,
  getCustomAccountNames, saveCustomAccountNames,
  getPluggyCredentials, savePluggyCredentials, getPluggyItemIds
} from './supabaseStorage.js';

const DB_NAME = 'FinanceHub_DB';
const DB_VERSION = 3;

export async function initStorage() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('budgets')) {
        db.createObjectStore('budgets', { keyPath: 'category' });
      }
      if (!db.objectStoreNames.contains('goals')) {
        db.createObjectStore('goals', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('custom_categories')) {
        db.createObjectStore('custom_categories', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('receivables')) {
        db.createObjectStore('receivables', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('manual_transactions')) {
        db.createObjectStore('manual_transactions', { keyPath: 'id' });
      }
    },
  });
}

// LocalStorage Helpers
export function getLocalSetting(key, fallback) {
  try {
    const val = localStorage.getItem(`financehub_${key}`);
    return val ? JSON.parse(val) : fallback;
  } catch (e) {
    return fallback;
  }
}

export function setLocalSetting(key, value) {
  try {
    localStorage.setItem(`financehub_${key}`, JSON.stringify(value));
  } catch (e) {
    console.error('Erro ao salvar no localStorage', e);
  }
}

// IndexedDB Budget Helpers
export async function local_getStoredBudgets() {
  const db = await initStorage();
  return db.getAll('budgets');
}

export async function local_saveStoredBudget(budget) {
  const db = await initStorage();
  return db.put('budgets', budget);
}

export async function local_deleteStoredBudget(category) {
  const db = await initStorage();
  return db.delete('budgets', category);
}

// IndexedDB Goals Helpers
export async function local_getStoredGoals() {
  const db = await initStorage();
  return db.getAll('goals');
}

export async function local_saveStoredGoal(goal) {
  const db = await initStorage();
  return db.put('goals', goal);
}

export async function local_deleteStoredGoal(goalId) {
  const db = await initStorage();
  return db.delete('goals', goalId);
}

// IndexedDB Receivables Helpers
export async function local_getStoredReceivables() {
  const db = await initStorage();
  return db.getAll('receivables');
}

export async function local_saveStoredReceivable(receivable) {
  const db = await initStorage();
  return db.put('receivables', receivable);
}

export async function local_deleteStoredReceivable(id) {
  const db = await initStorage();
  return db.delete('receivables', id);
}

// IndexedDB Manual Transactions Helpers
export async function local_getStoredManualTransactions() {
  const db = await initStorage();
  return db.getAll('manual_transactions');
}

export async function local_saveStoredManualTransaction(tx) {
  const db = await initStorage();
  return db.put('manual_transactions', tx);
}

export async function local_deleteStoredManualTransaction(id) {
  const db = await initStorage();
  return db.delete('manual_transactions', id);
}
