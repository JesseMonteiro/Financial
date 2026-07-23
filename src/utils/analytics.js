import { isBillPayment } from './creditBillPeriod.js';
import { translateCategory } from './categories.js';
import { calculateNetWorth } from './calculations.js';

const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** @param {string|Date} date */
export function ymFromDate(date) {
  if (!date) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return String(date).slice(0, 7) || null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function currentYm(now = new Date()) {
  return ymFromDate(now);
}

/** Last N calendar months ending at `endYm` (inclusive), oldest → newest */
export function lastNMonths(n = 6, endYm = currentYm()) {
  const [y0, m0] = endYm.split('-').map(Number);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    let y = y0;
    let m = m0 - i;
    while (m < 1) {
      m += 12;
      y -= 1;
    }
    out.push(`${y}-${String(m).padStart(2, '0')}`);
  }
  return out;
}

export function monthLabel(ym) {
  if (!ym) return '';
  const [, m] = ym.split('-');
  return MONTHS_SHORT[Number(m) - 1] || ym;
}

export function merchantName(tx) {
  return (
    tx?.merchant?.businessName ||
    tx?.merchant?.name ||
    tx?.originalDescription ||
    tx?.description ||
    'Desconhecido'
  );
}

export function isExpenseTx(tx) {
  if (!tx || isBillPayment(tx)) return false;
  if (tx.type === 'CREDIT' || tx.type === 'CREDIT_INCOME') return false;
  return Number(tx.amount) < 0 || tx.type === 'DEBIT';
}

export function isIncomeTx(tx) {
  if (!tx || isBillPayment(tx)) return false;
  if (tx.type === 'DEBIT') return false;
  return Number(tx.amount) > 0 || tx.type === 'CREDIT' || tx.type === 'CREDIT_INCOME';
}

/**
 * Normalize bank description for matching (uppercase, no accents).
 * @param {string} [text]
 */
function normalizeDesc(text) {
  return String(text || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * True when a bank-account expense looks like an automatic debit
 * (scheduled PENDING or classic "débito aut" / convênio patterns).
 * Excludes manuals, credit cards, and fatura payments (already counted elsewhere).
 *
 * @param {object} tx
 * @param {{ bankAccountIds?: Set<string>|string[] }} [opts]
 */
export function isAutomaticDebitTx(tx, { bankAccountIds } = {}) {
  if (!tx || tx.isManual) return false;
  if (!isExpenseTx(tx)) return false;

  if (bankAccountIds) {
    const ids = bankAccountIds instanceof Set ? bankAccountIds : new Set(bankAccountIds);
    if (!ids.has(tx.accountId)) return false;
  }

  if (tx.status === 'PENDING') return true;

  if (tx.operationType === 'CONVENIO_ARRECADACAO') return true;

  const d = normalizeDesc(tx.descriptionRaw || tx.description);
  return (
    d.includes('DEBITO AUT') ||
    d.includes('DEB AUT') ||
    d.includes('DEB.AUT') ||
    d.includes('DEBITO AUTOMATICO') ||
    d.includes('DEBITO AUTOM') ||
    d.includes('DEBITO EM CONTA')
  );
}

/**
 * Automatic debits from connected bank accounts for a calendar month (YYYY-MM).
 * @param {object[]} transactions
 * @param {string} ym
 * @param {{ bankAccountIds?: Set<string>|string[] }} [opts]
 */
export function automaticDebitsForMonth(transactions = [], ym, opts = {}) {
  if (!ym) return [];
  return transactions.filter(
    (t) => isAutomaticDebitTx(t, opts) && String(t.date || '').startsWith(ym)
  );
}

export function filterTransactions(transactions = [], { accountId, category, fromYm, toYm, fromDate, toDate } = {}) {
  return transactions.filter((t) => {
    if (accountId && accountId !== 'all' && t.accountId !== accountId) return false;
    if (category && category !== 'all') {
      const label = translateCategory(t.category);
      if (label !== category && t.category !== category) return false;
    }
    const ym = ymFromDate(t.date);
    if (fromYm && ym && ym < fromYm) return false;
    if (toYm && ym && ym > toYm) return false;
    if (fromDate && t.date && String(t.date).slice(0, 10) < fromDate) return false;
    if (toDate && t.date && String(t.date).slice(0, 10) > toDate) return false;
    return true;
  });
}

/** Monthly income / expense series for charts */
export function buildIncomeExpenseSeries(transactions = [], monthsCount = 6, endYm = currentYm()) {
  const months = lastNMonths(monthsCount, endYm);
  return months.map((ym) => {
    let receita = 0;
    let despesa = 0;
    transactions.forEach((t) => {
      if (ymFromDate(t.date) !== ym) return;
      if (isIncomeTx(t)) receita += Math.abs(Number(t.amount) || 0);
      else if (isExpenseTx(t)) despesa += Math.abs(Number(t.amount) || 0);
    });
    return {
      mês: monthLabel(ym),
      ym,
      receita: Number(receita.toFixed(2)),
      despesa: Number(despesa.toFixed(2)),
      net: Number((receita - despesa).toFixed(2)),
    };
  });
}

/**
 * Reconstruct net-worth evolution from current NW + monthly cashflow.
 * Walks backwards: NW[m-1] = NW[m] - netFlow[m]
 */
export function buildNetWorthSeries(
  transactions = [],
  accounts = [],
  investments = [],
  loans = [],
  monthsCount = 6,
  endYm = currentYm()
) {
  const months = lastNMonths(monthsCount, endYm);
  const flows = buildIncomeExpenseSeries(transactions, monthsCount, endYm);
  const { netWorth } = calculateNetWorth(accounts, investments, loans);
  const byYm = Object.fromEntries(flows.map((f) => [f.ym, f.net]));

  const values = {};
  values[endYm] = netWorth;
  for (let i = months.length - 2; i >= 0; i--) {
    const ym = months[i];
    const nextYm = months[i + 1];
    values[ym] = Number((values[nextYm] - (byYm[nextYm] || 0)).toFixed(2));
  }

  return months.map((ym) => ({
    month: monthLabel(ym),
    ym,
    patrimônio: values[ym] ?? 0,
  }));
}

export function monthCashflow(transactions = [], ym = currentYm()) {
  let income = 0;
  let expense = 0;
  transactions.forEach((t) => {
    if (ymFromDate(t.date) !== ym) return;
    if (isIncomeTx(t)) income += Math.abs(Number(t.amount) || 0);
    else if (isExpenseTx(t)) expense += Math.abs(Number(t.amount) || 0);
  });
  const net = income - expense;
  const savingsRate = income > 0 ? (net / income) * 100 : null;
  return {
    ym,
    income: Number(income.toFixed(2)),
    expense: Number(expense.toFixed(2)),
    net: Number(net.toFixed(2)),
    savingsRate: savingsRate == null ? null : Number(savingsRate.toFixed(1)),
  };
}

export function monthOverMonth(transactions = [], ym = currentYm()) {
  const [y, m] = ym.split('-').map(Number);
  let pm = m - 1;
  let py = y;
  if (pm < 1) {
    pm = 12;
    py -= 1;
  }
  const prevYm = `${py}-${String(pm).padStart(2, '0')}`;
  const current = monthCashflow(transactions, ym);
  const previous = monthCashflow(transactions, prevYm);

  const expenseDelta =
    previous.expense > 0
      ? ((current.expense - previous.expense) / previous.expense) * 100
      : current.expense > 0
        ? 100
        : 0;

  const byCat = (targetYm) => {
    const map = {};
    transactions.forEach((t) => {
      if (!isExpenseTx(t) || ymFromDate(t.date) !== targetYm) return;
      const cat = translateCategory(t.category);
      map[cat] = (map[cat] || 0) + Math.abs(Number(t.amount) || 0);
    });
    return map;
  };

  const curCats = byCat(ym);
  const prevCats = byCat(prevYm);
  const catDeltas = Object.keys({ ...curCats, ...prevCats })
    .map((cat) => {
      const cur = curCats[cat] || 0;
      const prev = prevCats[cat] || 0;
      const deltaPct = prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? 100 : 0;
      return { category: cat, current: cur, previous: prev, deltaPct: Number(deltaPct.toFixed(1)), delta: cur - prev };
    })
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  return {
    current,
    previous,
    expenseDeltaPct: Number(expenseDelta.toFixed(1)),
    topCategoryDeltas: catDeltas.slice(0, 5),
  };
}

export function expensesByCategory(transactions = [], { limit = 7, ym } = {}) {
  const map = {};
  transactions.forEach((t) => {
    if (!isExpenseTx(t)) return;
    if (ym && ymFromDate(t.date) !== ym) return;
    const cat = translateCategory(t.category);
    map[cat] = (map[cat] || 0) + Math.abs(Number(t.amount) || 0);
  });
  return Object.entries(map)
    .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

/** Stacked category spend over months — top categories across window */
export function buildCategoryTrend(transactions = [], monthsCount = 6, topN = 5, endYm = currentYm()) {
  const months = lastNMonths(monthsCount, endYm);
  const totals = {};
  months.forEach((ym) => {
    transactions.forEach((t) => {
      if (!isExpenseTx(t) || ymFromDate(t.date) !== ym) return;
      const cat = translateCategory(t.category);
      totals[cat] = (totals[cat] || 0) + Math.abs(Number(t.amount) || 0);
    });
  });
  const topCats = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([name]) => name);

  return months.map((ym) => {
    const row = { mês: monthLabel(ym), ym };
    topCats.forEach((cat) => {
      let sum = 0;
      transactions.forEach((t) => {
        if (!isExpenseTx(t) || ymFromDate(t.date) !== ym) return;
        if (translateCategory(t.category) !== cat) return;
        sum += Math.abs(Number(t.amount) || 0);
      });
      row[cat] = Number(sum.toFixed(2));
    });
    return row;
  });
}

export function getTopCategoriesForTrend(transactions = [], monthsCount = 6, topN = 5, endYm = currentYm()) {
  const months = lastNMonths(monthsCount, endYm);
  const totals = {};
  months.forEach((ym) => {
    transactions.forEach((t) => {
      if (!isExpenseTx(t) || ymFromDate(t.date) !== ym) return;
      const cat = translateCategory(t.category);
      totals[cat] = (totals[cat] || 0) + Math.abs(Number(t.amount) || 0);
    });
  });
  return Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([name]) => name);
}

export function expensesByMerchant(transactions = [], { limit = 10, ym } = {}) {
  const map = {};
  transactions.forEach((t) => {
    if (!isExpenseTx(t)) return;
    if (ym && ymFromDate(t.date) !== ym) return;
    const name = merchantName(t);
    map[name] = (map[name] || 0) + Math.abs(Number(t.amount) || 0);
  });
  return Object.entries(map)
    .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function monthlyEquivalentFor(amount, frequency = 'monthly') {
  const n = Number(amount) || 0;
  if (frequency === 'weekly') return Number((n * 4.33).toFixed(2));
  if (frequency === 'yearly') return Number((n / 12).toFixed(2));
  if (frequency === 'bimonthly') return Number((n / 2).toFixed(2));
  return Number(n.toFixed(2));
}

/** Sankey nodes/links: Income → Categories (top categories + Outros) */
export function buildCashflowSankey(transactions = [], ym = currentYm(), topN = 6) {
  const flow = monthCashflow(transactions, ym);
  const cats = expensesByCategory(transactions, { limit: topN, ym });
  const catTotal = cats.reduce((s, c) => s + c.value, 0);
  const otherRaw = Math.max(0, flow.expense - catTotal);

  // Deficit / no-income months: source is "Despesas" so link totals stay valid
  if (flow.income <= 0 || flow.expense > flow.income) {
    const nodes = [{ name: flow.income > 0 ? 'Gastos do mês' : 'Despesas' }];
    cats.forEach((c) => nodes.push({ name: c.name }));
    if (otherRaw > 1) nodes.push({ name: 'Outros' });
    const nameIndex = Object.fromEntries(nodes.map((n, i) => [n.name, i]));
    const links = [];
    const source = 0;
    cats.forEach((c) => {
      if (c.value <= 0) return;
      links.push({ source, target: nameIndex[c.name], value: c.value });
    });
    if (otherRaw > 1 && nameIndex['Outros'] != null) {
      links.push({ source, target: nameIndex['Outros'], value: Number(otherRaw.toFixed(2)) });
    }
    return { nodes, links, summary: flow };
  }

  // Surplus: Receitas → categories + Saldo positivo (outflows = income)
  const fundedExpense = flow.expense;
  const scale = catTotal + otherRaw > 0 ? fundedExpense / (catTotal + otherRaw) : 1;
  const nodes = [{ name: 'Receitas' }];
  cats.forEach((c) => nodes.push({ name: c.name }));
  const other = Number((otherRaw * scale).toFixed(2));
  if (other > 1) nodes.push({ name: 'Outros' });
  if (flow.net > 0) nodes.push({ name: 'Saldo positivo' });

  const nameIndex = Object.fromEntries(nodes.map((n, i) => [n.name, i]));
  const links = [];

  cats.forEach((c) => {
    const value = Number((c.value * scale).toFixed(2));
    if (value <= 0) return;
    links.push({ source: nameIndex['Receitas'], target: nameIndex[c.name], value });
  });
  if (other > 1 && nameIndex['Outros'] != null) {
    links.push({ source: nameIndex['Receitas'], target: nameIndex['Outros'], value: other });
  }
  if (flow.net > 0 && nameIndex['Saldo positivo'] != null) {
    links.push({
      source: nameIndex['Receitas'],
      target: nameIndex['Saldo positivo'],
      value: flow.net,
    });
  }

  return { nodes, links, summary: flow };
}

export function dailyExpenseHeatmap(transactions = [], ym = currentYm()) {
  const [y, m] = ym.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const byDay = {};
  for (let d = 1; d <= daysInMonth; d++) {
    byDay[d] = 0;
  }
  transactions.forEach((t) => {
    if (!isExpenseTx(t) || ymFromDate(t.date) !== ym) return;
    const day = Number(String(t.date).slice(8, 10));
    if (byDay[day] != null) byDay[day] += Math.abs(Number(t.amount) || 0);
  });
  return Object.entries(byDay).map(([day, value]) => ({
    day: Number(day),
    value: Number(value.toFixed(2)),
  }));
}

/**
 * Detect recurring subscriptions from expense transactions.
 * Groups by normalized merchant; requires ≥2 occurrences with similar amount.
 */
export function detectSubscriptions(transactions = [], { minOccurrences = 2, amountTolerance = 0.15 } = {}) {
  const expenses = transactions.filter(isExpenseTx);
  const groups = {};

  expenses.forEach((t) => {
    const raw = merchantName(t)
      .toUpperCase()
      .replace(/\s+/g, ' ')
      .replace(/\d{1,2}\/\d{1,2}/g, '')
      .trim();
    const key = raw.slice(0, 40) || 'OUTROS';
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  });

  const results = [];
  Object.entries(groups).forEach(([key, txs]) => {
    if (txs.length < minOccurrences) return;
    const amounts = txs.map((t) => Math.abs(Number(t.amount) || 0)).sort((a, b) => a - b);
    const median = amounts[Math.floor(amounts.length / 2)];
    const similar = txs.filter((t) => {
      const a = Math.abs(Number(t.amount) || 0);
      return median === 0 ? a === 0 : Math.abs(a - median) / median <= amountTolerance;
    });
    if (similar.length < minOccurrences) return;

    const dates = similar
      .map((t) => new Date(t.date))
      .filter((d) => !Number.isNaN(d.getTime()))
      .sort((a, b) => a - b);
    if (dates.length < 2) return;

    const gaps = [];
    for (let i = 1; i < dates.length; i++) {
      gaps.push((dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24));
    }
    const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    let frequency = 'monthly';
    if (avgGap <= 10) frequency = 'weekly';
    else if (avgGap >= 300) frequency = 'yearly';
    else if (avgGap > 40 && avgGap < 80) frequency = 'bimonthly';

    // Skip one-offs that just happened twice by chance with huge gap variance
    if (avgGap > 100 && frequency === 'monthly') return;

    const lastDate = dates[dates.length - 1];
    const nextDate = new Date(lastDate);
    if (frequency === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
    else if (frequency === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1);
    else if (frequency === 'bimonthly') nextDate.setMonth(nextDate.getMonth() + 2);
    else nextDate.setMonth(nextDate.getMonth() + 1);

    const sample = similar[similar.length - 1];
    results.push({
      id: key,
      name: merchantName(sample),
      amount: Number(median.toFixed(2)),
      frequency,
      occurrences: similar.length,
      lastDate: lastDate.toISOString(),
      nextDate: nextDate.toISOString(),
      category: translateCategory(sample.category),
      monthlyEquivalent: monthlyEquivalentFor(median, frequency),
    });
  });

  // Also include explicit manual recurrings
  transactions
    .filter((t) => t.isManual && t.isRecurring && isExpenseTx(t))
    .forEach((t) => {
      const name = t.originalDescription || t.description;
      const already = results.some(
        (r) => r.name.toLowerCase().includes(String(name).toLowerCase().slice(0, 20))
      );
      if (already) return;
      const amount = Math.abs(Number(t.amount) || 0);
      const frequency = t.frequency || 'monthly';
      const next = new Date(t.date);
      results.push({
        id: `manual_${t.id}`,
        name,
        amount,
        frequency,
        occurrences: 1,
        lastDate: t.date,
        nextDate: next.toISOString(),
        category: translateCategory(t.category),
        monthlyEquivalent: monthlyEquivalentFor(amount, frequency),
        isManual: true,
      });
    });

  return results.sort((a, b) => b.monthlyEquivalent - a.monthlyEquivalent);
}

export function weekBounds(now = new Date()) {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  prevEnd.setHours(23, 59, 59, 999);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - 6);
  prevStart.setHours(0, 0, 0, 0);
  return {
    thisWeek: { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) },
    lastWeek: { from: prevStart.toISOString().slice(0, 10), to: prevEnd.toISOString().slice(0, 10) },
  };
}

export function weeklyRecap(transactions = [], now = new Date()) {
  const { thisWeek, lastWeek } = weekBounds(now);
  const sumExpenses = (from, to) => {
    let total = 0;
    const cats = {};
    transactions.forEach((t) => {
      if (!isExpenseTx(t)) return;
      const d = String(t.date).slice(0, 10);
      if (d < from || d > to) return;
      const amt = Math.abs(Number(t.amount) || 0);
      total += amt;
      const cat = translateCategory(t.category);
      cats[cat] = (cats[cat] || 0) + amt;
    });
    const topCategory = Object.entries(cats).sort((a, b) => b[1] - a[1])[0];
    return {
      total: Number(total.toFixed(2)),
      topCategory: topCategory ? { name: topCategory[0], value: Number(topCategory[1].toFixed(2)) } : null,
    };
  };

  const current = sumExpenses(thisWeek.from, thisWeek.to);
  const previous = sumExpenses(lastWeek.from, lastWeek.to);
  const deltaPct =
    previous.total > 0
      ? Number((((current.total - previous.total) / previous.total) * 100).toFixed(1))
      : current.total > 0
        ? 100
        : 0;

  return { thisWeek, lastWeek, current, previous, deltaPct };
}

export function buildInsights(transactions = [], ym = currentYm()) {
  const insights = [];
  const mom = monthOverMonth(transactions, ym);
  const recap = weeklyRecap(transactions);
  const flow = mom.current;

  if (flow.savingsRate != null) {
    insights.push({
      id: 'savings',
      type: flow.savingsRate >= 20 ? 'positive' : flow.savingsRate >= 0 ? 'neutral' : 'warning',
      text:
        flow.savingsRate >= 0
          ? `Taxa de poupança de ${flow.savingsRate.toFixed(0)}% este mês.`
          : `Despesas superaram receitas em ${Math.abs(flow.savingsRate).toFixed(0)}% este mês.`,
    });
  }

  if (mom.expenseDeltaPct !== 0) {
    const up = mom.expenseDeltaPct > 0;
    insights.push({
      id: 'mom',
      type: up ? 'warning' : 'positive',
      text: up
        ? `Gastos ${mom.expenseDeltaPct.toFixed(0)}% acima do mês anterior.`
        : `Gastos ${Math.abs(mom.expenseDeltaPct).toFixed(0)}% abaixo do mês anterior.`,
    });
  }

  const spike = mom.topCategoryDeltas.find((c) => c.previous > 0 && c.deltaPct >= 25);
  if (spike) {
    insights.push({
      id: 'cat-spike',
      type: 'warning',
      text: `Você gastou ${spike.deltaPct.toFixed(0)}% a mais em ${spike.category} este mês.`,
    });
  }

  if (recap.current.topCategory) {
    insights.push({
      id: 'week-top',
      type: 'neutral',
      text: `Na última semana, a maior categoria foi ${recap.current.topCategory.name} (${recap.current.topCategory.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}).`,
    });
  }

  return insights.slice(0, 4);
}

export function investmentAllocation(investments = []) {
  const map = {};
  investments.forEach((inv) => {
    const key = inv.subtype || inv.type || 'Outros';
    const val = Number(inv.balance || inv.amount || 0);
    map[key] = (map[key] || 0) + val;
  });
  return Object.entries(map)
    .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
    .sort((a, b) => b.value - a.value);
}

export function investmentByIssuer(investments = []) {
  const map = {};
  investments.forEach((inv) => {
    const key = inv.issuer || inv.institution || 'Outros';
    const val = Number(inv.balance || inv.amount || 0);
    map[key] = (map[key] || 0) + val;
  });
  return Object.entries(map)
    .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
    .sort((a, b) => b.value - a.value);
}

export function goalProjection(goal, now = new Date()) {
  const target = Number(goal.targetAmount) || 0;
  const current = Number(goal.currentAmount) || 0;
  const remaining = Math.max(0, target - current);
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

  let monthsLeft = null;
  let neededPerMonth = null;
  let onTrack = null;
  let expectedPct = null;

  if (goal.deadline) {
    const deadline = new Date(goal.deadline);
    const startGuess = goal.createdAt ? new Date(goal.createdAt) : new Date(now.getFullYear(), 0, 1);
    const msLeft = deadline - now;
    monthsLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24 * 30.44)));
    neededPerMonth = monthsLeft > 0 ? Number((remaining / monthsLeft).toFixed(2)) : remaining;

    const totalSpan = Math.max(1, (deadline - startGuess) / (1000 * 60 * 60 * 24 * 30.44));
    const elapsed = Math.min(totalSpan, Math.max(0, (now - startGuess) / (1000 * 60 * 60 * 24 * 30.44)));
    expectedPct = Math.min(100, Math.round((elapsed / totalSpan) * 100));
    onTrack = pct >= expectedPct - 5;
  }

  return { remaining, pct, monthsLeft, neededPerMonth, onTrack, expectedPct };
}

export function exportReportCsv({ incomeExpense = [], categories = [], merchants = [] }) {
  const lines = ['tipo,nome,valor'];
  incomeExpense.forEach((row) => {
    lines.push(`receita,${row.mês || row.ym},${row.receita}`);
    lines.push(`despesa,${row.mês || row.ym},${row.despesa}`);
  });
  categories.forEach((c) => lines.push(`categoria,${JSON.stringify(c.name)},${c.value}`));
  merchants.forEach((m) => lines.push(`merchant,${JSON.stringify(m.name)},${m.value}`));
  return lines.join('\n');
}
