import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  Info,
  CreditCard,
  Repeat,
  Landmark,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { useTransactionStore } from '../stores/transactionStore';
import { useAccountStore } from '../stores/accountStore';
import { useCreditDataStore } from '../stores/creditDataStore';
import { formatCurrency, formatDate, formatDateRelative } from '../utils/formatters';
import {
  buildAgendaItems,
  buildAgendaMonthKeys,
  buildMonthCalendarCells,
  groupAgendaByDate,
  summarizeAgenda,
  summarizeAgendaMonth,
} from '../utils/agenda';

const FILTERS = [
  { id: 'all', label: 'Todas' },
  { id: 'unpaid', label: 'A pagar' },
  { id: 'overdue', label: 'Vencidas' },
  { id: 'paid', label: 'Pagas' },
];

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

function statusBadge(status) {
  if (status === 'paid') return <Badge variant="success">Paga</Badge>;
  if (status === 'overdue') return <Badge variant="danger">Vencida</Badge>;
  return <Badge variant="warning">A pagar</Badge>;
}

function typeIcon(type) {
  if (type === 'bill') return <CreditCard size={16} />;
  if (type === 'subscription') return <Repeat size={16} />;
  if (type === 'loan') return <Landmark size={16} />;
  return <CalendarDays size={16} />;
}

function relativeLabel(days) {
  if (days < 0) {
    const n = Math.abs(days);
    return n === 1 ? 'há 1 dia' : `há ${n} dias`;
  }
  if (days === 0) return 'hoje';
  if (days === 1) return 'amanhã';
  return `em ${days} dias`;
}

function currentYm(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function Agenda() {
  const { loadTransactions, transactions, setManualPaid } = useTransactionStore();
  const { loadAccounts, accounts, loans } = useAccountStore();
  const { loadForAccounts, getMerged, transactionsByAccount } = useCreditDataStore();
  const [filter, setFilter] = useState('all');
  const [selectedYm, setSelectedYm] = useState(() => currentYm());
  const [selectedDay, setSelectedDay] = useState(null);
  const monthStripRef = useRef(null);

  const creditCards = useMemo(() => accounts.filter((a) => a.type === 'CREDIT'), [accounts]);
  const creditIds = useMemo(() => creditCards.map((c) => c.id), [creditCards]);
  const months = useMemo(() => buildAgendaMonthKeys(new Date(), { before: 2, after: 3 }), []);

  useEffect(() => {
    loadTransactions();
    loadAccounts();
  }, []);

  useEffect(() => {
    if (creditIds.length) loadForAccounts(creditIds);
  }, [creditIds.join(',')]);

  // Center current month card on first paint
  useEffect(() => {
    const el = monthStripRef.current;
    if (!el) return;
    const current = el.querySelector('[data-month-current="true"]');
    if (current) {
      current.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    }
  }, []);

  const allExpenseSources = useMemo(() => {
    const { transactions: cardTxs } = getMerged(creditIds);
    const seen = new Set();
    const merged = [];
    [...transactions, ...(cardTxs || [])].forEach((t) => {
      const id = t?.id;
      if (id != null) {
        if (seen.has(id)) return;
        seen.add(id);
      }
      merged.push(t);
    });
    return merged;
  }, [transactions, creditIds, getMerged, transactionsByAccount]);

  const agendaItems = useMemo(
    () =>
      buildAgendaItems({
        transactions,
        creditCards,
        creditIds,
        getMerged,
        loans,
        expenseSources: allExpenseSources,
      }),
    [transactions, creditCards, creditIds, loans, allExpenseSources, getMerged, transactionsByAccount]
  );

  const filtered = useMemo(() => {
    if (filter === 'unpaid') return agendaItems.filter((i) => !i.isPaid);
    if (filter === 'overdue') return agendaItems.filter((i) => i.status === 'overdue');
    if (filter === 'paid') return agendaItems.filter((i) => i.isPaid);
    return agendaItems;
  }, [agendaItems, filter]);

  const summary = useMemo(() => summarizeAgenda(agendaItems), [agendaItems]);

  const monthSummaries = useMemo(
    () =>
      Object.fromEntries(months.map((m) => [m.ym, summarizeAgendaMonth(filtered, m.ym)])),
    [months, filtered]
  );

  const selectedMonthMeta = months.find((m) => m.ym === selectedYm) || months.find((m) => m.isCurrent);
  const selectedSummary = monthSummaries[selectedYm] || summarizeAgendaMonth(filtered, selectedYm);

  const calendarCells = useMemo(
    () => buildMonthCalendarCells(selectedYm, selectedSummary.items || []),
    [selectedYm, selectedSummary]
  );

  const dayGroups = useMemo(() => {
    let list = selectedSummary.items || [];
    if (selectedDay) list = list.filter((i) => i.date === selectedDay);
    return groupAgendaByDate(list);
  }, [selectedSummary, selectedDay]);

  const handleSelectMonth = (ym) => {
    setSelectedYm(ym);
    setSelectedDay(null);
  };

  const handleToggleManualPaid = async (item, next) => {
    if (item.type !== 'manual' || item.sourceId == null) return;
    await setManualPaid(item.sourceId, next);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>Agenda</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
            Visão mensal das contas — deslize pelos meses, veja o calendário e o que está pago, a pagar ou vencido.
          </p>
        </div>
      </div>

      <div className="dashboard-grid">
        <Card className="col-4">
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>
            A PAGAR
          </span>
          <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, margin: '0.5rem 0', color: 'var(--primary)' }}>
            {formatCurrency(summary.unpaidTotal)}
          </h2>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            {summary.unpaidCount} conta(s) pendente(s)
          </span>
        </Card>
        <Card className="col-4">
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <AlertTriangle size={12} /> VENCIDAS
          </span>
          <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, margin: '0.5rem 0', color: 'var(--danger)' }}>
            {summary.overdueCount}
          </h2>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            {formatCurrency(summary.overdueTotal)} em atraso
          </span>
        </Card>
        <Card className="col-4">
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Clock size={12} /> PRÓXIMOS 7 DIAS
          </span>
          <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, margin: '0.5rem 0' }}>
            {summary.dueSoonCount}
          </h2>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            Vencimentos iminentes
          </span>
        </Card>
      </div>

      {summary.overdueCount > 0 && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.25rem 0' }}>
            <AlertTriangle size={20} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>
                Você tem {summary.overdueCount} conta(s) vencida(s)
              </div>
              <p style={{ margin: '0.25rem 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                Total em atraso: {formatCurrency(summary.overdueTotal)}. Use o filtro “Vencidas” ou o calendário do mês.
              </p>
            </div>
          </div>
        </Card>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className="input"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '0.45rem 0.9rem',
              cursor: 'pointer',
              background: filter === f.id ? 'var(--primary)' : 'var(--bg-tertiary)',
              color: filter === f.id ? '#fff' : 'var(--text-primary)',
              fontWeight: 600,
              fontSize: 'var(--font-size-sm)',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Horizontal month cards */}
      <div>
        <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
          MESES
        </div>
        <div className="agenda-month-strip chip-scroll" ref={monthStripRef}>
          {months.map((m) => {
            const s = monthSummaries[m.ym] || { unpaidCount: 0, overdueCount: 0, unpaidTotal: 0, count: 0 };
            const active = selectedYm === m.ym;
            return (
              <button
                key={m.ym}
                type="button"
                data-month-current={m.isCurrent ? 'true' : undefined}
                className={`agenda-month-card ${active ? 'agenda-month-card--active' : ''} ${s.overdueCount ? 'agenda-month-card--overdue' : ''}`}
                onClick={() => handleSelectMonth(m.ym)}
              >
                <div className="agenda-month-card__label">
                  {m.label}
                  {m.isCurrent && <Badge variant="info" style={{ fontSize: 9 }}>Atual</Badge>}
                </div>
                <div className="agenda-month-card__year">{m.year}</div>
                <div className="agenda-month-card__total">
                  {s.unpaidCount > 0 ? formatCurrency(s.unpaidTotal) : s.count > 0 ? 'Em dia' : '—'}
                </div>
                <div className="agenda-month-card__meta">
                  {s.overdueCount > 0
                    ? `${s.overdueCount} vencida(s)`
                    : s.unpaidCount > 0
                      ? `${s.unpaidCount} a pagar`
                      : s.count > 0
                        ? `${s.count} lançamento(s)`
                        : 'Sem contas'}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Month calendar grid */}
      <Card
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <CalendarDays size={16} />
            {selectedMonthMeta ? `${selectedMonthMeta.label} de ${selectedMonthMeta.year}` : selectedYm}
            {selectedSummary.overdueCount > 0 && (
              <Badge variant="danger">{selectedSummary.overdueCount} vencida(s)</Badge>
            )}
          </span>
        }
        subtitle={
          selectedSummary.unpaidCount > 0
            ? `A pagar no mês: ${formatCurrency(selectedSummary.unpaidTotal)}`
            : selectedSummary.count > 0
              ? 'Nenhuma pendência neste mês no filtro atual'
              : 'Nenhuma conta neste mês'
        }
      >
        <div className="agenda-cal-weekdays">
          {WEEKDAYS.map((w, i) => (
            <span key={`${w}-${i}`}>{w}</span>
          ))}
        </div>
        <div className="agenda-cal-grid">
          {calendarCells.map((cell) => {
            if (cell.empty) {
              return <div key={cell.key} className="agenda-cal-cell agenda-cal-cell--empty" />;
            }
            const active = selectedDay === cell.date;
            const todayIso = new Date().toISOString().slice(0, 10);
            const isToday = cell.date === todayIso;
            return (
              <button
                key={cell.key}
                type="button"
                className={[
                  'agenda-cal-cell',
                  active ? 'agenda-cal-cell--active' : '',
                  isToday ? 'agenda-cal-cell--today' : '',
                  cell.hasOverdue ? 'agenda-cal-cell--overdue' : '',
                  cell.hasUnpaid && !cell.hasOverdue ? 'agenda-cal-cell--due' : '',
                  cell.hasPaid && !cell.hasUnpaid ? 'agenda-cal-cell--paid' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => setSelectedDay((d) => (d === cell.date ? null : cell.date))}
                title={
                  cell.items.length
                    ? `${cell.items.length} conta(s)${cell.unpaidTotal ? ` · a pagar ${formatCurrency(cell.unpaidTotal)}` : ''}`
                    : 'Sem contas'
                }
              >
                <span className="agenda-cal-cell__day">{cell.day}</span>
                {cell.items.length > 0 && (
                  <span className="agenda-cal-cell__dots">
                    {cell.hasOverdue && <i className="dot dot--danger" />}
                    {cell.hasUnpaid && !cell.hasOverdue && <i className="dot dot--warn" />}
                    {cell.hasPaid && <i className="dot dot--ok" />}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {selectedDay && (
          <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Badge variant="info">Dia {formatDate(selectedDay)}</Badge>
            <button
              type="button"
              className="input"
              style={{ padding: '0.25rem 0.6rem', fontSize: 12, cursor: 'pointer' }}
              onClick={() => setSelectedDay(null)}
            >
              Ver mês inteiro
            </button>
          </div>
        )}
      </Card>

      {/* Day lists for selected month / day */}
      {dayGroups.length === 0 ? (
        <Card title="Contas do período">
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Info size={32} style={{ marginBottom: 8 }} />
            <p>
              {filter === 'all'
                ? 'Nenhuma conta neste mês. Cadastre despesas manuais ou aguarde próximos vencimentos.'
                : 'Nenhuma conta neste filtro para o mês selecionado.'}
            </p>
          </div>
        </Card>
      ) : (
        dayGroups.map((group) => {
          const accent = group.hasOverdue
            ? 'var(--danger)'
            : group.items.every((i) => i.isPaid)
              ? 'var(--success)'
              : 'var(--primary)';
          return (
            <Card
              key={group.date}
              title={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <CalendarDays size={16} style={{ color: accent }} />
                  {formatDateRelative(group.date)}
                  <span style={{ fontWeight: 500, fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                    {formatDate(group.date)}
                  </span>
                  {group.hasOverdue && <Badge variant="danger">Atraso</Badge>}
                </span>
              }
              subtitle={
                group.totalDue > 0
                  ? `A pagar neste dia: ${formatCurrency(group.totalDue)}`
                  : group.totalPaid > 0
                    ? `Pago neste dia: ${formatCurrency(group.totalPaid)}`
                    : undefined
              }
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', marginTop: '0.5rem' }}>
                {group.items.map((item) => {
                  const overdue = item.status === 'overdue';
                  const paid = item.status === 'paid';
                  return (
                    <div
                      key={item.id}
                      className="list-row"
                      style={{
                        padding: '0.75rem 1rem',
                        background: paid
                          ? 'var(--success-bg)'
                          : overdue
                            ? 'rgba(239, 68, 68, 0.08)'
                            : 'var(--bg-tertiary)',
                        borderRadius: 'var(--radius-md)',
                        borderLeft: `3px solid ${paid ? 'var(--success)' : overdue ? 'var(--danger)' : 'var(--primary)'}`,
                        border: `1px solid ${paid ? 'rgba(16,185,129,0.35)' : overdue ? 'rgba(239,68,68,0.25)' : 'transparent'}`,
                        opacity: paid ? 0.92 : 1,
                      }}
                    >
                      <div className="list-row-main" style={{ gap: '0.75rem', minWidth: 0 }}>
                        <div
                          style={{
                            color: paid ? 'var(--success)' : overdue ? 'var(--danger)' : 'var(--primary)',
                            flexShrink: 0,
                          }}
                        >
                          {typeIcon(item.type)}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <h3
                              style={{
                                fontWeight: 600,
                                fontSize: 'var(--font-size-sm)',
                                margin: 0,
                                textDecoration: paid ? 'line-through' : 'none',
                              }}
                            >
                              {item.title}
                            </h3>
                            {statusBadge(item.status)}
                            {item.type === 'bill' && item.bankName && (
                              <Badge variant="neutral">{item.bankName}</Badge>
                            )}
                            {item.type === 'bill' && item.last4 && (
                              <Badge variant="neutral">final {item.last4}</Badge>
                            )}
                          </div>
                          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                            {item.meta} · {relativeLabel(item.days)}
                          </span>
                        </div>
                      </div>
                      <div className="list-row-amount" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span
                          style={{
                            fontWeight: 700,
                            color: paid ? 'var(--success)' : overdue ? 'var(--danger)' : 'var(--text-primary)',
                          }}
                        >
                          {formatCurrency(item.amount)}
                        </span>
                        {item.type === 'manual' && (
                          <label
                            className="tap-target"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              cursor: 'pointer',
                              fontSize: 10,
                              fontWeight: 600,
                              color: paid ? 'var(--success)' : 'var(--text-muted)',
                              userSelect: 'none',
                              whiteSpace: 'nowrap',
                            }}
                            title="Marcar como pago (apenas controle; não altera saldo)"
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(item.isPaid)}
                              onChange={(e) => handleToggleManualPaid(item, e.target.checked)}
                              style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--success)' }}
                            />
                            {paid ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                <CheckCircle2 size={11} /> Pago
                              </span>
                            ) : (
                              'Pago'
                            )}
                          </label>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
