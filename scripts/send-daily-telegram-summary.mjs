#!/usr/bin/env node
/**
 * CLI Script para executar o envio de resumo diário do Telegram.
 * 
 * Uso:
 *   node scripts/send-daily-telegram-summary.mjs [opções]
 * 
 * Opções:
 *   --dry-run       Apenas simula o envio e imprime as mensagens no terminal sem disparar no Telegram
 *   --force         Envia mesmo se o usuário já tiver recebido ou se não tiver transações
 *   --date YYYY-MM-DD  Especifica uma data personalizada para o resumo (padrão: ontem em BRT)
 *   --user <id>     Executa apenas para o usuário com o ID especificado
 */

import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import { runDailySummaryJob } from '../server/services/dailySummaryScheduler.js';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');

function getArgValue(flag) {
  const index = args.indexOf(flag);
  if (index !== -1 && index + 1 < args.length) {
    return args[index + 1];
  }
  return null;
}

const targetDateStr = getArgValue('--date');
const targetUserId = getArgValue('--user');

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://tslzhkbxabbhrmbefhrj.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const cronSecret = process.env.CRON_SECRET;

const hasValidServiceRoleKey = Boolean(supabaseKey && !supabaseKey.includes('your_'));

if (!hasValidServiceRoleKey && !cronSecret) {
  console.error('❌ Erro: Configure SUPABASE_SERVICE_ROLE_KEY ou CRON_SECRET no ambiente');
  process.exit(1);
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🤖 MeuFlux — Envio de Resumo Diário do Telegram');
console.log(`📅 Data Alvo: ${targetDateStr || 'Ontem (Automático)'}`);
console.log(`⚙️ Modo: ${dryRun ? 'DRY-RUN (Simulação)' : 'PRODUÇÃO (Envio Real)'}`);
if (force) console.log('⚡ Forçar envio ativado (--force)');
if (targetUserId) console.log(`👤 Usuário Específico: ${targetUserId}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

async function main() {
  let result;
  if (!hasValidServiceRoleKey && cronSecret) {
    console.log('🌐 Executando via Edge Function com CRON_SECRET...');
    const endpoint = `${supabaseUrl}/functions/v1/pluggy-proxy/chatbot/telegram/daily-summary`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dryRun,
        force,
        date: targetDateStr || undefined,
        userId: targetUserId || undefined,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`❌ Falha na chamada da Edge Function (HTTP ${res.status}):`, errText);
      process.exit(1);
    }
    result = await res.json();
  } else {
    const supabaseClient = createClient(supabaseUrl, supabaseKey);
    result = await runDailySummaryJob({
      supabaseClient,
      dryRun,
      targetDateStr,
      targetUserId,
      force,
    });
  }

  if (!result.success) {
    console.error('❌ Falha ao executar o job diário:', result.error);
    process.exit(1);
  }

  console.log('\n📊 Resultado da Execução:');
  console.log(`• Usuários verificados: ${result.processed}`);
  console.log(`• Mensagens enviadas: ${result.sent}`);
  console.log(`• Usuários ignorados (sem movimentação ou já enviado): ${result.skipped}`);

  if (result.results && result.results.length > 0) {
    console.log('\nDetalhes por usuário:');
    result.results.forEach((r) => {
      const statusIcon = r.sent || (r.dryRun && r.success) ? '✅' : (r.skipped ? '⏭️' : '❌');
      const detail = r.skipped ? `(ignorado: ${r.reason})` : (r.error ? `(erro: ${r.error})` : `(${r.summaryData?.transactionCount || 0} transações)`);
      console.log(`  ${statusIcon} ${r.name || r.userId}: ${detail}`);
    });
  }

  console.log('\n🏁 Finalizado com sucesso.');
}

main().catch((err) => {
  console.error('Erro inesperado:', err);
  process.exit(1);
});
