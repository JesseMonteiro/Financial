import { translateCategory, userCategoryOptions, pluggyCategoryOptions } from './categories.js';
import { formatCurrency, formatDate, formatDateRelative } from './formatters.js';

export const LINE_ITEM_KINDS = {
  transaction: 'transaction',
  creditBillLine: 'creditBillLine',
  automaticDebit: 'automaticDebit',
  manualExpense: 'manualExpense',
  receivable: 'receivable',
  agenda: 'agenda',
};

const KIND_TITLE = {
  transaction: 'Transação',
  creditBillLine: 'Compra no cartão',
  automaticDebit: 'Débito automático',
  manualExpense: 'Despesa manual',
  receivable: 'Valor a receber',
  agenda: 'Compromisso',
};

function caps(flags) {
  return {
    togglePaid: Boolean(flags.togglePaid),
    edit: Boolean(flags.edit),
    delete: Boolean(flags.delete),
    createReceivable: Boolean(flags.createReceivable),
    changeCategory: Boolean(flags.changeCategory),
  };
}

export function lineItemKindTitle(kind) {
  return KIND_TITLE[kind] || 'Lançamento';
}

export function fromTransaction(tx, accountName) {
  const isCredit = tx.amount > 0 || tx.type === 'CREDIT';
  const category = translateCategory(tx.category);
  const metadata = [
    { label: 'Data', value: `${formatDateRelative(tx.date)} (${formatDate(tx.date)})` },
  ];
  if (accountName) metadata.push({ label: 'Conta', value: accountName });
  if (category) metadata.push({ label: 'Categoria', value: category });
  if (tx.merchant?.businessName) metadata.push({ label: 'Estabelecimento', value: tx.merchant.businessName });
  const pending = tx.status && String(tx.status).toUpperCase() !== 'POSTED';
  return {
    id: tx.id,
    kind: LINE_ITEM_KINDS.transaction,
    title: tx.description || 'Lançamento',
    amount: Math.abs(Number(tx.amount) || 0),
    amountLabel: formatCurrency(Math.abs(Number(tx.amount) || 0)),
    isCredit,
    statusLabel: pending ? 'Pendente' : 'Confirmada',
    badges: pending ? ['Pendente'] : [],
    metadata,
    capabilities: caps({ changeCategory: true }),
    isPaid: false,
    sourceId: tx.id,
    categoryKey: tx.category || '',
    categoryId: tx.categoryId || '',
    raw: tx,
  };
}

export function fromCreditPurchase(tx, { accountName, canCreateReceivable = false } = {}) {
  const isPayment = Boolean(tx.isPayment);
  const isCredit = isPayment || tx.type === 'CREDIT' || Number(tx.amount) < 0;
  const amount = Math.abs(Number(tx.amountInAccountCurrency ?? tx.amount) || 0);
  const category = translateCategory(tx.category);
  const badges = [];
  const num = tx.installmentNumber ?? tx.creditCardMetadata?.installmentNumber;
  const total = tx.installmentTotal ?? tx.creditCardMetadata?.totalInstallments;
  if (Number(total) > 1 && Number(num) > 0) badges.push(`Parcela ${num}/${total}`);
  if (tx.isProjected) badges.push('Projetada');
  if (String(tx.status || '').toUpperCase() === 'PENDING') badges.push('Pendente');
  const metadata = [];
  if (accountName) metadata.push({ label: 'Cartão', value: accountName });
  if (tx.date) metadata.push({ label: 'Data', value: formatDate(tx.date) });
  if (category) metadata.push({ label: 'Categoria', value: category });
  if (tx.merchant?.businessName) metadata.push({ label: 'Estabelecimento', value: tx.merchant.businessName });
  const statusLabel = tx.isProjected ? 'Parcela projetada' : String(tx.status).toUpperCase() === 'POSTED' ? 'Confirmado' : 'Pendente';
  metadata.push({ label: 'Status', value: statusLabel });
  const create = canCreateReceivable && !isPayment && !isCredit;
  return {
    id: tx.id,
    kind: LINE_ITEM_KINDS.creditBillLine,
    title: tx.description || 'Lançamento',
    amount,
    amountLabel: formatCurrency(amount),
    isCredit,
    statusLabel,
    badges,
    metadata,
    capabilities: caps({ createReceivable: create, changeCategory: !isPayment && !tx.isProjected }),
    isPaid: false,
    sourceId: tx.id,
    categoryKey: tx.category || '',
    categoryId: tx.categoryId || '',
    raw: tx,
  };
}

export function fromManualExpense(expense, accountName) {
  const category = translateCategory(expense.category);
  const metadata = [
    { label: 'Data', value: formatDate(expense.date) },
  ];
  if (category) metadata.push({ label: 'Categoria', value: category });
  if (accountName) metadata.push({ label: 'Conta', value: accountName });
  return {
    id: expense.id,
    kind: LINE_ITEM_KINDS.manualExpense,
    title: expense.description || 'Despesa',
    amount: Math.abs(Number(expense.amount) || 0),
    amountLabel: formatCurrency(Math.abs(Number(expense.amount) || 0)),
    isCredit: false,
    statusLabel: expense.isPaid ? 'Paga' : 'Em aberto',
    badges: expense.isPaid ? ['Paga'] : [],
    metadata,
    capabilities: caps({ togglePaid: true, edit: true, delete: true, changeCategory: true }),
    isPaid: Boolean(expense.isPaid),
    sourceId: expense.id,
    categoryKey: expense.category || 'Other',
    raw: expense,
  };
}

export function fromReceivable(receivable, installment) {
  const inst = installment
    || (receivable.installmentHistory || []).find((i) => !i.paidAt)
    || (receivable.installmentHistory || [])[0];
  const amount = Number(inst?.amount ?? receivable.totalAmount ?? receivable.amount) || 0;
  const paid = Boolean(inst?.paidAt || receivable.isReceived);
  const badges = [];
  const total = receivable.installments || 1;
  if (total > 1 && inst?.installmentNumber) {
    badges.push(`Parcela ${inst.installmentNumber}/${total}`);
  }
  if (paid) badges.push('Recebido');
  const metadata = [
    { label: 'Pessoa', value: receivable.personName || 'Sem pessoa' },
  ];
  if (inst?.dueDate) metadata.push({ label: 'Vencimento', value: formatDate(inst.dueDate) });
  if (receivable.notes) metadata.push({ label: 'Notas', value: receivable.notes });
  return {
    id: `${receivable.id}-${inst?.installmentNumber || 0}`,
    kind: LINE_ITEM_KINDS.receivable,
    title: receivable.description || receivable.personName || 'Valor a receber',
    amount,
    amountLabel: formatCurrency(amount),
    isCredit: true,
    statusLabel: paid ? 'Recebido' : 'A receber',
    badges,
    metadata,
    capabilities: caps({
      togglePaid: !paid,
      edit: true,
      delete: true,
    }),
    isPaid: paid,
    sourceId: receivable.id,
    installmentNumber: inst?.installmentNumber,
    raw: receivable,
  };
}

export function fromMomentReceivable(row) {
  const paid = Boolean(row.paidAt || row.isPaid);
  const sourceId = row.id || row.receivableId;
  return {
    id: `${sourceId || row.personName}-${row.installmentNumber}`,
    kind: LINE_ITEM_KINDS.receivable,
    title: row.description || 'Valor a receber',
    amount: Math.abs(Number(row.amount) || 0),
    amountLabel: formatCurrency(Math.abs(Number(row.amount) || 0)),
    isCredit: true,
    statusLabel: paid ? 'Recebido' : 'A receber',
    badges: [
      `Parcela ${row.installmentNumber}/${row.totalInstallments}`,
      paid ? 'Recebido' : null,
    ].filter(Boolean),
    metadata: [
      { label: 'Pessoa', value: row.personName || 'Sem pessoa' },
      row.ownerLabel ? { label: 'Titular', value: row.ownerLabel } : null,
    ].filter(Boolean),
    capabilities: caps({
      togglePaid: Boolean(sourceId) && !paid,
      edit: Boolean(sourceId),
      delete: Boolean(sourceId),
    }),
    isPaid: paid,
    sourceId,
    installmentNumber: row.installmentNumber,
    raw: row,
  };
}

export function fromAutomaticDebit(tx, accountName) {
  const pending = Boolean(tx.isPending);
  return {
    id: tx.id,
    kind: LINE_ITEM_KINDS.automaticDebit,
    title: tx.description || tx.descriptionRaw || 'Débito automático',
    amount: Math.abs(Number(tx.amount) || 0),
    amountLabel: formatCurrency(Math.abs(Number(tx.amount) || 0)),
    isCredit: false,
    statusLabel: pending ? 'Agendado' : 'Liquidado',
    badges: [pending ? 'Agendado' : 'Liquidado'],
    metadata: [
      { label: 'Data', value: formatDate(tx.date) },
      accountName ? { label: 'Conta', value: accountName } : null,
    ].filter(Boolean),
    capabilities: caps({}),
    isPaid: !pending,
    sourceId: tx.id,
    raw: tx,
  };
}

export function fromAgendaItem(item) {
  const isManual = item.type === 'manual';
  const paid = Boolean(item.isPaid || item.status === 'paid');
  return {
    id: item.id || item.sourceId,
    kind: isManual ? LINE_ITEM_KINDS.manualExpense : LINE_ITEM_KINDS.agenda,
    title: item.title || item.description || 'Compromisso',
    amount: Math.abs(Number(item.amount) || 0),
    amountLabel: formatCurrency(Math.abs(Number(item.amount) || 0)),
    isCredit: item.type === 'receivable',
    statusLabel: paid ? 'Pago' : 'Pendente',
    badges: [item.meta, item.bankName, item.last4 ? `final ${item.last4}` : null].filter(Boolean),
    metadata: [
      { label: 'Quando', value: item.meta || '' },
      item.bankName ? { label: 'Banco', value: item.bankName } : null,
    ].filter(Boolean),
    capabilities: caps({ togglePaid: isManual }),
    isPaid: paid,
    sourceId: item.sourceId || item.id,
    raw: item,
  };
}

export function paidActionTitle(item) {
  if (!item) return '';
  if (item.kind === LINE_ITEM_KINDS.receivable) {
    return item.isPaid ? 'Já recebido' : 'Marcar recebido';
  }
  return item.isPaid ? 'Marcar como não paga' : 'Marcar como paga';
}

export function categoryOptionsForItem(item, pluggyCategories = [], purchaseCategories = []) {
  if (!item?.capabilities?.changeCategory) return [];
  if (item.kind === LINE_ITEM_KINDS.manualExpense) return userCategoryOptions(purchaseCategories);
  if (item.kind === LINE_ITEM_KINDS.transaction || item.kind === LINE_ITEM_KINDS.creditBillLine) {
    return pluggyCategoryOptions(pluggyCategories);
  }
  return [];
}

export function applyingCategory(item, option) {
  if (!item || !option) return item;
  const metadata = (item.metadata || []).map((row) => (
    row.label === 'Categoria' ? { ...row, value: option.label } : row
  ));
  if (!metadata.some((row) => row.label === 'Categoria')) {
    metadata.push({ label: 'Categoria', value: option.label });
  }
  return {
    ...item,
    categoryId: option.value,
    categoryKey: option.value,
    metadata,
  };
}

export function rowActivateProps(onOpen, extraClassName = '') {
  return {
    className: `list-row list-row--clickable ${extraClassName}`.trim(),
    role: 'button',
    tabIndex: 0,
    onClick: onOpen,
    onKeyDown: (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onOpen();
      }
    },
  };
}
