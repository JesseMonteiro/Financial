import { errorResponse, jsonResponse } from "../middleware/http.ts";

const BILL_PARSE_INSTRUCTION = `Você extrai dados de faturas de cartão de crédito brasileiras (PDF).
Retorne APENAS JSON:
{"totalAmount":number,"dueDate":"YYYY-MM-DD"|null,"closingDate":"YYYY-MM-DD"|null,"cardLastDigits":string|null,"institutionName":string|null,"purchases":[{"date":"YYYY-MM-DD","description":string,"amount":number,"installment":number|null,"totalInstallments":number|null,"category":"Food"|"Groceries"|"Rent"|"Utilities"|"Transport"|"Entertainment"|"Health"|"Education"|"Other"}]}
Ignore pagamentos de fatura. amount positivo em BRL. installment só se houver parcela (3/12).`;

const CATEGORY_ALIASES: Record<string, string> = {
  food: 'Food', alimentacao: 'Food', alimentação: 'Food',
  groceries: 'Groceries', supermercado: 'Groceries', mercado: 'Groceries',
  rent: 'Rent', moradia: 'Rent', aluguel: 'Rent',
  utilities: 'Utilities', contas: 'Utilities',
  transport: 'Transport', transporte: 'Transport',
  entertainment: 'Entertainment', lazer: 'Entertainment',
  health: 'Health', saude: 'Health', saúde: 'Health',
  education: 'Education', educacao: 'Education', educação: 'Education',
  other: 'Other', outros: 'Other',
};

export function normalizeParsedBill(raw: Record<string, unknown>) {
  const purchases = Array.isArray(raw?.purchases) ? (raw.purchases as Record<string, unknown>[]) : [];
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

export async function handleParseBill(body: unknown): Promise<Response> {
  const payload = (body || {}) as { base64?: string; mimeType?: string };
  const base64 = payload.base64;
  if (!base64 || typeof base64 !== 'string') {
    return errorResponse('PDF em base64 é obrigatório', 400);
  }
  const maxChars = Math.ceil(8 * 1024 * 1024 * 4 / 3) + 1024;
  if (base64.length > maxChars) {
    return errorResponse('PDF muito grande (limite 8 MB)', 413);
  }

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) return errorResponse('Assistente de fatura indisponível no momento.', 503);

  const mimeType = payload.mimeType || 'application/pdf';
  const models = ['gemini-2.5-flash', 'gemini-2.0-flash'];
  let lastError = '';
  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: BILL_PARSE_INSTRUCTION }] },
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { mimeType, data: base64 } },
            { text: 'Extraia os dados desta fatura de cartão de crédito. Retorne apenas o JSON pedido.' },
          ],
        }],
        generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
      }),
    });
    if (!res.ok) {
      lastError = await res.text();
      console.error(`[parse-bill] Gemini error (${model}):`, lastError);
      continue;
    }
    const data = await res.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
    try {
      return jsonResponse(normalizeParsedBill(JSON.parse(raw)));
    } catch {
      return errorResponse('A IA não retornou um JSON válido da fatura.', 500);
    }
  }
  return errorResponse('Falha ao ler a fatura com IA.', 500);
}
