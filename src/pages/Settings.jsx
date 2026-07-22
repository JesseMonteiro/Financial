import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Moon, Sun, Palette, LayoutGrid, Check, MessageSquare } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useSettingsStore } from '../stores/settingsStore';
import { getPluggyCredentials, savePluggyCredentials } from '../services/storage';
import { supabase } from '../services/supabaseClient';
import { generateTelegramLinkToken } from '../services/api';

export function Settings() {
  const { 
    theme, 
    setTheme, 
    density, 
    setDensity, 
    primaryColor, 
    setPrimaryColor,
    animationsEnabled,
    setAnimationsEnabled
  } = useSettingsStore();

  const [telegramLinked, setTelegramLinked] = React.useState(false);
  const [linkToken, setLinkToken] = React.useState('');
  const [loadingToken, setLoadingToken] = React.useState(false);
  const [loadingStatus, setLoadingStatus] = React.useState(true);

  const [pluggyClientId, setPluggyClientId] = useState('');
  const [pluggyClientSecret, setPluggyClientSecret] = useState('');
  const [savingCreds, setSavingCreds] = useState(false);
  const [credsMsg, setCredsMsg] = useState(null);

  useEffect(() => {
    async function loadCreds() {
      const creds = await getPluggyCredentials();
      if (creds) {
        setPluggyClientId(creds.pluggyClientId || '');
        setPluggyClientSecret(creds.pluggyClientSecret || '');
      }
    }
    loadCreds();
  }, []);

  const handleSaveCredentials = async () => {
    setSavingCreds(true);
    setCredsMsg(null);
    try {
      await savePluggyCredentials(pluggyClientId, pluggyClientSecret);
      setCredsMsg({ type: 'success', text: 'Credenciais do Pluggy salvas com sucesso!' });
    } catch (e) {
      setCredsMsg({ type: 'danger', text: 'Erro ao salvar credenciais.' });
    } finally {
      setSavingCreds(false);
    }
  };

  const colors = [
    { name: 'Índigo Violeta', value: '#6366f1' },
    { name: 'Esmeralda', value: '#10b981' },
    { name: 'Azul Oceano', value: '#0ea5e9' },
    { name: 'Púrpura', value: '#8b5cf6' },
    { name: 'Rosa Coral', value: '#f43f5e' },
  ];

  React.useEffect(() => {
    async function checkStatus() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data, error } = await supabase
            .from('profiles')
            .select('telegram_chat_id')
            .eq('id', user.id)
            .single();
          if (data?.telegram_chat_id) {
            setTelegramLinked(true);
          }
        }
      } catch (err) {
        console.error('Erro ao verificar status do Telegram:', err);
      } finally {
        setLoadingStatus(false);
      }
    }
    checkStatus();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>Configurações & Personalização</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
          Customize o visual, temas, cores e comportamento da sua plataforma financeira.
        </p>
      </div>

      {/* Theme Customization */}
      <Card title="Aparência & Tema">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1rem' }}>
          {/* Light / Dark Mode */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h4 style={{ fontWeight: 600 }}>Modo de Cor</h4>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Escolha entre tema escuro ou claro</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button
                variant={theme === 'dark' ? 'primary' : 'outline'}
                icon={Moon}
                onClick={() => setTheme('dark')}
              >
                Escuro
              </Button>
              <Button
                variant={theme === 'light' ? 'primary' : 'outline'}
                icon={Sun}
                onClick={() => setTheme('light')}
              >
                Claro
              </Button>
            </div>
          </div>

          {/* Primary Color Picker */}
          <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
            <h4 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Cor Primária de Destaque</h4>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              {colors.map(c => (
                <button
                  key={c.value}
                  onClick={() => setPrimaryColor(c.value)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    backgroundColor: c.value,
                    border: primaryColor === c.value ? '3px solid var(--text-primary)' : 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff'
                  }}
                  title={c.name}
                >
                  {primaryColor === c.value && <Check size={18} />}
                </button>
              ))}
            </div>
          </div>

          {/* Density Selector */}
          <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h4 style={{ fontWeight: 600 }}>Densidade da Interface</h4>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Espaçamento entre os elementos</p>
            </div>
            <select
              value={density}
              onChange={(e) => setDensity(e.target.value)}
              className="input"
              style={{ width: 'auto' }}
            >
              <option value="compact">Compacto</option>
              <option value="comfortable">Confortável (Padrão)</option>
              <option value="spacious">Espaçoso</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Telegram Chatbot Connection */}
      <Card title="Assistente do Telegram">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
          <div>
            <h4 style={{ fontWeight: 600 }}>Integração com Assistente Inteligente</h4>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Consulte seu saldo, peça extrato ou registre despesas por áudio ou texto usando o Telegram e Inteligência Artificial.
            </p>
          </div>
          
          {loadingStatus ? (
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>Carregando status do assistente...</p>
          ) : telegramLinked ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#10b981' }}></div>
              <div>
                <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>Telegram Conectado!</p>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Seu chatbot está pronto para receber comandos.</p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                style={{ marginLeft: 'auto' }}
                onClick={async () => {
                  if (confirm("Deseja realmente desconectar o Telegram?")) {
                    try {
                      const { data: { user } } = await supabase.auth.getUser();
                      if (user) {
                        const { error } = await supabase
                          .from('profiles')
                          .update({ telegram_chat_id: null })
                          .eq('id', user.id);
                        if (error) throw error;
                        setTelegramLinked(false);
                      }
                    } catch (e) {
                      alert("Erro ao desconectar: " + e.message);
                    }
                  }
                }}
              >
                Desconectar
              </Button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', backgroundColor: 'var(--bg-card-hover)', borderRadius: 'var(--radius-md)' }}>
                <div>
                  <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>Telegram Não Vinculado</p>
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Gere um token de pareamento para ativar o assistente.</p>
                </div>
                <Button
                  variant="primary"
                  onClick={async () => {
                    setLoadingToken(true);
                    try {
                      const token = await generateTelegramLinkToken();
                      setLinkToken(token);
                    } catch (err) {
                      alert(err.message);
                    } finally {
                      setLoadingToken(false);
                    }
                  }}
                  disabled={loadingToken}
                  style={{ marginLeft: 'auto' }}
                >
                  {loadingToken ? 'Gerando...' : 'Gerar Código'}
                </Button>
              </div>
              
              {linkToken && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1.25rem', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-body)' }}>
                  <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>Siga os passos abaixo para conectar:</p>
                  <ol style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingLeft: '1.25rem', margin: 0 }}>
                    <li>Clique no botão abaixo para abrir o chat com o Bot.</li>
                    <li>Clique em <b>Começar</b> ou envie o comando gerado: <code style={{ fontSize: 'var(--font-size-sm)', color: 'var(--primary-color)', backgroundColor: 'rgba(99, 102, 241, 0.1)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace' }}>/start {linkToken}</code></li>
                    <li>Seu Telegram será automaticamente vinculado e você receberá uma confirmação.</li>
                  </ol>
                  <a
                    href={`https://t.me/FinancialJesse_bot?start=${linkToken}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ textDecoration: 'none', marginTop: '0.5rem' }}
                  >
                    <Button variant="primary" style={{ width: '100%', display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center' }} icon={MessageSquare}>
                      Abrir Bot no Telegram
                    </Button>
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Credenciais do Pluggy */}
      <Card title="Credenciais Pluggy.ai (Opcional)" subtitle="Configure suas próprias chaves de desenvolvedor do Pluggy para total isolamento. Se deixado em branco, a aplicação usará a chave padrão compartilhada.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1rem' }}>
          <div>
            <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>
              Pluggy Client ID
            </label>
            <input
              type="text"
              placeholder="b10e0128-..."
              value={pluggyClientId}
              onChange={(e) => setPluggyClientId(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>
              Pluggy Client Secret
            </label>
            <input
              type="password"
              placeholder="Sua senha do Pluggy"
              value={pluggyClientSecret}
              onChange={(e) => setPluggyClientSecret(e.target.value)}
              className="input"
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={handleSaveCredentials} disabled={savingCreds}>
              {savingCreds ? 'Salvando...' : 'Salvar Credenciais'}
            </Button>
          </div>
          {credsMsg && (
            <div style={{
              padding: '0.5rem 0.75rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: credsMsg.type === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)',
              color: credsMsg.type === 'success' ? 'var(--success)' : 'var(--danger)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 500
            }}>
              {credsMsg.text}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
