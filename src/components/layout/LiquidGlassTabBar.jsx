import React, { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LogOut, X, ShieldCheck } from 'lucide-react';
import { navItems, mobilePrimaryTabs, mobileTabPaths } from './navItems';
import { useScrollDirection } from '../../hooks/useScrollDirection';
import { useAuthStore } from '../../stores/authStore';

export function LiquidGlassTabBar({ moreOpen, onMoreOpen, onMoreClose }) {
  const { hidden } = useScrollDirection({ threshold: 10 });
  const location = useLocation();
  const isPrimaryRoute = mobileTabPaths.includes(location.pathname);
  const showBar = !hidden || moreOpen;

  return (
    <>
      <nav
        className={`liquid-tabbar ${showBar ? '' : 'liquid-tabbar--hidden'}`}
        aria-label="Navegação principal"
      >
        {mobilePrimaryTabs.map((item) => {
          const Icon = item.icon;
          if (item.isMore) {
            const active = moreOpen || !isPrimaryRoute;
            return (
              <button
                key="more"
                type="button"
                className={`liquid-tab ${active ? 'liquid-tab--active' : ''}`}
                onClick={() => (moreOpen ? onMoreClose() : onMoreOpen())}
                aria-expanded={moreOpen}
                aria-label="Mais opções"
              >
                <Icon size={22} strokeWidth={active ? 2.25 : 1.75} />
                <span>{item.shortLabel}</span>
              </button>
            );
          }
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `liquid-tab ${isActive && !moreOpen ? 'liquid-tab--active' : ''}`
              }
              onClick={onMoreClose}
            >
              {({ isActive }) => (
                <>
                  <Icon size={22} strokeWidth={isActive && !moreOpen ? 2.25 : 1.75} />
                  <span>{item.shortLabel}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <MobileMoreDrawer open={moreOpen} onClose={onMoreClose} />
    </>
  );
}

function MobileMoreDrawer({ open, onClose }) {
  const { user, signOut } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="mobile-more-overlay" onClick={onClose} role="presentation">
      <div
        className="mobile-more-sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Menu completo"
      >
        <div className="mobile-more-sheet__header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="mobile-more-sheet__logo">
              <ShieldCheck size={20} />
            </div>
            <div>
              <strong style={{ display: 'block', fontSize: 'var(--font-size-base)' }}>FinanceHub</strong>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Menu
              </span>
            </div>
          </div>
          <button type="button" className="tap-target mobile-more-sheet__close" onClick={onClose} aria-label="Fechar">
            <X size={20} />
          </button>
        </div>

        <nav className="mobile-more-sheet__nav">
          <ul>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.path === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.path);
              return (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    end={item.path === '/'}
                    className={`mobile-more-link ${isActive ? 'mobile-more-link--active' : ''}`}
                    onClick={onClose}
                  >
                    <Icon size={20} />
                    <span>{item.label}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mobile-more-sheet__footer">
          <div className="mobile-more-sheet__user">
            <div className="mobile-more-sheet__avatar">
              {user?.user_metadata?.full_name?.charAt(0).toUpperCase() ||
                user?.email?.charAt(0).toUpperCase() ||
                'U'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.user_metadata?.full_name || 'Usuário'}
              </p>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.email}
              </span>
            </div>
            <button
              type="button"
              className="tap-target"
              onClick={() => {
                onClose();
                signOut();
              }}
              title="Sair"
              style={{ color: 'var(--danger)', border: 'none', background: 'transparent', cursor: 'pointer' }}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
