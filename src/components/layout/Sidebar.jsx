import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  LogOut,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useJointStore } from '../../stores/jointStore';
import { getVisibleNavItems } from './navItems';
import { GlassSurface } from '../ui/GlassSurface';

export function Sidebar({ collapsed, onToggle }) {
  const { user, signOut } = useAuthStore();
  const jointLink = useJointStore((s) => s.link);
  const hasJoint = jointLink?.status === 'active';
  const items = getVisibleNavItems(hasJoint);

  return (
    <GlassSurface as="aside" className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div
        className="sidebar-brand"
        style={{ justifyContent: collapsed ? 'center' : 'space-between' }}
      >
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
              boxShadow: 'var(--shadow-glow)',
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
          type="button"
          onClick={onToggle}
          className="header-cluster__btn"
          title={collapsed ? 'Expandir Menu' : 'Recolher Menu'}
          style={{ width: 28, height: 28, borderRadius: 10, background: 'color-mix(in srgb, var(--bg-tertiary) 80%, transparent)' }}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="sidebar-nav">
        <ul>
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    `sidebar-link ${collapsed ? 'sidebar-link--collapsed' : ''} ${isActive ? 'sidebar-link--active' : ''}`
                  }
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

      <div
        className="sidebar-footer"
        style={{
          padding: collapsed ? '1.25rem 0.5rem' : undefined,
          flexDirection: collapsed ? 'column' : 'row',
          justifyContent: 'center',
        }}
      >
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
          flexShrink: 0,
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
          type="button"
          onClick={signOut}
          className="header-cluster__btn"
          title="Sair da Conta"
          style={{ color: 'var(--danger)' }}
        >
          <LogOut size={18} />
        </button>
      </div>
    </GlassSurface>
  );
}
