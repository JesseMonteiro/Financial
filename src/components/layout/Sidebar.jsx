import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Wallet, 
  ArrowLeftRight, 
  TrendingUp, 
  CreditCard, 
  Landmark, 
  PieChart, 
  Target, 
  BarChart3, 
  Plug, 
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  HandCoins,
  PlusCircle,
  Activity,
  LogOut
} from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAuthStore } from '../../stores/authStore';


export function Sidebar({ collapsed, onToggle }) {
  const { theme } = useSettingsStore();
  const { user, signOut } = useAuthStore();

  const navItems = [
    { label: 'Visão Geral', path: '/', icon: LayoutDashboard },
    { label: 'Contas & Saldos', path: '/accounts', icon: Wallet },
    { label: 'Transações', path: '/transactions', icon: ArrowLeftRight },
    { label: 'Investimentos', path: '/investments', icon: TrendingUp },
    { label: 'Cartões de Crédito', path: '/credit-cards', icon: CreditCard },
    { label: 'Empréstimos', path: '/loans', icon: Landmark },
    { label: 'Orçamento', path: '/budget', icon: PieChart },
    { label: 'Valores a Receber', path: '/receivables', icon: HandCoins },
    { label: 'Momento Financeiro', path: '/financial-moment', icon: Activity },
    { label: 'Despesas Manuais', path: '/manual-expenses', icon: PlusCircle },
    { label: 'Metas', path: '/goals', icon: Target },
    { label: 'Relatórios', path: '/reports', icon: BarChart3 },
    { label: 'Conexões Bancárias', path: '/connect', icon: Plug },
    { label: 'Configurações', path: '/settings', icon: Settings },
  ];

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* App Header / Logo */}
      <div style={{
        padding: '1.25rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        borderBottom: '1px solid var(--border-color)'
      }}>
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, var(--primary) 0%, #8b5cf6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 700,
              boxShadow: 'var(--shadow-glow)'
            }}>
              <ShieldCheck size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>FinanceHub</h2>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pluggy.ai MCP</span>
            </div>
          </div>
        )}
        <button
          onClick={onToggle}
          style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
            borderRadius: 'var(--radius-sm)',
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
          title={collapsed ? 'Expandir Menu' : 'Recolher Menu'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Navigation Items */}
      <nav style={{ flex: 1, padding: '1rem 0.75rem', overflowY: 'auto' }}>
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {navItems.map(item => {
            const Icon = item.icon;
            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  end={item.path === '/'}
                  style={({ isActive }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.85rem',
                    padding: collapsed ? '0.75rem' : '0.65rem 1rem',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    borderRadius: 'var(--radius-md)',
                    color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                    backgroundColor: isActive ? 'var(--primary-light)' : 'transparent',
                    fontWeight: isActive ? 600 : 500,
                    textDecoration: 'none',
                    fontSize: 'var(--font-size-sm)',
                    transition: 'all var(--transition-fast)'
                  })}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon size={20} />
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Footer Profile */}
      <div style={{
        padding: collapsed ? '1.25rem 0.5rem' : '1rem 1.25rem',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: collapsed ? 'column' : 'row',
        alignItems: 'center',
        gap: '0.75rem',
        justifyContent: 'center'
      }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          backgroundColor: 'var(--primary)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 600,
          fontSize: 'var(--font-size-sm)',
          flexShrink: 0
        }} title={user?.email}>
          {user?.user_metadata?.full_name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
        </div>
        
        {!collapsed && (
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>
              {user?.user_metadata?.full_name || 'Usuário'}
            </p>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.email}
            </span>
          </div>
        )}

        <button
          onClick={signOut}
          style={{
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: 'var(--danger)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.4rem',
            borderRadius: 'var(--radius-md)',
            transition: 'background var(--transition-fast)',
          }}
          title="Sair da Conta"
        >
          <LogOut size={18} />
        </button>
      </div>
    </aside>
  );
}
