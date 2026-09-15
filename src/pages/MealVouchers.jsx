import React, { useEffect, useMemo, useState } from 'react';
import { UtensilsCrossed, Plus, Info, Trash2, Pencil, ShoppingBag } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ProgressBar } from '../components/ui/ProgressBar';
import { IconBusyButton, SavingScope } from '../components/ui/Spinner';
import { PageLoadingSkeleton } from '../components/ui/Skeleton';
import { useMealBenefitStore } from '../stores/mealBenefitStore';
import { formatCurrency, formatDate } from '../utils/formatters';
import {
  MEAL_KIND_LABELS,
  MEAL_CATEGORY_OPTIONS,
  defaultMealCategoryForKind,
  displayBenefitLabel,
  monthSnapshot,
  nextCreditDate,
  remainingAsOf,
  todayISO,
} from '../utils/mealBenefits';
import { isInitialEmpty } from '../utils/loading';

const emptyBenefitForm = () => ({
  kind: 'VA',
  label: '',
  monthlyAmount: '',
  creditDay: '1',
  startsOn: todayISO(),
  openingBalance: '',
  showInMoment: false,
});

const emptyPurchaseForm = (kind = 'VA') => ({
  description: '',
  amount: '',
  purchasedAt: todayISO(),
  category: defaultMealCategoryForKind(kind),
});

export function MealVouchers() {
  const {
    benefits,
    purchases,
    loadMealBenefits,
    addBenefit,
    updateBenefit,
    removeBenefit,
    addPurchase,
    removePurchase,
    pending,
    loading,
    lastUpdated,
  } = useMealBenefitStore();

  const [showBenefitModal, setShowBenefitModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [benefitForm, setBenefitForm] = useState(emptyBenefitForm);
  const [savingBenefit, setSavingBenefit] = useState(false);
  const [purchaseForId, setPurchaseForId] = useState(null);
  const [purchaseForm, setPurchaseForm] = useState(emptyPurchaseForm);
  const [savingPurchase, setSavingPurchase] = useState(false);

  useEffect(() => {
    loadMealBenefits();
  }, []);

  const todayYm = todayISO().slice(0, 7);

  const openCreate = () => {
    setEditingId(null);
    setBenefitForm(emptyBenefitForm());
    setShowBenefitModal(true);
  };

  const openEdit = (benefit) => {
    setEditingId(benefit.id);
    setBenefitForm({
      kind: benefit.kind,
      label: benefit.label || '',
      monthlyAmount: String(benefit.monthlyAmount || ''),
      creditDay: String(benefit.creditDay || 1),
      startsOn: benefit.startsOn || todayISO(),
      openingBalance: String(benefit.openingBalance || ''),
      showInMoment: Boolean(benefit.showInMoment),
    });
    setShowBenefitModal(true);
  };

  const handleSaveBenefit = async (e) => {
    e.preventDefault();
    if (!benefitForm.monthlyAmount || savingBenefit) return;
    setSavingBenefit(true);
    const payload = {
      kind: benefitForm.kind,
      label: benefitForm.label.trim(),
      monthlyAmount: parseFloat(benefitForm.monthlyAmount) || 0,
      creditDay: Math.min(31, Math.max(1, parseInt(benefitForm.creditDay, 10) || 1)),
      startsOn: benefitForm.startsOn || todayISO(),
      openingBalance: parseFloat(benefitForm.openingBalance) || 0,
      showInMoment: Boolean(benefitForm.showInMoment),
    };
    try {
      if (editingId) {
        await updateBenefit(editingId, payload);
      } else {
        await addBenefit(payload);
      }
      setShowBenefitModal(false);
      setEditingId(null);
      setBenefitForm(emptyBenefitForm());
    } catch (err) {
      console.error(err);
    } finally {
      setSavingBenefit(false);
    }
  };

  const handleSavePurchase = async (e) => {
    e.preventDefault();
    if (!purchaseForId || !purchaseForm.amount || savingPurchase) return;
    setSavingPurchase(true);
    try {
      await addPurchase({
        benefitId: purchaseForId,
        description: purchaseForm.description.trim(),
        amount: parseFloat(purchaseForm.amount) || 0,
        purchasedAt: purchaseForm.purchasedAt || todayISO(),
        category: purchaseForm.category || '',
      });
      setPurchaseForId(null);
      setPurchaseForm(emptyPurchaseForm());
    } catch (err) {
      console.error(err);
    } finally {
      setSavingPurchase(false);
    }
  };

  const cards = useMemo(
    () => benefits.map((benefit) => {
      const related = purchases.filter((p) => p.benefitId === benefit.id);
      const remaining = remainingAsOf(benefit, related);
      const snap = monthSnapshot(benefit, related, todayYm);
      const next = nextCreditDate(benefit);
      const pct = benefit.monthlyAmount > 0
        ? Math.min(100, Math.round((snap.monthSpent / benefit.monthlyAmount) * 100))
        : 0;
      const recent = [...related].sort((a, b) => (b.purchasedAt || '').localeCompare(a.purchasedAt || '')).slice(0, 8);
      return { benefit, remaining, snap, next, pct, recent, related };
    }),
    [benefits, purchases, todayYm]
  );

  if (isInitialEmpty(benefits, loading, lastUpdated) && purchases.length === 0) {
    return (
      <PageLoadingSkeleton
        kpiCount={2}
        showTimeline={false}
        showChart={false}
        showList
        label="Carregando VA/VR…"
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>Vale alimentação e refeição</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
            Programe o valor e o dia que cai, registre compras e acompanhe o saldo. Ative para ver no Momento Financeiro.
          </p>
        </div>
        <div className="page-header__actions">
          <Button icon={Plus} onClick={openCreate}>Novo benefício</Button>
        </div>
      </div>

      {cards.length === 0 ? (
        <Card>
          <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
            <Info size={36} />
            <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--text-primary)' }}>Nenhum VA ou VR cadastrado</h3>
            <p style={{ fontSize: 'var(--font-size-sm)', maxWidth: 480 }}>
              Cadastre o benefício da empresa (valor mensal e dia do crédito) e lance as compras para ir debitando o saldo.
            </p>
            <Button icon={Plus} onClick={openCreate}>Cadastrar VA/VR</Button>
          </div>
        </Card>
      ) : (
        <div className="dashboard-grid">
          {cards.map(({ benefit, remaining, snap, next, pct, recent }) => (
            <Card key={benefit.id} className="col-6">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.85rem', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--primary)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <UtensilsCrossed size={22} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, margin: 0 }}>
                      {displayBenefitLabel(benefit)}
                    </h3>
                    <div style={{ display: 'flex', gap: '0.35rem', marginTop: 4, flexWrap: 'wrap' }}>
                      <Badge variant="neutral">{MEAL_KIND_LABELS[benefit.kind]}</Badge>
                      {benefit.showInMoment && <Badge variant="success">No Momento</Badge>}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <IconBusyButton
                    onClick={() => openEdit(benefit)}
                    busy={Boolean(pending[benefit.id])}
                    title="Editar"
                  >
                    <Pencil size={16} />
                  </IconBusyButton>
                  <IconBusyButton
                    onClick={() => removeBenefit(benefit.id)}
                    busy={Boolean(pending[benefit.id])}
                    title="Excluir benefício"
                    style={{ color: 'var(--danger)' }}
                  >
                    <Trash2 size={16} />
                  </IconBusyButton>
                </div>
              </div>

              <div style={{ marginBottom: '0.85rem' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>SALDO ATUAL</span>
                <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, margin: '0.2rem 0' }}>
                  {formatCurrency(remaining)}
                </h2>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                  {formatCurrency(benefit.monthlyAmount)} no dia {benefit.creditDay}
                  {next ? ` · próximo crédito ${formatDate(next)}` : ''}
                </span>
              </div>

              <div style={{ marginBottom: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', marginBottom: 4 }}>
                  <span>Gasto neste mês</span>
                  <span>{formatCurrency(snap.monthSpent)} / {formatCurrency(benefit.monthlyAmount)}</span>
                </div>
                <ProgressBar percent={pct} height={8} />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: 'var(--font-size-sm)', marginBottom: '0.85rem' }}>
                <input
                  type="checkbox"
                  checked={Boolean(benefit.showInMoment)}
                  onChange={(e) => updateBenefit(benefit.id, { showInMoment: e.target.checked })}
                  disabled={Boolean(pending[benefit.id])}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                Mostrar no Momento Financeiro e na Conta conjunta
              </label>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>Compras</span>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={ShoppingBag}
                  onClick={() => {
                    setPurchaseForm(emptyPurchaseForm(benefit.kind));
                    setPurchaseForId(benefit.id);
                  }}
                >
                  Nova compra
                </Button>
              </div>

              {recent.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)', margin: 0 }}>
                  Nenhuma compra lançada ainda.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {recent.map((p) => (
                    <div
                      key={p.id}
                      className="list-row"
                      style={{
                        gap: '0.5rem',
                        padding: '0.5rem 0.65rem',
                        backgroundColor: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <div className="list-row-main" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                        <span style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>
                          {p.description || 'Compra'}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          {formatDate(p.purchasedAt)}
                          {p.category ? ` · ${p.category}` : ''}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)', color: 'var(--danger)' }}>
                          − {formatCurrency(p.amount)}
                        </span>
                        <IconBusyButton
                          onClick={() => removePurchase(p.id)}
                          busy={Boolean(pending[p.id])}
                          title="Excluir compra"
                          style={{ color: 'var(--danger)' }}
                        >
                          <Trash2 size={14} />
                        </IconBusyButton>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {showBenefitModal && (
        <div className="modal-overlay" onClick={() => { if (!savingBenefit) setShowBenefitModal(false); }}>
          <SavingScope active={savingBenefit}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, marginBottom: '1rem' }}>
                {editingId ? 'Editar benefício' : 'Novo benefício'}
              </h2>
              <form onSubmit={handleSaveBenefit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>Tipo</label>
                  <select
                    className="input"
                    value={benefitForm.kind}
                    onChange={(e) => setBenefitForm((f) => ({ ...f, kind: e.target.value }))}
                  >
                    <option value="VA">Vale Alimentação (VA)</option>
                    <option value="VR">Vale Refeição (VR)</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>Apelido (opcional)</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Ex: Alelo, Sodexo, Ticket"
                    value={benefitForm.label}
                    onChange={(e) => setBenefitForm((f) => ({ ...f, label: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>Valor que recebe (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input"
                    required
                    value={benefitForm.monthlyAmount}
                    onChange={(e) => setBenefitForm((f) => ({ ...f, monthlyAmount: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>Dia que cai</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    className="input"
                    required
                    value={benefitForm.creditDay}
                    onChange={(e) => setBenefitForm((f) => ({ ...f, creditDay: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>Começa em</label>
                  <input
                    type="date"
                    className="input"
                    value={benefitForm.startsOn}
                    onChange={(e) => setBenefitForm((f) => ({ ...f, startsOn: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>Saldo atual (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input"
                    placeholder="O que já tem no cartão agora"
                    value={benefitForm.openingBalance}
                    onChange={(e) => setBenefitForm((f) => ({ ...f, openingBalance: e.target.value }))}
                  />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: 'var(--font-size-sm)' }}>
                  <input
                    type="checkbox"
                    checked={benefitForm.showInMoment}
                    onChange={(e) => setBenefitForm((f) => ({ ...f, showInMoment: e.target.checked }))}
                    style={{ width: 16, height: 16 }}
                  />
                  Mostrar no Momento Financeiro e na Conta conjunta
                </label>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <Button variant="outline" type="button" onClick={() => setShowBenefitModal(false)} disabled={savingBenefit}>
                    Cancelar
                  </Button>
                  <Button type="submit" loading={savingBenefit}>Salvar</Button>
                </div>
              </form>
            </div>
          </SavingScope>
        </div>
      )}

      {purchaseForId && (
        <div className="modal-overlay" onClick={() => { if (!savingPurchase) setPurchaseForId(null); }}>
          <SavingScope active={savingPurchase}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, marginBottom: '1rem' }}>Nova compra</h2>
              <form onSubmit={handleSavePurchase} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>Descrição</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Ex: Mercado, almoço"
                    value={purchaseForm.description}
                    onChange={(e) => setPurchaseForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>Valor (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input"
                    required
                    value={purchaseForm.amount}
                    onChange={(e) => setPurchaseForm((f) => ({ ...f, amount: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>Data</label>
                  <input
                    type="date"
                    className="input"
                    required
                    value={purchaseForm.purchasedAt}
                    onChange={(e) => setPurchaseForm((f) => ({ ...f, purchasedAt: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>Categoria no orçamento</label>
                  <select
                    className="input"
                    value={purchaseForm.category}
                    onChange={(e) => setPurchaseForm((f) => ({ ...f, category: e.target.value }))}
                  >
                    {MEAL_CATEGORY_OPTIONS.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', margin: '0.35rem 0 0' }}>
                    VA cai em supermercado e VR em restaurantes, a menos que você escolha outra.
                  </p>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <Button variant="outline" type="button" onClick={() => setPurchaseForId(null)} disabled={savingPurchase}>
                    Cancelar
                  </Button>
                  <Button type="submit" loading={savingPurchase}>Lançar compra</Button>
                </div>
              </form>
            </div>
          </SavingScope>
        </div>
      )}
    </div>
  );
}

export default MealVouchers;
