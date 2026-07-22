import React, { useState, useEffect } from 'react';
import { Plug, ShieldCheck, RefreshCw, AlertTriangle, CheckCircle2, Globe, Radio, Trash2, Send, Building2 } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import api, { checkServerHealth, createConnectToken, fetchItems } from '../services/api';

export function ConnectBank() {
  const [health, setHealth] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Webhook State
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookEvent, setWebhookEvent] = useState('all');
  const [activeWebhooks, setActiveWebhooks] = useState([]);
  const [history, setHistory] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  useEffect(() => {
    async function init() {
      const h = await checkServerHealth();
      setHealth(h);
      loadRealItems();
      loadWebhooks();
      loadHistory();
      setLoading(false);
    }
    init();
  }, []);

  const loadRealItems = async () => {
    try {
      const it = await fetchItems();
      if (Array.isArray(it) && it.length > 0) {
        setItems(it);
      } else {
        setItems([]);
      }
    } catch (e) {
      setItems([]);
    }
  };

  const loadWebhooks = async () => {
    try {
      const res = await api.get('/webhooks/list');
      setActiveWebhooks(res.data.results || res.data || []);
    } catch (e) {
      console.warn('Servidor sem chave Pluggy ou lista de webhooks vazia');
    }
  };

  const loadHistory = async () => {
    try {
      const res = await api.get('/webhooks/history');
      setHistory(res.data || []);
    } catch (e) {
      console.warn('Sem histórico de webhooks');
    }
  };

  const handleOpenPluggyWidget = async () => {
    try {
      const data = await createConnectToken();
      if (data.accessToken) {
        if (!window.PluggyConnect) {
          throw new Error('O SDK do Pluggy Connect não foi carregado corretamente. Recarregue a página.');
        }

        const pluggyConnect = new window.PluggyConnect({
          connectToken: data.accessToken,
          includeSandbox: true,
          onSuccess: async (itemData) => {
            console.log('[Pluggy Connect Success]', itemData);
            try {
              // Pluggy Connect may return { item: { id } } or the item object directly
              const itemId =
                itemData?.item?.id ||
                itemData?.id ||
                itemData?.itemId ||
                null;

              if (!itemId) {
                throw new Error('Pluggy Connect não retornou o itemId da conexão.');
              }

              // Registra a nova conexão vinculando-a ao usuário logado no Supabase
              await api.post('/items/register', { itemId });
              await loadRealItems();
            } catch (err) {
              console.error('[ConnectBank] Falha ao registrar itemId no servidor:', err);
              alert('Erro ao registrar a conexão no seu perfil do FinanceHub.');
            }
          },
          onError: (error) => {
            console.error('[Pluggy Connect Error]', error);
          },
          onClose: () => {
            console.log('[Pluggy Connect Closed]');
          }
        });
        pluggyConnect.init();
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRegisterWebhook = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setStatusMsg(null);

    try {
      const res = await api.post('/webhooks/register', {
        url: webhookUrl,
        event: webhookEvent
      });

      setStatusMsg({ type: 'success', text: res.data.message });
      setWebhookUrl('');
      loadWebhooks();
    } catch (err) {
      const errorText = err.response?.data?.message || err.response?.data?.error || err.message;
      setStatusMsg({ type: 'danger', text: errorText });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteWebhook = async (id) => {
    try {
      await api.delete(`/webhooks/${id}`);
      loadWebhooks();
    } catch (err) {
      alert('Erro ao remover webhook');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>Conexões Bancárias & Webhooks</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
          Gerencie suas conexões Open Finance reais e configure webhooks para atualizações em tempo real.
        </p>
      </div>

      {/* Connection Status Banner */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 'var(--radius-md)',
              backgroundColor: health?.pluggyConfigured ? 'var(--success-bg)' : 'var(--warning-bg)',
              color: health?.pluggyConfigured ? 'var(--success)' : 'var(--warning)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {health?.pluggyConfigured ? <ShieldCheck size={24} /> : <AlertTriangle size={24} />}
            </div>
            <div>
              <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>
                {health?.pluggyConfigured ? 'Pluggy.ai Conectado em Produção' : 'Modo de Demonstração Ativo'}
              </h3>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                {health?.pluggyConfigured
                  ? 'O servidor possui credenciais padrão ativas. Você também pode definir suas próprias chaves do Pluggy em Configurações para total isolamento.'
                  : 'Para conectar, defina suas próprias chaves do Pluggy em Configurações, ou configure PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET no .env do servidor.'}
              </p>
            </div>
          </div>

          <Button icon={Plug} onClick={handleOpenPluggyWidget}>
            Conectar Nova Instituição
          </Button>
        </div>
      </Card>

      {/* Registered Institutions List */}
      <Card title={`Instituições Conectadas (${items.length})`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
          {items.map(item => (
            <div key={item.id} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-tertiary)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <CheckCircle2 size={24} style={{ color: 'var(--success)' }} />
                <div>
                  <h4 style={{ fontWeight: 600 }}>{item.connector?.name || 'Banco Santander'} (Open Finance)</h4>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                    ID da Conexão: {item.id} • Status: {item.status || 'UPDATED'}
                  </span>
                </div>
              </div>
              <Badge variant={item.status === 'UPDATED' ? 'success' : 'neutral'}>
                {item.status === 'UPDATED' ? 'Sincronizado' : item.status}
              </Badge>
            </div>
          ))}
        </div>
      </Card>

      {/* Webhook Registration Section */}
      <Card 
        title="Registro de Webhooks (Atualizações em Tempo Real)" 
        subtitle="Receba notificações automáticas quando contas ou transações forem criadas, atualizadas ou excluídas"
      >
        <form onSubmit={handleRegisterWebhook} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
          <div>
            <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
              <Globe size={16} style={{ color: 'var(--primary)' }} /> URL Pública HTTPS do Webhook (Endpoint Não-Localhost)
            </label>
            <input
              type="url"
              placeholder="https://sua-url-publica.ngrok-free.app/api/webhooks"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="input"
              required
            />
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', display: 'block', marginTop: '0.3rem' }}>
              💡 Para desenvolvimento local, execute no terminal: <code>ngrok http 3001</code> e copie o link HTTPS gerado + <code>/api/webhooks</code>.
            </span>
          </div>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>
                Evento a Monitorar
              </label>
              <select
                value={webhookEvent}
                onChange={(e) => setWebhookEvent(e.target.value)}
                className="input"
              >
                <option value="all">Todos os Eventos (Recomendado — "all")</option>
                <option value="item/created">item/created (Nova conta conectada)</option>
                <option value="item/updated">item/updated (Conta atualizada)</option>
                <option value="transactions/created">transactions/created (Nova transação)</option>
                <option value="transactions/updated">transactions/updated (Transação alterada)</option>
                <option value="transactions/deleted">transactions/deleted (Transação removida)</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <Button type="submit" icon={Send} disabled={submitting}>
                {submitting ? 'Registrando...' : 'Registrar Webhook'}
              </Button>
            </div>
          </div>

          {statusMsg && (
            <div style={{
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: statusMsg.type === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)',
              color: statusMsg.type === 'success' ? 'var(--success)' : 'var(--danger)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 500
            }}>
              {statusMsg.text}
            </div>
          )}
        </form>

        {/* Registered Webhooks */}
        <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
          <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Radio size={18} style={{ color: 'var(--primary)' }} /> Webhooks Ativos na Pluggy.ai
          </h4>

          {activeWebhooks.length === 0 ? (
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
              Nenhum webhook registrado ainda. Preencha a URL pública acima e clique em registrar.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {activeWebhooks.map(wh => (
                <div key={wh.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)'
                }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{wh.url}</span>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem' }}>
                      <Badge variant="info">Evento: {wh.event}</Badge>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>ID: {wh.id}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteWebhook(wh.id)}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--danger)' }}
                    title="Remover Webhook"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
