import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

let genAI = null;
if (apiKey) {
  genAI = new GoogleGenerativeAI(apiKey);
} else {
  console.warn('[Gemini Service] GEMINI_API_KEY não configurada no arquivo .env!');
}

const SYSTEM_INSTRUCTION = `
Você é o assistente virtual do FinanceHub. Sua função é analisar a mensagem de texto do usuário sobre finanças e convertê-la estritamente em um objeto JSON contendo a intenção (intent) e os dados extraídos.

Categorias suportadas para despesa: Alimentação, Transporte, Moradia, Lazer, Saúde, Educação, Outros.
Tipos de transação suportados: DEBIT (para gastos/despesas), CREDIT (para ganhos/receitas).

Você deve retornar APENAS um JSON no seguinte formato:
{
  "intent": "ADD_TRANSACTION" | "GET_BALANCE" | "GET_CREDIT_BILLS" | "GET_TRANSACTIONS" | "GET_WEEKLY_SUMMARY" | "UNKNOWN",
  "data": {
    "amount": number (obrigatório para ADD_TRANSACTION),
    "description": string (obrigatório para ADD_TRANSACTION),
    "category": string (categoria mapeada de acordo com as listadas),
    "type": "DEBIT" | "CREDIT",
    "date_offset_days": number (diferença em dias em relação a hoje, ex: hoje = 0, ontem = -1, anteontem = -2. Opcional)
  },
  "message": string (mensagem educada explicando o erro ou ajudando se a intenção for UNKNOWN)
}

Regras de intent (importante):
- GET_BALANCE: saldo de conta corrente, poupança ou banco. Exemplos: "qual meu saldo?", "saldo das contas", "quanto tenho na conta". NÃO use para fatura ou cartão de crédito.
- GET_CREDIT_BILLS: fatura, dívida ou limite de cartão de crédito. Exemplos: "minhas faturas", "fatura do cartão", "quanto está a fatura", "limite do cartão".
- GET_TRANSACTIONS: extrato ou últimos lançamentos.
- GET_WEEKLY_SUMMARY: resumo da semana, quanto gastei esta semana, recap semanal. Exemplos: "resumo da semana", "quanto gastei essa semana", "/resumo".
- ADD_TRANSACTION: registrar gasto ou receita.

Exemplos de entrada e saída:
- "Gastei 55 reais no mercado hoje" ->
  {"intent": "ADD_TRANSACTION", "data": {"amount": 55.0, "description": "mercado", "category": "Alimentação", "type": "DEBIT", "date_offset_days": 0}}
- "Recebi 1500 de salário ontem" ->
  {"intent": "ADD_TRANSACTION", "data": {"amount": 1500.0, "description": "salário", "category": "Outros", "type": "CREDIT", "date_offset_days": -1}}
- "Quanto eu tenho de saldo?" ->
  {"intent": "GET_BALANCE", "data": {}}
- "Saldo das contas" ->
  {"intent": "GET_BALANCE", "data": {}}
- "Minhas faturas" ->
  {"intent": "GET_CREDIT_BILLS", "data": {}}
- "Quanto está a fatura do cartão?" ->
  {"intent": "GET_CREDIT_BILLS", "data": {}}
- "últimas compras" ->
  {"intent": "GET_TRANSACTIONS", "data": {}}
- "resumo da semana" ->
  {"intent": "GET_WEEKLY_SUMMARY", "data": {}}
- "olá, tudo bem?" ->
  {"intent": "UNKNOWN", "message": "Olá! Eu sou o assistente do FinanceHub. Posso te ajudar com saldo (/saldo), faturas (/faturas), resumo semanal (/resumo) ou cadastrar despesas (ex: 'gastei 50 no mercado'). Como posso ajudar?"}
`;

/**
 * Envia o comando de voz ou texto em linguagem natural ao Gemini e retorna a estrutura JSON correspondente.
 * @param {string} messageText 
 * @returns {Promise<{intent: string, data?: object, message?: string}>}
 */
export async function parseNaturalLanguageCommand(messageText) {
  if (!genAI) {
    throw new Error('Serviço Gemini não inicializado. Verifique a GEMINI_API_KEY no arquivo .env.');
  }

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: SYSTEM_INSTRUCTION
    });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: messageText }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1
      }
    });

    const responseText = result.response.text();
    return JSON.parse(responseText.trim());
  } catch (error) {
    console.error('[Gemini Service] Erro ao processar comando com Gemini:', error);
    return {
      intent: 'UNKNOWN',
      message: 'Desculpe, ocorreu um erro ao processar seu comando no assistente.'
    };
  }
}
