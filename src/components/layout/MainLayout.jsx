import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { LiquidGlassTabBar } from './LiquidGlassTabBar';
import { PageTransition } from '../motion/PageTransition';
import { ChatbotLauncher } from '../chatbot/ChatbotLauncher';
import { ChatbotModal } from '../chatbot/ChatbotModal';
import { useSettingsStore } from '../../stores/settingsStore';
import { useJointStore } from '../../stores/jointStore';
import { useIsMobile } from '../../hooks/useMediaQuery';

export function MainLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const { initTheme } = useSettingsStore();
  const loadJointStatus = useJointStore((s) => s.loadStatus);
  const isMobile = useIsMobile();

  useEffect(() => {
    initTheme();
  }, [initTheme]);

  useEffect(() => {
    loadJointStatus().catch(console.error);
  }, [loadJointStatus]);

  useEffect(() => {
    if (!isMobile) setMoreOpen(false);
  }, [isMobile]);

  return (
    <div className={`app-container ${isMobile ? 'app-container--mobile' : ''}`}>
      {!isMobile && (
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      )}
      <div className="main-wrapper">
        {!isMobile && <Header isMobile={false} />}
        <main className="content-container">
          <PageTransition />
        </main>
      </div>
      {isMobile && (
        <LiquidGlassTabBar
          moreOpen={moreOpen}
          onMoreOpen={() => setMoreOpen(true)}
          onMoreClose={() => setMoreOpen(false)}
        />
      )}
      <ChatbotLauncher />
      <ChatbotModal />
    </div>
  );
}
