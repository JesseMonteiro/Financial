import React, { useState, useRef, useEffect } from 'react';
import { Bot, Sparkles, Send, X, Trash2, User, RefreshCw } from 'lucide-react';
import { useChatbotStore } from '../../stores/chatbotStore';
import { GlassSurface } from '../ui/GlassSurface';
import { motion, AnimatePresence } from 'framer-motion';

function renderFormattedMessage(text) {
  if (!text) return null;

  const lines = text.split('\n');
  return lines.map((line, idx) => {
    // Processamento simples e seguro de Markdown (negrito **texto**, marcadores • / -)
    const trimmed = line.trim();

    // Linha em branco
    if (!trimmed) {
      return <div key={idx} style={{ height: '0.4rem' }} />;
    }

    // Bullet point
    const isBullet = trimmed.startsWith('•') || trimmed.startsWith('- ') || trimmed.startsWith('* ');
    const content = isBullet ? trimmed.replace(/^([•\-\*]\s*)/, '') : trimmed;

    // Negrito com regex
    const parts = content.split(/(\*\*.*?\*\*)/g);
    const renderedParts = parts.map((part, pIdx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={pIdx} style={{ color: 'var(--text-primary)' }}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });

    if (isBullet) {
      return (
        <div
          key={idx}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.5rem',
            marginLeft: '0.25rem',
            marginBottom: '0.25rem',
          }}
        >
          <span style={{ color: 'var(--primary)', lineHeight: 1.4 }}>•</span>
          <span style={{ flex: 1, lineHeight: 1.45 }}>{renderedParts}</span>
        </div>
      );
    }

    return (
      <p key={idx} style={{ margin: '0 0 0.4rem 0', lineHeight: 1.45 }}>
        {renderedParts}
      </p>
    );
  });
}

export function ChatbotModal() {
  const { isOpen, closeChat, messages, isSending, sendMessage, clearHistory, suggestedPrompts } = useChatbotStore();
  const [draft, setDraft] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isSending, isOpen]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || isSending) return;
    setDraft('');
    sendMessage(text);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="chatbot-backdrop"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.55)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'stretch',
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) closeChat();
        }}
      >
        <motion.div
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          style={{
            width: '100%',
            maxWidth: '480px',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <GlassSurface
            variant="solid"
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderLeft: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)',
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.25rem',
                borderBottom: '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: 'var(--radius-full)',
                    background: 'linear-gradient(135deg, var(--primary) 0%, #a855f7 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    boxShadow: '0 2px 10px rgba(168, 85, 247, 0.35)',
                  }}
                >
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Assistente MeuFlux
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '2px' }}>
                    <span
                      style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        background: '#10b981',
                        display: 'inline-block',
                      }}
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      IA Gemini • Contexto em Tempo Real
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={clearHistory}
                    className="tap-target"
                    title="Limpar conversa"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '0.4rem',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <Trash2 size={18} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeChat}
                  className="tap-target"
                  title="Fechar"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '0.4rem',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Messages Body */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
              }}
            >
              {messages.length === 0 ? (
                <div
                  style={{
                    margin: 'auto 0',
                    textAlign: 'center',
                    padding: '1rem 0.5rem',
                  }}
                >
                  <div
                    style={{
                      width: '64px',
                      height: '64px',
                      margin: '0 auto 1rem',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(168, 85, 247, 0.2) 100%)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--primary)',
                    }}
                  >
                    <Bot size={32} />
                  </div>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.15rem', color: 'var(--text-primary)' }}>
                    Como posso te ajudar hoje?
                  </h4>
                  <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    Tenho acesso aos seus cartões, compras, contas e orçamentos. Faça perguntas diretas ou escolha uma das sugestões abaixo:
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', textAlign: 'left' }}>
                    {suggestedPrompts.map((prompt, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => sendMessage(prompt)}
                        className="tap-target"
                        style={{
                          background: 'var(--bg-tertiary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-lg)',
                          padding: '0.75rem 1rem',
                          color: 'var(--text-primary)',
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.6rem',
                          textAlign: 'left',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <Sparkles size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                        <span style={{ flex: 1 }}>{prompt}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((msg) => {
                    const isUser = msg.role === 'user';
                    return (
                      <div
                        key={msg.id}
                        style={{
                          display: 'flex',
                          flexDirection: isUser ? 'row-reverse' : 'row',
                          alignItems: 'flex-start',
                          gap: '0.6rem',
                        }}
                      >
                        <div
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.75rem',
                            background: isUser ? 'var(--primary)' : 'var(--bg-tertiary)',
                            color: isUser ? '#fff' : 'var(--primary)',
                            border: '1px solid var(--border-color)',
                          }}
                        >
                          {isUser ? <User size={15} /> : <Sparkles size={15} />}
                        </div>

                        <div
                          style={{
                            maxWidth: '82%',
                            padding: '0.75rem 1rem',
                            borderRadius: 'var(--radius-lg)',
                            fontSize: '0.88rem',
                            wordBreak: 'break-word',
                            background: isUser ? 'var(--primary)' : 'var(--bg-tertiary)',
                            color: isUser ? '#ffffff' : 'var(--text-secondary)',
                            border: isUser ? 'none' : '1px solid var(--border-color)',
                            boxShadow: 'var(--shadow-sm)',
                          }}
                        >
                          {renderFormattedMessage(msg.text)}
                        </div>
                      </div>
                    );
                  })}

                  {isSending && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'var(--bg-tertiary)',
                          color: 'var(--primary)',
                          border: '1px solid var(--border-color)',
                        }}
                      >
                        <RefreshCw size={14} className="spin" />
                      </div>
                      <div
                        style={{
                          padding: '0.75rem 1rem',
                          borderRadius: 'var(--radius-lg)',
                          fontSize: '0.85rem',
                          background: 'var(--bg-tertiary)',
                          color: 'var(--text-muted)',
                          border: '1px solid var(--border-color)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                        }}
                      >
                        <span>Analisando suas finanças com Gemini...</span>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input Composer */}
            <form
              onSubmit={handleSubmit}
              style={{
                padding: '1rem',
                borderTop: '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-full)',
                  padding: '0.35rem 0.5rem 0.35rem 1rem',
                }}
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Pergunte sobre seus gastos, faturas, saldo..."
                  disabled={isSending}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                  }}
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || isSending}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: draft.trim() && !isSending ? 'var(--primary)' : 'var(--bg-tertiary)',
                    color: draft.trim() && !isSending ? '#fff' : 'var(--text-muted)',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: draft.trim() && !isSending ? 'pointer' : 'default',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Send size={16} />
                </button>
              </div>
              <div
                style={{
                  fontSize: '0.72rem',
                  color: 'var(--text-muted)',
                  textAlign: 'center',
                  marginTop: '0.4rem',
                }}
              >
                Respostas geradas por IA com base estrita no seu MeuFlux.
              </div>
            </form>
          </GlassSurface>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
