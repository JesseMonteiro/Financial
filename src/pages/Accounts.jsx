import React, { useEffect, useRef, useState } from 'react';
import {
  Wallet,
  CreditCard,
  Plus,
  Edit2,
  Check,
  X,
  Clock,
  RefreshCw,
  Landmark,
  Trash2,
  FileUp,
  ShoppingBag,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { IconBusyButton, SavingScope } from '../components/ui/Spinner';
import { PageLoadingSkeleton } from '../components/ui/Skeleton';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { useAccountStore } from '../stores/accountStore';
import { useTransactionStore } from '../stores/transactionStore';
import { useCreditDataStore } from '../stores/creditDataStore';
import { formatCurrency, getDataSyncMeta } from '../utils/formatters';
import { isInitialEmpty } from '../utils/loading';
import { accountAvailableBalance, sumReservedBalances } from '../utils/reservedBalances';
import { summarizeCardOpenBill } from '../utils/creditBillPeriod';
import { Link } from 'react-router-dom';
import {
  clearApiCache,
  createConnectToken,
  syncPluggyConnections,
  waitForItemUpdate,
  parseCreditBillPdf,
} from '../services/api';
import { getCurrentUserId } from '../services/storage';
import { PurchaseModal, MANUAL_CATEGORY_OPTIONS } from './ManualExpenses';
import { AccountIcon } from '../components/AccountIcon';
import { IconPicker } from '../components/IconPicker';
import { decorateAccountWithIcon } from '../utils/accountIcons';

function SyncUpdatedBadge({ updatedAt }) {
  const sync = getDataSyncMeta(updatedAt);
  if (!sync) return null;
  return (
    <Badge variant={sync.variant} title={sync.title} style={{ whiteSpace: 'nowrap' }}>
      <Clock size={10} aria-hidden />
      {sync.label}
    </Badge>
  );
}

function ManualBadge() {
  return <Badge variant="info">Manual</Badge>;
}

function cardOpenBillAmount(acc, transactionsByAccount = {}, billsByAccount = {}) {
  if (acc?.isManual) return Math.abs(Number(acc.billAmount ?? acc.balance) || 0);
  const txs = transactionsByAccount[acc.id] || [];
  const bills = billsByAccount[acc.id] || [];
  if (txs.length || bills.length) {
    return Math.abs(Number(summarizeCardOpenBill(acc, txs, bills).openTotal) || 0);
  }
  if (acc.openBillTotal != null) return Math.abs(Number(acc.openBillTotal) || 0);
  return 0;
}

/** Open Pluggy Connect in update mode (MFA / invalid credentials). */
function openPluggyItemUpdate(itemId) {
  return new Promise(async (resolve, reject) => {
    try {
      const data = await createConnectToken(itemId);
      if (!data?.accessToken) {
        reject(new Error('Token de conexão Pluggy inválido.'));
        return;
      }
      if (!window.PluggyConnect) {
        reject(new Error('O SDK do Pluggy Connect não foi carregado. Recarregue a página.'));
        return;
      }

      const pluggyConnect = new window.PluggyConnect({
        connectToken: data.accessToken,
        updateItem: itemId,
        onSuccess: async () => {
          try {
            const item = await waitForItemUpdate(itemId);
            resolve(item);
          } catch (err) {
            resolve(null);
          }
        },
        onError: (error) => {
          reject(error instanceof Error ? error : new Error(error?.message || 'Falha no Pluggy Connect'));
        },
        onClose: () => {
          resolve(null);
        },
      });
      pluggyConnect.init();
    } catch (err) {
      reject(err);
    }
  });
}

function blankAddForm() {
  return {
    kind: 'both',
    institutionName: '',
    accountName: '',
    accountBalance: '',
    cardName: '',
    cardNumber: '',
    billAmount: '',
    billDueDay: '',
    creditLimit: '',
  };
}

function AddManualModal({ onClose, onSave, saving }) {
  const connectors = useAccountStore((s) => s.connectors);
  const [form, setForm] = useState(blankAddForm);
  const showAccount = form.kind === 'account' || form.kind === 'both';
  const showCard = form.kind === 'card' || form.kind === 'both';

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const previewCtx = { connectors: connectors || [] };
  const accountPreview = decorateAccountWithIcon({
    type: 'BANK',
    name: form.accountName.trim() || form.institutionName.trim() || 'Conta',
    institutionName: form.institutionName.trim(),
  }, previewCtx);
  const cardPreview = decorateAccountWithIcon({
    type: 'CREDIT',
    name: form.cardName.trim() || `${form.institutionName.trim()} Cartão`,
    institutionName: form.institutionName.trim(),
  }, previewCtx);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.institutionName.trim() || saving) return;
    onSave({
      kind: form.kind,
      institutionName: form.institutionName.trim(),
      accountName: form.accountName.trim() || form.institutionName.trim(),
      accountBalance: parseFloat(form.accountBalance) || 0,
      cardName: form.cardName.trim() || `${form.institutionName.trim()} Cartão`,
      cardNumber: form.cardNumber,
      billAmount: parseFloat(form.billAmount) || 0,
      billDueDay: form.billDueDay ? parseInt(form.billDueDay, 10) : null,
      creditLimit: form.creditLimit ? parseFloat(form.creditLimit) : 0,
    });
  };

  return (
    <div className="modal-overlay" onClick={() => { if (!saving) onClose(); }}>
      <SavingScope active={saving}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
          <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, marginBottom: '0.35rem' }}>
            Adicionar conta ou cartão manual
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: '1rem' }}>
            Use quando o banco não está no Open Finance. O item aparece junto dos demais, com a tag Manual.
          </p>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <SegmentedControl
              layoutId="manual-kind"
              value={form.kind}
              onChange={(kind) => setForm((prev) => ({ ...prev, kind }))}
              options={[
                { id: 'both', label: 'Conta + cartão' },
                { id: 'account', label: 'Conta' },
                { id: 'card', label: 'Cartão' },
              ]}
            />
            <div>
              <label className="label" style={{ display: 'block', marginBottom: '0.35rem', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Instituição</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <AccountIcon account={showCard && !showAccount ? cardPreview : accountPreview} size={32} />
                <input className="input" required value={form.institutionName} onChange={set('institutionName')} placeholder="Ex: Nubank, Inter, Caixa" style={{ width: '100%' }} />
              </div>
              {showAccount && showCard && form.institutionName.trim() && accountPreview.iconKey !== cardPreview.iconKey && (
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.45rem', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', alignItems: 'center' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <AccountIcon account={accountPreview} size={16} /> Conta
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <AccountIcon account={cardPreview} size={16} /> Cartão
                  </span>
                </div>
              )}
            </div>
            {showAccount && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="label" style={{ display: 'block', marginBottom: '0.35rem', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Nome da conta</label>
                  <input className="input" value={form.accountName} onChange={set('accountName')} placeholder="Conta corrente" style={{ width: '100%' }} />
                </div>
                <div>
                  <label className="label" style={{ display: 'block', marginBottom: '0.35rem', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Saldo (R$)</label>
                  <input className="input" type="number" step="0.01" value={form.accountBalance} onChange={set('accountBalance')} placeholder="0,00" style={{ width: '100%' }} />
                </div>
              </div>
            )}
            {showCard && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label className="label" style={{ display: 'block', marginBottom: '0.35rem', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Nome do cartão</label>
                    <input className="input" value={form.cardName} onChange={set('cardName')} placeholder="Cartão platinum" style={{ width: '100%' }} />
                  </div>
                  <div>
                    <label className="label" style={{ display: 'block', marginBottom: '0.35rem', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Final</label>
                    <input className="input" value={form.cardNumber} onChange={set('cardNumber')} placeholder="1234" maxLength={4} style={{ width: '100%' }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label className="label" style={{ display: 'block', marginBottom: '0.35rem', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Fatura atual (R$)</label>
                    <input className="input" type="number" step="0.01" value={form.billAmount} onChange={set('billAmount')} placeholder="0,00" style={{ width: '100%' }} />
                  </div>
                  <div>
                    <label className="label" style={{ display: 'block', marginBottom: '0.35rem', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Vencimento (dia)</label>
                    <input className="input" type="number" min="1" max="31" value={form.billDueDay} onChange={set('billDueDay')} placeholder="10" style={{ width: '100%' }} />
                  </div>
                  <div>
                    <label className="label" style={{ display: 'block', marginBottom: '0.35rem', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Limite (opcional)</label>
                    <input className="input" type="number" step="0.01" value={form.creditLimit} onChange={set('creditLimit')} placeholder="—" style={{ width: '100%' }} />
                  </div>
                </div>
              </>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
              <Button variant="outline" type="button" onClick={onClose} disabled={saving}>Cancelar</Button>
              <Button type="submit" loading={saving}>Salvar</Button>
            </div>
          </form>
        </div>
      </SavingScope>
    </div>
  );
}

function BillReviewModal({ account, parsed, onClose, onConfirm, saving }) {
  const [selected, setSelected] = useState(() => (parsed.purchases || []).map((_, i) => i));
  const purchases = parsed.purchases || [];
  const toggle = (i) => {
    setSelected((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));
  };
  const selectedPurchases = purchases.filter((_, i) => selected.includes(i));

  return (
    <div className="modal-overlay" onClick={() => { if (!saving) onClose(); }}>
      <SavingScope active={saving}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640, maxHeight: '85vh', overflow: 'auto' }}>
          <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, marginBottom: '0.35rem' }}>
            Revisar fatura extraída
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: '1rem' }}>
            {account.name} · Total {formatCurrency(parsed.totalAmount || 0)}
            {parsed.dueDate ? ` · Vence ${parsed.dueDate}` : ''}
          </p>
          {purchases.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>Nenhuma compra encontrada no PDF. O valor da fatura ainda pode ser atualizado.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem' }}>
              {purchases.map((p, i) => (
                <label
                  key={`${p.description}-${i}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    padding: '0.5rem 0.65rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    background: selected.includes(i) ? 'var(--bg-tertiary)' : 'transparent',
                    cursor: 'pointer',
                    fontSize: 'var(--font-size-sm)',
                  }}
                >
                  <input type="checkbox" checked={selected.includes(i)} onChange={() => toggle(i)} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <strong>{p.description || 'Compra'}</strong>
                    <span style={{ color: 'var(--text-muted)', marginLeft: '0.4rem' }}>
                      {p.date || ''}
                      {p.installment && p.totalInstallments ? ` · ${p.installment}/${p.totalInstallments}` : ''}
                    </span>
                  </span>
                  <span style={{ fontWeight: 700 }}>{formatCurrency(Math.abs(Number(p.amount) || 0))}</span>
                </label>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <Button variant="outline" type="button" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button type="button" loading={saving} onClick={() => onConfirm(selectedPurchases)}>
              Aplicar fatura e {selectedPurchases.length} compra(s)
            </Button>
          </div>
        </div>
      </SavingScope>
    </div>
  );
}

export function Accounts() {
  const {
    accounts,
    loadAccounts,
    renameAccount,
    addManualAccounts,
    updateManualAccount,
    deleteManualAccount,
    setAccountIcon,
    connectors,
    loading,
    pending,
    lastUpdated,
    error: accountsError,
  } = useAccountStore();
  const { addManualTransaction, replaceManualPurchasesForAccount } = useTransactionStore();
  const { loadForAccounts: loadCreditForAccounts, invalidateAccounts, transactionsByAccount, billsByAccount } = useCreditDataStore();
  const [editingId, setEditingId] = useState(null);
  const [tempName, setTempName] = useState('');
  const [editingMoneyId, setEditingMoneyId] = useState(null);
  const [tempMoney, setTempMoney] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);
  const [savingName, setSavingName] = useState(false);
  const [savingMoney, setSavingMoney] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [savingAdd, setSavingAdd] = useState(false);
  const [purchaseAccount, setPurchaseAccount] = useState(null);
  const [savingPurchase, setSavingPurchase] = useState(false);
  const [pdfAccount, setPdfAccount] = useState(null);
  const [parsedBill, setParsedBill] = useState(null);
  const [parsingPdf, setParsingPdf] = useState(false);
  const [savingBill, setSavingBill] = useState(false);
  const [iconAccount, setIconAccount] = useState(null);
  const [savingIcon, setSavingIcon] = useState(false);
  const pdfInputRef = useRef(null);
  const pdfTargetRef = useRef(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  const bankAccounts = accounts.filter((a) => a.type === 'BANK');
  const creditCards = accounts.filter((a) => a.type === 'CREDIT');

  useEffect(() => {
    const ids = creditCards.filter((c) => !c.isManual).map((c) => c.id);
    if (ids.length) loadCreditForAccounts(ids);
  }, [accounts]);

  const startEditing = (acc) => {
    setEditingId(acc.id);
    setTempName(acc.name || '');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setTempName('');
  };

  const saveName = async (id) => {
    if (savingName || pending[id]) return;
    setSavingName(true);
    try {
      await renameAccount(id, tempName);
      setEditingId(null);
      setTempName('');
    } catch (err) {
      console.error(err);
    } finally {
      setSavingName(false);
    }
  };

  const handleKeyDown = (e, id) => {
    if (e.key === 'Enter') {
      saveName(id);
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  };

  const startMoneyEdit = (acc) => {
    const value = acc.type === 'CREDIT' ? Math.abs(acc.billAmount ?? acc.balance ?? 0) : accountAvailableBalance(acc);
    setEditingMoneyId(acc.id);
    setTempMoney(String(value));
  };

  const saveMoney = async (acc) => {
    if (!acc?.isManual || savingMoney || pending[acc.id]) return;
    const num = parseFloat(tempMoney);
    if (Number.isNaN(num) || num < 0) return;
    setSavingMoney(true);
    try {
    if (acc.type === 'CREDIT') {
      await updateManualAccount(acc.id, { billAmount: num });
      await loadCreditForAccounts([acc.id], { force: true });
    } else {
      await updateManualAccount(acc.id, { balance: num });
    }
      setEditingMoneyId(null);
      setTempMoney('');
    } catch (err) {
      console.error(err);
    } finally {
      setSavingMoney(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg({ type: 'info', text: 'Solicitando sincronização nos bancos via Pluggy…' });

    try {
      const outcome = await syncPluggyConnections();

      if (!outcome.results?.length) {
        setSyncMsg({ type: 'error', text: outcome.message || 'Nenhuma conexão para sincronizar.' });
        return;
      }

      const needingAction = outcome.results.filter((r) => r.needsUserAction);
      for (const row of needingAction) {
        setSyncMsg({
          type: 'info',
          text: `Autenticação necessária${row.connectorName ? ` (${row.connectorName})` : ''}. Abrindo Pluggy Connect…`,
        });
        try {
          await openPluggyItemUpdate(row.itemId);
        } catch (err) {
          console.warn('[Accounts] Pluggy Connect update failed:', err);
        }
      }

      clearApiCache();
      await loadAccounts({ force: true });

      const failed = outcome.results.filter((r) => !r.ok && !r.needsUserAction);
      const rateLimited = failed.find((r) => String(r.code || '').includes('BEFORE_ALLOWED_FREQUENCY'));

      if (rateLimited) {
        setSyncMsg({
          type: 'error',
          text: rateLimited.error || 'Pluggy limita atualizações manuais por API. Tente novamente mais tarde ou use o widget.',
        });
      } else if (failed.length > 0 && outcome.okCount === 0 && needingAction.length === 0) {
        setSyncMsg({
          type: 'error',
          text: failed[0]?.error || outcome.message || 'Falha ao sincronizar.',
        });
      } else {
        setSyncMsg({
          type: 'success',
          text: `${outcome.message || 'Sincronização concluída.'} Contas manuais não são alteradas.`,
        });
      }
    } catch (err) {
      setSyncMsg({
        type: 'error',
        text: err.message || 'Falha ao sincronizar com os bancos.',
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleAddManual = async (payload) => {
    setSavingAdd(true);
    try {
      await addManualAccounts(payload);
      setShowAdd(false);
    } catch (err) {
      console.error(err);
      setSyncMsg({ type: 'error', text: err.message || 'Não foi possível salvar a conta manual.' });
    } finally {
      setSavingAdd(false);
    }
  };

  const handleDelete = async (acc) => {
    if (!acc?.isManual) return;
    const pairMate = acc.pairId
      ? accounts.find((a) => a.isManual && a.pairId === acc.pairId && a.id !== acc.id)
      : null;
    let deletePair = false;
    if (pairMate) {
      const both = window.confirm(
        'Este item faz par com outro (conta + cartão). Excluir os dois?\n\nAs compras manuais dessas contas também serão apagadas.'
      );
      if (both) {
        deletePair = true;
      } else if (!window.confirm(`Excluir só ${acc.name}?\n\nAs compras manuais desta conta serão apagadas.`)) {
        return;
      }
    } else if (!window.confirm(`Excluir ${acc.name}?\n\nAs compras manuais desta conta serão apagadas.`)) {
      return;
    }
    const ids = [acc.id];
    if (deletePair && pairMate) ids.push(pairMate.id);
    try {
      await deleteManualAccount(acc.id, { deletePair });
      invalidateAccounts(ids);
    } catch (err) {
      console.error(err);
      setSyncMsg({ type: 'error', text: err.message || 'Não foi possível excluir a conta.' });
    }
  };

  const handlePurchaseSave = async (payload) => {
    setSavingPurchase(true);
    try {
      await addManualTransaction(payload);
      if (payload.accountId && payload.accountId !== 'manual') {
        await loadCreditForAccounts([payload.accountId], { force: true });
      }
      setPurchaseAccount(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingPurchase(false);
    }
  };

  const openPdfPicker = (acc) => {
    pdfTargetRef.current = acc;
    setPdfAccount(acc);
    pdfInputRef.current?.click();
  };

  const handlePdfFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const acc = pdfTargetRef.current;
    if (!file || !acc) return;
    if (file.type && file.type !== 'application/pdf') {
      setSyncMsg({ type: 'error', text: 'Envie um arquivo PDF da fatura.' });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setSyncMsg({ type: 'error', text: 'PDF muito grande (limite 8 MB).' });
      return;
    }
    setParsingPdf(true);
    setSyncMsg({ type: 'info', text: 'Lendo a fatura com IA…' });
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      const base64 = btoa(binary);
      const parsed = await parseCreditBillPdf({ base64, mimeType: 'application/pdf' });
      setParsedBill(parsed);
      setPdfAccount(acc);
      setSyncMsg(null);
    } catch (err) {
      console.error(err);
      setSyncMsg({ type: 'error', text: err.response?.data?.error || err.message || 'Falha ao ler o PDF.' });
      setPdfAccount(null);
    } finally {
      setParsingPdf(false);
    }
  };

  const applyParsedBill = async (purchases) => {
    const acc = pdfAccount;
    if (!acc) return;
    setSavingBill(true);
    try {
      const dueDate = parsedBill?.dueDate || null;
      const closingDate = parsedBill?.closingDate || null;
      const total = Number(parsedBill?.totalAmount);
      const patch = {};
      if (Number.isFinite(total)) patch.billAmount = total;
      if (dueDate) {
        const day = parseInt(String(dueDate).slice(8, 10), 10);
        if (day >= 1 && day <= 31) patch.billDueDay = day;
      }
      const userId = await getCurrentUserId();
      const newTxs = (purchases || []).map((p) => {
        const dateStr = p.date ? `${String(p.date).slice(0, 10)}T12:00:00.000Z` : new Date().toISOString();
        const installment = p.installment ? Number(p.installment) : null;
        const totalInstallments = p.totalInstallments ? Number(p.totalInstallments) : null;
        const cat = MANUAL_CATEGORY_OPTIONS.some((o) => o.value === p.category) ? p.category : 'Other';
        return {
          id: crypto.randomUUID(),
          description: p.description || 'Compra',
          originalDescription: p.description || 'Compra',
          amount: -Math.abs(parseFloat(p.amount) || 0),
          category: cat,
          date: dateStr,
          type: 'DEBIT',
          status: 'POSTED',
          accountId: acc.id,
          isManual: true,
          isRecurring: false,
          isContinuous: false,
          parentId: null,
          isPaid: false,
          paidAt: null,
          merchant: {
            name: 'Fatura PDF',
            installmentNumber: installment || undefined,
            totalInstallments: totalInstallments || undefined,
          },
          userId,
          creditCardMetadata:
            installment && totalInstallments
              ? { installmentNumber: installment, totalInstallments }
              : undefined,
        };
      });
      await replaceManualPurchasesForAccount(acc.id, newTxs, { dueDate, closingDate });
      if (Object.keys(patch).length) await updateManualAccount(acc.id, patch);
      await loadCreditForAccounts([acc.id], { force: true });
      setParsedBill(null);
      setPdfAccount(null);
      setSyncMsg({ type: 'success', text: 'Fatura e compras atualizadas a partir do PDF.' });
    } catch (err) {
      console.error(err);
      setSyncMsg({ type: 'error', text: err.message || 'Não foi possível aplicar a fatura.' });
    } finally {
      setSavingBill(false);
    }
  };

  const statusMsg = syncMsg || (accountsError ? { type: 'error', text: accountsError } : null);

  if (isInitialEmpty(accounts, loading, lastUpdated)) {
    return (
      <PageLoadingSkeleton
        kpiCount={0}
        showList
        label="Carregando contas…"
      />
    );
  }

  const renderNameEditor = (acc) => {
    const isEditing = editingId === acc.id;
    if (isEditing) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <input
            type="text"
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, acc.id)}
            className="input"
            autoFocus
            style={{ padding: '0.25rem 0.5rem', fontSize: 'var(--font-size-sm)', width: '100%', minWidth: '100px' }}
          />
          <IconBusyButton
            busy={savingName || Boolean(pending[acc.id])}
            onClick={() => saveName(acc.id)}
            title="Salvar nome"
            style={{ color: 'var(--success)', padding: '0.15rem' }}
          >
            <Check size={16} />
          </IconBusyButton>
          <button onClick={cancelEditing} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.15rem' }}>
            <X size={16} />
          </button>
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
        <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, margin: 0 }}>{acc.name}</h3>
        <button onClick={() => startEditing(acc)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', display: 'inline-flex', padding: 0 }} title="Editar nome">
          <Edit2 size={12} />
        </button>
      </div>
    );
  };

  const renderMoney = (acc, label, color) => {
    const isEditing = editingMoneyId === acc.id;
    const value = acc.type === 'CREDIT'
      ? cardOpenBillAmount(acc, transactionsByAccount, billsByAccount)
      : accountAvailableBalance(acc);
    if (acc.isManual && isEditing) {
      return (
        <div>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{label}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.15rem' }}>
            <input
              type="number"
              step="0.01"
              min="0"
              autoFocus
              value={tempMoney}
              onChange={(e) => setTempMoney(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveMoney(acc);
                if (e.key === 'Escape') { setEditingMoneyId(null); setTempMoney(''); }
              }}
              className="input"
              style={{ width: 140, padding: '0.25rem 0.5rem', fontSize: 'var(--font-size-base)', fontWeight: 700 }}
            />
            <IconBusyButton
              busy={savingMoney || Boolean(pending[acc.id])}
              onClick={() => saveMoney(acc)}
              title="Salvar valor"
              style={{ color: 'var(--success)', padding: '0.15rem' }}
            >
              <Check size={16} />
            </IconBusyButton>
            <button
              onClick={() => { setEditingMoneyId(null); setTempMoney(''); }}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.15rem' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      );
    }
    return (
      <div>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{label}</span>
        <h4 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color, margin: '0.15rem 0 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {formatCurrency(value)}
          {acc.isManual && (
            <button
              onClick={() => startMoneyEdit(acc)}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', display: 'inline-flex', padding: 0 }}
              title={acc.type === 'CREDIT' ? 'Editar fatura' : 'Editar saldo'}
            >
              <Edit2 size={14} />
            </button>
          )}
        </h4>
      </div>
    );
  };

  const renderManualActions = (acc) => {
    if (!acc.isManual) return null;
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.85rem' }}>
        <Button size="sm" variant="outline" icon={ShoppingBag} onClick={() => setPurchaseAccount(acc)}>
          Compra
        </Button>
        {acc.type === 'CREDIT' && (
          <Button size="sm" variant="outline" icon={FileUp} loading={parsingPdf && pdfAccount?.id === acc.id} onClick={() => openPdfPicker(acc)}>
            PDF da fatura
          </Button>
        )}
        <Button size="sm" variant="outline" icon={Trash2} onClick={() => handleDelete(acc)}>
          Excluir
        </Button>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <input
        ref={pdfInputRef}
        type="file"
        accept="application/pdf"
        style={{ display: 'none' }}
        onChange={handlePdfFile}
      />
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>Contas & Saldos</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
            Contas e cartões do Open Finance e itens manuais que você cadastrar.
          </p>
        </div>
        <div className="page-header__actions">
          <Button
            variant="outline"
            icon={RefreshCw}
            disabled={syncing || loading}
            loading={syncing}
            onClick={handleSync}
          >
            {syncing ? 'Sincronizando…' : 'Sincronizar'}
          </Button>
          <Link to="/connect" style={{ textDecoration: 'none' }}>
            <Button variant="outline" icon={Landmark}>Conectar banco</Button>
          </Link>
          <Button icon={Plus} onClick={() => setShowAdd(true)}>Adicionar manual</Button>
        </div>
      </div>

      {statusMsg && (
        <div
          role="status"
          style={{
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor:
              statusMsg.type === 'success'
                ? 'var(--success-bg)'
                : statusMsg.type === 'error'
                  ? 'var(--danger-bg)'
                  : 'var(--bg-tertiary)',
            color:
              statusMsg.type === 'success'
                ? 'var(--success)'
                : statusMsg.type === 'error'
                  ? 'var(--danger)'
                  : 'var(--text-primary)',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 500,
          }}
        >
          {statusMsg.text}
        </div>
      )}

      <div>
        <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Wallet size={20} style={{ color: 'var(--primary)' }} /> Contas Bancárias ({bankAccounts.length})
        </h2>
        <div className="dashboard-grid">
          {bankAccounts.map((acc) => {
            const reservedTotal = sumReservedBalances(acc);
            const ownerHint = acc.ownerLabel || acc.owner || null;
            return (
              <Card key={acc.id} className="col-4">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                    <AccountIcon
                      account={acc}
                      size={40}
                      onClick={() => setIconAccount(acc)}
                      title="Alterar ícone"
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {renderNameEditor(acc)}
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                        {acc.bankData?.institutionName || acc.marketingName || 'Banco'}
                        {acc.number ? ` • ${acc.number}` : ''}
                      </span>
                      {ownerHint && (
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                          Titular: {ownerHint}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem', flexShrink: 0 }}>
                    {acc.isManual ? <ManualBadge /> : <Badge variant="success">Ativa</Badge>}
                    {!acc.isManual && <SyncUpdatedBadge updatedAt={acc.updatedAt} />}
                  </div>
                </div>
                <div style={{ marginTop: '1rem' }}>
                  {renderMoney(acc, 'Saldo disponível', 'var(--text-primary)')}
                  {reservedTotal > 0 && (
                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', margin: '0.4rem 0 0' }}>
                      {formatCurrency(reservedTotal)} em caixinhas contabilizados em{' '}
                      <Link to="/investments" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
                        Investimentos
                      </Link>
                    </p>
                  )}
                </div>
                {renderManualActions(acc)}
              </Card>
            );
          })}
        </div>
      </div>

      <div>
        <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CreditCard size={20} style={{ color: 'var(--danger)' }} /> Cartões de Crédito ({creditCards.length})
        </h2>
        <div className="dashboard-grid">
          {creditCards.map((acc) => (
            <Card key={acc.id} className="col-4">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0, marginRight: '0.5rem' }}>
                  <AccountIcon
                    account={acc}
                    size={40}
                    onClick={() => setIconAccount(acc)}
                    title="Alterar ícone"
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ marginBottom: '0.2rem' }}>{renderNameEditor(acc)}</div>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                      {acc.creditData?.institutionName || 'Cartão'}
                      {acc.number ? ` • Final ${acc.number}` : ''}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem', flexShrink: 0 }}>
                  {acc.isManual ? <ManualBadge /> : <Badge variant="neutral">Fatura Aberta</Badge>}
                  {!acc.isManual && <SyncUpdatedBadge updatedAt={acc.updatedAt} />}
                </div>
              </div>
              {renderMoney(acc, 'Fatura Atual', 'var(--danger)')}
              {acc.creditData && (acc.creditData.creditLimit > 0 || acc.creditData.availableCreditLimit > 0) && (
                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                  <span>Limite Disponível: {formatCurrency(acc.creditData.availableCreditLimit)}</span>
                  <span>Total: {formatCurrency(acc.creditData.creditLimit)}</span>
                </div>
              )}
              {renderManualActions(acc)}
            </Card>
          ))}
        </div>
      </div>

      {showAdd && (
        <AddManualModal onClose={() => setShowAdd(false)} onSave={handleAddManual} saving={savingAdd} />
      )}
      {purchaseAccount && (
        <PurchaseModal
          account={purchaseAccount}
          onClose={() => setPurchaseAccount(null)}
          onSave={handlePurchaseSave}
          saving={savingPurchase}
        />
      )}
      {parsedBill && pdfAccount && (
        <BillReviewModal
          account={pdfAccount}
          parsed={parsedBill}
          onClose={() => { setParsedBill(null); setPdfAccount(null); }}
          onConfirm={applyParsedBill}
          saving={savingBill}
        />
      )}
      {iconAccount && (
        <IconPicker
          account={accounts.find((a) => a.id === iconAccount.id) || iconAccount}
          connectors={connectors}
          saving={savingIcon}
          onClose={() => { if (!savingIcon) setIconAccount(null); }}
          onSelectKey={async (key) => {
            setSavingIcon(true);
            try {
              await setAccountIcon(iconAccount.id, { key });
              setIconAccount(null);
            } finally {
              setSavingIcon(false);
            }
          }}
          onUpload={async (file) => {
            setSavingIcon(true);
            try {
              await setAccountIcon(iconAccount.id, { file });
              setIconAccount(null);
            } finally {
              setSavingIcon(false);
            }
          }}
        />
      )}
    </div>
  );
}
