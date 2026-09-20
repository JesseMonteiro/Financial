import React, { useEffect, useState, useMemo, useRef } from 'react';
import { 
  CreditCard as CreditCardIcon, 
  Calendar, 
  Search, 
  ChevronRight,
  ChevronLeft,
  TrendingUp,
  AlertCircle,
  Plus
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ProgressBar } from '../components/ui/ProgressBar';
import { PageLoadingSkeleton, Skeleton, SkeletonList } from '../components/ui/Skeleton';
import { useAccountStore } from '../stores/accountStore';
import { useReceivableStore } from '../stores/receivableStore';
import { useCreditDataStore } from '../stores/creditDataStore';
import { useTransactionStore } from '../stores/transactionStore';
import { PurchaseModal } from './ManualExpenses';
import { ReceivableModal } from './Receivables';
import { ItemDetailSheet } from '../components/ItemDetailSheet';
import { fromCreditPurchase, rowActivateProps, categoryOptionsForItem, applyingCategory } from '../utils/lineItemDetail';
import { fetchCategories, patchTransactionCategory } from '../services/api';
import { formatCurrency, formatDate } from '../utils/formatters';
import { translateCategory } from '../utils/categories';
import { getCategoryColor } from '../utils/colors';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { AccountIcon } from '../components/AccountIcon';
import { CategoryIcon } from '../components/CategoryIcon';
import { CreditCardFace } from '../components/CreditCardFace';
import { useCategoryStore } from '../stores/categoryStore';
import { useIsMobile } from '../hooks/useMediaQuery';
import {
  buildCreditCardBills,
  summarizeCardOpenBill,
  formatDueMonthTitle,
  formatDueMonthShort,
  isBillPayment,
  signedTxAmount,
  txBillingAmount,
  installmentNumberOf,
  installmentTotalOf,
  resolvePurchaseDate,
} from '../utils/creditBillPeriod';
import { attrSelector, bindSnapSelect, centerChild } from '../utils/snapCarousel';

function purchaseTimestamp(tx) {
  const timestamp = new Date(resolvePurchaseDate(tx)).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function CreditCards() {
  const { accounts, loadAccounts, setCardFace, pending, loading: accountsLoading, lastUpdated: accountsUpdatedAt } = useAccountStore();
  const { receivables, loadReceivables, addReceivable } = useReceivableStore();
  const {
    loadForAccounts,
    loading: creditLoading,
    lastUpdatedByAccount,
    transactionsByAccount,
    billsByAccount,
    updateTransactionCategory,
  } = useCreditDataStore();
  const { addManualTransaction } = useTransactionStore();
  const { loadCategories, categories: purchaseCategories } = useCategoryStore();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [purchaseAccount, setPurchaseAccount] = useState(null);
  const [savingPurchase, setSavingPurchase] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [prefilledReceivableTx, setPrefilledReceivableTx] = useState(null);
  const [pluggyCategories, setPluggyCategories] = useState([]);

  // Multi-card selection state ('all' or specific card.id)
  const [selectedCardId, setSelectedCardId] = useState('all');
  const isMobile = useIsMobile();

  const timelineRef = useRef(null);
  const cardStripRef = useRef(null);
  const ignoreCardScrollRef = useRef(false);
  const ignoreBillScrollRef = useRef(false);
  const selectedCardIdRef = useRef(selectedCardId);
  selectedCardIdRef.current = selectedCardId;

  // ── Accounts & Receivables ──────────────────────────────────────────────────
  useEffect(() => {
    loadAccounts();
    loadReceivables();
    loadCategories();
    fetchCategories({ force: true }).then((list) => setPluggyCategories(Array.isArray(list) ? list : [])).catch(() => setPluggyCategories([]));
  }, []);

  const creditCards = useMemo(() => accounts.filter(a => a.type === 'CREDIT'), [accounts]);
  const activeCard = selectedCardId === 'all'
    ? null
    : (creditCards.find(c => c.id === selectedCardId) || creditCards[0] || null);

  const cardIdsForLoad = useMemo(() => {
    if (selectedCardId === 'all') return creditCards.map((c) => c.id);
    return activeCard?.id ? [activeCard.id] : [];
  }, [selectedCardId, creditCards, activeCard?.id]);

  // ── Load card data (shared 1h cache) ───────────────────────────────────────
  useEffect(() => {
    if (accountsLoading) return;
    if (cardIdsForLoad.length === 0) return;
    loadForAccounts(cardIdsForLoad);
  }, [cardIdsForLoad.join(','), accountsLoading, loadForAccounts]);

  const cardTransactions = useMemo(() => {
    const txs = [];
    for (const id of cardIdsForLoad) txs.push(...(transactionsByAccount[id] || []));
    return txs;
  }, [cardIdsForLoad, transactionsByAccount]);

  const officialBills = useMemo(() => {
    const bills = [];
    for (const id of cardIdsForLoad) bills.push(...(billsByAccount[id] || []));
    return bills;
  }, [cardIdsForLoad, billsByAccount]);

  const hasCachedCardData =
    cardIdsForLoad.length === 0 ||
    cardIdsForLoad.every((id) => lastUpdatedByAccount[id]);
  const loadingData = cardIdsForLoad.length > 0 && !hasCachedCardData && creditLoading;
  const isPageLoading =
    accountsLoading ||
    accountsUpdatedAt == null ||
    loadingData;

  // ── Card metrics (Consolidated vs Individual) ──────────────────────────────
  const totalDebtAllCards = creditCards.reduce((acc, c) => acc + Math.abs(c.balance || 0), 0);
  const totalLimitAllCards = creditCards.reduce((acc, c) => acc + (c.creditData?.creditLimit || 0), 0);
  const availableLimitAllCards = creditCards.reduce((acc, c) => acc + (c.creditData?.availableCreditLimit ?? (c.creditData?.creditLimit ? c.creditData.creditLimit - Math.abs(c.balance || 0) : 0)), 0);

  const displayCard = activeCard || creditCards[0];
  const creditData = displayCard?.creditData || {};
  const totalDebt = activeCard ? Math.abs(activeCard.balance || 0) : totalDebtAllCards;
  const creditLimit = activeCard ? (creditData.creditLimit || 0) : (totalLimitAllCards || 0);
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

  // Open-bill total per card (same signed-net logic as FATURA EM ABERTO) — not account.balance
  const openTotalByCardId = useMemo(() => {
    const map = {};
    for (const card of creditCards) {
      const txs = transactionsByAccount[card.id] || [];
      const bills = billsByAccount[card.id] || [];
      if (!txs.length && !bills.length) {
        map[card.id] = null;
        continue;
      }
      const summary = summarizeCardOpenBill(card, txs, bills);
      map[card.id] = summary.openTotal;
    }
    return map;
  }, [creditCards, transactionsByAccount, billsByAccount]);

  /** Chip list: highest open bill first (fallback to outstanding balance). */
  const creditCardsByOpenBill = useMemo(() => {
    const billAmount = (card) => {
      const open = openTotalByCardId[card.id];
      if (open != null) return Number(open) || 0;
      return Math.abs(Number(card.balance) || 0);
    };
    return [...creditCards].sort((a, b) => {
      const byBill = billAmount(b) - billAmount(a);
      if (byBill !== 0) return byBill;
      return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR');
    });
  }, [creditCards, openTotalByCardId]);

  const [selectedBillKey, setSelectedBillKey] = useState(null);
  const prevCardIdRef = useRef(selectedCardId);

  // Switching cards must always land on that card's open bill (not the previous
  // card's selection, which often matches a future/last due-month key).
  useEffect(() => {
    if (prevCardIdRef.current === selectedCardId) return;
    prevCardIdRef.current = selectedCardId;
    ignoreBillScrollRef.current = true;
    setSelectedBillKey(currentOpenKey || null);
  }, [selectedCardId, currentOpenKey]);

  // When open key arrives after data load, or selection is not in this card's bills
  useEffect(() => {
    if (!currentOpenKey) return;
    if (selectedBillKey && sortedBillKeys.includes(selectedBillKey)) return;
    setSelectedBillKey(currentOpenKey);
  }, [currentOpenKey, selectedBillKey, sortedBillKeys]);

  const activeSelectedKey = selectedBillKey || currentOpenKey;
  const activeSelectedKeyRef = useRef(activeSelectedKey);
  activeSelectedKeyRef.current = activeSelectedKey;

  const selectBill = (key) => {
    if (!key || key === activeSelectedKeyRef.current) return;
    setSelectedBillKey(key);
    setSearch('');
    setSelectedCategory('all');
  };

  // Re-center whenever the card or selected bill changes (same open month across
  // cards used to skip this and leave the strip on the last chip).
  useEffect(() => {
    if (!activeSelectedKey || loadingData || !timelineRef.current) {
      if (!loadingData) ignoreBillScrollRef.current = false;
      return undefined;
    }
    ignoreBillScrollRef.current = true;
    let releaseTimer;
    const timer = setTimeout(() => {
      const container = timelineRef.current;
      const selectedEl = container?.querySelector(attrSelector('data-bill-key', activeSelectedKey));
      if (!selectedEl) {
        releaseTimer = window.setTimeout(() => { ignoreBillScrollRef.current = false; }, 80);
        return;
      }
      // Instant jump so snap-select cannot pick a neighbor mid-smooth-scroll
      const moved = centerChild(container, selectedEl, 'auto');
      releaseTimer = window.setTimeout(() => { ignoreBillScrollRef.current = false; }, moved ? 120 : 50);
    }, 50);
    return () => {
      clearTimeout(timer);
      clearTimeout(releaseTimer);
    };
  }, [activeSelectedKey, loadingData, selectedCardId, sortedBillKeys.length]);

  useEffect(() => {
    if (!isMobile || isPageLoading || !cardStripRef.current) return undefined;
    let releaseTimer;
    const timer = setTimeout(() => {
      const container = cardStripRef.current;
      const selectedEl = container?.querySelector(attrSelector('data-card-id', selectedCardId));
      if (!selectedEl) return;
      ignoreCardScrollRef.current = true;
      const moved = centerChild(container, selectedEl);
      releaseTimer = window.setTimeout(() => { ignoreCardScrollRef.current = false; }, moved ? 500 : 80);
    }, 80);
    return () => {
      clearTimeout(timer);
      clearTimeout(releaseTimer);
      ignoreCardScrollRef.current = false;
    };
  }, [selectedCardId, isMobile, isPageLoading]);

  useEffect(() => {
    if (!isMobile) return undefined;
    const unbindCard = bindSnapSelect(cardStripRef.current, {
      attr: 'data-card-id',
      ignoreRef: ignoreCardScrollRef,
      onSelect: (id) => {
        if (id === selectedCardIdRef.current) return;
        setSelectedCardId(id);
      },
    });
    const unbindBill = bindSnapSelect(timelineRef.current, {
      attr: 'data-bill-key',
      ignoreRef: ignoreBillScrollRef,
      onSelect: (id) => selectBill(id),
    });
    return () => {
      unbindCard();
      unbindBill();
    };
  }, [isMobile, isPageLoading, creditCards.length, sortedBillKeys.length]);

  // Navigation
  const activeIndex = sortedBillKeys.indexOf(activeSelectedKey);
  const handlePrev = () => {
    if (activeIndex > 0) selectBill(sortedBillKeys[activeIndex - 1]);
  };
  const handleNext = () => {
    if (activeIndex >= 0 && activeIndex < sortedBillKeys.length - 1) selectBill(sortedBillKeys[activeIndex + 1]);
  };
  const handleGoToCurrent = () => { selectBill(currentOpenKey); };

  // KPIs
  const currentOpenBill = billsData[currentOpenKey];
  const currentOpenTotal = currentOpenBill?.total || 0;

  const lastPaidKey = [...sortedBillKeys]
    .reverse()
    .find((k) => {
      const b = billsData[k];
      return b?.isPaid && b?.type === 'PAST' && (b.hasOfficial || (Number(b.total) || 0) > 0.05);
    });
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

  // Category breakdown for selected bill (signed so credits reduce the category slice)
  const selectedBillCategories = useMemo(() => {
    const map = {};
    (currentSelectedBill.items || []).forEach(t => {
      if (isBillPayment(t)) return;
      const label = translateCategory(t.category);
      map[label] = (map[label] || 0) + signedTxAmount(t);
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value: Math.abs(value) }))
      .filter((c) => c.value > 0.005)
      .sort((a, b) => b.value - a.value);
  }, [currentSelectedBill]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return (currentSelectedBill.items || [])
      .filter(t => {
        if (search) {
          const q = search.toLowerCase();
          if (!t.description?.toLowerCase().includes(q) &&
              !t.merchant?.businessName?.toLowerCase().includes(q)) return false;
        }
        if (selectedCategory !== 'all' && translateCategory(t.category) !== selectedCategory) return false;
        return true;
      })
      .sort((a, b) => {
        const byPurchaseDate = purchaseTimestamp(b) - purchaseTimestamp(a);
        if (byPurchaseDate !== 0) return byPurchaseDate;
        return String(a.id || '').localeCompare(String(b.id || ''));
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

  const handlePurchaseSave = async (payload) => {
    setSavingPurchase(true);
    try {
      await addManualTransaction(payload);
      if (payload.accountId) {
        await loadForAccounts([payload.accountId], { force: true });
      }
      setPurchaseAccount(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingPurchase(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 'var(--space-4)' : 'var(--space-6)' }}>

      {/* Page Header */}
      <div>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>
          {isPageLoading
            ? 'Cartões de Crédito'
            : selectedCardId === 'all'
              ? 'Cartões de Crédito (Visão Consolidada)'
              : (activeCard?.name || 'Cartão de Crédito')}
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
          {isPageLoading
            ? 'Carregando faturas e limites…'
            : selectedCardId === 'all'
              ? `Soma consolidada de ${creditCards.length} cartões`
              : `${activeCard?.name || 'Cartão'}${activeCard?.isManual ? ' · Manual' : ''} • Final ${activeCard?.number || '****'} • Titular: ${activeCard?.owner || '—'}`
          }
        </p>
      </div>

      {isPageLoading ? (
        <>
          <div style={{ display: 'flex', gap: '0.85rem', overflow: 'hidden' }}>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} width={188} height={118} borderRadius="12px" />
            ))}
          </div>
          <PageLoadingSkeleton
            kpiCount={4}
            showTimeline
            showChart
            showList
            label="Carregando faturas dos cartões"
          />
        </>
      ) : (
      <>

      {/* Credit Card Selector */}
      {creditCards.length > 0 && (
        <div className="credit-card-carousel">
          <div ref={cardStripRef} className="chip-scroll credit-card-strip">
            <div className="credit-card-slide" data-card-id="all">
              <div
                className="credit-card-all-chip"
                role="button"
                tabIndex={0}
                onClick={() => setSelectedCardId('all')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedCardId('all');
                  }
                }}
                style={{
                  border: selectedCardId === 'all' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                  backgroundColor: selectedCardId === 'all' ? 'var(--primary-light)' : 'var(--bg-tertiary)',
                }}
              >
                <CreditCardIcon size={20} style={{ color: selectedCardId === 'all' ? 'var(--primary)' : 'var(--text-muted)' }} />
                <div>
                  <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, display: 'block', color: selectedCardId === 'all' ? 'var(--primary)' : 'var(--text-primary)' }}>
                    Todos os Cartões
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {creditCards.length} cartões • {formatCurrency(totalDebtAllCards)}
                  </span>
                </div>
              </div>
            </div>

            {creditCardsByOpenBill.map(card => {
              const isSelected = selectedCardId === card.id;
              const openBill = openTotalByCardId[card.id];
              const debtLabel = openBill != null ? openBill : Math.abs(card.balance || 0);
              return (
                <div className="credit-card-slide" data-card-id={card.id} key={card.id}>
                  <CreditCardFace
                    account={card}
                    lastFour={card.number || '****'}
                    amountLabel={formatCurrency(debtLabel)}
                    selected={isSelected}
                    uploading={Boolean(pending[card.id])}
                    onClick={() => setSelectedCardId(card.id)}
                    onUpload={(file) => setCardFace(card.id, file)}
                  />
                </div>
              );
            })}
          </div>
          {isMobile && (
            <div className="credit-card-dots" role="tablist" aria-label="Cartões">
              <button
                type="button"
                className={selectedCardId === 'all' ? 'is-active' : ''}
                aria-label="Todos os cartões"
                onClick={() => setSelectedCardId('all')}
              />
              {creditCardsByOpenBill.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  className={selectedCardId === card.id ? 'is-active' : ''}
                  aria-label={card.name || 'Cartão'}
                  onClick={() => setSelectedCardId(card.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── KPI Row ── */}
      {isMobile ? (
        <div className="credit-kpi-compact">
          <div className="credit-kpi-cell credit-kpi-cell--open">
            <span className="credit-kpi-label">Fatura em aberto</span>
            <span className="credit-kpi-value">{formatCurrency(currentOpenTotal)}</span>
            <span className="credit-kpi-meta">
              Vence {formatDueMonthShort(currentOpenKey, currentOpenBill?.dueDate)}
            </span>
          </div>
          <div className="credit-kpi-cell credit-kpi-cell--paid">
            <span className="credit-kpi-label">Última paga</span>
            <span className="credit-kpi-value">{formatCurrency(lastPaidBill?.total || 0)}</span>
            <span className="credit-kpi-meta">
              {lastPaidBill ? formatDueMonthTitle(lastPaidKey) : '—'}
            </span>
          </div>
          <div className="credit-kpi-cell credit-kpi-cell--debt">
            <span className="credit-kpi-label">Saldo devedor</span>
            <span className="credit-kpi-value">{formatCurrency(totalDebt)}</span>
            <span className="credit-kpi-meta">
              {selectedCardId === 'all' ? 'Soma consolidada' : 'Neste cartão'}
            </span>
          </div>
          <div className="credit-kpi-cell credit-kpi-cell--limit">
            <span className="credit-kpi-label">Limite disponível</span>
            <span className="credit-kpi-value">{formatCurrency(availableLimit)}</span>
            <span className="credit-kpi-meta">{100 - pctUsed}% livre</span>
          </div>
        </div>
      ) : (
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
      )}

      {/* ── Bill Selector ── */}
      <Card
        className="credit-bill-selector"
        title={isMobile ? undefined : 'Seletor de Faturas'}
        subtitle={isMobile ? undefined : (selectedCardId === 'all' ? "Valores consolidados (soma) de todas as faturas históricas, fatura aberta e projeções" : "Faturas históricas (oficiais), fatura em aberto e projeções de parcelas futuras")}
        action={isMobile ? undefined : (
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
        )}
      >
        {isMobile && activeSelectedKey && currentOpenKey && activeSelectedKey !== currentOpenKey && (
          <div className="credit-bill-current">
            <Button size="sm" variant="secondary" onClick={handleGoToCurrent}>
              Fatura atual
            </Button>
          </div>
        )}
        <div
          ref={timelineRef}
          className="chip-scroll credit-bill-strip"
        >
          {sortedBillKeys.map(k => {
            const bill = billsData[k];
            const isSelected = k === activeSelectedKey;
            const badge = billBadge(bill);
            const displayAmount = bill?.total || 0;

            const title = formatDueMonthTitle(k);
            const dueStr = formatDueMonthShort(k, bill?.dueDate);

            const typeClass =
              bill?.type === 'CURRENT_OPEN' ? 'is-open' :
              bill?.type === 'FUTURE' ? 'is-future' :
              bill?.isPaid ? 'is-paid' : '';

            return (
              <div
                key={k}
                role="button"
                tabIndex={0}
                data-bill-key={k}
                className={`credit-bill-chip ${typeClass} ${isSelected ? 'is-selected' : ''}`.trim()}
                onClick={() => selectBill(k)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    selectBill(k);
                  }
                }}
              >
                <div className="credit-bill-chip__title">{title}</div>
                <Badge variant={badge.variant}>{badge.text}</Badge>
                <div className="credit-bill-chip__body">
                  <span className="credit-bill-chip__amount-label">VALOR CONSOLIDADO</span>
                  <h4 className="credit-bill-chip__amount">
                    {formatCurrency(displayAmount)}
                  </h4>
                  <span className="credit-bill-chip__meta">
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
          action={
            activeCard?.isManual ? (
              <Button
                size="sm"
                icon={Plus}
                onClick={() => setPurchaseAccount(activeCard)}
              >
                Adicionar compra
              </Button>
            ) : null
          }
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

          <div className="filter-bar" style={{ marginBottom: '1rem' }}>
            <div className="filter-bar__search" style={{ padding: '0.4rem 0.75rem' }}>
              <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
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
            <SkeletonList rows={6} />
          ) : filteredTransactions.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>
              Nenhuma compra para o filtro selecionado.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 520, overflowY: 'auto' }}>
              {filteredTransactions.map((tx, idx) => {
                const isPayment = isBillPayment(tx);
                const isCredit = isPayment || tx.type === 'CREDIT' || signedTxAmount(tx) < 0;
                const cardObj = creditCards.find(c => c.id === tx.accountId);
                const installmentNum = installmentNumberOf(tx);
                const installmentTotal = installmentTotalOf(tx);
                const hasInstallments = Number(installmentTotal) > 1 && Number(installmentNum) > 0;
                const purchaseDate = resolvePurchaseDate(tx);
                const billingAmt = Math.abs(txBillingAmount(tx));
                const foreignUsd =
                  String(tx.currencyCode || '').toUpperCase() === 'USD' &&
                  tx.amountInAccountCurrency != null &&
                  Math.abs(Number(tx.amount) || 0) !== billingAmt;
                return (
                  <div
                    key={tx.id || idx}
                    {...rowActivateProps(() => {
                      const linked = receivables.find((r) => r.linkedTransactionId === tx.id);
                      setSelectedItem(fromCreditPurchase(tx, {
                        accountName: cardObj?.name,
                        canCreateReceivable: !linked && !isPayment && !isCredit,
                      }));
                    })}
                    style={{ padding: '0.75rem 0.85rem' }}
                  >
                    <div className="list-row-main" style={{ gap: '0.75rem' }}>
                      <CategoryIcon
                        category={isPayment ? null : tx.category}
                        categories={purchaseCategories}
                        isPayment={isPayment}
                        isCredit={isCredit && !isPayment}
                        title={isPayment ? null : tx.description}
                        merchant={isPayment ? null : tx.merchant}
                        emptyFallback="receipt"
                        size={36}
                      />
                      <div style={{ minWidth: 0 }}>
                        <h4 style={{
                          fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                        }}>
                          {tx.description}
                        </h4>
                        <div className="list-row-meta" style={{ gap: '0.4rem' }}>
                          {selectedCardId === 'all' && cardObj && (
                            <Badge variant="neutral" style={{ fontWeight: 600, fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <AccountIcon account={cardObj} size={12} /> {cardObj.name}
                            </Badge>
                          )}
                          <Badge variant={isPayment ? 'success' : 'neutral'}>
                            {translateCategory(tx.category)}
                          </Badge>
                          {hasInstallments && (
                            <Badge variant="info">
                              Parcela {installmentNum}/{installmentTotal}
                            </Badge>
                          )}
                          {foreignUsd && (
                            <Badge variant="neutral" style={{ fontSize: '10px' }}>
                              US$ {Math.abs(Number(tx.amount) || 0).toFixed(2).replace('.', ',')}
                            </Badge>
                          )}
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
                            {formatDate(purchaseDate)}
                          </span>
                          {tx.merchant?.businessName && (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {tx.merchant.businessName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="list-row-amount">
                      <span style={{
                        fontWeight: 700, fontSize: 'var(--font-size-sm)',
                        color: isCredit ? 'var(--success)' : 'var(--danger)'
                      }}>
                        {isCredit ? '+ ' : '- '}{formatCurrency(billingAmt)}
                      </span>
                      <p style={{ fontSize: '10px', marginTop: '2px', marginBottom: 0, color: tx.isProjected ? 'var(--info)' : tx.status === 'POSTED' ? 'var(--success)' : 'var(--warning)' }}>
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
      </>
      )}
      {purchaseAccount && (
        <PurchaseModal
          account={purchaseAccount}
          onClose={() => { if (!savingPurchase) setPurchaseAccount(null); }}
          onSave={handlePurchaseSave}
          saving={savingPurchase}
        />
      )}
      {selectedItem && (
        <ItemDetailSheet
          item={selectedItem}
          categoryOptions={categoryOptionsForItem(selectedItem, pluggyCategories)}
          onClose={() => setSelectedItem(null)}
          onCreateReceivable={() => {
            setPrefilledReceivableTx(selectedItem.raw);
            setSelectedItem(null);
          }}
          onChangeCategory={async (option) => {
            const updated = await patchTransactionCategory(selectedItem.sourceId, option.value);
            updateTransactionCategory(
              selectedItem.sourceId,
              option.value,
              updated?.category || option.label
            );
            setSelectedItem(applyingCategory(selectedItem, option));
          }}
        />
      )}
      {prefilledReceivableTx && (
        <ReceivableModal
          onClose={() => setPrefilledReceivableTx(null)}
          onSave={async (data) => {
            await addReceivable(data);
            setPrefilledReceivableTx(null);
          }}
          creditTransactions={[prefilledReceivableTx]}
          prefilledTransaction={prefilledReceivableTx}
        />
      )}
    </div>
  );
}
