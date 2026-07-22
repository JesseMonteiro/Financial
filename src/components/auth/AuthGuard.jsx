import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2, Wallet } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { migrateLocalDataToSupabase } from '../../services/dataMigration';
import { useSettingsStore } from '../../stores/settingsStore';

export function AuthGuard({ children }) {
  const { user, loading } = useAuthStore();
  const loadFromSupabase = useSettingsStore(s => s.loadFromSupabase);

  // Run data migration and load settings when user is authenticated
  useEffect(() => {
    if (user) {
      migrateLocalDataToSupabase().catch(console.error);
      loadFromSupabase().catch(console.error);
    }
  }, [user, loadFromSupabase]);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
        color: '#fff',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <Wallet size={32} color="#6366f1" />
          <h1 style={{ 
            fontSize: '1.75rem', 
            fontWeight: 700, 
            margin: 0,
            background: 'linear-gradient(to right, #818cf8, #c084fc)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            FinanceHub
          </h1>
        </div>
        <Loader2 size={32} className="spinner" style={{ color: '#6366f1', animation: 'spin 1s linear infinite' }} />
        <style>
          {`
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}
        </style>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
