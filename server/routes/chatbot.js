import { Router } from 'express';
import { checkAuth } from '../middleware/auth.js';
import { getSupabaseClient, getServiceRoleClient } from '../services/supabaseClient.js';
import { createPluggyClient } from '../services/pluggyClient.js';
import { parseNaturalLanguageCommand } from '../services/geminiService.js';
import { summarizeCardOpenBill } from '../../src/utils/creditBillPeriod.js';
import axios from 'axios';

const router = Router();

function asItemIdList(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((id) => typeof id === 'string' && id.length > 0);
}

/** Prefer a complete profile credential pair; otherwise use the shared env pair. Never mix. */
function resolvePluggyCredentials(profile) {
  const profileId = profile?.pluggy_client_id;
  const profileSecret = profile?.pluggy_client_secret;
  if (profileId && profileSecret) {
    return { clientId: profileId, clientSecret: profileSecret, source: 'profile' };
  }
  const envId = process.env.PLUGGY_CLIENT_ID;
  const envSecret = process.env.PLUGGY_CLIENT_SECRET;
  if (envId && envSecret) {
    return { clientId: envId, clientSecret: envSecret, source: 'env' };
  }
  return null;
}

/** Prefer the name the user set in Accounts/Cards over Pluggy's raw name. */
function accountDisplayName(profile, account) {
  const custom = profile?.custom_account_names;
  if (custom && typeof custom === 'object' && account?.id && custom[account.id]) {
    return String(custom[account.id]);
  }
  return account?.name || 'Conta';
}

// Helper para enviar mensagens para o Telegram
async function sendTelegramMessage(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error('[Telegram Chatbot] TELEGRAM_BOT_TOKEN não configurada!');
    return;
  }
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    await axios.post(url, {
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.error('[Telegram Chatbot] Erro ao enviar mensagem:', error.response?.data || error.message);
  }
}

// 1. POST /api/chatbot/telegram/link-token (Autenticado - Gera o token de 6 dígitos)
router.post('/telegram/link-token', checkAuth, async (req, res) => {
  try {
    const supabase = req.supabase;
    const userId = req.user.id;

    const { data: token, error } = await supabase.rpc('generate_telegram_link_token', {
      p_user_id: userId
    });

    if (error) throw error;

    res.json({ success: true, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. POST /api/chatbot/telegram/webhook (Público - Chamado pelo Telegram)
router.post('/telegram/webhook', async (req, res) => {
  // Telegram espera que respondamos 200 OK imediatamente para não reenviar a mensagem em loop
  res.sendStatus(200);

  try {
    const { message } = req.body;
    if (!message || !message.text) return;

    const chatId = message.chat.id.toString();
    const text = message.text.trim();

    // Service role: webhook não tem JWT; precisa ler perfil + manual_transactions sem RLS
    let supabase;
    try {
      supabase = getServiceRoleClient();
    } catch (e) {
      console.warn('[Chatbot] SERVICE_ROLE ausente, fallback anon:', e.message);
      supabase = getSupabaseClient(req);
    }

    // 2.1 Fluxo de ativação de conta (/start TOKEN)
    if (text.startsWith('/start')) {
      const parts = text.split(' ');
      const token = parts[1];

      if (token) {
        const { data: linkResult, error: linkError } = await supabase.rpc('link_telegram_user', {
          p_token: token,
          p_chat_id: chatId
        });

        if (linkError || !linkResult.success) {
          await sendTelegramMessage(chatId, `❌ *Falha ao vincular conta:*\n${linkResult?.message || linkError?.message || 'Token inválido ou expirado.'}`);
        } else {
          await sendTelegramMessage(chatId, `🎉 *Olá, ${linkResult.display_name}!*\n\nSua conta do FinanceHub foi vinculada com sucesso a este Telegram.\n\nAgora você pode conversar comigo de forma natural! Pergunte por exemplo:\n- "Qual meu saldo?"\n- "Gastei 45 reais com uber ontem"\n- "Recebi 1200 de pix"`);
        }
      } else {
        await sendTelegramMessage(chatId, `👋 *Olá! Eu sou o assistente do FinanceHub.*\n\nPara me usar, você precisa conectar sua conta:\n1. Acesse o FinanceHub Web.\n2. Vá na tela de *Configurações*.\n3. Clique em *Conectar Telegram* para gerar seu código de pareamento.`);
      }
      return;
    }

    // 2.2 Verificar se o chatId está vinculado a algum perfil
    const { data: profile, error: profileError } = await supabase.rpc('get_profile_by_telegram_chat_id', {
      p_chat_id: chatId
    });

    if (profileError || !profile || !profile.id) {
      await sendTelegramMessage(chatId, `⚠️ *Conta não vinculada!*\n\nNão consegui encontrar nenhuma conta do FinanceHub associada a este número de chat.\n\nPara vincular:\n1. Vá nas *Configurações* do FinanceHub Web.\n2. Clique em *Conectar Telegram*.\n3. Digite o comando gerado aqui no chat.`);
      return;
    }

    console.log(`[Chatbot] chat=${chatId} user=${profile.id} name=${profile.display_name} items=${asItemIdList(profile.pluggy_item_ids).length}`);

    // 2.3 Processamento de Comandos Tradicionais ou Linguagem Natural com Gemini
    let parsed = { intent: 'UNKNOWN' };

    // Atalhos rápidos sem IA
    const normalized = text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
    if (
      normalized === '/faturas' ||
      normalized === '/fatura' ||
      normalized === '/cartoes' ||
      normalized === 'faturas' ||
      normalized === 'fatura' ||
      /\b(fatura|faturas|cartao(es)? de credito|limite do cartao|divida do cartao)\b/.test(normalized)
    ) {
      parsed = { intent: 'GET_CREDIT_BILLS' };
    } else if (
      normalized === '/saldo' ||
      normalized === 'saldo' ||
      normalized === '/contas' ||
      /\b(saldo|quanto tenho|meu patrimonio|meus saldos|conta corrente|poupanca|saldo das contas)\b/.test(normalized)
    ) {
      parsed = { intent: 'GET_BALANCE' };
    } else if (
      normalized === '/ultimos' ||
      normalized === 'extrato' ||
      /\b(extrato|ultimas? (compras|transacoes|lancamentos)|ultimos gastos)\b/.test(normalized)
    ) {
      parsed = { intent: 'GET_TRANSACTIONS' };
    } else if (
      normalized === '/resumo' ||
      normalized === 'resumo' ||
      /\b(resumo (da |dessa )?semana|quanto gastei (essa|esta) semana|recap)\b/.test(normalized)
    ) {
      parsed = { intent: 'GET_WEEKLY_SUMMARY' };
    } else {
      // Processar linguagem natural via Gemini
      try {
        parsed = await parseNaturalLanguageCommand(text);
      } catch (geminiErr) {
        console.error('[Chatbot] Erro no Gemini:', geminiErr.message);
        parsed = { intent: 'UNKNOWN', message: 'Desculpe, tive um problema de comunicação com minha inteligência artificial. Tente /saldo, /faturas, /resumo ou /ultimos.' };
      }
    }

    // 2.4 Tratamento da Intenção
    switch (parsed.intent) {
      case 'GET_BALANCE': {
        await sendTelegramMessage(chatId, '🔍 _Buscando saldo das contas..._');
        const balanceText = await fetchUserBalancesText(profile, supabase);
        await sendTelegramMessage(chatId, balanceText);
        break;
      }

      case 'GET_CREDIT_BILLS': {
        await sendTelegramMessage(chatId, '🔍 _Buscando faturas dos cartões..._');
        const billsText = await fetchUserCreditBillsText(profile);
        await sendTelegramMessage(chatId, billsText);
        break;
      }

      case 'GET_TRANSACTIONS': {
        await sendTelegramMessage(chatId, '🔍 _Buscando seus lançamentos recentes..._');
        const transactionsText = await fetchUserTransactionsText(profile, supabase);
        await sendTelegramMessage(chatId, transactionsText);
        break;
      }

      case 'GET_WEEKLY_SUMMARY': {
        await sendTelegramMessage(chatId, '🔍 _Montando resumo da semana..._');
        const recapText = await fetchUserWeeklyRecapText(profile, supabase);
        await sendTelegramMessage(chatId, recapText);
        break;
      }

      case 'ADD_TRANSACTION': {
        const { amount, description, category, type, date_offset_days = 0 } = parsed.data || {};
        if (!amount || !description) {
          await sendTelegramMessage(chatId, `❌ *Não consegui cadastrar a transação:*\nFaltou me informar o valor ou a descrição do gasto.`);
          return;
        }

        const formattedCategory = category || 'Outros';
        const formattedType = type || 'DEBIT';

        // Salva a transação manual no Supabase via RPC
        const { data: txResult, error: txError } = await supabase.rpc('create_manual_transaction_from_telegram', {
          p_chat_id: chatId,
          p_amount: amount,
          p_description: description,
          p_category: formattedCategory,
          p_type: formattedType,
          p_date_offset_days: date_offset_days
        });

        if (txError || !txResult.success) {
          await sendTelegramMessage(chatId, `❌ *Erro ao salvar transação:* ${txError?.message || txResult?.message}`);
        } else {
          const emoji = formattedType === 'CREDIT' ? '💰' : '💸';
          const typeText = formattedType === 'CREDIT' ? 'Receita' : 'Despesa';
          await sendTelegramMessage(
            chatId,
            `${emoji} *${typeText} Cadastrada com Sucesso!*\n\n📝 *Descrição:* ${description}\n💵 *Valor:* R$ ${amount.toFixed(2)}\n📂 *Categoria:* ${formattedCategory}`
          );
        }
        break;
      }

      case 'UNKNOWN':
      default: {
        const helpMessage = parsed.message || `Olá! Sou o assistente do FinanceHub.\n\nComo posso ajudar?\n- *Saldo das contas:* "Qual meu saldo?" ou /saldo\n- *Faturas do cartão:* "Minhas faturas" ou /faturas\n- *Resumo semanal:* "Resumo da semana" ou /resumo\n- *Despesas:* "Gastei 55 reais no supermercado hoje"`;
        await sendTelegramMessage(chatId, helpMessage);
        break;
      }
    }

  } catch (err) {
    console.error('[Chatbot Webhook] Erro geral:', err);
  }
});

async function fetchPluggyAccounts(profile) {
  const pluggyItemIds = asItemIdList(profile.pluggy_item_ids);
  const creds = resolvePluggyCredentials(profile);
  if (pluggyItemIds.length === 0 || !creds) {
    return [];
  }

  const pluggyClient = await createPluggyClient(creds.clientId, creds.clientSecret);
  const promises = pluggyItemIds.map(async (itemId) => {
    try {
      const res = await pluggyClient.get('/accounts', { params: { itemId } });
      return res.data.results || res.data || [];
    } catch (e) {
      console.warn(`[Chatbot Pluggy] Falha ao buscar contas do item ${itemId} (${creds.source}):`, e.response?.data || e.message);
      return [];
    }
  });
  return (await Promise.all(promises)).flat();
}

async function fetchAllPluggyTransactions(pluggyClient, accountId) {
  let results = [];
  let next = null;
  let guard = 0;
  // Cursor pagination without pageSize (Pluggy v2)
  do {
    try {
      const res = next
        ? await axios.get(next.startsWith('http') ? next : `https://api.pluggy.ai${next}`, {
            headers: { 'X-API-KEY': pluggyClient.defaults.headers['X-API-KEY'] },
          })
        : await pluggyClient.get('/v2/transactions', { params: { accountId } });
      const data = res.data || {};
      results = results.concat(data.results || []);
      next = data.next || null;
    } catch (e) {
      console.warn('[Chatbot] tx fetch fail', accountId, e.response?.data || e.message);
      break;
    }
    guard++;
  } while (next && guard < 30);
  return results;
}

async function fetchPluggyBills(pluggyClient, accountId) {
  try {
    const res = await pluggyClient.get('/bills', { params: { accountId } });
    return res.data.results || res.data || [];
  } catch (e) {
    console.warn('[Chatbot] bills fail', accountId, e.response?.data || e.message);
    return [];
  }
}

// Helper: só contas bancárias (BANK) + carteira manual
async function fetchUserBalancesText(profile, supabase) {
  try {
    const accounts = await fetchPluggyAccounts(profile);
    const bankAccounts = accounts.filter((a) => a.type === 'BANK');

    let manualBalance = 0;
    const { data: manualTxs } = await supabase
      .from('manual_transactions')
      .select('amount, type')
      .eq('user_id', profile.id);

    if (manualTxs) {
      manualTxs.forEach(tx => {
        const amt = Number(tx.amount);
        if (tx.type === 'DEBIT') {
          manualBalance -= amt;
        } else {
          manualBalance += amt;
        }
      });
    }

    const money = (v) => `R$ ${Number(v).toFixed(2)}`;
    let text = `🏦 *Saldos das contas — ${profile.display_name}*\n\n`;
    let bankTotal = 0;

    if (bankAccounts.length > 0) {
      bankAccounts.forEach(acc => {
        const bal = Number(acc.balance || 0);
        bankTotal += bal;
        text += `• *${accountDisplayName(profile, acc)}*: ${money(bal)}\n`;
      });
      text += `\n💵 *Total em contas:* ${money(bankTotal)}`;
    } else {
      text += `_Nenhuma conta bancária conectada._`;
    }

    if (manualBalance !== 0) {
      text += `\n📦 *Carteira manual:* ${money(manualBalance)}`;
      text += `\n📊 *Total disponível:* ${money(bankTotal + manualBalance)}`;
    }

    text += `\n\n_Para faturas de cartão, diga "faturas" ou /faturas._`;
    return text;
  } catch (err) {
    console.error('[Chatbot Balance Text] Erro:', err);
    return "❌ Erro ao compilar informações de saldo.";
  }
}

// Helper: fatura aberta (ciclo atual) por cartão — mesma regra do app
async function fetchUserCreditBillsText(profile) {
  try {
    const accounts = await fetchPluggyAccounts(profile);
    const creditCards = accounts.filter((a) => a.type === 'CREDIT');
    const money = (v) => `R$ ${Number(v).toFixed(2)}`;

    let text = `💳 *Faturas em aberto — ${profile.display_name}*\n\n`;
    let creditDebt = 0;

    if (!creditCards.length) {
      return `${text}_Nenhum cartão de crédito conectado._\n\n_Para saldo de contas, diga "saldo" ou /saldo._`;
    }

    const creds = resolvePluggyCredentials(profile);
    if (!creds) {
      return `${text}_Credenciais Pluggy indisponíveis._`;
    }
    const pluggyClient = await createPluggyClient(creds.clientId, creds.clientSecret);

    for (const acc of creditCards) {
      const [bills, txs] = await Promise.all([
        fetchPluggyBills(pluggyClient, acc.id),
        fetchAllPluggyTransactions(pluggyClient, acc.id),
      ]);
      const summary = summarizeCardOpenBill(acc, txs, bills);
      creditDebt += summary.openTotal;

      const last4 = acc.number ? ` • final ${String(acc.number).slice(-4)}` : '';
      const due = summary.openDueDate
        ? `\n  Vencimento: ${new Date(summary.openDueDate).toLocaleDateString('pt-BR')}`
        : '';
      const limit = summary.creditLimit != null
        ? `\n  Limite total: ${money(summary.creditLimit)}`
        : '';
      const available = summary.availableLimit != null
        ? `\n  Limite disponível: ${money(summary.availableLimit)}`
        : '';
      const lastPaid = summary.lastPaidTitle
        ? `\n  Última paga: ${summary.lastPaidTitle} (${money(summary.lastPaidTotal || 0)})`
        : '';

      text += `• *${accountDisplayName(profile, acc)}*${last4}\n`;
      text += `  ${summary.openTitle} (em aberto): *${money(summary.openTotal)}*${due}`;
      text += `\n  ${summary.openItemCount} lançamentos${limit}${available}${lastPaid}\n\n`;
    }

    text += `🧾 *Total em faturas abertas:* ${money(creditDebt)}`;
    text += `\n\n_Valor = soma dos lançamentos da *próxima fatura* (ciclo aberto), não a dívida total do cartão._`;
    text += `\n_Para saldo de contas, diga "saldo" ou /saldo._`;
    return text;
  } catch (err) {
    console.error('[Chatbot Credit Bills] Erro:', err);
    return "❌ Erro ao buscar faturas dos cartões.";
  }
}

// Helper para compilar transações recentes do Pluggy + Manual
async function fetchUserTransactionsText(profile, supabase) {
  try {
    let transactions = [];
    const pluggyItemIds = asItemIdList(profile.pluggy_item_ids);
    const creds = resolvePluggyCredentials(profile);

    // 1. Buscar transações do Pluggy (somente itemIds deste perfil)
    if (pluggyItemIds.length > 0 && creds) {
      try {
        const pluggyClient = await createPluggyClient(creds.clientId, creds.clientSecret);

        const accPromises = pluggyItemIds.map(async (itemId) => {
          try {
            const res = await pluggyClient.get('/accounts', { params: { itemId } });
            return res.data.results || [];
          } catch (e) { return []; }
        });
        const accounts = (await Promise.all(accPromises)).flat();
        const accountIds = accounts.map(a => a.id);

        if (accountIds.length > 0) {
          const txPromises = accountIds.slice(0, 3).map(async (accId) => {
            try {
              const res = await pluggyClient.get('/v2/transactions', { params: { accountId: accId, pageSize: 5 } });
              return res.data.results || [];
            } catch (e) { return []; }
          });
          const pluggyTxs = (await Promise.all(txPromises)).flat();
          pluggyTxs.forEach(t => {
            const tAmount = Number(t.amount);
            transactions.push({
              date: new Date(t.date),
              description: t.description,
              amount: tAmount,
              type: tAmount < 0 ? 'DEBIT' : 'CREDIT',
              category: t.category || 'Outros',
              origin: 'Banco'
            });
          });
        }
      } catch (pluggyErr) {
        console.warn('[Chatbot Tx] Erro Pluggy Client:', pluggyErr.message);
      }
    }

    // 2. Buscar últimas 5 transações manuais do Supabase (somente deste user_id)
    const { data: manualTxs } = await supabase
      .from('manual_transactions')
      .select('date, description, amount, type, category')
      .eq('user_id', profile.id)
      .order('date', { ascending: false })
      .limit(5);

    if (manualTxs) {
      manualTxs.forEach(t => {
        transactions.push({
          date: new Date(t.date),
          description: t.description,
          amount: Number(t.amount),
          type: t.type,
          category: t.category || 'Outros',
          origin: 'Manual'
        });
      });
    }

    if (transactions.length === 0) {
      return "📝 Nenhuma transação recente encontrada.";
    }

    transactions.sort((a, b) => b.date - a.date);

    let text = `📝 *Últimos Lançamentos de ${profile.display_name}:*\n\n`;
    transactions.slice(0, 8).forEach(tx => {
      const dateStr = tx.date.toLocaleDateString('pt-BR');
      const prefix = tx.type === 'CREDIT' ? '🟢' : '🔴';
      const amountSign = tx.type === 'CREDIT' ? '+' : '-';
      const absAmount = Math.abs(tx.amount).toFixed(2);

      text += `${prefix} *${dateStr}* - ${tx.description}\n     Valor: R$ ${amountSign}${absAmount} [${tx.origin}] (${tx.category})\n`;
    });

    return text;
  } catch (err) {
    console.error('[Chatbot Tx Text] Erro:', err);
    return "❌ Erro ao buscar extrato de lançamentos.";
  }
}

/** Resumo semanal: gastos dos últimos 7 dias vs 7 anteriores + top categoria */
async function fetchUserWeeklyRecapText(profile, supabase) {
  try {
    const money = (n) =>
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

    const txs = [];
    const pluggyItemIds = asItemIdList(profile.pluggy_item_ids);
    const creds = resolvePluggyCredentials(profile);

    if (pluggyItemIds.length > 0 && creds) {
      try {
        const pluggyClient = await createPluggyClient(creds.clientId, creds.clientSecret);
        const accounts = (
          await Promise.all(
            pluggyItemIds.map(async (itemId) => {
              try {
                const res = await pluggyClient.get('/accounts', { params: { itemId } });
                return res.data.results || [];
              } catch {
                return [];
              }
            })
          )
        ).flat();

        const from = prevStart.toISOString().slice(0, 10);
        await Promise.all(
          accounts.slice(0, 6).map(async (acc) => {
            try {
              const res = await pluggyClient.get('/v2/transactions', {
                params: { accountId: acc.id, pageSize: 50, from },
              });
              (res.data.results || []).forEach((t) => {
                txs.push({
                  date: new Date(t.date),
                  amount: Number(t.amount),
                  category: t.category || 'Outros',
                  description: t.description || '',
                });
              });
            } catch {
              /* ignore per-account errors */
            }
          })
        );
      } catch (e) {
        console.warn('[Chatbot Recap] Pluggy:', e.message);
      }
    }

    const { data: manualTxs } = await supabase
      .from('manual_transactions')
      .select('date, description, amount, type, category')
      .eq('user_id', profile.id)
      .gte('date', prevStart.toISOString().slice(0, 10))
      .order('date', { ascending: false })
      .limit(100);

    (manualTxs || []).forEach((t) => {
      txs.push({
        date: new Date(t.date),
        amount: Number(t.amount),
        type: t.type || (Number(t.amount) < 0 ? 'DEBIT' : 'CREDIT'),
        category: t.category || 'Outros',
        description: t.description || '',
      });
    });

    const isExpense = (t) => Number(t.amount) < 0 || t.type === 'DEBIT';
    const inRange = (t, from, to) => t.date >= from && t.date <= to;

    const sumWeek = (from, to) => {
      let total = 0;
      const cats = {};
      txs.forEach((t) => {
        if (!isExpense(t) || !inRange(t, from, to)) return;
        const desc = (t.description || '').toUpperCase();
        if (desc.includes('PAGAMENTO DE FATURA') || desc.includes('PAGAMENTO RECEBIDO')) return;
        const amt = Math.abs(Number(t.amount) || 0);
        total += amt;
        cats[t.category] = (cats[t.category] || 0) + amt;
      });
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

    let text = `📊 *Resumo semanal de ${profile.display_name}*\n\n`;
    text += `💸 Gastos (7 dias): *${money(current.total)}*\n`;
    text += `📅 Semana anterior: ${money(previous.total)} (${Number(deltaPct) > 0 ? '+' : ''}${deltaPct}%)\n`;
    if (current.top) {
      text += `🏷 Maior categoria: *${current.top[0]}* (${money(current.top[1])})\n`;
    }
    text += `\n_Diga /faturas para ver cartões ou /saldo para contas._`;
    return text;
  } catch (err) {
    console.error('[Chatbot Recap] Erro:', err);
    return '❌ Erro ao montar o resumo semanal.';
  }
}

export default router;
