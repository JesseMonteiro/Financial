export interface TelegramProfile {
  id: string;
  display_name?: string;
  telegram_chat_id?: string;
  pluggy_item_ids?: unknown;
  pluggy_client_id?: string | null;
  pluggy_client_secret?: string | null;
  custom_account_names?: Record<string, string> | null;
}

export interface DailyTransactionItem {
  id?: string;
  date: Date;
  rawDate: string;
  description: string;
  amount: number;
  absAmount: number;
  type: string;
  category: string;
  accountName: string;
  origin: string;
  isBillPayment: boolean;
}

export interface DailySummaryResult {
  targetDateStr: string;
  displayDate: string;
  transactions: DailyTransactionItem[];
  transactionCount: number;
  hasTransactions: boolean;
  totalExpenses: number;
  totalIncome: number;
  expenseCount: number;
  incomeCount: number;
  netDay: number;
  categories: Array<{ category: string; amount: number; emoji: string; percentage: number }>;
  consolidatedStatus: {
    bankTotal: number;
    manualBalance: number;
    totalAvailable: number;
    creditDebt: number;
    netConsolidated: number;
    hasBankAccounts: boolean;
    hasCreditCards: boolean;
  };
}
