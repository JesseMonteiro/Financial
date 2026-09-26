import React from 'react';
import { Sparkles } from 'lucide-react';
import { useChatbotStore } from '../../stores/chatbotStore';
import { useIsMobile } from '../../hooks/useMediaQuery';

export function ChatbotLauncher() {
  const { openChat, isOpen } = useChatbotStore();
  const isMobile = useIsMobile();

  if (isOpen) return null;

  return (
    <button
      type="button"
      onClick={openChat}
      className="tap-target chatbot-launcher-btn"
      title="Abrir Assistente IA Gemini"
      aria-label="Abrir Assistente IA Gemini"
      style={{
        position: 'fixed',
        right: '1.25rem',
        bottom: isMobile ? '5.5rem' : '1.75rem',
        zIndex: 999,
        width: '52px',
        height: '52px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, var(--primary) 0%, #a855f7 100%)',
        color: '#ffffff',
        border: 'none',
        boxShadow: '0 6px 20px rgba(168, 85, 247, 0.45)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.08)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      <Sparkles size={24} />
    </button>
  );
}
