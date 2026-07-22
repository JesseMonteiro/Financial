import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useSettingsStore } from '../../stores/settingsStore';

export function MainLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { initTheme } = useSettingsStore();

  useEffect(() => {
    initTheme();
  }, [initTheme]);

  return (
    <div className="app-container">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <div className="main-wrapper">
        <Header />
        <main className="content-container animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
