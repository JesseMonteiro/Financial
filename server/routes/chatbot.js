import { Router } from 'express';
import { checkAuth } from '../middleware/auth.js';
import { getSupabaseClient, getServiceRoleClient } from '../services/supabaseClient.js';
import { createPluggyClient } from '../services/pluggyClient.js';
import { parseNaturalLanguageCommand } from '../services/geminiService.js';
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
    if (text.toLowerCase() === '/saldo' || text.toLowerCase() === 'saldo') {
      parsed = { intent: 'GET_BALANCE' };
    } else if (text.toLowerCase() === '/ultimos' || text.toLowerCase() === 'extrato') {
      parsed = { intent: 'GET_TRANSACTIONS' };
    } else {
      // Processar linguagem natural via Gemini
      try {
        parsed = await parseNaturalLanguageCommand(text);
      } catch (geminiErr) {
        console.error('[Chatbot] Erro no Gemini:', geminiErr.message);
        parsed = { intent: 'UNKNOWN', message: 'Desculpe, tive um problema de comunicação com minha inteligência artificial.' };
      }
    }

    // 2.4 Tratamento da Intenção
    switch (parsed.intent) {
      case 'GET_BALANCE': {
        await sendTelegramMessage(chatId, '🔍 _Buscando seus saldos nas contas conectadas..._');
        const balanceText = await fetchUserBalancesText(profile, supabase);
        await sendTelegramMessage(chatId, balanceText);
        break;
      }

      case 'GET_TRANSACTIONS': {
        await sendTelegramMessage(chatId, '🔍 _Buscando seus lançamentos recentes..._');
        const transactionsText = await fetchUserTransactionsText(profile, supabase);
        await sendTelegramMessage(chatId, transactionsText);
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
        const helpMessage = parsed.message || `Olá! Sou o assistente do FinanceHub.\n\nComo posso ajudar?\n- Pergunte seu saldo: *"Qual meu saldo?"*\n- Adicione despesas: *"Gastei 55 reais no supermercado hoje"*`;
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

// Helper para compilar saldos do Pluggy + Manual
async function fetchUserBalancesText(profile, supabase) {
  try {
    const bankAccounts = await fetchPluggyAccounts(profile);

    // Busca transações manuais no Supabase para calcular saldo manual (somente deste user_id)
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

    let text = `💰 *Saldos de ${profile.display_name}:*\n\n`;
    let bankTotal = 0;

    if (bankAccounts.length > 0) {
      bankAccounts.forEach(acc => {
        text += `🏦 *${acc.name}*: R$ ${Number(acc.balance).toFixed(2)}\n`;
        bankTotal += Number(acc.balance);
      });
      text += `\n💵 *Total Bancos:* R$ ${bankTotal.toFixed(2)}\n`;
    } else {
      text += `🏦 *Contas de Banco:* Nenhuma conectada.\n`;
    }

    text += `📦 *Carteira Manual:* R$ ${manualBalance.toFixed(2)}\n`;
    text += `\n📊 *Saldo Geral:* R$ ${(bankTotal + manualBalance).toFixed(2)}`;

    return text;
  } catch (err) {
    console.error('[Chatbot Balance Text] Erro:', err);
    return "❌ Erro ao compilar informações de saldo.";
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

export default router;
