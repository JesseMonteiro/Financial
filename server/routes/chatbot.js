import { Router } from 'express';
import { checkAuth } from '../middleware/auth.js';
import { getSupabaseClient, getServiceRoleClient } from '../services/supabaseClient.js';
import { createPluggyClient } from '../services/pluggyClient.js';
import { parseNaturalLanguageCommand, transcribeAudioCommand } from '../services/geminiService.js';
import { summarizeCardOpenBill, isBillPayment } from '../../src/utils/creditBillPeriod.js';
import { translateCategory } from '../../src/utils/categories.js';
import axios from 'axios';

const router = Router();

const MAX_VOICE_DURATION_SEC = 60;

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

/** Escapa caracteres especiais para modo Markdown do Telegram */
export function escapeTelegramMd(text) {
  if (!text) return '';
  return String(text).replace(/([_*\[\]`])/g, '\\$1');
}

/** Retorna emoji correspondente à categoria */
export function getCategoryEmoji(category) {
  const c = String(category || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  if (c.includes('alimenta') || c.includes('comida') || c.includes('restaurante') || c.includes('food') || c.includes('refeic') || c.includes('bar') || c.includes('cafe')) return '🍔';
  if (c.includes('mercado') || c.includes('supermercado') || c.includes('grocer') || c.includes('feira') || c.includes('hortifruti')) return '🛒';
  if (c.includes('transporte') || c.includes('uber') || c.includes('99') || c.includes('combustivel') || c.includes('posto') || c.includes('gasolina') || c.includes('onibus') || c.includes('metro') || c.includes('estacionamento') || c.includes('pedagio')) return '🚗';
  if (c.includes('moradia') || c.includes('habitacao') || c.includes('aluguel') || c.includes('condominio') || c.includes('luz') || c.includes('energia') || c.includes('agua') || c.includes('gas') || c.includes('internet')) return '🏠';
  if (c.includes('saude') || c.includes('farmacia') || c.includes('droga') || c.includes('medico') || c.includes('hospital') || c.includes('consulta') || c.includes('dentista') || c.includes('exame')) return '💊';
  if (c.includes('educacao') || c.includes('curso') || c.includes('escola') || c.includes('faculdade') || c.includes('livr') || c.includes('livro')) return '📚';
  if (c.includes('lazer') || c.includes('cinema') || c.includes('show') || c.includes('viag') || c.includes('hotel') || c.includes('passeio') || c.includes('jogos') || c.includes('game')) return '🎉';
  if (c.includes('servico') || c.includes('assinatura') || c.includes('streaming') || c.includes('netflix') || c.includes('spotify') || c.includes('nuvem')) return '⚡';
  if (c.includes('compra') || c.includes('shopping') || c.includes('shopee') || c.includes('amazon') || c.includes('mercado livre') || c.includes('vestuario') || c.includes('roupa')) return '🛍️';
  if (c.includes('renda') || c.includes('salario') || c.includes('investimento') || c.includes('dividendo') || c.includes('provento') || c.includes('pix')) return '💰';
  if (c.includes('imposto') || c.includes('taxa') || c.includes('tarifa') || c.includes('iof') || c.includes('tributo')) return '🧾';
  if (c.includes('pets') || c.includes('veterinario') || c.includes('racao')) return '🐾';
  return '📂';
}

/** Retorna informações do dia anterior no fuso horário de São Paulo (UTC-3) */
export function getYesterdayDateInfo(referenceDate = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const todayStr = formatter.format(referenceDate);
  const [y, m, d] = todayStr.split('-').map(Number);
  const yesterdayUtc = new Date(Date.UTC(y, m - 1, d - 1));
  const yesterdayStr = yesterdayUtc.toISOString().slice(0, 10);
  const [yy, mm, dd] = yesterdayStr.split('-');
  const displayDate = `${dd}/${mm}/${yy}`;

  return {
    todayStr,
    yesterdayStr,
    displayDate,
  };
}

// Helper para enviar mensagens para o Telegram com fallback seguro
export async function sendTelegramMessage(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error('[Telegram Chatbot] TELEGRAM_BOT_TOKEN não configurada!');
    return false;
  }
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    await axios.post(url, {
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown'
    });
    return true;
  } catch (error) {
    console.warn('[Telegram Chatbot] Falha ao enviar com Markdown, tentando texto puro:', error.response?.data || error.message);
    try {
      await axios.post(url, {
        chat_id: chatId,
        text: text.replace(/[*_`]/g, '')
      });
      return true;
    } catch (fallbackError) {
      console.error('[Telegram Chatbot] Erro final ao enviar mensagem:', fallbackError.response?.data || fallbackError.message);
      return false;
    }
  }
}

/** Download Telegram voice/audio file as base64 for Gemini STT. */
async function downloadTelegramAudioFile(fileId) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN não configurada');

  const metaRes = await axios.get(`https://api.telegram.org/bot${token}/getFile`, {
    params: { file_id: fileId }
  });
  const filePath = metaRes.data?.result?.file_path;
  if (!filePath) throw new Error('Arquivo de áudio não encontrado no Telegram');

  const fileRes = await axios.get(`https://api.telegram.org/file/bot${token}/${filePath}`, {
    responseType: 'arraybuffer'
  });
  return Buffer.from(fileRes.data).toString('base64');
}

/**
 * Resolve message text from plain text or voice/audio transcription.
 * @returns {Promise<string|null>}
 */
async function resolveMessageText(message, chatId) {
  const voiceOrAudio = message.voice || message.audio;
  if (voiceOrAudio) {
    const duration = Number(voiceOrAudio.duration || 0);
    if (duration > MAX_VOICE_DURATION_SEC) {
      await sendTelegramMessage(
        chatId,
        `⏱ Áudio muito longo (${duration}s). Envie um comando com até *${MAX_VOICE_DURATION_SEC} segundos* ou digite o texto.`
      );
      return null;
    }

    await sendTelegramMessage(chatId, '🎧 _Transcrevendo áudio..._');
    try {
      const base64 = await downloadTelegramAudioFile(voiceOrAudio.file_id);
      const mimeType = message.audio?.mime_type || 'audio/ogg';
      const transcript = await transcribeAudioCommand({ base64, mimeType });
      if (!transcript) {
        await sendTelegramMessage(
          chatId,
          '❌ Não consegui entender o áudio. Tente falar de novo com mais clareza ou digite o comando.'
        );
        return null;
      }
      await sendTelegramMessage(chatId, `📝 _Entendi:_ "${transcript}"`);
      return transcript;
    } catch (err) {
      console.error('[Chatbot] Erro ao transcrever áudio:', err.message || err);
      await sendTelegramMessage(
        chatId,
        '❌ Falha ao processar o áudio. Tente novamente em instantes ou digite o comando.'
      );
      return null;
    }
  }

  if (message.text) return message.text.trim();
  return null;
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
    if (!message?.chat?.id) return;

    const chatId = message.chat.id.toString();
    const text = await resolveMessageText(message, chatId);
    if (!text) return;

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
          await sendTelegramMessage(chatId, `🎉 *Olá, ${linkResult.display_name}!*\n\nSua conta do MeuFlux foi vinculada com sucesso a este Telegram.\n\nAgora você pode conversar comigo de forma natural! Pergunte por exemplo:\n- "Qual meu saldo?"\n- "Gastei 45 reais com uber ontem"\n- "Recebi 1200 de pix"`);
        }
      } else {
        await sendTelegramMessage(chatId, `👋 *Olá! Eu sou o assistente do MeuFlux.*\n\nPara me usar, você precisa conectar sua conta:\n1. Acesse o MeuFlux Web.\n2. Vá na tela de *Configurações*.\n3. Clique em *Conectar Telegram* para gerar seu código de pareamento.`);
      }
      return;
    }

    // 2.2 Verificar se o chatId está vinculado a algum perfil
    const { data: profile, error: profileError } = await supabase.rpc('get_profile_by_telegram_chat_id', {
      p_chat_id: chatId
    });

    if (profileError || !profile || !profile.id) {
      await sendTelegramMessage(chatId, `⚠️ *Conta não vinculada!*\n\nNão consegui encontrar nenhuma conta do MeuFlux associada a este número de chat.\n\nPara vincular:\n1. Vá nas *Configurações* do MeuFlux Web.\n2. Clique em *Conectar Telegram*.\n3. Digite o comando gerado aqui no chat.`);
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
      normalized === '/ontem' ||
      normalized === '/diario' ||
      normalized === 'ontem' ||
      normalized === 'diario' ||
      /\b(resumo (de )?ontem|gastos? (de )?ontem|quanto gastei ontem|o que gastei ontem|transacoes (de )?ontem|lancamentos (de )?ontem|resumo diario)\b/.test(normalized)
    ) {
      parsed = { intent: 'GET_DAILY_SUMMARY' };
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
        parsed = { intent: 'UNKNOWN', message: 'Desculpe, tive um problema de comunicação com minha inteligência artificial. Tente /saldo, /faturas, /ontem, /resumo ou /ultimos.' };
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

      case 'GET_DAILY_SUMMARY': {
        await sendTelegramMessage(chatId, '🔍 _Montando resumo de ontem..._');
        const summaryData = await fetchUserDailySummaryData(profile, supabase);
        const summaryText = formatDailySummaryMessage(profile, summaryData);
        await sendTelegramMessage(chatId, summaryText);
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
        const helpMessage = parsed.message || `Olá! Sou o assistente do MeuFlux.\n\nComo posso ajudar?\n- *Saldo das contas:* "Qual meu saldo?" ou /saldo\n- *Faturas do cartão:* "Minhas faturas" ou /faturas\n- *Resumo de ontem:* "Resumo de ontem" ou /ontem\n- *Resumo semanal:* "Resumo da semana" ou /resumo\n- *Despesas:* "Gastei 55 reais no supermercado hoje"`;
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
        const boxes = (acc.bankData?.reservedBalances || [])
          .map((item, index) => {
            const amounts = Array.isArray(item?.availableAmounts) ? item.availableAmounts : [];
            const amount = amounts.reduce((sum, a) => sum + (Number(a?.amount) || 0), 0);
            const name = (item?.name && String(item.name).trim()) || `Caixinha ${index + 1}`;
            return { name, amount };
          })
          .filter((b) => b.amount > 0);
        const reserved = boxes.reduce((s, b) => s + b.amount, 0);
        const total = bal + reserved;
        bankTotal += total;
        text += `• *${accountDisplayName(profile, acc)}*: ${money(bal)}`;
        if (acc.owner) text += `\n  _Titular: ${acc.owner}_`;
        if (boxes.length) {
          for (const box of boxes) {
            text += `\n  🐷 ${box.name}: ${money(box.amount)}`;
          }
          text += `\n  *Total na conta:* ${money(total)}`;
        }
        text += `\n`;
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

/**
 * Compila todas as informações do resumo do dia anterior:
 * - Transações do dia anterior (Pluggy + Manual)
 * - Agrupamento por categoria
 * - Status consolidado atual (contas bancárias, carteira manual, faturas de cartão em aberto, saldo líquido)
 */
export async function fetchUserDailySummaryData(profile, supabase, options = {}) {
  const targetDateStr = options.date || getYesterdayDateInfo().yesterdayStr;
  const [yy, mm, dd] = targetDateStr.split('-');
  const displayDate = `${dd}/${mm}/${yy}`;

  const transactions = [];
  const pluggyItemIds = asItemIdList(profile.pluggy_item_ids);
  const creds = resolvePluggyCredentials(profile);

  let accounts = [];
  if (pluggyItemIds.length > 0 && creds) {
    try {
      accounts = await fetchPluggyAccounts(profile);
    } catch (e) {
      console.warn('[Chatbot Daily] Falha ao buscar contas Pluggy:', e.message);
    }
  }

  // 1. Buscar transações do Pluggy na data alvo
  if (accounts.length > 0 && creds) {
    try {
      const pluggyClient = await createPluggyClient(creds.clientId, creds.clientSecret);
      const txPromises = accounts.map(async (acc) => {
        try {
          const res = await pluggyClient.get('/v2/transactions', {
            params: { accountId: acc.id, from: targetDateStr, pageSize: 100 }
          });
          const list = res.data.results || res.data || [];
          return (Array.isArray(list) ? list : []).map((t) => ({ ...t, _account: acc }));
        } catch (e) {
          console.warn(`[Chatbot Daily] Erro ao buscar transações da conta ${acc.id}:`, e.message);
          return [];
        }
      });

      const allAccountTxs = (await Promise.all(txPromises)).flat();
      for (const t of allAccountTxs) {
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
            accountName: accountDisplayName(profile, t._account),
            origin: 'Banco',
            isBillPayment: isPayment
          });
        }
      }
    } catch (e) {
      console.warn('[Chatbot Daily] Falha geral nas transações Pluggy:', e.message);
    }
  }

  // 2. Buscar transações manuais no Supabase na data alvo
  try {
    const { data: manualTxs, error: mError } = await supabase
      .from('manual_transactions')
      .select('id, date, description, amount, type, category')
      .eq('user_id', profile.id)
      .gte('date', targetDateStr)
      .lt('date', `${targetDateStr}T23:59:59.999Z\uffff`);

    if (!mError && manualTxs) {
      for (const t of manualTxs) {
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
            isBillPayment: false
          });
        }
      }
    }
  } catch (mErr) {
    console.warn('[Chatbot Daily] Falha ao buscar manual_transactions:', mErr.message);
  }

  // Ordenar transações por data mais recente
  transactions.sort((a, b) => b.date.getTime() - a.date.getTime());

  // 3. Totais e categorias do dia
  let totalExpenses = 0;
  let totalIncome = 0;
  let expenseCount = 0;
  let incomeCount = 0;
  const categoryTotals = {};

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
      emoji: getCategoryEmoji(category),
      percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0
    }));

  // 4. Status Consolidado Atual
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
  if (allManualTxs) {
    for (const tx of allManualTxs) {
      const amt = Number(tx.amount || 0);
      if (tx.type === 'DEBIT') manualBalance -= amt;
      else manualBalance += amt;
    }
  }

  const totalAvailable = bankTotal + manualBalance;

  // Faturas de cartão em aberto
  const creditCards = accounts.filter((a) => a.type === 'CREDIT');
  let creditDebt = 0;
  if (creditCards.length > 0 && creds) {
    try {
      const pluggyClient = await createPluggyClient(creds.clientId, creds.clientSecret);
      for (const acc of creditCards) {
        try {
          const [bills, txs] = await Promise.all([
            fetchPluggyBills(pluggyClient, acc.id),
            fetchAllPluggyTransactions(pluggyClient, acc.id)
          ]);
          const summary = summarizeCardOpenBill(acc, txs, bills);
          creditDebt += Number(summary.openTotal || 0);
        } catch (e) {
          console.warn('[Chatbot Daily] Falha ao resumir fatura:', acc.id, e.message);
        }
      }
    } catch (e) {
      console.warn('[Chatbot Daily] Erro ao buscar cartões:', e.message);
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
      hasCreditCards: creditCards.length > 0
    }
  };
}

/**
 * Formata a mensagem Markdown para o Telegram
 */
export function formatDailySummaryMessage(profile, summaryData) {
  const money = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
    summaryData.categories.forEach((c) => {
      text += `• ${c.emoji} *${escapeTelegramMd(c.category)}*: ${money(c.amount)} (${c.percentage.toFixed(0)}%)\n`;
    });
    text += `\n`;
  }

  // Lista de Transações
  text += `📝 *Lançamentos de Ontem:*\n`;
  const MAX_DISPLAY_TX = 15;
  const displayedTxs = summaryData.transactions.slice(0, MAX_DISPLAY_TX);
  displayedTxs.forEach((tx) => {
    const isCredit = tx.type === 'CREDIT';
    const prefix = isCredit ? '🟢' : '🔴';
    const sign = isCredit ? '+' : '-';
    const desc = escapeTelegramMd(tx.description);
    const acc = escapeTelegramMd(tx.accountName);
    const cat = escapeTelegramMd(tx.category);
    text += `${prefix} *${desc}*\n     ${sign}${money(tx.absAmount)} • [${acc}] (${cat})\n`;
  });

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

/**
 * Envia o resumo diário para um perfil específico se houver transações (ou se force === true)
 */
export async function sendDailySummaryToUser(profile, supabase, options = {}) {
  if (!profile.telegram_chat_id) {
    return { skipped: true, reason: 'no_telegram_chat_id' };
  }

  const summaryData = await fetchUserDailySummaryData(profile, supabase, options);

  // Regra central: envia apenas se houver transações no dia anterior (a menos que forçado)
  if (!summaryData.hasTransactions && !options.force) {
    console.log(`[Chatbot Daily] Usuário ${profile.display_name} (${profile.id}) sem transações em ${summaryData.targetDateStr}. Não enviando mensagem.`);
    return { skipped: true, reason: 'no_transactions', date: summaryData.targetDateStr };
  }

  const messageText = formatDailySummaryMessage(profile, summaryData);

  if (options.dryRun) {
    console.log(`[Chatbot Daily] [DRY RUN] Mensagem para ${profile.display_name} (${profile.telegram_chat_id}):\n${messageText}`);
    return { success: true, dryRun: true, messageText, summaryData };
  }

  const sent = await sendTelegramMessage(profile.telegram_chat_id, messageText);
  if (sent) {
    try {
      await supabase
        .from('profiles')
        .update({ last_telegram_daily_summary_date: summaryData.targetDateStr })
        .eq('id', profile.id);
    } catch (updateErr) {
      console.warn('[Chatbot Daily] Falha ao atualizar last_telegram_daily_summary_date:', updateErr.message);
    }
  }

  return { success: sent, summaryData };
}

// 3. POST /api/chatbot/telegram/daily-summary (Executa o resumo diário para todos os usuários elegíveis)
router.post('/telegram/daily-summary', async (req, res) => {
  try {
    let supabase;
    try {
      supabase = getServiceRoleClient();
    } catch (e) {
      supabase = getSupabaseClient(req);
    }

    const { date, userId, dryRun = false, force = false } = req.body || {};

    let query = supabase
      .from('profiles')
      .select('id, display_name, telegram_chat_id, pluggy_item_ids, pluggy_client_id, pluggy_client_secret, custom_account_names, last_telegram_daily_summary_date')
      .not('telegram_chat_id', 'is', null)
      .neq('telegram_chat_id', '');

    if (userId) {
      query = query.eq('id', userId);
    }

    const { data: profiles, error } = await query;
    if (error) throw error;

    if (!profiles || profiles.length === 0) {
      return res.json({ success: true, message: 'Nenhum usuário com Telegram conectado encontrado.', processed: 0, sent: 0 });
    }

    const targetDateInfo = date ? { yesterdayStr: date, displayDate: date } : getYesterdayDateInfo();
    const results = [];

    for (const profile of profiles) {
      if (!force && profile.last_telegram_daily_summary_date === targetDateInfo.yesterdayStr) {
        results.push({ userId: profile.id, name: profile.display_name, skipped: true, reason: 'already_sent_for_date' });
        continue;
      }

      try {
        const resUser = await sendDailySummaryToUser(profile, supabase, { date: targetDateInfo.yesterdayStr, dryRun, force });
        results.push({ userId: profile.id, name: profile.display_name, ...resUser });
      } catch (userErr) {
        console.error(`[Chatbot Daily] Erro para usuário ${profile.id}:`, userErr);
        results.push({ userId: profile.id, name: profile.display_name, error: userErr.message });
      }
    }

    const sentCount = results.filter((r) => r.success && !r.dryRun).length;
    const skippedCount = results.filter((r) => r.skipped).length;

    res.json({
      success: true,
      date: targetDateInfo.yesterdayStr,
      processed: profiles.length,
      sent: sentCount,
      skipped: skippedCount,
      results
    });
  } catch (err) {
    console.error('[Chatbot Daily Summary] Erro geral:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/chatbot/telegram/daily-summary para checagem ou trigger simples via GET
router.get('/telegram/daily-summary', async (req, res) => {
  req.body = { ...req.query };
  return router.handle({ ...req, method: 'POST' }, res);
});

export default router;
