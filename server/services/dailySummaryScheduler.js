import { getServiceRoleClient } from './supabaseClient.js';
import { getYesterdayDateInfo, sendDailySummaryToUser } from '../routes/chatbot.js';

let schedulerInterval = null;
let lastRunDateKey = null;

/**
 * Executa o job de envio de resumo diário para todos os usuários que conectaram o Telegram.
 * Envia apenas para quem teve transações no dia anterior (ou se force === true).
 */
export async function runDailySummaryJob(options = {}) {
  const {
    supabaseClient,
    dryRun = false,
    targetDateStr,
    targetUserId,
    force = false,
  } = options;

  let supabase = supabaseClient;
  if (!supabase) {
    try {
      supabase = getServiceRoleClient();
    } catch (e) {
      console.error('[Daily Scheduler] Erro ao obter Supabase Service Role client:', e.message);
      return { success: false, error: e.message };
    }
  }

  const dateInfo = targetDateStr
    ? { yesterdayStr: targetDateStr, displayDate: targetDateStr }
    : getYesterdayDateInfo();

  console.log(`[Daily Scheduler] Iniciando verificação de resumo diário para data ${dateInfo.yesterdayStr} (dryRun=${dryRun}, force=${force})...`);

  try {
    let query = supabase
      .from('profiles')
      .select('id, display_name, telegram_chat_id, pluggy_item_ids, pluggy_client_id, pluggy_client_secret, custom_account_names, last_telegram_daily_summary_date')
      .not('telegram_chat_id', 'is', null)
      .neq('telegram_chat_id', '');

    if (targetUserId) {
      query = query.eq('id', targetUserId);
    }

    const { data: profiles, error } = await query;
    if (error) throw error;

    if (!profiles || profiles.length === 0) {
      console.log('[Daily Scheduler] Nenhum perfil com Telegram conectado encontrado.');
      return { success: true, processed: 0, sent: 0, skipped: 0, date: dateInfo.yesterdayStr };
    }

    const results = [];

    for (const profile of profiles) {
      // Evitar reenvio se já foi enviado para a mesma data (a menos que seja force ou dryRun)
      if (!force && !dryRun && profile.last_telegram_daily_summary_date === dateInfo.yesterdayStr) {
        console.log(`[Daily Scheduler] Usuário ${profile.display_name} já recebeu resumo de ${dateInfo.yesterdayStr}. Pulando.`);
        results.push({ userId: profile.id, name: profile.display_name, skipped: true, reason: 'already_sent_today' });
        continue;
      }

      try {
        const resUser = await sendDailySummaryToUser(profile, supabase, {
          date: dateInfo.yesterdayStr,
          dryRun,
          force,
        });
        results.push({ userId: profile.id, name: profile.display_name, ...resUser });
      } catch (userErr) {
        console.error(`[Daily Scheduler] Erro ao processar resumo para ${profile.display_name} (${profile.id}):`, userErr.message);
        results.push({ userId: profile.id, name: profile.display_name, error: userErr.message });
      }
    }

    const sentCount = results.filter((r) => r.success && !r.dryRun).length;
    const skippedCount = results.filter((r) => r.skipped).length;

    console.log(`[Daily Scheduler] Concluído: ${profiles.length} usuários verificados, ${sentCount} enviados, ${skippedCount} ignorados.`);
    return {
      success: true,
      date: dateInfo.yesterdayStr,
      processed: profiles.length,
      sent: sentCount,
      skipped: skippedCount,
      results,
    };
  } catch (err) {
    console.error('[Daily Scheduler] Falha na execução do job diário:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Inicializa o agendador automático no backend Node.
 * Por padrão roda todos os dias às 08:00 (horário de Brasília).
 */
export function initDailySummaryScheduler() {
  if (process.env.DAILY_SUMMARY_ENABLED === 'false') {
    console.log('[Daily Scheduler] Agendador desativado via DAILY_SUMMARY_ENABLED=false.');
    return;
  }

  const targetHour = parseInt(process.env.DAILY_SUMMARY_HOUR || '8', 10);
  const targetMinute = parseInt(process.env.DAILY_SUMMARY_MINUTE || '0', 10);

  console.log(`[Daily Scheduler] Agendador diário do Telegram ativo: programado para as ${String(targetHour).padStart(2, '0')}:${String(targetMinute).padStart(2, '0')} BRT.`);

  if (schedulerInterval) {
    clearInterval(schedulerInterval);
  }

  // Verifica a cada 60 segundos se chegou a hora de disparar
  schedulerInterval = setInterval(async () => {
    try {
      const now = new Date();

      const timeFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      const parts = timeFormatter.format(now).split(':');
      const curHour = parseInt(parts[0], 10);
      const curMinute = parseInt(parts[1], 10);

      const dateFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const todayDateKey = dateFormatter.format(now);

      if (curHour === targetHour && curMinute === targetMinute && lastRunDateKey !== todayDateKey) {
        lastRunDateKey = todayDateKey;
        console.log(`[Daily Scheduler] Disparando envio diário programado para a data ${todayDateKey} às ${curHour}:${curMinute} BRT.`);
        await runDailySummaryJob();
      }
    } catch (err) {
      console.error('[Daily Scheduler] Erro no loop de verificação do agendador:', err);
    }
  }, 60 * 1000);
}
