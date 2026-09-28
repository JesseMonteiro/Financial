import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { errorResponse, jsonResponse } from "../../middleware/http.ts";
import { summarizeCardOpenBill } from "../../creditBillPeriod.ts";
import { asItemIdList, pluggyJson, type PluggyClient } from "../pluggy.ts";
import { handleCreditCards } from "../creditCards.ts";
import type { TelegramProfile } from "./types.ts";
import {
  sendTelegramMessage,
  resolvePluggyCredentials,
  accountDisplayName,
  formatMoney,
  reservedBalancesFromAccount,
  fetchPluggyAccountsForProfile,
  fetchPluggyBillsForAccount,
  fetchAllPluggyTransactionsForAccount,
} from "./telegramApi.ts";
import {
  buildDailySummaryDataEdge,
  formatDailySummaryMessageEdge,
} from "./dailySummary.ts";

const MAX_VOICE_DURATION_SEC = 60;

export async function downloadTelegramAudioFile(fileId: string): Promise<{ base64: string; mimeType: string }> {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN missing');

  const metaRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`);
  if (!metaRes.ok) throw new Error(`getFile failed: ${await metaRes.text()}`);
  const meta = await metaRes.json();
  const filePath = meta?.result?.file_path as string | undefined;
  if (!filePath) throw new Error('Arquivo de áudio não encontrado no Telegram');

  const fileRes = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);
  if (!fileRes.ok) throw new Error(`file download failed: ${fileRes.status}`);
  const bytes = new Uint8Array(await fileRes.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);

  const lower = filePath.toLowerCase();
  let mimeType = 'audio/ogg';
  if (lower.endsWith('.mp3')) mimeType = 'audio/mpeg';
  else if (lower.endsWith('.m4a') || lower.endsWith('.mp4')) mimeType = 'audio/mp4';
  else if (lower.endsWith('.wav')) mimeType = 'audio/wav';

  return { base64, mimeType };
}

export async function transcribeAudioWithGemini(base64: string, mimeType = 'audio/ogg'): Promise<string> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY missing');

  const prompt =
    'Transcreva este áudio em português do Brasil. Retorne APENAS o texto falado, sem aspas, sem explicações e sem pontuação extra inventada. Se não houver fala audível, retorne uma string vazia.';
  const models = ['gemini-2.5-flash', 'gemini-2.0-flash'];
  let lastError = '';

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            { inline_data: { mime_type: mimeType, data: base64 } },
            { text: prompt },
          ],
        }],
        generationConfig: { temperature: 0.1 },
      }),
    });
    if (!res.ok) {
      lastError = await res.text();
      console.error(`[telegram] Gemini STT error (${model}):`, lastError);
      continue;
    }
    const data = await res.json();
    const raw = String(data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();
    return raw.replace(/^["'«»]|["'«»]$/g, '').trim();
  }

  throw new Error(lastError || 'Falha na transcrição com Gemini');
}

export type TelegramVoiceOrAudio = {
  file_id: string;
  duration?: number;
  mime_type?: string;
};

export async function resolveMessageText(
  message: {
    text?: string;
    voice?: TelegramVoiceOrAudio;
    audio?: TelegramVoiceOrAudio;
  },
  chatId: string,
): Promise<string | null> {
  const voiceOrAudio = message.voice || message.audio;
  if (voiceOrAudio) {
    const duration = Number(voiceOrAudio.duration || 0);
    if (duration > MAX_VOICE_DURATION_SEC) {
      await sendTelegramMessage(
        chatId,
        `⏱ Áudio muito longo (${duration}s). Envie um comando com até *${MAX_VOICE_DURATION_SEC} segundos* ou digite o texto.`,
      );
      return null;
    }

    await sendTelegramMessage(chatId, '🎧 _Transcrevendo áudio..._');
    try {
      const { base64, mimeType: pathMime } = await downloadTelegramAudioFile(voiceOrAudio.file_id);
      const mimeType = message.audio?.mime_type || pathMime || 'audio/ogg';
      const transcript = await transcribeAudioWithGemini(base64, mimeType);
      if (!transcript) {
        await sendTelegramMessage(
          chatId,
          '❌ Não consegui entender o áudio. Tente falar de novo com mais clareza ou digite o comando.',
        );
        return null;
      }
      await sendTelegramMessage(chatId, `📝 _Entendi:_ "${transcript}"`);
      return transcript;
    } catch (err) {
      console.error('[telegram] STT error:', err);
      await sendTelegramMessage(
        chatId,
        '❌ Falha ao processar o áudio. Tente novamente em instantes ou digite o comando.',
      );
      return null;
    }
  }

  if (message.text) return message.text.trim();
  return null;
}

export async function parseIntentWithGemini(text: string): Promise<{ intent: string; data?: Record<string, unknown>; message?: string }> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) return { intent: 'UNKNOWN', message: 'Assistente de linguagem natural indisponível no momento.' };

  const system = `Você é o assistente do MeuFlux. Retorne APENAS JSON:
{"intent":"ADD_TRANSACTION"|"GET_BALANCE"|"GET_CREDIT_BILLS"|"GET_TRANSACTIONS"|"GET_WEEKLY_SUMMARY"|"GET_DAILY_SUMMARY"|"UNKNOWN","data":{"amount":number,"description":string,"category":string,"type":"DEBIT"|"CREDIT","date_offset_days":number},"message":string}
Regras de intent:
- GET_BALANCE: saldo de conta corrente/poupança/banco (ex: "qual meu saldo?", "saldo das contas"). NÃO use para fatura ou cartão.
- GET_CREDIT_BILLS: fatura/dívida/limite de cartão de crédito (ex: "minhas faturas", "fatura do cartão", "quanto está a fatura").
- GET_TRANSACTIONS: extrato/últimos lançamentos.
- GET_WEEKLY_SUMMARY: resumo da semana / quanto gastei esta semana / /resumo.
- GET_DAILY_SUMMARY: resumo do dia anterior / ontem, quanto gastei ontem, transações de ontem, /ontem, /diario.
- ADD_TRANSACTION: registrar gasto ou receita.
Categorias: Alimentação, Transporte, Moradia, Lazer, Saúde, Educação, Outros.`;

  const models = ['gemini-2.5-flash', 'gemini-2.0-flash'];
  let lastError = '';
  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text }] }],
        generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
      }),
    });
    if (!res.ok) {
      lastError = await res.text();
      console.error(`[telegram] Gemini error (${model}):`, lastError);
      continue;
    }
    const data = await res.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
    try {
      return JSON.parse(raw);
    } catch {
      return { intent: 'UNKNOWN', message: 'Não consegui entender o comando.' };
    }
  }

  return {
    intent: 'UNKNOWN',
    message: 'Desculpe, tive um problema ao interpretar sua mensagem. Tente /saldo, /faturas ou /ultimos.',
  };
}

export function parseIntentLocally(text: string): { intent: string; data?: Record<string, unknown>; message?: string } | null {
  const lower = text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');

  if (
    lower === '/faturas' ||
    lower === '/fatura' ||
    lower === '/cartoes' ||
    lower === 'faturas' ||
    lower === 'fatura' ||
    /\b(fatura|faturas|cartao(es)? de credito|limite do cartao|divida do cartao)\b/.test(lower)
  ) {
    return { intent: 'GET_CREDIT_BILLS' };
  }

  if (
    lower === '/saldo' ||
    lower === 'saldo' ||
    lower === '/contas' ||
    /\b(saldo|quanto tenho|meu patrimonio|meus saldos|conta corrente|poupanca|saldo das contas)\b/.test(lower)
  ) {
    return { intent: 'GET_BALANCE' };
  }

  if (
    lower === '/ontem' ||
    lower === '/diario' ||
    lower === 'ontem' ||
    lower === 'diario' ||
    /\b(resumo (de )?ontem|gastos? (de )?ontem|quanto gastei ontem|o que gastei ontem|transacoes (de )?ontem|lancamentos (de )?ontem|resumo diario)\b/.test(lower)
  ) {
    return { intent: 'GET_DAILY_SUMMARY' };
  }

  if (
    lower === '/ultimos' ||
    lower === 'extrato' ||
    /\b(extrato|ultimas? (compras|transacoes|lancamentos)|ultimos gastos)\b/.test(lower)
  ) {
    return { intent: 'GET_TRANSACTIONS' };
  }

  if (
    lower === '/resumo' ||
    lower === 'resumo' ||
    /\b(resumo (da |dessa )?semana|quanto gastei (essa|esta) semana|recap)\b/.test(lower)
  ) {
    return { intent: 'GET_WEEKLY_SUMMARY' };
  }

  return null;
}

export async function buildBankBalanceText(profile: TelegramProfile, supabase: SupabaseClient): Promise<string> {
  const accounts = await fetchPluggyAccountsForProfile(profile);
  const bankAccounts = accounts.filter((a) => a.type === 'BANK');

  let manualBalance = 0;
  const { data: manualTxs } = await supabase
    .from('manual_transactions')
    .select('amount, type')
    .eq('user_id', profile.id);

  (manualTxs || []).forEach((tx: { amount: number; type: string }) => {
    const amt = Number(tx.amount);
    manualBalance += tx.type === 'DEBIT' ? -amt : amt;
  });

  let text = `🏦 *Saldos das contas — ${profile.display_name || 'usuário'}*\n\n`;
  let bankTotal = 0;

  if (bankAccounts.length) {
    for (const acc of bankAccounts) {
      const bal = Number(acc.balance || 0);
      const boxes = reservedBalancesFromAccount(acc);
      const reserved = boxes.reduce((s, b) => s + b.amount, 0);
      const total = bal + reserved;
      bankTotal += total;
      text += `• *${accountDisplayName(profile, acc)}*: ${formatMoney(bal)}`;
      if (acc.owner) text += `\n  _Titular: ${acc.owner}_`;
      if (boxes.length) {
        for (const box of boxes) {
          text += `\n  🐷 ${box.name}: ${formatMoney(box.amount)}`;
        }
        text += `\n  *Total na conta:* ${formatMoney(total)}`;
      }
      text += `\n`;
    }
    text += `\n💵 *Total em contas:* ${formatMoney(bankTotal)}`;
  } else {
    text += `_Nenhuma conta bancária conectada._`;
  }

  if (manualBalance !== 0) {
    text += `\n📦 *Carteira manual:* ${formatMoney(manualBalance)}`;
    text += `\n📊 *Total disponível:* ${formatMoney(bankTotal + manualBalance)}`;
  }

  text += `\n\n_Para faturas de cartão, diga "faturas" ou /faturas._`;
  return text;
}

export async function buildCreditBillsText(profile: TelegramProfile): Promise<string> {
  const accounts = await fetchPluggyAccountsForProfile(profile);
  const creditCards = accounts.filter((a) => a.type === 'CREDIT');

  let text = `💳 *Faturas em aberto — ${profile.display_name || 'usuário'}*\n\n`;
  let creditDebt = 0;

  if (!creditCards.length) {
    return `${text}_Nenhum cartão de crédito conectado._\n\n_Para saldo de contas, diga "saldo" ou /saldo._`;
  }

  const creds = resolvePluggyCredentials(profile);
  if (!creds) {
    return `${text}_Credenciais Pluggy indisponíveis._`;
  }
  const client = { clientId: creds.clientId, clientSecret: creds.clientSecret };

  for (const acc of creditCards) {
    const [bills, txs] = await Promise.all([
      fetchPluggyBillsForAccount(client, acc.id),
      fetchAllPluggyTransactionsForAccount(client, acc.id),
    ]);
    const summary = summarizeCardOpenBill(acc, txs, bills);
    creditDebt += summary.openTotal;

    const last4 = acc.number ? ` • final ${String(acc.number).slice(-4)}` : '';
    const due = summary.openDueDate
      ? `\n  Vencimento: ${new Date(summary.openDueDate).toLocaleDateString('pt-BR')}`
      : '';
    const limit = summary.creditLimit != null
      ? `\n  Limite total: ${formatMoney(summary.creditLimit)}`
      : '';
    const available = summary.availableLimit != null
      ? `\n  Limite disponível: ${formatMoney(summary.availableLimit)}`
      : '';
    const lastPaid = summary.lastPaidTitle
      ? `\n  Última paga: ${summary.lastPaidTitle} (${formatMoney(summary.lastPaidTotal || 0)})`
      : '';

    text += `• *${accountDisplayName(profile, acc)}*${last4}\n`;
    text += `  ${summary.openTitle} (em aberto): *${formatMoney(summary.openTotal)}*${due}`;
    text += `\n  ${summary.openItemCount} lançamentos${limit}${available}${lastPaid}\n\n`;
  }

  text += `🧾 *Total em faturas abertas:* ${formatMoney(creditDebt)}`;
  text += `\n\n_Valor = soma dos lançamentos da *próxima fatura* (ciclo aberto), não a dívida total do cartão._`;
  text += `\n_Para saldo de contas, diga "saldo" ou /saldo._`;
  return text;
}

export async function buildTransactionsText(profile: TelegramProfile, supabase: SupabaseClient): Promise<string> {
  const transactions: Array<{ date: Date; description: string; amount: number; type: string; category: string; origin: string }> = [];
  const itemIds = asItemIdList(profile.pluggy_item_ids);
  const creds = resolvePluggyCredentials(profile);

  if (itemIds.length && creds) {
    const client = { clientId: creds.clientId, clientSecret: creds.clientSecret };
    const accounts = await fetchPluggyAccountsForProfile(profile);
    for (const acc of accounts.slice(0, 3)) {
      try {
        const d = await pluggyJson(client, '/v2/transactions', {
          params: { accountId: acc.id },
        }) as { results?: Array<{ date: string; description: string; amount: number; category?: string }> };
        for (const t of d.results || []) {
          const amount = Number(t.amount);
          transactions.push({
            date: new Date(t.date),
            description: t.description,
            amount,
            type: amount < 0 ? 'DEBIT' : 'CREDIT',
            category: t.category || 'Outros',
            origin: 'Banco',
          });
        }
      } catch (_) {
        // Ignorar falha na leitura da conta
      }
    }
  }

  const { data: manualTxs } = await supabase
    .from('manual_transactions')
    .select('date, description, amount, type, category')
    .eq('user_id', profile.id)
    .order('date', { ascending: false })
    .limit(5);

  for (const t of manualTxs || []) {
    transactions.push({
      date: new Date(t.date),
      description: t.description,
      amount: Number(t.amount),
      type: t.type,
      category: t.category || 'Outros',
      origin: 'Manual',
    });
  }

  if (!transactions.length) return '📝 Nenhuma transação recente encontrada.';
  transactions.sort((a, b) => b.date.getTime() - a.date.getTime());

  let text = `📝 *Últimos Lançamentos de ${profile.display_name || 'usuário'}:*\n\n`;
  for (const tx of transactions.slice(0, 8)) {
    const dateStr = tx.date.toLocaleDateString('pt-BR');
    const prefix = tx.type === 'CREDIT' ? '🟢' : '🔴';
    const sign = tx.type === 'CREDIT' ? '+' : '-';
    text += `${prefix} *${dateStr}* - ${tx.description}\n     Valor: R$ ${sign}${Math.abs(tx.amount).toFixed(2)} [${tx.origin}] (${tx.category})\n`;
  }
  return text;
}

export async function buildWeeklyRecapText(profile: TelegramProfile, supabase: SupabaseClient): Promise<string> {
  const money = (n: number) =>
    Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const now = new Date();
  const thisStart = new Date(now);
  thisStart.setDate(thisStart.getDate() - 6);
  thisStart.setHours(0, 0, 0, 0);
  const prevEnd = new Date(thisStart);
  prevEnd.setDate(prevEnd.getDate() - 1);
  prevEnd.setHours(23, 59, 59, 999);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - 6);
  prevStart.setHours(0, 0, 0, 0);

  const txs: Array<{ date: Date; amount: number; type?: string; category: string; description: string }> = [];
  const accounts = await fetchPluggyAccountsForProfile(profile);
  const creds = resolvePluggyCredentials(profile);
  if (creds) {
    const client = { clientId: creds.clientId, clientSecret: creds.clientSecret };
    for (const acc of accounts.slice(0, 6)) {
      try {
        const d = await pluggyJson(client, '/v2/transactions', {
          params: { accountId: acc.id, pageSize: 50, from: prevStart.toISOString().slice(0, 10) },
        }) as { results?: Array<{ date: string; description: string; amount: number; category?: string }> };
        for (const t of d.results || []) {
          txs.push({
            date: new Date(t.date),
            amount: Number(t.amount),
            category: t.category || 'Outros',
            description: t.description || '',
          });
        }
      } catch (_) {
        // Ignorar falha na leitura da conta
      }
    }
  }

  const { data: manualTxs } = await supabase
    .from('manual_transactions')
    .select('date, description, amount, type, category')
    .eq('user_id', profile.id)
    .gte('date', prevStart.toISOString().slice(0, 10))
    .order('date', { ascending: false })
    .limit(100);

  for (const t of manualTxs || []) {
    txs.push({
      date: new Date(t.date),
      amount: Number(t.amount),
      type: t.type || (Number(t.amount) < 0 ? 'DEBIT' : 'CREDIT'),
      category: t.category || 'Outros',
      description: t.description || '',
    });
  }

  const isExpense = (t: { amount: number; type?: string }) =>
    Number(t.amount) < 0 || t.type === 'DEBIT';
  const inRange = (t: { date: Date }, from: Date, to: Date) => t.date >= from && t.date <= to;
  const sumWeek = (from: Date, to: Date) => {
    let total = 0;
    const cats: Record<string, number> = {};
    for (const t of txs) {
      if (!isExpense(t) || !inRange(t, from, to)) continue;
      const desc = (t.description || '').toUpperCase();
      if (desc.includes('PAGAMENTO DE FATURA') || desc.includes('PAGAMENTO RECEBIDO')) continue;
      const amt = Math.abs(Number(t.amount) || 0);
      total += amt;
      cats[t.category] = (cats[t.category] || 0) + amt;
    }
    const top = Object.entries(cats).sort((a, b) => b[1] - a[1])[0];
    return { total, top };
  };

  const current = sumWeek(thisStart, now);
  const previous = sumWeek(prevStart, prevEnd);
  const deltaPct =
    previous.total > 0
      ? (((current.total - previous.total) / previous.total) * 100).toFixed(0)
      : current.total > 0
        ? '100'
        : '0';

  let text = `📊 *Resumo semanal de ${profile.display_name || 'usuário'}*\n\n`;
  text += `💸 Gastos (7 dias): *${money(current.total)}*\n`;
  text += `📅 Semana anterior: ${money(previous.total)} (${Number(deltaPct) > 0 ? '+' : ''}${deltaPct}%)\n`;
  if (current.top) {
    text += `🏷 Maior categoria: *${current.top[0]}* (${money(current.top[1])})\n`;
  }
  text += `\n_Diga /faturas para cartões ou /saldo para contas._`;
  return text;
}

export async function handleTelegramWebhook(payload: unknown): Promise<void> {
  const message = (payload as {
    message?: {
      chat?: { id?: number | string };
      text?: string;
      voice?: TelegramVoiceOrAudio;
      audio?: TelegramVoiceOrAudio;
    };
  })?.message;
  if (!message || message.chat?.id == null) return;

  const chatId = String(message.chat.id);
  const text = await resolveMessageText(message, chatId);
  if (!text) return;

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase = createClient(supabaseUrl, serviceKey);

  if (text.startsWith('/start')) {
    const token = text.split(/\s+/)[1];
    if (!token) {
      await sendTelegramMessage(chatId, '👋 *Olá! Eu sou o assistente do MeuFlux.*\n\nVincule sua conta em *Configurações → Conectar Telegram*.');
      return;
    }
    const { data: linkResult, error } = await supabase.rpc('link_telegram_user', { p_token: token, p_chat_id: chatId });
    if (error || !linkResult?.success) {
      await sendTelegramMessage(chatId, `❌ *Falha ao vincular:* ${linkResult?.message || error?.message || 'Token inválido'}`);
    } else {
      await sendTelegramMessage(chatId, `🎉 *Olá, ${linkResult.display_name}!*\n\nConta vinculada. Experimente:\n• /saldo — contas\n• /faturas — cartões`);
    }
    return;
  }

  const { data: profile, error: profileError } = await supabase.rpc('get_profile_by_telegram_chat_id', { p_chat_id: chatId });
  if (profileError || !profile?.id) {
    await sendTelegramMessage(chatId, '⚠️ *Conta não vinculada!*\nVá em Configurações do MeuFlux e conecte o Telegram.');
    return;
  }

  console.log(`[telegram] chat=${chatId} user=${profile.id} name=${profile.display_name} items=${asItemIdList(profile.pluggy_item_ids).length}`);

  let parsed: { intent: string; data?: Record<string, unknown>; message?: string } = { intent: 'UNKNOWN' };
  const local = parseIntentLocally(text);
  if (local) parsed = local;
  else parsed = await parseIntentWithGemini(text);

  if (parsed.intent === 'GET_BALANCE') {
    await sendTelegramMessage(chatId, '🔍 _Buscando saldo das contas..._');
    await sendTelegramMessage(chatId, await buildBankBalanceText(profile, supabase));
    return;
  }

  if (parsed.intent === 'GET_CREDIT_BILLS') {
    await sendTelegramMessage(chatId, '🔍 _Buscando faturas dos cartões..._');
    await sendTelegramMessage(chatId, await buildCreditBillsText(profile));
    return;
  }

  if (parsed.intent === 'GET_DAILY_SUMMARY') {
    await sendTelegramMessage(chatId, '🔍 _Montando resumo de ontem..._');
    const summaryData = await buildDailySummaryDataEdge(profile, supabase);
    await sendTelegramMessage(chatId, formatDailySummaryMessageEdge(profile, summaryData));
    return;
  }

  if (parsed.intent === 'GET_TRANSACTIONS') {
    await sendTelegramMessage(chatId, '🔍 _Buscando lançamentos..._');
    await sendTelegramMessage(chatId, await buildTransactionsText(profile, supabase));
    return;
  }

  if (parsed.intent === 'GET_WEEKLY_SUMMARY') {
    await sendTelegramMessage(chatId, '🔍 _Montando resumo da semana..._');
    await sendTelegramMessage(chatId, await buildWeeklyRecapText(profile, supabase));
    return;
  }

  if (parsed.intent === 'ADD_TRANSACTION') {
    const amount = Number(parsed.data?.amount);
    const description = String(parsed.data?.description || '');
    if (!amount || !description) {
      await sendTelegramMessage(chatId, '❌ Informe o valor e a descrição do lançamento.');
      return;
    }
    const formattedType = (parsed.data?.type as string) || 'DEBIT';
    const formattedCategory = (parsed.data?.category as string) || 'Outros';
    const dateOffset = Number(parsed.data?.date_offset_days || 0);
    const { data: txResult, error: txError } = await supabase.rpc('create_manual_transaction_from_telegram', {
      p_chat_id: chatId,
      p_amount: amount,
      p_description: description,
      p_category: formattedCategory,
      p_type: formattedType,
      p_date_offset_days: dateOffset,
    });
    if (txError || !txResult?.success) {
      await sendTelegramMessage(chatId, `❌ Erro ao salvar: ${txError?.message || txResult?.message}`);
    } else {
      const emoji = formattedType === 'CREDIT' ? '💰' : '💸';
      const typeText = formattedType === 'CREDIT' ? 'Receita' : 'Despesa';
      await sendTelegramMessage(chatId, `${emoji} *${typeText} cadastrada!*\n📝 ${description}\n💵 R$ ${amount.toFixed(2)}\n📂 ${formattedCategory}`);
    }
    return;
  }

  await sendTelegramMessage(
    chatId,
    parsed.message ||
      'Olá! Posso ajudar com:\n• *Saldo das contas:* "qual meu saldo?" ou /saldo\n• *Faturas do cartão:* "minhas faturas" ou /faturas\n• *Resumo de ontem:* "resumo de ontem" ou /ontem\n• *Resumo semanal:* "resumo da semana" ou /resumo\n• *Registrar gasto:* "gastei 50 no mercado"'
  );
}

export async function handleTelegramWebhookRequest(req: Request): Promise<Response> {
  const secretHeader = req.headers.get('x-telegram-bot-api-secret-token');
  const expectedSecret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET');
  if (expectedSecret && secretHeader !== expectedSecret) {
    return errorResponse('Não autorizado: secret token inválido', 401);
  }
  let body: unknown = {};
  try {
    body = await req.json();
  } catch (_) {
    // Body vazio
  }
  await handleTelegramWebhook(body);
  return jsonResponse({ ok: true });
}

export async function handleEdgeChatbotMessage(
  body: unknown,
  supabaseClient?: SupabaseClient,
  userId?: string
): Promise<Response> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    return errorResponse('GEMINI_API_KEY não configurada no servidor', 500);
  }
  const payload = (body || {}) as {
    message?: string;
    history?: Array<{ role: string; text: string }>;
    context?: Record<string, unknown>;
  };
  const message = payload?.message;
  if (!message || typeof message !== 'string') {
    return errorResponse('Mensagem inválida ou ausente', 400);
  }

  let ctx: Record<string, unknown> = (payload.context && typeof payload.context === 'object')
    ? { ...(payload.context as Record<string, unknown>) }
    : {};

  // Auto-enrich credit cards context if creditPurchases is empty or missing
  if (supabaseClient && userId && (!Array.isArray(ctx.creditPurchases) || (ctx.creditPurchases as unknown[]).length === 0)) {
    try {
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('pluggy_item_ids, pluggy_client_id, pluggy_client_secret')
        .eq('id', userId)
        .maybeSingle();

      const clientId = profile?.pluggy_client_id || Deno.env.get('PLUGGY_CLIENT_ID');
      const clientSecret = profile?.pluggy_client_secret || Deno.env.get('PLUGGY_CLIENT_SECRET');
      const itemIds = asItemIdList(profile?.pluggy_item_ids);

      if (clientId && clientSecret) {
        const clientConfig: PluggyClient = {
          clientId,
          clientSecret,
          itemIds,
          userId,
          supabase: supabaseClient,
        };

        const ccResponse = await handleCreditCards(clientConfig);
        if (ccResponse.ok) {
          const ccData = await ccResponse.json();
          if (Array.isArray(ccData.cards) && (!Array.isArray(ctx.cards) || (ctx.cards as unknown[]).length === 0)) {
            ctx.cards = ccData.cards;
          }
          const periods = (ccData.periods || {}) as Record<string, { bills?: Array<{ dueMonth?: string; items?: Array<Record<string, unknown>> }> }>;
          const allPeriod = periods.all || Object.values(periods)[0];
          const bills = allPeriod?.bills || [];
          const enrichedPurchases: Array<Record<string, unknown>> = [];
          for (const bill of bills) {
            for (const item of (bill.items || [])) {
              if (item.isPayment) continue;
              const totalInst = Number(item.installmentTotal || 0);
              const numInst = Number(item.installmentNumber || 0);
              const isInst = totalInst > 1;
              enrichedPurchases.push({
                cardName: String(item.accountName || 'Cartão'),
                description: String(item.description || 'Compra'),
                amount: Number(item.amount) || 0,
                amountLabel: `R$ ${item.amount}`,
                purchaseDate: item.purchaseDate ? String(item.purchaseDate) : null,
                date: item.purchaseDate ? String(item.purchaseDate) : null,
                dueMonth: bill.dueMonth || '',
                isInstallment: isInst,
                installmentLabel: isInst ? `Parcela ${numInst || 1}/${totalInst}` : 'À vista (não parcelada)',
                category: item.category ? String(item.category) : ''
              });
            }
          }
          if (enrichedPurchases.length > 0) {
            ctx.creditPurchases = enrichedPurchases;
          }
        }
      }
    } catch (e) {
      console.error('[chatbot] Failed to auto-enrich credit cards context:', e);
    }
  }

  const contextStr = JSON.stringify(ctx, null, 2);

  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [
    {
      role: 'user',
      parts: [{ text: `Aqui está o meu contexto financeiro atualizado do MeuFlux:\n\`\`\`json\n${contextStr}\n\`\`\`\nPor favor, use esses dados para responder às minhas próximas perguntas com precisão.` }]
    },
    {
      role: 'model',
      parts: [{ text: 'Entendido! Tenho acesso ao seu contexto financeiro completo (contas, cartões, compras, faturas e orçamentos). Como posso te ajudar hoje?' }]
    }
  ];

  if (Array.isArray(payload.history)) {
    for (const h of payload.history.slice(-8)) {
      if (!h.text) continue;
      contents.push({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.text }]
      });
    }
  }

  contents.push({
    role: 'user',
    parts: [{ text: message }]
  });

  const systemInstruction = `Você é o assistente financeiro inteligente do MeuFlux.
Seu objetivo é responder a perguntas do usuário com precisão, clareza e simpatia em Português do Brasil.
Baseie-se nos dados financeiros fornecidos no contexto (contas, cartões, compras, faturas e orçamentos).
Para compras de cartão de crédito:
- Compras NÃO PARCELADAS (à vista): isInstallment é falso, ou installmentLabel contém "À vista" ou "não parcelada", ou descrição não possui indicação de parcelas.
- Compras PARCELADAS: isInstallment é verdadeiro, ou total de parcelas > 1, ou descrição/installmentLabel indica parcela.
- Ao filtrar por mês (ex: outubro), considere tanto o mês da data da compra (purchaseDate / date, ex: 2026-10-XX) quanto o mês de vencimento da fatura (dueMonth, ex: 2026-10).
- Ao filtrar por cartão (ex: "Amazon", "cartão Amazon", "Nubank"), busque por correspondência aproximada no nome do cartão (ex: "Amazon Prime Bradescard" corresponde a "Amazon").
- Se encontrar compras que atendam aos filtros, liste cada uma delas com o nome/estabelecimento, data, valor em R$ e o cartão, e informe a soma total das compras encontradas.
- Se não encontrar compras com os filtros exatos, informe com clareza quais cartões e faturas estão registrados no contexto para orientar o usuário.`;

  try {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const res = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents,
        generationConfig: { temperature: 0.2, maxOutputTokens: 1024 }
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      return errorResponse(`Erro no serviço Gemini: ${errText}`, 502);
    }

    const data = await res.json();
    const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Não foi possível gerar uma resposta.';
    return jsonResponse({ success: true, reply: replyText.trim(), model: 'gemini' });
  } catch (err) {
    return errorResponse(`Falha ao comunicar com a IA: ${(err as Error).message}`, 500);
  }
}
