import React, { useEffect, useMemo } from 'react';
import { Search, ArrowDownRight, ArrowUpRight, Download, RefreshCw } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useTransactionStore } from '../stores/transactionStore';
import { useAccountStore } from '../stores/accountStore';
import { formatCurrency, formatDateRelative, formatDate } from '../utils/formatters';
import { translateCategory } from '../utils/categories';

export function Transactions() {
  const { loadTransactions, getFilteredTransactions, transactions: rawTransactions, filters, setFilters, loading } = useTransactionStore();
  const { accounts, loadAccounts } = useAccountStore();

  useEffect(() => {
    loadTransactions();
    loadAccounts();
  }, []);

  const filteredTransactions = getFilteredTransactions();

  const uniqueCategories = useMemo(() => {
    const setCat = new Set();
    rawTransactions.forEach(t => {
      if (t.category) setCat.add(t.category);
    });
    return Array.from(setCat).sort();
  }, [rawTransactions]);

  const handleExportCSV = () => {
    const headers = ['Data', 'Descricao', 'Categoria', 'Valor (RS)', 'Status'];
    const rows = filteredTransactions.map(t => [
      formatDate(t.date),
      `"${t.description || ''}"`,
      `"${translateCategory(t.category)}"`,
      t.amount,
      t.status
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `transacoes_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>Histórico de Transações</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
            Visualize, filtre e pesquise por todas as suas entradas e saídas sincronizadas em tempo real.
          </p>
        </div>
        <div className="page-header__actions">
          <Button variant="outline" icon={RefreshCw} onClick={() => loadTransactions({ force: true })}>
            <span className="hide-mobile">Atualizar</span>
            <span className="show-mobile">Atualizar</span>
          </Button>
          <Button variant="outline" icon={Download} onClick={handleExportCSV}>
            <span className="hide-mobile">Exportar CSV</span>
            <span className="show-mobile">CSV</span>
          </Button>
        </div>
      </div>

      <Card padding="1rem">
        <div className="filter-bar">
          <div className="filter-bar__search">
            <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Buscar por descrição..."
              value={filters.search}
              onChange={(e) => setFilters({ search: e.target.value })}
              style={{ border: 'none', background: 'transparent', outline: 'none', color: 'var(--text-primary)', width: '100%', fontSize: 'var(--font-size-sm)' }}
            />
          </div>

          <select
            value={filters.accountId}
            onChange={(e) => setFilters({ accountId: e.target.value })}
            className="input"
            style={{ width: 'auto' }}
          >
            <option value="all">Todas as Contas e Cartões ({accounts.length})</option>
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>
                {acc.name} ({acc.type === 'CREDIT' ? `Cartão • Final ${acc.number || '****'}` : `Conta • Ag. ${acc.number || '0001'}`})
              </option>
            ))}
          </select>

          <select
            value={filters.type}
            onChange={(e) => setFilters({ type: e.target.value })}
            className="input"
            style={{ width: 'auto' }}
          >
            <option value="all">Todos os Tipos</option>
            <option value="debit">Apenas Despesas</option>
            <option value="credit">Apenas Receitas</option>
          </select>

          <select
            value={filters.category}
            onChange={(e) => setFilters({ category: e.target.value })}
            className="input"
            style={{ width: 'auto' }}
          >
            <option value="all">Todas as Categorias ({uniqueCategories.length})</option>
            {uniqueCategories.map(cat => (
              <option key={cat} value={cat}>
                {translateCategory(cat)}
              </option>
            ))}
          </select>

          {(filters.search || filters.category !== 'all' || filters.type !== 'all' || filters.accountId !== 'all') && (
            <Button size="sm" variant="ghost" onClick={() => setFilters({ search: '', category: 'all', type: 'all', accountId: 'all' })}>
              Limpar Filtros
            </Button>
          )}
        </div>
      </Card>

      <Card title={`Transações Encontradas (${filteredTransactions.length} de ${rawTransactions.length})`}>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Carregando histórico de transações...
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Nenhuma transação encontrada para os filtros selecionados.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
            {filteredTransactions.map(tx => {
              const isIncome = tx.amount > 0 || tx.type === 'CREDIT';
              return (
                <div key={tx.id} className="list-row">
                  <div className="list-row-main">
                    <div style={{
                      width: 38,
                      height: 38,
                      borderRadius: '50%',
                      backgroundColor: isIncome ? 'var(--success-bg)' : 'var(--danger-bg)',
                      color: isIncome ? 'var(--success)' : 'var(--danger)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      {isIncome ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <h4 style={{
                        fontWeight: 600,
                        fontSize: 'var(--font-size-base)',
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {tx.description}
                      </h4>
                      <div className="list-row-meta">
                        <Badge variant="neutral">{translateCategory(tx.category)}</Badge>
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                          {formatDateRelative(tx.date)} ({formatDate(tx.date)})
                        </span>
                        {tx.merchant?.businessName && (
                          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                            {tx.merchant.businessName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="list-row-amount">
                    <span style={{
                      fontWeight: 700,
                      fontSize: 'var(--font-size-base)',
                      color: isIncome ? 'var(--success)' : 'var(--danger)'
                    }}>
                      {isIncome ? `+ ${formatCurrency(Math.abs(tx.amount))}` : `- ${formatCurrency(Math.abs(tx.amount))}`}
                    </span>
                    <p style={{ fontSize: '11px', color: tx.status === 'POSTED' ? 'var(--success)' : 'var(--warning)', margin: 0 }}>
                      {tx.status === 'POSTED' ? 'Confirmada' : 'Pendente'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
