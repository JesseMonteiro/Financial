import { type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { summarizeCardOpenBill, isBillPayment } from "../../creditBillPeriod.ts";
import { translateCategory } from "../../utils/dashboardAnalytics.ts";
import { errorResponse, jsonResponse } from "../../middleware/http.ts";
import { pluggyJson } from "../pluggy.ts";
import type { TelegramProfile, DailyTransactionItem, DailySummaryResult } from "./types.ts";
import {
  sendTelegramMessage,
  escapeTelegramMd,
  getCategoryEmojiEdge,
  getYesterdayDateInfoEdge,
  fetchPluggyAccountsForProfile,
  resolvePluggyCredentials,
  accountDisplayName,
  fetchPluggyBillsForAccount,
  fetchAllPluggyTransactionsForAccount,
} from "./telegramApi.ts";

export async function buildDailySummaryDataEdge(
  profile: TelegramProfile,
  supabase: SupabaseClient,
  options: { date?: string } = {}
): Promise<DailySummaryResult> {
  const targetDateStr = options.date || getYesterdayDateInfoEdge().yesterdayStr;
  const [yy, mm, dd] = targetDateStr.split('-');
  const displayDate = `${dd}/${mm}/${yy}`;

  const transactions: DailyTransactionItem[] = [];
  const accounts = await fetchPluggyAccountsForProfile(profile);
  const creds = resolvePluggyCredentials(profile);

  // 1. Pluggy transactions
  if (accounts.length && creds) {
    const client = { clientId: creds.clientId, clientSecret: creds.clientSecret };
    for (const acc of accounts) {
      try {
        const d = (await pluggyJson(client, '/v2/transactions', {
          params: { accountId: acc.id, from: targetDateStr, pageSize: 100 },
        })) as { results?: Array<{ id?: string; date: string; description: string; amount: number; category?: string }> };

        for (const t of d.results || []) {
          const rawDate = String(t.date || '');
          if (rawDate.slice(0, 10) === targetDateStr) {
            const tAmount = Number(t.amount || 0);
            const isPayment = isBillPayment(t);
            const isDebit = tAmount < 0;
            const translatedCat = translateCategory(t.category || 'Outros');
            transactions.push({
              id: t.id,
              date: new Date(t.date),
              rawDate,
              description: t.description || 'Transação Bancária',
              amount: tAmount,
              absAmount: Math.abs(tAmount),
              type: isDebit ? 'DEBIT' : 'CREDIT',
              category: translatedCat,
              accountName: accountDisplayName(profile, acc),
              origin: 'Banco',
              isBillPayment: isPayment,
            });
          }
        }
      } catch (e) {
        console.warn('[daily-edge] txs fail', acc.id, e);
      }
    }
  }

  // 2. Manual transactions
  try {
    const { data: manualTxs } = await supabase
      .from('manual_transactions')
      .select('id, date, description, amount, type, category')
      .eq('user_id', profile.id)
      .gte('date', targetDateStr)
      .lt('date', `${targetDateStr}T23:59:59.999Z\uffff`);

    for (const t of manualTxs || []) {
      const rawDate = String(t.date || '');
      if (rawDate.slice(0, 10) === targetDateStr) {
        const numAmt = Number(t.amount || 0);
        const isDebit = t.type === 'DEBIT' || numAmt < 0;
        const absAmt = Math.abs(numAmt);
        transactions.push({
          id: t.id,
          date: new Date(t.date),
          rawDate,
          description: t.description || 'Lançamento Manual',
          amount: isDebit ? -absAmt : absAmt,
          absAmount: absAmt,
          type: isDebit ? 'DEBIT' : 'CREDIT',
          category: translateCategory(t.category || 'Outros'),
          accountName: 'Carteira Manual',
          origin: 'Manual',
          isBillPayment: false,
        });
      }
    }
  } catch (mErr) {
    console.warn('[daily-edge] manual fail', mErr);
  }

  transactions.sort((a, b) => b.date.getTime() - a.date.getTime());

  // 3. Totals and categories
  let totalExpenses = 0;
  let totalIncome = 0;
  let expenseCount = 0;
  let incomeCount = 0;
  const categoryTotals: Record<string, number> = {};

  for (const tx of transactions) {
    if (tx.type === 'DEBIT') {
      if (!tx.isBillPayment) {
        totalExpenses += tx.absAmount;
        expenseCount++;
        const cat = tx.category || 'Outros';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + tx.absAmount;
      }
    } else {
      if (!tx.isBillPayment) {
        totalIncome += tx.absAmount;
        incomeCount++;
      }
    }
  }
  const netDay = totalIncome - totalExpenses;

  const sortedCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount]) => ({
      category,
      amount,
      emoji: getCategoryEmojiEdge(category),
      percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
    }));

  // 4. Status consolidado atual
  const bankAccounts = accounts.filter((a) => a.type === 'BANK');
  let bankTotal = 0;
  for (const acc of bankAccounts) {
    const bal = Number(acc.balance || 0);
    const boxes = (acc.bankData?.reservedBalances || []).map((item) => {
      const amounts = Array.isArray(item?.availableAmounts) ? item.availableAmounts : [];
      return amounts.reduce((sum, a) => sum + (Number(a?.amount) || 0), 0);
    });
    const reserved = boxes.reduce((sum, b) => sum + b, 0);
    bankTotal += (bal + reserved);
  }

  let manualBalance = 0;
  const { data: allManualTxs } = await supabase
    .from('manual_transactions')
    .select('amount, type')
    .eq('user_id', profile.id);
  for (const tx of allManualTxs || []) {
    const amt = Number(tx.amount || 0);
    if (tx.type === 'DEBIT') manualBalance -= amt;
    else manualBalance += amt;
  }

  const totalAvailable = bankTotal + manualBalance;

  const creditCards = accounts.filter((a) => a.type === 'CREDIT');
  let creditDebt = 0;
  if (creditCards.length && creds) {
    const client = { clientId: creds.clientId, clientSecret: creds.clientSecret };
    for (const acc of creditCards) {
      try {
        const [bills, txs] = await Promise.all([
          fetchPluggyBillsForAccount(client, acc.id),
          fetchAllPluggyTransactionsForAccount(client, acc.id),
        ]);
        const summary = summarizeCardOpenBill(acc, txs, bills);
        creditDebt += Number(summary.openTotal || 0);
      } catch (e) {
        console.warn('[daily-edge] bill fail', acc.id, e);
      }
    }
  }

  const netConsolidated = totalAvailable - creditDebt;

  return {
    targetDateStr,
    displayDate,
    transactions,
    transactionCount: transactions.length,
    hasTransactions: transactions.length > 0,
    totalExpenses,
    totalIncome,
    expenseCount,
    incomeCount,
    netDay,
    categories: sortedCategories,
    consolidatedStatus: {
      bankTotal,
      manualBalance,
      totalAvailable,
      creditDebt,
      netConsolidated,
      hasBankAccounts: bankAccounts.length > 0,
      hasCreditCards: creditCards.length > 0,
    },
  };
}

export function formatDailySummaryMessageEdge(profile: TelegramProfile, summaryData: DailySummaryResult): string {
  const money = (v: number) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const userName = escapeTelegramMd(profile.display_name || 'você');

  if (!summaryData.hasTransactions) {
    let emptyMsg = `📅 *Resumo de Ontem — ${summaryData.displayDate}*\n`;
    emptyMsg += `_Olá, ${userName}!_\n\n`;
    emptyMsg += `ℹ️ *Nenhuma transação foi realizada no dia anterior.*\n\n`;
    emptyMsg += `━━━━━━━━━━━━━━━━━━━━\n`;
    emptyMsg += `📊 *Status Consolidado Atual:*\n`;
    emptyMsg += `🏦 Contas & Reservas: *${money(summaryData.consolidatedStatus.bankTotal)}*\n`;
    if (summaryData.consolidatedStatus.manualBalance !== 0) {
      emptyMsg += `📦 Carteira manual: *${money(summaryData.consolidatedStatus.manualBalance)}*\n`;
    }
    if (summaryData.consolidatedStatus.hasCreditCards || summaryData.consolidatedStatus.creditDebt > 0) {
      emptyMsg += `💳 Faturas em aberto: *${money(summaryData.consolidatedStatus.creditDebt)}*\n`;
    }
    emptyMsg += `💰 *Saldo líquido disponível:* *${money(summaryData.consolidatedStatus.netConsolidated)}*\n`;
    return emptyMsg;
  }

  let text = `🌅 *Resumo de Ontem — ${summaryData.displayDate}*\n`;
  text += `_Olá, ${userName}! Aqui está o resumo das suas movimentações do dia anterior:_\n\n`;

  // Balanço do Dia
  text += `📊 *Balanço do Dia:*\n`;
  text += `💸 Despesas: *${money(summaryData.totalExpenses)}* (${summaryData.expenseCount} ${summaryData.expenseCount === 1 ? 'lançamento' : 'lançamentos'})\n`;
  if (summaryData.totalIncome > 0) {
    text += `💰 Receitas: *${money(summaryData.totalIncome)}* (${summaryData.incomeCount} ${summaryData.incomeCount === 1 ? 'entrada' : 'entradas'})\n`;
  }
  const netSign = summaryData.netDay > 0 ? '+' : '';
  const netEmoji = summaryData.netDay >= 0 ? '🟢' : '🔴';
  text += `${netEmoji} Resultado do dia: *${netSign}${money(summaryData.netDay)}*\n\n`;

  // Gastos por Categoria
  if (summaryData.categories.length > 0) {
    text += `📂 *Gastos por Categoria:*\n`;
    for (const c of summaryData.categories) {
      text += `• ${c.emoji} *${escapeTelegramMd(c.category)}*: ${money(c.amount)} (${c.percentage.toFixed(0)}%)\n`;
    }
    text += `\n`;
  }

  // Lista de Transações
  text += `📝 *Lançamentos de Ontem:*\n`;
  const MAX_DISPLAY_TX = 15;
  const displayedTxs = summaryData.transactions.slice(0, MAX_DISPLAY_TX);
  for (const tx of displayedTxs) {
    const isCredit = tx.type === 'CREDIT';
    const prefix = isCredit ? '🟢' : '🔴';
    const sign = isCredit ? '+' : '-';
    const desc = escapeTelegramMd(tx.description);
    const acc = escapeTelegramMd(tx.accountName);
    const cat = escapeTelegramMd(tx.category);
    text += `${prefix} *${desc}*\n     ${sign}${money(tx.absAmount)} • [${acc}] (${cat})\n`;
  }

  if (summaryData.transactions.length > MAX_DISPLAY_TX) {
    text += `_... e mais ${summaryData.transactions.length - MAX_DISPLAY_TX} lançamentos._\n`;
  }

  text += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  text += `📊 *Status Consolidado Atual:*\n`;
  text += `🏦 Contas & Reservas: *${money(summaryData.consolidatedStatus.bankTotal)}*\n`;
  if (summaryData.consolidatedStatus.manualBalance !== 0) {
    text += `📦 Carteira manual: *${money(summaryData.consolidatedStatus.manualBalance)}*\n`;
  }
  if (summaryData.consolidatedStatus.hasCreditCards || summaryData.consolidatedStatus.creditDebt > 0) {
    text += `💳 Faturas em aberto: *${money(summaryData.consolidatedStatus.creditDebt)}*\n`;
  }
  text += `💰 *Saldo líquido disponível:* *${money(summaryData.consolidatedStatus.netConsolidated)}*\n`;

  return text;
}

export async function sendDailySummaryToUserEdge(
  profile: TelegramProfile,
  supabase: SupabaseClient,
  options: { date?: string; dryRun?: boolean; force?: boolean } = {}
): Promise<{ success?: boolean; skipped?: boolean; reason?: string; summaryData?: DailySummaryResult }> {
  const chatId = String(profile.telegram_chat_id || '');
  if (!chatId) return { skipped: true, reason: 'no_telegram_chat_id' };

  const summaryData = await buildDailySummaryDataEdge(profile, supabase, options);
  if (!summaryData.hasTransactions && !options.force) {
    return { skipped: true, reason: 'no_transactions', summaryData };
  }

  const messageText = formatDailySummaryMessageEdge(profile, summaryData);
  if (options.dryRun) {
    console.log(`[daily-edge-dry] ${profile.display_name}:\n${messageText}`);
    return { success: true, summaryData };
  }

  const sent = await sendTelegramMessage(chatId, messageText);
  if (sent) {
    try {
      await supabase
        .from('profiles')
        .update({ last_telegram_daily_summary_date: summaryData.targetDateStr })
        .eq('id', profile.id);
    } catch (_) {
      // Ignorar erro de log de persistência
    }
  }
  return { success: sent, summaryData };
}

export async function executeDailySummaryEdge(
  supabase: SupabaseClient,
  options: { date?: string; userId?: string; dryRun?: boolean; force?: boolean } = {}
): Promise<Record<string, unknown>> {
  let query = supabase
    .from('profiles')
    .select('id, display_name, telegram_chat_id, pluggy_item_ids, pluggy_client_id, pluggy_client_secret, custom_account_names, last_telegram_daily_summary_date')
    .not('telegram_chat_id', 'is', null)
    .neq('telegram_chat_id', '');

  if (options.userId) query = query.eq('id', options.userId);

  const { data: profiles, error } = await query;
  if (error) throw error;
  if (!profiles || !profiles.length) {
    return { success: true, message: 'Nenhum usuário com Telegram conectado.', processed: 0, sent: 0 };
  }

  const dateInfo = options.date ? { yesterdayStr: options.date } : getYesterdayDateInfoEdge();
  const results = [];

  for (const p of profiles) {
    if (!options.force && p.last_telegram_daily_summary_date === dateInfo.yesterdayStr) {
      results.push({ userId: p.id, name: p.display_name, skipped: true, reason: 'already_sent_today' });
      continue;
    }
    try {
      const res = await sendDailySummaryToUserEdge(p as TelegramProfile, supabase, {
        date: dateInfo.yesterdayStr,
        dryRun: options.dryRun,
        force: options.force,
      });
      results.push({ userId: p.id, name: p.display_name, ...res });
    } catch (e) {
      results.push({ userId: p.id, name: p.display_name, error: (e as Error).message });
    }
  }

  const sentCount = results.filter((r) => r.success && !options.dryRun).length;
  const skippedCount = results.filter((r) => r.skipped).length;

  return {
    success: true,
    date: dateInfo.yesterdayStr,
    processed: profiles.length,
    sent: sentCount,
    skipped: skippedCount,
    results,
  };
}

export async function handleDailySummaryRequest(
  req: Request,
  supabaseClient: SupabaseClient,
  body?: unknown,
): Promise<Response> {
  const authHeader = req.headers.get('authorization') || '';
  const cronHeader = req.headers.get('x-cron-secret') || '';
  const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  const expectedCron = Deno.env.get('CRON_SECRET') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

  const isCronSecretValid = Boolean(expectedCron && (cronHeader === expectedCron || bearerToken === expectedCron));
  const isServiceRoleValid = Boolean(serviceRoleKey && bearerToken === serviceRoleKey);

  if (!isCronSecretValid && !isServiceRoleValid) {
    return errorResponse('Não autorizado: CRON_SECRET ou SUPABASE_SERVICE_ROLE_KEY obrigatório', 401);
  }

  const res = await executeDailySummaryEdge(supabaseClient, (body as Record<string, unknown>) || {});
  return jsonResponse(res);
}
