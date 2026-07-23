import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { MainLayout } from './components/layout/MainLayout';
import { Dashboard } from './pages/Dashboard';
import { Accounts } from './pages/Accounts';
import { Transactions } from './pages/Transactions';
import { Investments } from './pages/Investments';
import { CreditCards } from './pages/CreditCards';
import { Loans } from './pages/Loans';
import { Budget } from './pages/Budget';
import { Goals } from './pages/Goals';
import { Reports } from './pages/Reports';
import { ConnectBank } from './pages/ConnectBank';
import { Settings } from './pages/Settings';
import { Receivables } from './pages/Receivables';
import { ManualExpenses } from './pages/ManualExpenses';
import { FinancialMoment } from './pages/FinancialMoment';
import { Subscriptions } from './pages/Subscriptions';
import { Login } from './pages/Login';
import { AuthGuard } from './components/auth/AuthGuard';

export default function App() {
  const { initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<AuthGuard><MainLayout /></AuthGuard>}>
          <Route index element={<Dashboard />} />
          <Route path="accounts" element={<Accounts />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="investments" element={<Investments />} />
          <Route path="credit-cards" element={<CreditCards />} />
          <Route path="loans" element={<Loans />} />
          <Route path="budget" element={<Budget />} />
          <Route path="goals" element={<Goals />} />
          <Route path="receivables" element={<Receivables />} />
          <Route path="manual-expenses" element={<ManualExpenses />} />
          <Route path="financial-moment" element={<FinancialMoment />} />
          <Route path="subscriptions" element={<Subscriptions />} />
          <Route path="calendar" element={<Subscriptions />} />
          <Route path="reports" element={<Reports />} />
          <Route path="connect" element={<ConnectBank />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
