import React, { useEffect } from 'react';
import { BarChart3, Download, Filter, Calendar } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { BalanceChart } from '../components/charts/BalanceChart';
import { ExpenseByCategoryChart } from '../components/charts/ExpenseByCategoryChart';
import { IncomeVsExpenseChart } from '../components/charts/IncomeVsExpenseChart';
import { useTransactionStore } from '../stores/transactionStore';
import { useAccountStore } from '../stores/accountStore';

export function Reports() {
  const { loadTransactions } = useTransactionStore();
  const { loadAccounts } = useAccountStore();

  useEffect(() => {
    loadTransactions();
    loadAccounts();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>Relatórios & Analytics Reais</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
            Análise detalhada do seu desempenho financeiro baseada nas contas sincronizadas via Pluggy.
          </p>
        </div>
        <Button variant="outline" icon={Download}>Exportar Relatório PDF</Button>
      </div>

      <div className="dashboard-grid">
        <Card className="col-8" title="Evolução Patrimonial Consolidada">
          <BalanceChart height={300} />
        </Card>
        <Card className="col-4" title="Distribuição de Despesas por Categoria">
          <ExpenseByCategoryChart height={300} />
        </Card>
      </div>

      <div className="dashboard-grid">
        <Card className="col-12" title="Balanço Mensal (Receita vs Despesa)">
          <IncomeVsExpenseChart height={320} />
        </Card>
      </div>
    </div>
  );
}
