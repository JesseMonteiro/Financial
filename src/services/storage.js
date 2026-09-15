import { openDB } from 'idb';

export {
  getCurrentUserId,
  getStoredBudgets, saveStoredBudget, deleteStoredBudget,
  getStoredGoals, saveStoredGoal, deleteStoredGoal,
  getStoredPurchaseCategories, saveStoredPurchaseCategory, deleteStoredPurchaseCategory,
  getStoredReceivables, saveStoredReceivable, deleteStoredReceivable,
  getStoredManualTransactions, saveStoredManualTransaction, saveStoredManualTransactions,
  deleteStoredManualTransaction, deleteStoredManualTransactions,
  getStoredManualAccounts, saveStoredManualAccount, saveStoredManualAccounts,
  deleteStoredManualAccounts, deleteStoredManualTransactionsForAccounts,
  getProfileSettings, updateProfileSettings,
  getCustomAccountNames, saveCustomAccountNames,
  getCustomAccountIcons, saveCustomAccountIcons, uploadAccountIconFile, uploadCardFaceFile, deleteAccountIconFile,
  getMonthlySalaries, saveMonthlySalaries,
  getPluggyCredentials, savePluggyCredentials, getPluggyItemIds,
  getStoredMealBenefits, saveStoredMealBenefit, deleteStoredMealBenefit,
  getStoredMealBenefitPurchases, saveStoredMealBenefitPurchase, deleteStoredMealBenefitPurchase,
} from './supabaseStorage.js';

const DB_NAME = 'MeuFlux_DB';
const LEGACY_DB_NAME = 'FinanceHub_DB';
const DB_VERSION = 3;
const LS_PREFIX = 'meuflux_';
const LEGACY_LS_PREFIX = 'financehub_';
const LS_MIGRATED_FLAG = 'meuflux_storage_keys_migrated';
const IDB_MIGRATED_FLAG = 'meuflux_idb_migrated';

export function migrateLocalStorageKeysOnce() {
  if (typeof window === 'undefined') return;
  try {
    if (localStorage.getItem(LS_MIGRATED_FLAG)) return;
    const toCopy = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(LEGACY_LS_PREFIX)) toCopy.push(key);
    }
    for (const oldKey of toCopy) {
      const newKey = LS_PREFIX + oldKey.slice(LEGACY_LS_PREFIX.length);
      if (localStorage.getItem(newKey) == null) {
        localStorage.setItem(newKey, localStorage.getItem(oldKey));
      }
    }
    const legacyDone = localStorage.getItem('financehub_migration_completed');
    if (legacyDone && !localStorage.getItem('meuflux_migration_completed')) {
      localStorage.setItem('meuflux_migration_completed', legacyDone);
    }
    localStorage.setItem(LS_MIGRATED_FLAG, '1');
  } catch {
    /* private mode / quota */
  }
}

async function copyLegacyIndexedDBIfNeeded(newDb) {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') return;
  try {
    if (localStorage.getItem(IDB_MIGRATED_FLAG)) return;

    const legacy = await new Promise((resolve) => {
      const req = indexedDB.open(LEGACY_DB_NAME);
      let created = false;
      req.onupgradeneeded = () => {
        created = true;
      };
      req.onsuccess = () => {
        const db = req.result;
        if (created) {
          db.close();
          indexedDB.deleteDatabase(LEGACY_DB_NAME);
          resolve(null);
          return;
        }
        resolve(db);
      };
      req.onerror = () => resolve(null);
    });

    if (!legacy) {
      localStorage.setItem(IDB_MIGRATED_FLAG, '1');
      return;
    }

    try {
      const storeNames = Array.from(legacy.objectStoreNames);
      for (const storeName of storeNames) {
        if (!newDb.objectStoreNames.contains(storeName)) continue;
        const existing = await newDb.getAll(storeName);
        if (existing.length > 0) continue;
        const rows = await new Promise((resolve, reject) => {
          const tx = legacy.transaction(storeName, 'readonly');
          const req = tx.objectStore(storeName).getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => reject(req.error);
        });
        const tx = newDb.transaction(storeName, 'readwrite');
        for (const row of rows) {
          await tx.store.put(row);
        }
        await tx.done;
      }
    } finally {
      legacy.close();
      localStorage.setItem(IDB_MIGRATED_FLAG, '1');
    }
  } catch {
    try {
      localStorage.setItem(IDB_MIGRATED_FLAG, '1');
    } catch {
      /* ignore */
    }
  }
}

export async function initStorage() {
  migrateLocalStorageKeysOnce();
  const db = await openDB(DB_NAME, DB_VERSION, {
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
  await copyLegacyIndexedDBIfNeeded(db);
  return db;
}

if (typeof window !== 'undefined') {
  migrateLocalStorageKeysOnce();
}

// LocalStorage Helpers
export function getLocalSetting(key, fallback) {
  try {
    migrateLocalStorageKeysOnce();
    const val = localStorage.getItem(`${LS_PREFIX}${key}`)
      ?? localStorage.getItem(`${LEGACY_LS_PREFIX}${key}`);
    return val ? JSON.parse(val) : fallback;
  } catch (e) {
    return fallback;
  }
}

export function setLocalSetting(key, value) {
  try {
    localStorage.setItem(`${LS_PREFIX}${key}`, JSON.stringify(value));
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
