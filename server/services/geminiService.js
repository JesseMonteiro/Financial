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
Você é o assistente virtual do MeuFlux. Sua função é analisar a mensagem de texto do usuário sobre finanças e convertê-la estritamente em um objeto JSON contendo a intenção (intent) e os dados extraídos.

Categorias suportadas para despesa: Alimentação, Transporte, Moradia, Lazer, Saúde, Educação, Outros.
Tipos de transação suportados: DEBIT (para gastos/despesas), CREDIT (para ganhos/receitas).

Você deve retornar APENAS um JSON no seguinte formato:
{
  "intent": "ADD_TRANSACTION" | "GET_BALANCE" | "GET_CREDIT_BILLS" | "GET_TRANSACTIONS" | "GET_WEEKLY_SUMMARY" | "GET_DAILY_SUMMARY" | "UNKNOWN",
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
- GET_DAILY_SUMMARY: resumo do dia anterior / ontem, quanto gastei ontem, transações de ontem, balanço de ontem. Exemplos: "resumo de ontem", "quanto gastei ontem", "gastos de ontem", "/ontem", "/diario".
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
- "resumo de ontem" ->
  {"intent": "GET_DAILY_SUMMARY", "data": {}}
- "quanto gastei ontem?" ->
  {"intent": "GET_DAILY_SUMMARY", "data": {}}
- "olá, tudo bem?" ->
  {"intent": "UNKNOWN", "message": "Olá! Eu sou o assistente do MeuFlux. Posso te ajudar com saldo (/saldo), faturas (/faturas), resumo de ontem (/ontem), resumo semanal (/resumo) ou cadastrar despesas (ex: 'gastei 50 no mercado'). Como posso ajudar?"}
`;

/**
 * Transcreve áudio (voice note / arquivo) em português do Brasil via Gemini multimodal.
 * @param {{ base64: string, mimeType?: string }} params
 * @returns {Promise<string>}
 */
export async function transcribeAudioCommand({ base64, mimeType = 'audio/ogg' }) {
  if (!genAI) {
    throw new Error('Serviço Gemini não inicializado. Verifique a GEMINI_API_KEY no arquivo .env.');
  }
  if (!base64) {
    throw new Error('Áudio vazio para transcrição.');
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const result = await model.generateContent({
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType, data: base64 } },
        {
          text: 'Transcreva este áudio em português do Brasil. Retorne APENAS o texto falado, sem aspas, sem explicações e sem pontuação extra inventada. Se não houver fala audível, retorne uma string vazia.'
        }
      ]
    }],
    generationConfig: { temperature: 0.1 }
  });

  return (result.response.text() || '').trim().replace(/^["'«»]|["'«»]$/g, '').trim();
}

const BILL_PARSE_INSTRUCTION = `
Você extrai dados de faturas de cartão de crédito brasileiras (PDF).
Retorne APENAS JSON neste formato:
{
  "totalAmount": number,
  "dueDate": "YYYY-MM-DD" | null,
  "closingDate": "YYYY-MM-DD" | null,
  "cardLastDigits": string | null,
  "institutionName": string | null,
  "purchases": [
    {
      "date": "YYYY-MM-DD",
      "description": string,
      "amount": number,
      "installment": number | null,
      "totalInstallments": number | null,
      "category": "Food" | "Groceries" | "Rent" | "Utilities" | "Transport" | "Entertainment" | "Health" | "Education" | "Other"
    }
  ]
}
Regras:
- totalAmount é o valor total da fatura em BRL (número positivo).
- purchases: lançamentos de compras/serviços. Ignore pagamentos de fatura, IOF destacado se já estiver no valor da compra, e linhas de saldo anterior.
- amount de cada compra é positivo em BRL.
- installment/totalInstallments só quando houver parcela (ex: 3/12 → installment 3, totalInstallments 12).
- category mapeada para os valores em inglês listados.
- Se um campo não existir, use null ou lista vazia.
`;

const CATEGORY_ALIASES = {
  food: 'Food',
  alimentacao: 'Food',
  alimentação: 'Food',
  groceries: 'Groceries',
  supermercado: 'Groceries',
  mercado: 'Groceries',
  rent: 'Rent',
  moradia: 'Rent',
  aluguel: 'Rent',
  utilities: 'Utilities',
  contas: 'Utilities',
  transport: 'Transport',
  transporte: 'Transport',
  entertainment: 'Entertainment',
  lazer: 'Entertainment',
  health: 'Health',
  saude: 'Health',
  saúde: 'Health',
  education: 'Education',
  educacao: 'Education',
  educação: 'Education',
  other: 'Other',
  outros: 'Other',
};

function normalizeParsedBill(raw) {
  const purchases = Array.isArray(raw?.purchases) ? raw.purchases : [];
  return {
    totalAmount: Number(raw?.totalAmount) || 0,
    dueDate: raw?.dueDate ? String(raw.dueDate).slice(0, 10) : null,
    closingDate: raw?.closingDate ? String(raw.closingDate).slice(0, 10) : null,
    cardLastDigits: raw?.cardLastDigits ? String(raw.cardLastDigits).replace(/\D/g, '').slice(-4) : null,
    institutionName: raw?.institutionName ? String(raw.institutionName) : null,
    purchases: purchases.map((p) => {
      const catKey = String(p?.category || 'Other').trim().toLowerCase();
      return {
        date: p?.date ? String(p.date).slice(0, 10) : null,
        description: String(p?.description || 'Compra').trim(),
        amount: Math.abs(Number(p?.amount) || 0),
        installment: p?.installment != null ? Number(p.installment) || null : null,
        totalInstallments: p?.totalInstallments != null ? Number(p.totalInstallments) || null : null,
        category: CATEGORY_ALIASES[catKey] || 'Other',
      };
    }).filter((p) => p.amount > 0 || p.description),
  };
}

/**
 * Extrai total, vencimento e compras de um PDF de fatura via Gemini multimodal.
 * @param {{ base64: string, mimeType?: string }} params
 */
export async function parseCreditBillPdf({ base64, mimeType = 'application/pdf' }) {
  if (!genAI) {
    throw new Error('Serviço Gemini não inicializado. Verifique a GEMINI_API_KEY no arquivo .env.');
  }
  if (!base64) {
    throw new Error('PDF vazio.');
  }

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: BILL_PARSE_INSTRUCTION,
  });
  const result = await model.generateContent({
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: mimeType || 'application/pdf', data: base64 } },
        { text: 'Extraia os dados desta fatura de cartão de crédito. Retorne apenas o JSON pedido.' },
      ],
    }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
    },
  });

  const text = (result.response.text() || '').trim();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    console.error('[Gemini Service] JSON inválido na fatura:', text.slice(0, 400));
    throw new Error('A IA não retornou um JSON válido da fatura.');
  }
  return normalizeParsedBill(parsed);
}

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
