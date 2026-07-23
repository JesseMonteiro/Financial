import React, { useEffect, useState, useMemo } from 'react';
import { Search, Filter, ArrowDownRight, ArrowUpRight, Download, RefreshCw } from 'lucide-react';
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

  // Extract unique category options dynamically from raw transactions
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
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>Histórico de Transações</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
            Visualize, filtre e pesquise por todas as suas entradas e saídas sincronizadas em tempo real.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button variant="outline" icon={RefreshCw} onClick={() => loadTransactions({ force: true })}>Atualizar</Button>
          <Button variant="outline" icon={Download} onClick={handleExportCSV}>Exportar CSV</Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card padding="1rem">
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search Input */}
          <div style={{ flex: 1, minWidth: 260, display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--bg-tertiary)', padding: '0.5rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <Search size={16} style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Buscar por descrição, Uber, Movida, Recife..."
              value={filters.search}
              onChange={(e) => setFilters({ search: e.target.value })}
              style={{ border: 'none', background: 'transparent', outline: 'none', color: 'var(--text-primary)', width: '100%', fontSize: 'var(--font-size-sm)' }}
            />
          </div>

          {/* Account Filter */}
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

          {/* Type Selector */}
          <select
            value={filters.type}
            onChange={(e) => setFilters({ type: e.target.value })}
            className="input"
            style={{ width: 'auto' }}
          >
            <option value="all">Todos os Tipos (Receitas & Despesas)</option>
            <option value="debit">Apenas Despesas (Saídas)</option>
            <option value="credit">Apenas Receitas (Entradas)</option>
          </select>

          {/* Dynamic Category Filter */}
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

          {/* Reset Filters Button */}
          {(filters.search || filters.category !== 'all' || filters.type !== 'all' || filters.accountId !== 'all') && (
            <Button size="sm" variant="ghost" onClick={() => setFilters({ search: '', category: 'all', type: 'all', accountId: 'all' })}>
              Limpar Filtros
            </Button>
          )}
        </div>
      </Card>

      {/* Transactions Table / List */}
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
                <div key={tx.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                      width: 38,
                      height: 38,
                      borderRadius: '50%',
                      backgroundColor: isIncome ? 'var(--success-bg)' : 'var(--danger-bg)',
                      color: isIncome ? 'var(--success)' : 'var(--danger)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {isIncome ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                    </div>
                    <div>
                      <h4 style={{ fontWeight: 600, fontSize: 'var(--font-size-base)', color: 'var(--text-primary)' }}>
                        {tx.description}
                      </h4>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.2rem' }}>
                        <Badge variant="neutral">{translateCategory(tx.category)}</Badge>
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                          • {formatDateRelative(tx.date)} ({formatDate(tx.date)})
                        </span>
                        {tx.merchant?.businessName && (
                          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                            • {tx.merchant.businessName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={{
                      fontWeight: 700,
                      fontSize: 'var(--font-size-base)',
                      color: isIncome ? 'var(--success)' : 'var(--danger)'
                    }}>
                      {isIncome ? `+ ${formatCurrency(Math.abs(tx.amount))}` : `- ${formatCurrency(Math.abs(tx.amount))}`}
                    </span>
                    <p style={{ fontSize: '11px', color: tx.status === 'POSTED' ? 'var(--success)' : 'var(--warning)' }}>
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
