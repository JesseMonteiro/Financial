import React, { useMemo, useRef, useState } from 'react';
import { Upload, Search, X } from 'lucide-react';
import { Button } from './ui/Button';
import { SavingScope } from './ui/Spinner';
import { AccountIcon } from './AccountIcon';
import {
  ACCOUNT_ICON_CATALOG,
  catalogEntryUrls,
  normalizeIconText,
  validateIconFile,
} from '../utils/accountIcons';

export function IconPicker({
  account,
  connectors = [],
  saving = false,
  onClose,
  onSelectKey,
  onUpload,
}) {
  const [query, setQuery] = useState('');
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const filtered = useMemo(() => {
    const q = normalizeIconText(query);
    const list = ACCOUNT_ICON_CATALOG;
    if (!q) return list;
    return list.filter((entry) => {
      const blob = normalizeIconText(`${entry.label} ${entry.aliases.join(' ')}`);
      return blob.includes(q);
    });
  }, [query]);

  const cards = filtered.filter((e) => e.kind === 'card');
  const banks = filtered.filter((e) => e.kind === 'bank');

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const invalid = validateIconFile(file);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    try {
      await onUpload(file);
    } catch (err) {
      setError(err.message || 'Falha ao enviar imagem.');
    }
  };

  const renderGrid = (entries) => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))',
        gap: '0.5rem',
      }}
    >
      {entries.map((entry) => {
        const selected = account?.iconKey === entry.id && account?.iconSource !== 'upload';
        const preview = {
          iconColor: entry.color,
          type: entry.kind === 'card' ? 'CREDIT' : 'BANK',
        };
        return (
          <button
            key={entry.id}
            type="button"
            disabled={saving}
            onClick={async () => {
              try {
                await onSelectKey(entry.id);
              } catch (err) {
                setError(err.message || 'Falha ao salvar ícone.');
              }
            }}
            title={entry.label}
            style={{
              border: selected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
              background: selected ? 'var(--primary-light)' : 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-md)',
              padding: '0.55rem 0.4rem',
              cursor: saving ? 'not-allowed' : 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.35rem',
              minHeight: 88,
            }}
          >
            <AccountIcon account={preview} src={catalogEntryUrls(entry, connectors)} size={36} />
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                textAlign: 'center',
                lineHeight: 1.2,
                color: 'var(--text-primary)',
              }}
            >
              {entry.label}
            </span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="modal-overlay" onClick={() => { if (!saving) onClose(); }}>
      <SavingScope active={saving} label="Salvando ícone…">
        <div
          className="modal-content"
          onClick={(e) => e.stopPropagation()}
          style={{ maxWidth: 560, maxHeight: '86vh', overflow: 'auto' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
            <div>
              <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, margin: 0 }}>Ícone</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', margin: '0.25rem 0 0' }}>
                {account?.name || 'Conta'} — escolha um banco/cartão ou envie uma imagem.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
              title="Fechar"
            >
              <X size={18} />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
            <div className="filter-bar__search" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.65rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
              <Search size={14} style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar Itaú, Unique, Nubank…"
                style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)' }}
              />
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              hidden
              onChange={handleFile}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={Upload}
              disabled={saving}
              onClick={() => fileRef.current?.click()}
            >
              Enviar
            </Button>
          </div>

          {error && (
            <p style={{ color: 'var(--danger)', fontSize: 'var(--font-size-xs)', marginTop: '0.65rem' }}>{error}</p>
          )}

          {cards.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <h3 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--text-muted)', margin: '0 0 0.5rem' }}>
                CARTÕES
              </h3>
              {renderGrid(cards)}
            </div>
          )}

          {banks.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <h3 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--text-muted)', margin: '0 0 0.5rem' }}>
                BANCOS
              </h3>
              {renderGrid(banks)}
            </div>
          )}

          {filtered.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', textAlign: 'center', padding: '1.25rem 0' }}>
              Nenhum ícone encontrado.
            </p>
          )}
        </div>
      </SavingScope>
    </div>
  );
}
