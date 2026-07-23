import React, { useEffect, useState, useMemo, useRef } from 'react';
import { 
  CreditCard as CreditCardIcon, 
  Calendar, 
  Search, 
  ChevronRight,
  ChevronLeft,
  Receipt,
  CheckCircle2,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ProgressBar } from '../components/ui/ProgressBar';
import { useAccountStore } from '../stores/accountStore';
import { fetchTransactions, fetchBills } from '../services/api';
import { formatCurrency, formatDate } from '../utils/formatters';
import { translateCategory } from '../utils/categories';
import { getCategoryColor } from '../utils/colors';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { useReceivableStore } from '../stores/receivableStore';
import {
  buildCreditCardBills,
  formatDueMonthTitle,
  formatDueMonthShort,
  isBillPayment,
} from '../utils/creditBillPeriod';

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function CreditCards() {
  const { accounts, loadAccounts } = useAccountStore();
  const { receivables, loadReceivables } = useReceivableStore();
  const [cardTransactions, setCardTransactions] = useState([]);
  const [officialBills, setOfficialBills] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Multi-card selection state ('all' or specific card.id)
  const [selectedCardId, setSelectedCardId] = useState('all');

  const timelineRef = useRef(null);

  // ── Accounts & Receivables ──────────────────────────────────────────────────
  useEffect(() => { loadAccounts(); loadReceivables(); }, []);

  const creditCards = useMemo(() => accounts.filter(a => a.type === 'CREDIT'), [accounts]);
  const activeCard = selectedCardId === 'all'
    ? null
    : (creditCards.find(c => c.id === selectedCardId) || creditCards[0] || null);

  // ── Load card data (supports single or all cards) ──────────────────────────
  useEffect(() => {
    async function load() {
      if (creditCards.length === 0) {
        setLoadingData(false);
        return;
      }
      setLoadingData(true);
      try {
        if (selectedCardId === 'all') {
          // Consolidated mode: fetch transactions and bills for ALL cards
          const allTxs = [];
          const allBillsList = [];
          for (const card of creditCards) {
            const [txRes, billsRes] = await Promise.all([
              fetchTransactions({ accountId: card.id }),
              fetchBills(card.id)
            ]);
            const txs = (txRes.results || txRes || []).map(t => ({ ...t, accountId: t.accountId || card.id }));
            const bills = (billsRes || []).map(b => ({ ...b, accountId: card.id }));
            allTxs.push(...txs);
            allBillsList.push(...bills);
          }
          setCardTransactions(allTxs);
          setOfficialBills(allBillsList);
        } else if (activeCard?.id) {
          const [txRes, billsRes] = await Promise.all([
            fetchTransactions({ accountId: activeCard.id }),
            fetchBills(activeCard.id)
          ]);
          setCardTransactions((txRes.results || txRes || []).map(t => ({
            ...t,
            accountId: t.accountId || activeCard.id,
          })));
          setOfficialBills((billsRes || []).map(b => ({ ...b, accountId: activeCard.id })));
        }
      } catch (e) {
        console.warn('[CreditCards] load error:', e);
      } finally {
        setLoadingData(false);
      }
    }
    if (accounts.length > 0) load();
  }, [selectedCardId, activeCard?.id, accounts.length]);

  // ── Card metrics (Consolidated vs Individual) ──────────────────────────────
  const totalDebtAllCards = creditCards.reduce((acc, c) => acc + Math.abs(c.balance || 0), 0);
  const totalLimitAllCards = creditCards.reduce((acc, c) => acc + (c.creditData?.creditLimit || 0), 0);
  const availableLimitAllCards = creditCards.reduce((acc, c) => acc + (c.creditData?.availableCreditLimit ?? (c.creditData?.creditLimit ? c.creditData.creditLimit - Math.abs(c.balance || 0) : 0)), 0);

  const displayCard = activeCard || creditCards[0];
  const creditData = displayCard?.creditData || {};
  const totalDebt = activeCard ? Math.abs(activeCard.balance || 0) : totalDebtAllCards;
  const creditLimit = activeCard ? (creditData.creditLimit || 79000) : (totalLimitAllCards || 79000);
  const availableLimit = activeCard ? (creditData.availableCreditLimit ?? (creditLimit - totalDebt)) : availableLimitAllCards;
  const pctUsed = creditLimit > 0 ? Math.min(100, Math.round((totalDebt / creditLimit) * 100)) : 0;

  // ── Bills indexed by due month (canonical) ─────────────────────────────────
  const billPeriod = useMemo(
    () =>
      buildCreditCardBills({
        transactions: cardTransactions,
        officialBills,
        creditCards,
        selectedCardId,
      }),
    [cardTransactions, officialBills, creditCards, selectedCardId]
  );

  const sortedBillKeys = billPeriod.sortedDueKeys;
  const currentOpenKey = billPeriod.openDueKey;
  const billsData = billPeriod.bills;

  const [selectedBillKey, setSelectedBillKey] = useState(null);

  useEffect(() => {
    setSelectedBillKey(null);
  }, [selectedCardId]);

  useEffect(() => {
    if (currentOpenKey && !selectedBillKey) {
      setSelectedBillKey(currentOpenKey);
    }
  }, [currentOpenKey, selectedBillKey]);

  const activeSelectedKey = selectedBillKey || currentOpenKey;

  // Scroll selected bill into view on load or when selected key changes
  useEffect(() => {
    if (timelineRef.current && activeSelectedKey && !loadingData) {
      // Wait slightly for DOM to settle
      const timer = setTimeout(() => {
        const container = timelineRef.current;
        const selectedEl = container.querySelector(`[data-bill-key="${activeSelectedKey}"]`);
        if (selectedEl) {
          const containerWidth = container.clientWidth;
          const elementLeft = selectedEl.offsetLeft;
          const elementWidth = selectedEl.clientWidth;
          container.scrollTo({
            left: elementLeft - (containerWidth / 2) + (elementWidth / 2),
            behavior: 'smooth'
          });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [activeSelectedKey, loadingData]);

  // Navigation
  const activeIndex = sortedBillKeys.indexOf(activeSelectedKey);
  const handlePrev = () => {
    if (activeIndex > 0) { setSelectedBillKey(sortedBillKeys[activeIndex - 1]); setSearch(''); setSelectedCategory('all'); }
  };
  const handleNext = () => {
    if (activeIndex >= 0 && activeIndex < sortedBillKeys.length - 1) { setSelectedBillKey(sortedBillKeys[activeIndex + 1]); setSearch(''); setSelectedCategory('all'); }
  };
  const handleGoToCurrent = () => { setSelectedBillKey(currentOpenKey); setSearch(''); setSelectedCategory('all'); };

  // KPIs
  const currentOpenBill = billsData[currentOpenKey];
  const currentOpenTotal = currentOpenBill?.total || 0;

  const lastPaidKey = [...sortedBillKeys]
    .reverse()
    .find(k => billsData[k]?.isPaid && billsData[k]?.type === 'PAST');
  const lastPaidBill = lastPaidKey ? billsData[lastPaidKey] : null;

  // Selected bill
  const currentSelectedBill = useMemo(() => {
    return billsData[activeSelectedKey] || {
      monthKey: activeSelectedKey,
      items: [],
      total: 0,
      type: activeSelectedKey > (currentOpenKey || '') ? 'FUTURE' : 'PAST'
    };
  }, [billsData, activeSelectedKey, currentOpenKey]);

  // Category breakdown for selected bill
  const selectedBillCategories = useMemo(() => {
    const map = {};
    (currentSelectedBill.items || []).forEach(t => {
      if (isBillPayment(t)) return;
      const label = translateCategory(t.category);
      map[label] = (map[label] || 0) + Math.abs(t.amount);
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [currentSelectedBill]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return (currentSelectedBill.items || []).filter(t => {
      if (search) {
        const q = search.toLowerCase();
        if (!t.description?.toLowerCase().includes(q) &&
            !t.merchant?.businessName?.toLowerCase().includes(q)) return false;
      }
      if (selectedCategory !== 'all' && translateCategory(t.category) !== selectedCategory) return false;
      return true;
    });
  }, [currentSelectedBill, search, selectedCategory]);

  // Bar chart data — keys are already due months
  const chartData = useMemo(() => {
    return sortedBillKeys.map(k => {
      const b = billsData[k];
      const [, dm] = k.split('-');
      return {
        key: k,
        label: `${dm}/${k.split('-')[0].slice(2)}`,
        total: b?.total || 0,
        type: b?.type
      };
    });
  }, [sortedBillKeys, billsData]);

  // Badge helpers
  function billBadge(bill) {
    if (!bill || bill.type === 'FUTURE') return { variant: 'info', text: 'Projetada' };
    if (bill.type === 'CURRENT_OPEN') return { variant: 'warning', text: 'Em Aberto' };
    if (bill.isPaid) return { variant: 'success', text: 'Paga' };
    return { variant: 'neutral', text: 'Fechada' };
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

      {/* Page Header */}
      <div>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>
          {selectedCardId === 'all' ? 'Cartões de Crédito (Visão Consolidada)' : (activeCard?.name || 'Cartão de Crédito')}
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
          {selectedCardId === 'all'
            ? `Soma consolidada de ${creditCards.length} cartões conectados • Sincronização em tempo real via Pluggy.ai`
            : `${activeCard?.name || 'Cartão'} • Final ${activeCard?.number || '****'} • Titular: ${activeCard?.owner || '—'}`
          }
        </p>
      </div>

      {/* Credit Card Selector Tabs */}
      {creditCards.length > 0 && (
        <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.25rem', scrollbarWidth: 'thin' }}>
          <div
            onClick={() => setSelectedCardId('all')}
            style={{
              padding: '0.75rem 1.25rem',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              border: selectedCardId === 'all' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
              backgroundColor: selectedCardId === 'all' ? 'var(--primary-light)' : 'var(--bg-tertiary)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              transition: 'all 0.2s ease',
              flexShrink: 0
            }}
          >
            <CreditCardIcon size={20} style={{ color: selectedCardId === 'all' ? 'var(--primary)' : 'var(--text-muted)' }} />
            <div>
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, display: 'block', color: selectedCardId === 'all' ? 'var(--primary)' : 'var(--text-primary)' }}>
                Todos os Cartões (Consolidado)
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {creditCards.length} cartões • Total: {formatCurrency(totalDebtAllCards)}
              </span>
            </div>
          </div>

          {creditCards.map(card => {
            const isSelected = selectedCardId === card.id;
            const debt = Math.abs(card.balance || 0);
            return (
              <div
                key={card.id}
                onClick={() => setSelectedCardId(card.id)}
                style={{
                  padding: '0.75rem 1.25rem',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                  backgroundColor: isSelected ? 'var(--primary-light)' : 'var(--bg-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  transition: 'all 0.2s ease',
                  flexShrink: 0
                }}
              >
                <CreditCardIcon size={20} style={{ color: isSelected ? 'var(--primary)' : 'var(--text-muted)' }} />
                <div>
                  <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, display: 'block', color: isSelected ? 'var(--primary)' : 'var(--text-primary)' }}>
                    {card.name}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Final {card.number || '****'} • Fatura: {formatCurrency(debt)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── KPI Row ── */}
      <div className="dashboard-grid">
        <Card className="col-3" style={{ borderLeft: '4px solid var(--warning)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>
              FATURA EM ABERTO
            </span>
            <Badge variant="warning">Aberta</Badge>
          </div>
          <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, margin: '0.4rem 0' }}>
            {formatCurrency(currentOpenTotal)}
          </h2>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            Vence em {formatDueMonthShort(currentOpenKey, currentOpenBill?.dueDate)} • {currentOpenBill?.items?.filter(t => !isBillPayment(t) && !t.isProjected).length || 0} compras
          </span>
        </Card>

        <Card className="col-3" style={{ borderLeft: '4px solid var(--success)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>
              ÚLTIMA FATURA PAGA
            </span>
            <Badge variant="success">Paga</Badge>
          </div>
          <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, margin: '0.4rem 0', color: 'var(--success)' }}>
            {formatCurrency(lastPaidBill?.total || 0)}
          </h2>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--success)' }}>
            ✓ {lastPaidBill ? `${formatDueMonthTitle(lastPaidKey)} — Venceu em ${lastPaidBill.dueDate || '—'}` : '—'}
          </span>
        </Card>

        <Card className="col-3" style={{ borderLeft: '4px solid var(--danger)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>
              SALDO DEVEDOR TOTAL
            </span>
            <Badge variant="neutral">{selectedCardId === 'all' ? 'Soma Consolidada' : 'Cartão'}</Badge>
          </div>
          <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, margin: '0.4rem 0', color: 'var(--danger)' }}>
            {formatCurrency(totalDebt)}
          </h2>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            Faturas abertas + parcelas futuras
          </span>
        </Card>

        <Card className="col-3" style={{ borderLeft: '4px solid var(--info)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>
              LIMITE DISPONÍVEL
            </span>
            <Badge variant="neutral">{100 - pctUsed}% Livre</Badge>
          </div>
          <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, margin: '0.4rem 0', color: 'var(--success)' }}>
            {formatCurrency(availableLimit)}
          </h2>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            De {formatCurrency(creditLimit)} total ({pctUsed}% utilizado)
          </span>
        </Card>
      </div>

      {/* ── Bill Selector ── */}
      <Card
        title="Seletor de Faturas"
        subtitle={selectedCardId === 'all' ? "Valores consolidados (soma) de todas as faturas históricas, fatura aberta e projeções" : "Faturas históricas (oficiais), fatura em aberto e projeções de parcelas futuras"}
        action={
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Button size="sm" variant="outline" onClick={handlePrev} disabled={activeIndex <= 0}>
              <ChevronLeft size={15} /> Anterior
            </Button>
            <Button size="sm" variant="secondary" onClick={handleGoToCurrent}>
              Fatura Atual
            </Button>
            <Button size="sm" variant="outline" onClick={handleNext} disabled={activeIndex >= sortedBillKeys.length - 1}>
              Próxima <ChevronRight size={15} />
            </Button>
          </div>
        }
      >
        <div
          ref={timelineRef}
          style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', padding: '0.75rem 0.25rem', scrollbarWidth: 'thin' }}
        >
          {sortedBillKeys.map(k => {
            const bill = billsData[k];
            const isSelected = k === activeSelectedKey;
            const badge = billBadge(bill, k);
            const displayAmount = bill?.total || 0;

            const title = formatDueMonthTitle(k);
            const dueStr = formatDueMonthShort(k, bill?.dueDate);

            let borderColor = 'var(--border-color)';
            if (bill?.type === 'CURRENT_OPEN') borderColor = 'var(--warning)';
            else if (bill?.type === 'FUTURE') borderColor = 'var(--info)';
            else if (bill?.isPaid) borderColor = 'var(--success)';

            return (
              <div
                key={k}
                data-bill-key={k}
                onClick={() => { setSelectedBillKey(k); setSearch(''); setSelectedCategory('all'); }}
                style={{
                  minWidth: 185,
                  flexShrink: 0,
                  padding: '1rem',
                  borderRadius: 'var(--radius-lg)',
                  cursor: 'pointer',
                  border: isSelected ? `2px solid var(--primary)` : `1.5px solid ${borderColor}`,
                  backgroundColor: isSelected ? 'var(--primary-light)' : 'var(--bg-tertiary)',
                  boxShadow: isSelected ? 'var(--shadow-glow)' : 'var(--shadow-sm)',
                  transition: 'all 0.2s ease',
                  transform: isSelected ? 'translateY(-3px)' : 'none'
                }}
              >
                <div style={{ marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: isSelected ? 'var(--primary)' : 'var(--text-secondary)' }}>
                    {title}
                  </span>
                </div>
                <Badge variant={badge.variant}>{badge.text}</Badge>
                <div style={{ marginTop: '0.6rem' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>VALOR CONSOLIDADO</span>
                  <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: isSelected ? 'var(--primary)' : 'var(--text-primary)', margin: '2px 0' }}>
                    {formatCurrency(displayAmount)}
                  </h4>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    Vence {dueStr} • {bill?.items?.length || 0} itens
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* ── Evolution Chart ── */}
      <Card title="Evolução Mensal das Faturas (Soma Consolidada)" subtitle="Valores totais consolidados das faturas fechadas e projeções futuras">
        <div style={{ width: '100%', height: 220, marginTop: '0.5rem' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
              <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false}
                tickFormatter={v => `R$ ${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={v => [formatCurrency(v), 'Total da Fatura']}
                labelFormatter={lbl => `Fatura ${lbl}`}
                contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', borderColor: 'var(--border-color)' }}
              />
              <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={
                      entry.type === 'CURRENT_OPEN' ? 'var(--warning)' :
                      entry.type === 'FUTURE' ? 'var(--info)' :
                      'var(--primary)'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', justifyContent: 'flex-end', fontSize: '11px', color: 'var(--text-muted)' }}>
          <span>🟦 Paga</span>
          <span style={{ color: 'var(--warning)' }}>🟡 Aberta</span>
          <span style={{ color: 'var(--info)' }}>🔵 Projetada</span>
        </div>
      </Card>

      {/* ── Detailed Bill View ── */}
      <div className="dashboard-grid">
        <Card
          className="col-8"
          title={`Extrato Discriminado: ${formatDueMonthTitle(activeSelectedKey)}`}
        >
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            backgroundColor: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-md)',
            marginBottom: '1rem', border: '1px solid var(--border-color)'
          }}>
            <div>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', display: 'block' }}>VALOR TOTAL DESTA FATURA</span>
              <h3 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--danger)' }}>
                {formatCurrency(currentSelectedBill.total)}
              </h3>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Vencimento: {formatDueMonthShort(activeSelectedKey, currentSelectedBill.dueDate)} {currentSelectedBill.dueDate ? `(${currentSelectedBill.dueDate})` : ''}
              </span>
            </div>
            <div style={{ textAlign: 'right' }}>
              {(() => { const b = billBadge(currentSelectedBill, activeSelectedKey); return <Badge variant={b.variant}>{b.text}</Badge>; })()}
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
                {filteredTransactions.length} de {currentSelectedBill.items?.length || 0} compras
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--bg-tertiary)', padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <Search size={14} style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Buscar compra..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', color: 'var(--text-primary)', width: '100%', fontSize: 'var(--font-size-xs)' }}
              />
            </div>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="input"
              style={{ width: 'auto', padding: '0.4rem 0.6rem', fontSize: 'var(--font-size-xs)' }}
            >
              <option value="all">Todas ({selectedBillCategories.length} categorias)</option>
              {selectedBillCategories.map(c => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          {loadingData ? (
            <p style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>Carregando faturas consolidadas...</p>
          ) : filteredTransactions.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>
              Nenhuma compra para o filtro selecionado.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 520, overflowY: 'auto' }}>
              {filteredTransactions.map((tx, idx) => {
                const isPayment = isBillPayment(tx);
                const cardObj = creditCards.find(c => c.id === tx.accountId);
                return (
                  <div
                    key={tx.id || idx}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '0.75rem 0.85rem', borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        backgroundColor: isPayment ? 'var(--success-bg)' : 'var(--danger-bg)',
                        color: isPayment ? 'var(--success)' : 'var(--danger)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                      }}>
                        {isPayment ? <CheckCircle2 size={18} /> : <Receipt size={18} />}
                      </div>
                      <div>
                        <h4 style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>
                          {tx.description}
                        </h4>
                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginTop: '0.15rem', flexWrap: 'wrap' }}>
                          {selectedCardId === 'all' && cardObj && (
                            <Badge variant="neutral" style={{ fontWeight: 600, fontSize: '10px' }}>
                              💳 {cardObj.name}
                            </Badge>
                          )}
                          <Badge variant={isPayment ? 'success' : 'neutral'}>
                            {translateCategory(tx.category)}
                          </Badge>
                          {(() => {
                            const linked = receivables.find(r => r.linkedTransactionId === tx.id);
                            if (!linked) return null;
                            return (
                              <Badge
                                variant="info"
                                style={{ backgroundColor: linked.personColor + '22', color: linked.personColor, border: `1px solid ${linked.personColor}55` }}
                              >
                                👤 {linked.personName}
                              </Badge>
                            );
                          })()}
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            • {formatDate(tx.date)}
                          </span>
                          {tx.merchant?.businessName && (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              • {tx.merchant.businessName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '0.5rem' }}>
                      <span style={{
                        fontWeight: 700, fontSize: 'var(--font-size-sm)',
                        color: isPayment ? 'var(--success)' : 'var(--danger)'
                      }}>
                        {isPayment ? '+ ' : '- '}{formatCurrency(Math.abs(tx.amount))}
                      </span>
                      <p style={{ fontSize: '10px', marginTop: '2px', color: tx.isProjected ? 'var(--info)' : tx.status === 'POSTED' ? 'var(--success)' : 'var(--warning)' }}>
                        {tx.isProjected ? 'Parcela Projetada' : tx.status === 'POSTED' ? 'Confirmado' : 'Pendente'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="col-4" title={`Gastos por Categoria`} subtitle={formatDueMonthTitle(activeSelectedKey)}>
          {selectedBillCategories.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
              Sem dados de categoria nesta fatura.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {selectedBillCategories.map(cat => {
                const base = currentSelectedBill.total || 1;
                const pct = Math.min(100, Math.round((cat.value / base) * 100));
                return (
                  <div key={cat.name} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)' }}>
                      <span style={{ fontWeight: 600 }}>{cat.name}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{formatCurrency(cat.value)} ({pct}%)</span>
                    </div>
                    <ProgressBar percent={pct} color={getCategoryColor(cat.name)} height={8} />
                  </div>
                );
              })}
            </div>
          )}

          {currentSelectedBill.type === 'FUTURE' && (
            <div style={{ marginTop: '1.5rem', padding: '0.85rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                <TrendingUp size={14} style={{ color: 'var(--info)' }} />
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--info)' }}>PARCELAS PROJETADAS</span>
              </div>
              {(currentSelectedBill.items || []).map((t, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', padding: '0.2rem 0', borderBottom: '1px solid var(--border-color)' }}>
                  <span style={{ color: 'var(--text-secondary)', flex: 1, marginRight: '0.5rem' }}>
                    {t.description?.replace(/ \(Parcela \d+\/\d+\)/, '') || ''}
                  </span>
                  <span style={{ fontWeight: 600, color: 'var(--danger)', whiteSpace: 'nowrap' }}>
                    {formatCurrency(Math.abs(t.amount))}
                  </span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px solid var(--border-color)' }}>
                <span>Total projetado</span>
                <span style={{ color: 'var(--danger)' }}>{formatCurrency(currentSelectedBill.total)}</span>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
