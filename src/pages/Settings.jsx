import React from 'react';
import { Settings as SettingsIcon, Moon, Sun, Palette, LayoutGrid, Check } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useSettingsStore } from '../stores/settingsStore';

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

  const colors = [
    { name: 'Índigo Violeta', value: '#6366f1' },
    { name: 'Esmeralda', value: '#10b981' },
    { name: 'Azul Oceano', value: '#0ea5e9' },
    { name: 'Púrpura', value: '#8b5cf6' },
    { name: 'Rosa Coral', value: '#f43f5e' },
  ];

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
    </div>
  );
}
